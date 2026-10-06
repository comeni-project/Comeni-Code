"""Review (M4.5 spec, M4R.3–M4R.4): submit, withdraw, reject, approve and send back, and the
reviewer's answers to the node's questions.

Every transition locks the draft row, checks the state it needs, changes it and writes its event
in one transaction (M4R.5), so two people acting at once run one after the other and the second
finds the state moved.
"""

from dataclasses import dataclass
from typing import Literal

from django.db import transaction

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import drafts
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, Review, Revision
from code_schema import ExamQuestion, TryQuestion
from code_schema.grading import is_right

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


# ── The review: the reviewer's answers to the submitted revision's questions (M4R.4) ───────────


class NoSuchQuestion(Exception):
    """The submitted revision asks no question with this id."""


@dataclass(frozen=True)
class Asked:
    id: str
    pool: Literal["try", "exam"]
    question: TryQuestion | ExamQuestion


@dataclass(frozen=True)
class Answered:
    asked: Asked
    given: object | None  # None: not answered yet
    right: bool | None


def asked(draft: Draft) -> list[Asked]:
    """Every question the latest revision asks: its try questions, then its exam pool."""
    node, problems = drafts.node_of(draft)
    if node is None:
        raise drafts.Refused(problems)
    tries: list[Asked] = [Asked(q.id, "try", q) for q in node.questions]
    return tries + [Asked(q.id, "exam", q) for q in node.exam]


def _reviewer(by: User) -> None:
    if not by.can_act_as(Role.REVIEWER):
        raise RoleTooLow()


def _submission(draft: Draft) -> DraftEvent:
    """The submission under review: the draft's latest `submitted` event. A review belongs to
    it, so a revision submitted again is reviewed afresh (#188)."""
    found = draft.events.filter(kind=Kind.SUBMITTED).order_by("-id").first()
    assert found is not None, "a submitted draft has a submitted event"
    return found


def _review(draft: Draft, by: User) -> Review | None:
    return Review.objects.filter(submission=_submission(draft), reviewer=by).first()


def _given(draft: Draft, by: User) -> dict[str, object]:
    found = _review(draft, by)
    return {} if found is None else dict(found.answers)


def _graded(question: Asked, given: object | None) -> Answered:
    if given is None:
        return Answered(question, None, None)
    return Answered(question, given, is_right(question.question.answer, given))


def review_of(draft: Draft, *, by: User) -> list[Answered]:
    """`by`'s answers to the submitted revision; a key is theirs to see only once answered."""
    _reviewer(by)
    now = Draft.objects.get(pk=draft.pk)  # its state now, not when the caller read it (#188)
    _need(now, State.SUBMITTED)
    given = _given(now, by)
    return [_graded(question, given.get(question.id)) for question in asked(now)]


def answer(draft: Draft, question_id: str, given: object, *, by: User) -> Answered:
    """Store or change one answer; what cannot answer the question raises `NotAnAnswer` and
    stores nothing."""
    _reviewer(by)
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED)
        question = next((q for q in asked(locked) if q.id == question_id), None)
        if question is None:
            raise NoSuchQuestion(question_id)
        right = is_right(question.question.answer, given)
        review, _ = Review.objects.get_or_create(
            submission=_submission(locked),
            reviewer=by,
            defaults={"draft": locked, "number": drafts.latest(locked).number},
        )
        review.answers = {**review.answers, question_id: given}
        review.save(update_fields=["answers"])
    return Answered(question, given, right)


# ── Approve (M4R.2, M4R.3) ──────────────────────────────────────────────────────────────────────


class Unanswered(Exception):
    def __init__(self, ids: list[str]) -> None:
        super().__init__(", ".join(ids))
        self.ids = ids


def approve(draft: Draft, *, revision: int, reason: str, by: User) -> Draft:
    """Approve the submitted revision: a judge who answered all its questions, the checklist
    still passing; an operator's own draft only with a reason, marked self-approved."""
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED)
        own = _judge(locked, by)
        current = _submitted(locked, revision)
        why = _reason(reason) if own else reason.strip()
        _passes(locked)
        questions = asked(locked)
        given = _given(locked, by)
        missing = [question.id for question in questions if question.id not in given]
        if missing:
            raise Unanswered(missing)
        wrong = sum(not is_right(q.question.answer, given[q.id]) for q in questions)
        found = _review(locked, by)
        _move(locked, State.APPROVED)
        record(
            locked,
            Kind.APPROVED,
            by=by,
            revision=current.number,
            reason=why,
            self_approved=own,
            review=found,
            answered=len(questions),
            wrong=wrong,
        )
    return locked
