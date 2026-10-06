"""Landing (M4.6 spec, M4L.3–M4L.4): a batch of approved drafts, as one commit and one pull
request on the content repository, opened by the GitHub App.

`start` runs in the request: it checks the batch against the index and queues it. The worker's
steps, the poller and closing follow (`run`, `watch`, `close`). A draft is in at most one live
landing, which Postgres holds, so landings need no lock and run on any worker.
"""

from dataclasses import dataclass, field
from uuid import UUID

from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.db import IntegrityError, transaction

from code_api.accounts.models import User
from code_api.content.models import IndexBuild
from code_api.studio import drafts
from code_api.studio.github import GitHub, GitHubError
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Landing, LandingDraft
from code_schema import Problem
from code_schema.exam import EXAM_FILE
from code_schema.node import BODY_FILE, NODE_FILE


class NotConfigured(Exception):
    """The GitHub App's settings are not set (M4L.4)."""


class EmptyBatch(Exception):
    pass


class NoSuchDraft(Exception):
    def __init__(self, public_id: UUID) -> None:
        super().__init__(public_id)
        self.public_id = public_id


class NotApproved(Exception):
    def __init__(self, draft: Draft) -> None:
        super().__init__(draft.node_id)
        self.draft = draft


class AlreadyLanding(Exception):
    def __init__(self, draft: Draft, landing: Landing) -> None:
        super().__init__(draft.node_id)
        self.draft = draft
        self.landing = landing


@dataclass
class BatchFails(Exception):
    problems: list[Problem] = field(default_factory=list)


def live_landing(draft: Draft) -> Landing | None:
    entry = LandingDraft.objects.filter(draft=draft, live=True).select_related("landing").first()
    return None if entry is None else entry.landing


def start(public_ids: list[UUID], *, by: User) -> Landing:
    if settings.CODE_GITHUB_APP is None:
        raise NotConfigured()
    if not public_ids:
        raise EmptyBatch()
    batch: list[Draft] = []
    for public_id in dict.fromkeys(public_ids):  # once each, in the order asked
        found = Draft.objects.filter(public_id=public_id).first()
        if found is None:
            raise NoSuchDraft(public_id)
        batch.append(found)
    for draft in batch:
        if draft.state != Draft.State.APPROVED:
            raise NotApproved(draft)
        held = live_landing(draft)
        if held is not None:
            raise AlreadyLanding(draft, held)
    errors = [problem for problem in drafts.in_place(batch) if problem.refuses]
    if errors:
        raise BatchFails(errors)
    try:
        with transaction.atomic():
            made = Landing.objects.create(started_by=by)
            for draft in batch:
                locked = Draft.objects.select_for_update().get(pk=draft.pk)
                if locked.state != Draft.State.APPROVED:  # sent back since it was read
                    raise NotApproved(locked)
                LandingDraft.objects.create(
                    landing=made, draft=locked, revision=drafts.latest(locked).number
                )
            transaction.on_commit(lambda: _queue(made))
    except IntegrityError:
        # Another landing took one of these drafts between the check and the insert.
        for draft in batch:
            held = live_landing(draft)
            if held is not None:
                raise AlreadyLanding(draft, held) from None
        raise
    return made


def _queue(made: Landing) -> None:
    from code_api.studio import tasks  # the tasks module imports this one

    tasks.land.delay(str(made.public_id))


DROPPED_CHANGED = "CA0306"
DROPPED_EXISTS = "CA0307"
DROPPED_NO_COMMIT = "CA0308"
GITHUB_FAILED = "CA0311"


def person(user: User | None) -> str:
    """How a pull request names someone (M4L.4): `@login` where a GitHub account is linked,
    else the display name. Never an email: the content repository is public."""
    if user is None:
        return "a former member"
    account = SocialAccount.objects.filter(user=user, provider="github").first()
    login = None if account is None else account.extra_data.get("login")
    if login:
        return f"@{login}"
    return user.name.strip() or "a team member"


def _starting_commit(draft: Draft) -> str:
    build = (
        IndexBuild.objects.filter(digest=draft.base_digest, outcome=IndexBuild.Outcome.APPLIED)
        .exclude(commit="")
        .order_by("-id")
        .first()
    )
    return "" if build is None else build.commit


def _drop(entry: LandingDraft, code: str, reason: str) -> None:
    entry.live, entry.dropped_code, entry.dropped_reason = False, code, reason
    entry.save(update_fields=["live", "dropped_code", "dropped_reason"])


def _stale(entry: LandingDraft, head: str, client: GitHub) -> tuple[str, str] | None:
    """Why this draft must not land on `head`, or None (M4L.3)."""
    draft = entry.draft
    if not draft.base_digest:  # a new node
        if client.exists(draft.folder, head):
            return DROPPED_EXISTS, f"{draft.folder} already exists on main."
        return None
    start = _starting_commit(draft)
    if not start:
        return DROPPED_NO_COMMIT, "the index this draft started from records no commit."
    prefix = f"{draft.folder}/"
    if any(path.startswith(prefix) for path in client.changed(start, head)):
        return DROPPED_CHANGED, f"{draft.node_id} changed on main since this draft was opened."
    return None


def _files(entry: LandingDraft, head: str, client: GitHub) -> dict[str, str | None]:
    revision = entry.draft.revisions.get(number=entry.revision)
    folder = entry.draft.folder
    files: dict[str, str | None] = {
        f"{folder}/{NODE_FILE}": revision.node_yaml,
        f"{folder}/{BODY_FILE}": revision.body_md,
    }
    if revision.exam_yaml:
        files[f"{folder}/{EXAM_FILE}"] = revision.exam_yaml
    elif client.exists(f"{folder}/{EXAM_FILE}", head):
        files[f"{folder}/{EXAM_FILE}"] = None  # the pool was removed
    return files


def _approval(draft: Draft) -> DraftEvent:
    found = draft.events.filter(kind=DraftEvent.Kind.APPROVED).order_by("-id").first()
    assert found is not None  # only approved drafts enter a landing
    return found


def provenance(made: Landing, entries: list[LandingDraft]) -> str:
    """The pull request's body (M4L.4, W9): who stands behind each node, then the marker."""
    lines = [
        f"Landed from Comeni Code's Studio by {person(made.started_by)}.",
        "Each node below was drafted and reviewed in Studio (W9).",
        "",
    ]
    for entry in entries:
        draft = entry.draft
        node, _ = drafts.node_of(draft, draft.revisions.get(number=entry.revision))
        title = draft.node_id if node is None else node.title
        approval = _approval(draft)
        drafted = ", ".join(person(user) for user in drafts.contributors(draft)) or "nobody"
        lines += [
            f"### {draft.node_id} — {title} ({'new' if not draft.base_digest else 'changed'})",
            "",
            f"- Drafted by {drafted}",
            f"- Approved by {person(approval.by)}, at revision {approval.revision}",
        ]
        if approval.answered is not None:
            lines.append(
                f"- Review: {approval.answered} questions answered, {approval.wrong or 0} wrong"
            )
        if approval.self_approved:
            lines.append(f"- **Self-approved**: {approval.reason}")
        lines.append("")
    lines.append(f"<!-- comeni-studio landing {made.public_id} -->")
    return "\n".join(lines) + "\n"


def _end(made: Landing, state: str, reason: str) -> Landing:
    made.state, made.reason = state, reason
    made.save(update_fields=["state", "reason", "main_head"])
    made.entries.filter(live=True).update(live=False)
    return made


def run(made: Landing, client: GitHub) -> Landing:
    """The worker's steps. Holds the landing's row, so a redelivered task finds it no longer
    pending and does nothing; GitHub's calls are few and bounded by their timeouts."""
    with transaction.atomic():
        locked = Landing.objects.select_for_update().get(pk=made.pk)
        if locked.state != Landing.State.PENDING:
            return locked
        try:
            return _land(locked, client)
        except GitHubError as error:
            return _end(locked, Landing.State.REFUSED, str(error))


def _land(made: Landing, client: GitHub) -> Landing:
    head = client.head()
    made.main_head = head
    entries = list(made.entries.select_related("draft").order_by("draft__node_id"))
    for entry in entries:
        why = _stale(entry, head, client)
        if why is not None:
            _drop(entry, *why)
    kept = [entry for entry in entries if entry.live]
    if not kept:
        return _end(made, Landing.State.REFUSED, "Nothing landed: every draft was dropped.")
    files: dict[str, str | None] = {}
    for entry in kept:
        files.update(_files(entry, head, client))
    ids = ", ".join(entry.draft.node_id for entry in kept)
    noun = "node" if len(kept) == 1 else "nodes"
    message = f"content: land {len(kept)} {noun} ({ids})"
    sha = client.commit(parent=head, files=files, message=message)
    made.branch = f"studio/landing-{made.public_id.hex[:8]}"
    client.branch(made.branch, sha)
    pull = client.open_pull(branch=made.branch, title=message, body=provenance(made, kept))
    made.pull_number, made.pull_url = pull.number, pull.url
    made.state = Landing.State.OPEN
    made.save()
    try:
        client.auto_merge(pull)
    except GitHubError as error:
        # The pull request exists: the landing is failed, holding its drafts, until it is closed.
        made.state, made.reason = Landing.State.FAILED, str(error)
        made.save(update_fields=["state", "reason"])
    for entry in kept:
        record(
            entry.draft,
            DraftEvent.Kind.LANDING,
            by=made.started_by,
            revision=entry.revision,
            landing=made,
        )
    return made


class NotFailed(Exception):
    def __init__(self, state: str) -> None:
        super().__init__(state)
        self.state = state


def watch(made: Landing, client: GitHub) -> Landing:
    """The poller's step for one landing (M4L.4): merged, failed, open again, or closed."""
    with transaction.atomic():
        locked = Landing.objects.select_for_update().get(pk=made.pk)
        if locked.state not in (Landing.State.OPEN, Landing.State.FAILED):
            return locked
        assert locked.pull_number is not None
        try:
            found = client.pull_state(locked.pull_number)
        except GitHubError:
            return locked  # GitHub is down; the next round asks again
        if found.merged:
            locked.state, locked.reason = Landing.State.MERGED, ""
        elif found.closed:
            return _end(locked, Landing.State.CLOSED, "The pull request was closed on GitHub.")
        elif found.conflict:
            locked.state, locked.reason = (
                Landing.State.FAILED,
                "The pull request conflicts with main.",
            )
        elif found.failed:
            name, link = found.failed[0]
            locked.state, locked.reason = Landing.State.FAILED, f"{name} failed: {link}"
        else:
            locked.state, locked.reason = Landing.State.OPEN, ""
        locked.save(update_fields=["state", "reason"])
        return locked


def close(made: Landing, client: GitHub) -> Landing:
    """An operator closes a failed landing: its pull request and branch go, its drafts are free."""
    with transaction.atomic():
        locked = Landing.objects.select_for_update().get(pk=made.pk)
        if locked.state != Landing.State.FAILED:
            raise NotFailed(locked.state)
        assert locked.pull_number is not None
        client.close_pull(locked.pull_number)
        client.delete_branch(locked.branch)
        return _end(locked, Landing.State.CLOSED, locked.reason)
