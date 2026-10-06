"""Approve, and an operator's self-approval (M4.5 spec, M4R.2–M4R.3). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.log import history
from code_api.studio.models import Draft
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]
TPM_KEYS = {"tpm-sums-to": 1000000, "tpm-or-count": 0, "twice-as-long": 0, "tpm-of-a": 750000}


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def answered_all(draft: Draft, by: User, wrong: str | None = None) -> None:
    for question_id, key in TPM_KEYS.items():
        given = (key + 1 if key else 1) if question_id == wrong else key
        review.answer(draft, question_id, given, by=by)


def test_a_reviewer_who_answered_everything_approves(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace, wrong="twice-as-long")
    approved = review.approve(draft, revision=2, reason="", by=grace)
    assert approved.state == "approved"
    event = history(draft)[-1]
    assert (event.kind, event.by, event.revision, event.self_approved) == (
        "approved",
        grace,
        2,
        False,
    )
    assert (event.answered, event.wrong) == (4, 1)
    assert event.review is not None and event.review.reviewer == grace


def test_an_authors_own_approval_is_refused(ada: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.approve(draft, revision=2, reason="Mine.", by=ada)


def test_a_reviewer_who_contributed_may_not_approve(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.Contributor):
        review.approve(draft, revision=3, reason="", by=grace)


def test_an_operator_self_approves_only_with_a_reason(otto: User, ready: Ready) -> None:
    draft = review.submit(ready(otto), revision=2, by=otto)
    answered_all(draft, otto)
    with pytest.raises(review.NeedsReason):
        review.approve(draft, revision=2, reason=" ", by=otto)
    review.approve(draft, revision=2, reason="A team of one; reread the next morning.", by=otto)
    event = history(draft)[-1]
    assert (event.self_approved, event.reason) == (True, "A team of one; reread the next morning.")


def test_approval_waits_for_every_answer(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    with pytest.raises(review.Unanswered) as missing:
        review.approve(draft, revision=2, reason="", by=grace)
    assert missing.value.ids == ["tpm-sums-to", "twice-as-long", "tpm-of-a"]


def test_answers_to_an_earlier_submission_do_not_count(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace)
    review.withdraw(draft, by=ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=ada, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.NotSubmittedRevision):
        review.approve(draft, revision=2, reason="", by=grace)
    with pytest.raises(review.Unanswered):
        review.approve(draft, revision=3, reason="", by=grace)


def test_approval_rechecks_the_checklist(ada: User, grace: User, ready: Ready) -> None:
    from code_api.content.models import Provider

    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace)
    Provider.objects.update(licences=[])  # a rebuild dropped the licence the resource uses
    with pytest.raises(review.ChecklistFails):
        review.approve(draft, revision=2, reason="", by=grace)


def test_an_approved_draft_cannot_be_edited_in_place(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace)
    review.approve(draft, revision=2, reason="", by=grace)
    with pytest.raises(drafts.NotOpen):
        drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=ada, change="m")


def test_a_second_approval_finds_it_approved(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace)
    answered_all(draft, otto)
    review.approve(draft, revision=2, reason="", by=grace)
    with pytest.raises(review.WrongState):
        review.approve(draft, revision=2, reason="", by=otto)


def test_a_send_back_and_the_same_revision_resubmitted_needs_fresh_answers(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    # #188: answers given before a send back do not approve the next submission.
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered_all(draft, grace)
    review.approve(draft, revision=2, reason="", by=grace)
    review.send_back(draft, reason="Check the claim again.", by=otto)
    review.submit(draft, revision=2, by=ada)
    with pytest.raises(review.Unanswered):
        review.approve(draft, revision=2, reason="", by=grace)


def test_an_operator_who_contributed_may_reject(otto: User, ready: Ready) -> None:
    draft = review.submit(ready(otto), revision=2, by=otto)
    assert review.reject(draft, revision=2, reason="Not ready.", by=otto).state == "open"
