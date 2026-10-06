"""Review (M4.5 spec, M4R.3–M4R.4): submit, withdraw, reject, approve and send back, and the
reviewer's answers to the node's questions.

Every transition locks the draft row, checks the state it needs, changes it and writes its event
in one transaction (M4R.5), so two people acting at once run one after the other and the second
finds the state moved.
"""

from django.db import transaction

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import drafts
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Revision

State = Draft.State
Kind = DraftEvent.Kind


class WrongState(Exception):
    def __init__(self, state: str, needs: tuple[str, ...]) -> None:
        super().__init__(state)
        self.state = state
        self.needs = needs


class ChecklistFails(Exception):
    def __init__(self, items: list[drafts.Item]) -> None:
        super().__init__(", ".join(item.rule for item in items))
        self.items = items


class RoleTooLow(Exception):
    """The step needs a higher role than the caller's (M4.3's CA0102)."""


class Contributor(Exception):
    """Nobody approves or rejects a draft they contributed to, unless an operator (M4R.2)."""


class NeedsReason(Exception):
    """A rejection, a send back and a self-approval each need a reason."""


class NotSubmittedRevision(Exception):
    def __init__(self, submitted: int) -> None:
        super().__init__(submitted)
        self.submitted = submitted


def _locked(draft: Draft) -> Draft:
    return Draft.objects.select_for_update().get(pk=draft.pk)


def _need(draft: Draft, *states: str) -> None:
    if draft.state not in states:
        raise WrongState(draft.state, states)


def _reason(reason: str) -> str:
    if not reason.strip():
        raise NeedsReason()
    return reason.strip()


def _judge(draft: Draft, by: User) -> bool:
    """Whether `by` may approve or reject: a reviewer or above who did not contribute, or an
    operator. True when it is an operator judging their own draft (self-approval)."""
    if not by.can_act_as(Role.REVIEWER):
        raise RoleTooLow()
    own = by in drafts.contributors(draft)
    if own and not by.can_act_as(Role.OPERATOR):
        raise Contributor()
    return own


def _submitted(draft: Draft, revision: int) -> Revision:
    """The submitted revision, which the call must name (M4R.3)."""
    current = drafts.latest(draft)
    if current.number != revision:
        raise NotSubmittedRevision(current.number)
    return current


def _passes(draft: Draft) -> None:
    failed = [item for item in drafts.checklist(draft) if not item.passed]
    if failed:
        raise ChecklistFails(failed)


def _move(draft: Draft, state: str) -> None:
    draft.state = state
    draft.save(update_fields=["state"])


def submit(draft: Draft, *, revision: int, by: User) -> Draft:
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.OPEN)
        current = drafts.latest(locked)
        if current.number != revision:
            raise drafts.Stale(current)
        _passes(locked)
        _move(locked, State.SUBMITTED)
        record(locked, Kind.SUBMITTED, by=by, revision=current.number)
    return locked


def withdraw(draft: Draft, *, by: User) -> Draft:
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED)
        if not by.can_act_as(Role.OPERATOR) and by not in drafts.contributors(locked):
            raise drafts.NotAllowed()
        _move(locked, State.OPEN)
        record(locked, Kind.WITHDRAWN, by=by, revision=drafts.latest(locked).number)
    return locked


def reject(draft: Draft, *, revision: int, reason: str, by: User) -> Draft:
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED)
        _judge(locked, by)
        current = _submitted(locked, revision)
        why = _reason(reason)
        _move(locked, State.OPEN)
        record(locked, Kind.REJECTED, by=by, revision=current.number, reason=why)
    return locked


def send_back(draft: Draft, *, reason: str, by: User) -> Draft:
    if not by.can_act_as(Role.OPERATOR):
        raise RoleTooLow()
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.APPROVED)
        why = _reason(reason)
        _move(locked, State.OPEN)
        record(locked, Kind.SENT_BACK, by=by, revision=drafts.latest(locked).number, reason=why)
    return locked
