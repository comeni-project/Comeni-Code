"""Landing (M4.6 spec, M4L.3–M4L.4): a batch of approved drafts, as one commit and one pull
request on the content repository, opened by the GitHub App.

`start` runs in the request: it checks the batch against the index and queues it. The worker's
steps, the poller and closing follow (`run`, `watch`, `close`). A draft is in at most one live
landing, which Postgres holds, so landings need no lock and run on any worker.
"""

import logging
from dataclasses import dataclass, field
from datetime import timedelta
from uuid import UUID

from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.content.models import IndexBuild
from code_api.studio import drafts
from code_api.studio.github import GitHub, GitHubError, Pull
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
        if client.folder(draft.folder, head) is not None:
            return DROPPED_EXISTS, f"{draft.folder} already exists on main."
        return None
    start = _starting_commit(draft)
    if not start:
        return DROPPED_NO_COMMIT, "the index this draft started from records no commit."
    # The folder's tree at both commits: equal means nothing under it changed. Not compare, which
    # lists at most 300 files (#203).
    if client.folder(draft.folder, start) != client.folder(draft.folder, head):
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
    """A landing that will not land: its drafts are free."""
    with transaction.atomic():
        made.state, made.reason = state, reason
        made.save(update_fields=["state", "reason", "main_head"])
        made.entries.filter(live=True).update(live=False)
    return made


def _ours(made: Landing) -> Landing | None:
    """The landing, locked, if it is still pending under this run's claim; None if the poller's
    recovery took it over meanwhile (the final review: a slow worker and recovery never both act).
    Call inside a transaction."""
    locked = Landing.objects.select_for_update().get(pk=made.pk)
    if locked.state != Landing.State.PENDING or locked.claimed_at != made.claimed_at:
        return None
    return locked


def _opened(made: Landing, pull: Pull, state: str, reason: str = "") -> Landing | None:
    """The pull request exists: the landing holds its drafts, and each draft's log says so. None,
    writing nothing, if the landing is no longer this run's."""
    with transaction.atomic():
        if _ours(made) is None:
            return None
        made.pull_number, made.pull_url = pull.number, pull.url
        made.state, made.reason = state, reason
        made.save()
        for entry in made.entries.filter(live=True).select_related("draft"):
            record(
                entry.draft,
                DraftEvent.Kind.LANDING,
                by=made.started_by,
                revision=entry.revision,
                landing=made,
            )
    return made


STUCK_AFTER = timedelta(minutes=10)  # a claimed landing this old was interrupted
log = logging.getLogger(__name__)


def _said(error: Exception) -> str:
    if isinstance(error, GitHubError):
        return str(error)
    return f"Studio stopped mid-landing ({type(error).__name__}: {error})."


def refuse_unconfigured(made: Landing) -> Landing:
    """A worker without the app's settings cannot land: say so rather than leave it pending."""
    with transaction.atomic():
        locked = Landing.objects.select_for_update().get(pk=made.pk)
        if locked.state != Landing.State.PENDING:
            return locked
        reason = "Landing is not configured on the worker: the GitHub App's settings are not set."
        return _end(locked, Landing.State.REFUSED, reason)


def run(made: Landing, client: GitHub) -> Landing:
    """The worker's steps (#203). A short transaction claims the landing and names its branch;
    GitHub's calls run outside any transaction; every failure ends the landing in words. A
    landing claimed long ago was interrupted (a killed worker), and is recovered, not landed
    twice; one claimed moments ago belongs to the worker running it."""
    with transaction.atomic():
        locked = Landing.objects.select_for_update().get(pk=made.pk)
        if locked.state != Landing.State.PENDING:
            return locked
        claimed = locked.claimed_at
        if claimed is None:
            locked.branch = f"studio/landing-{locked.public_id.hex[:8]}"
            locked.claimed_at = timezone.now()
            locked.save(update_fields=["branch", "claimed_at"])
    if claimed is not None:
        if timezone.now() - claimed < STUCK_AFTER:
            return locked
        return _recover(locked, client, "Studio stopped mid-landing; it was found unfinished.")
    try:
        return _land(locked, client)
    except Exception as error:
        if not isinstance(error, GitHubError):
            log.exception("landing %s stopped", locked.public_id)
        return _recover(locked, client, _said(error))


def _recover(made: Landing, client: GitHub, reason: str) -> Landing:
    """After a failure: a pull request that exists holds its drafts (failed, for an operator to
    close); otherwise its branch, if any, is deleted and the landing refused. If GitHub cannot
    say, the landing stays pending and the poller asks again."""
    with transaction.atomic():
        locked = _ours(made)
        if locked is None:
            return Landing.objects.get(pk=made.pk)
        locked.claimed_at = timezone.now()  # a new claim: a late worker finds it gone
        locked.save(update_fields=["claimed_at"])
    made.claimed_at = locked.claimed_at
    try:
        pull = client.find_pull(made.branch)
        if pull is not None:
            return _opened(made, pull, Landing.State.FAILED, reason) or made
        try:
            client.delete_branch(made.branch)
        except GitHubError as error:
            if error.status not in (404, 422):  # no such branch: nothing was left behind
                raise
    except GitHubError:
        log.warning("landing %s could not be recovered yet", made.public_id)
        return made
    return _end(made, Landing.State.REFUSED, reason)


def _land(made: Landing, client: GitHub) -> Landing:
    head = client.head()
    made.main_head = head
    made.save(update_fields=["main_head"])
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
    with transaction.atomic():
        if _ours(made) is None:  # recovered while this worker was slow: write nothing
            return Landing.objects.get(pk=made.pk)
    client.branch(made.branch, sha)
    pull = client.open_pull(branch=made.branch, title=message, body=provenance(made, kept))
    if _opened(made, pull, Landing.State.OPEN) is None:
        # Recovered while this worker was slow: what it opened is not the landing's.
        try:
            client.close_pull(pull.number)
            client.delete_branch(made.branch)
        except GitHubError:
            log.warning("landing %s: could not close pull request %s", made.public_id, pull.number)
        return Landing.objects.get(pk=made.pk)
    try:
        client.auto_merge(pull)
    except GitHubError as error:
        # The pull request exists without auto-merge: failed, holding its drafts, until closed.
        made.state, made.reason = Landing.State.FAILED, str(error)
        made.save(update_fields=["state", "reason"])
        return made
    made.auto_merge = True
    made.save(update_fields=["auto_merge"])
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
        elif locked.auto_merge:
            locked.state, locked.reason = Landing.State.OPEN, ""
        elif locked.state == Landing.State.FAILED:
            return locked  # no auto-merge: it stays failed until an operator closes it (#203)
        else:
            # Open without auto-merge (a worker stopped between the two): it would never merge.
            reason = "Auto-merge is not on for this pull request."
            locked.state, locked.reason = Landing.State.FAILED, reason
        locked.save(update_fields=["state", "reason"])
        return locked


def close(made: Landing, client: GitHub) -> Landing:
    """An operator closes a failed landing: its pull request and branch go, its drafts are free.
    Its pull request is read first: one that merged since the last poll is recorded as merged and
    keeps its drafts (the final review)."""
    merged = False
    with transaction.atomic():
        locked = Landing.objects.select_for_update().get(pk=made.pk)
        if locked.state != Landing.State.FAILED:
            raise NotFailed(locked.state)
        assert locked.pull_number is not None
        found = client.pull_state(locked.pull_number)
        if found.merged:
            locked.state, locked.reason = Landing.State.MERGED, ""
            locked.save(update_fields=["state", "reason"])
            merged = True
        else:
            if not found.closed:
                client.close_pull(locked.pull_number)
            try:
                client.delete_branch(locked.branch)
            except GitHubError as error:
                if error.status not in (404, 422):  # already gone
                    raise
            _end(locked, Landing.State.CLOSED, locked.reason)
    if merged:
        raise NotFailed(Landing.State.MERGED)
    return locked
