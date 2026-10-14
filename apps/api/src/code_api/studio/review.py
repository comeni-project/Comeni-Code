"""Review (M4.5 spec, M4R.3–M4R.4): submit, withdraw, reject, approve and send back, and the
reviewer's answers to the node's questions.

Every transition locks the draft row, checks the state it needs, changes it and writes its event
in one transaction (M4R.5), so two people acting at once run one after the other and the second
finds the state moved.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from django.db import transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import drafts
from code_api.studio.keys import Key, review_keys
from code_api.studio.landing import AlreadyLanding
from code_api.studio.log import record
from code_api.studio.models import Draft, DraftEvent, LandingDraft, Review, Revision, Verdict
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
        held = LandingDraft.objects.filter(draft=locked, live=True).select_related("landing")
        entry = held.first()
        if entry is not None:
            raise AlreadyLanding(locked, entry.landing)
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


def keys_of(draft: Draft) -> list[Key]:
    """The latest revision's review keys, in reading order (M4.9a spec, M4V.1)."""
    node, problems = drafts.node_of(draft)
    if node is None:
        raise drafts.Refused(problems)
    return review_keys(node)


def _question(key: Key) -> Asked | None:
    if isinstance(key.content, TryQuestion):
        return Asked(key.content.id, "try", key.content)
    if isinstance(key.content, ExamQuestion):
        return Asked(key.content.id, "exam", key.content)
    return None


def asked(draft: Draft) -> list[Asked]:
    """Every question the latest revision asks, in reading order: its try blocks, then its pool."""
    return [question for key in keys_of(draft) if (question := _question(key)) is not None]


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


def _review_for(draft: Draft, by: User) -> Review:
    """`by`'s review of the submission, started if it has none."""
    found, _ = Review.objects.get_or_create(
        submission=_submission(draft),
        reviewer=by,
        defaults={"draft": draft, "number": drafts.latest(draft).number},
    )
    return found


def _verdicts(found: Review | None) -> dict[str, Verdict]:
    return {} if found is None else {verdict.key: verdict for verdict in found.verdicts.all()}


def _given(draft: Draft, by: User) -> dict[str, object]:
    found = _review(draft, by)
    return {} if found is None else dict(found.answers)


def _graded(question: Asked, given: object | None) -> Answered:
    if given is None:
        return Answered(question, None, None)
    return Answered(question, given, is_right(question.question.answer, given))


@dataclass(frozen=True)
class Reviewed:
    """One key of a review: its verdict and note, and a question's answer (M4V.4)."""

    key: Key
    verdict: str | None
    note: str
    answered: Answered | None  # None unless the key is a question


@dataclass(frozen=True)
class Sheet:
    revision: int
    items: list[Reviewed]


def _sheet(draft: Draft, by: User) -> Sheet:
    """Read under the caller's row lock, so a resubmission cannot land between the parts (#189)."""
    found = _review(draft, by)
    given = {} if found is None else dict(found.answers)
    verdicts = _verdicts(found)
    items = []
    for key in keys_of(draft):
        question = _question(key)
        verdict = verdicts.get(key.key)
        items.append(
            Reviewed(
                key=key,
                verdict=None if verdict is None else verdict.verdict,
                note="" if verdict is None else verdict.note,
                answered=None if question is None else _graded(question, given.get(question.id)),
            )
        )
    return Sheet(drafts.latest(draft).number, items)


def review_of(draft: Draft, *, by: User) -> Sheet:
    """`by`'s review of the submitted revision; a key is theirs to see only once answered."""
    _reviewer(by)
    with transaction.atomic():
        now = _locked(draft)  # its state now, not the caller's copy (#188)
        _need(now, State.SUBMITTED)
        return _sheet(now, by)


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
        review = _review_for(locked, by)
        review.answers = {**review.answers, question_id: given}
        review.save(update_fields=["answers"])
    return Answered(question, given, right)


# ── Verdicts (M4.9a spec, M4V.2) ────────────────────────────────────────────────────────────────


class Keyed(Exception):
    """A refusal naming review keys."""

    def __init__(self, keys: list[str]) -> None:
        super().__init__(", ".join(keys))
        self.keys = keys


class NoSuchKey(Keyed):
    """Keys the submitted revision does not have (CA0219)."""


class NotAnswered(Keyed):
    """Questions approved before this reviewer answered them (CA0220)."""


class NeedsNote(Keyed):
    """`changes` verdicts without a note (CA0221)."""


def _refuse(error: type[Keyed], keys: list[str]) -> None:
    if keys:
        raise error(keys)


@dataclass(frozen=True)
class Given:
    key: str
    verdict: Literal["approved", "changes"] | None  # None clears it
    note: str = ""


def set_verdicts(draft: Draft, *, revision: int, verdicts: Sequence[Given], by: User) -> Sheet:
    """Set, change or clear verdicts on the submitted revision, all or nothing, in order."""
    with transaction.atomic():
        locked = _locked(draft)
        _need(locked, State.SUBMITTED)
        _judge(locked, by)
        _submitted(locked, revision)
        keys = {key.key: key for key in keys_of(locked)}
        _refuse(NoSuchKey, [g.key for g in verdicts if g.key not in keys])
        given = _given(locked, by)
        _refuse(
            NotAnswered,
            [
                g.key
                for g in verdicts
                if g.verdict == "approved"
                and (question := _question(keys[g.key])) is not None
                and question.id not in given
            ],
        )
        _refuse(
            NeedsNote,
            [g.key for g in verdicts if g.verdict == "changes" and not g.note.strip()],
        )
        found = _review_for(locked, by)
        for g in verdicts:
            if g.verdict is None:
                Verdict.objects.filter(review=found, key=g.key).delete()
                continue
            Verdict.objects.update_or_create(
                review=found,
                key=g.key,
                defaults={
                    "kind": keys[g.key].kind,
                    "verdict": g.verdict,
                    "note": g.note.strip() if g.verdict == "changes" else "",
                    "at": timezone.now(),
                },
            )
        return _sheet(locked, by)


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
