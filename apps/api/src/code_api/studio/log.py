"""A draft's log (M4.5 spec, M4R.5): every transition, append-only, written in the transaction
that changes the state, so replaying a draft's events gives its state."""

from collections.abc import Iterable

from code_api.accounts.models import User
from code_api.studio.models import Draft, DraftEvent, Landing, Review

Kind = DraftEvent.Kind
AFTER: dict[str, str] = {
    Kind.OPENED: Draft.State.OPEN,
    Kind.SUBMITTED: Draft.State.SUBMITTED,
    Kind.WITHDRAWN: Draft.State.OPEN,
    Kind.REJECTED: Draft.State.OPEN,
    Kind.APPROVED: Draft.State.APPROVED,
    Kind.SENT_BACK: Draft.State.OPEN,
    Kind.DISCARDED: Draft.State.DISCARDED,
    Kind.LANDED: Draft.State.LANDED,
    Kind.LANDING: Draft.State.APPROVED,  # it leaves the draft approved; M4.7 moves it on
}


def record(
    draft: Draft,
    kind: str,
    *,
    by: User | None,
    revision: int | None = None,
    reason: str = "",
    self_approved: bool = False,
    review: Review | None = None,
    answered: int | None = None,
    wrong: int | None = None,
    landing: Landing | None = None,
) -> DraftEvent:
    return DraftEvent.objects.create(
        draft=draft,
        kind=kind,
        by=by,
        revision=revision,
        reason=reason,
        self_approved=self_approved,
        review=review,
        answered=answered,
        wrong=wrong,
        landing=landing,
    )


def history(draft: Draft) -> list[DraftEvent]:
    """Oldest first. By id, not time: two events in one transaction share a clock."""
    return list(draft.events.order_by("id").select_related("by"))


def replay(events: Iterable[DraftEvent]) -> str | None:
    state = None
    for event in events:
        state = AFTER[event.kind]
    return state
