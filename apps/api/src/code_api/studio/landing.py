"""Landing (M4.6 spec, M4L.3–M4L.4): a batch of approved drafts, as one commit and one pull
request on the content repository, opened by the GitHub App.

`start` runs in the request: it checks the batch against the index and queues it. The worker's
steps, the poller and closing follow (`run`, `watch`, `close`). A draft is in at most one live
landing, which Postgres holds, so landings need no lock and run on any worker.
"""

from dataclasses import dataclass, field
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError, transaction

from code_api.accounts.models import User
from code_api.studio import drafts
from code_api.studio.github import GitHub
from code_api.studio.models import Draft, Landing, LandingDraft
from code_schema import Problem


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


def run(made: Landing, client: GitHub) -> Landing:
    raise NotImplementedError("Task 5")
