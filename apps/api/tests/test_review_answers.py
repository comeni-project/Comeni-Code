"""The review and the reviewer's answers (M4.5 spec, M4R.4). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft
from code_schema.edits import set_fields
from code_schema.grading import NotAnAnswer

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def test_a_review_lists_every_question_with_nothing_answered(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    answered = review.review_of(draft, by=grace)
    assert [(a.asked.id, a.asked.pool, a.given, a.right) for a in answered] == [
        ("tpm-sums-to", "exam", None, None),
        ("tpm-or-count", "exam", None, None),
        ("twice-as-long", "exam", None, None),
        ("tpm-of-a", "exam", None, None),
    ]


def test_an_answer_is_stored_graded_and_may_change(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    assert review.answer(draft, "tpm-or-count", 1, by=grace).right is False
    assert review.answer(draft, "tpm-or-count", 0, by=grace).right is True
    assert review.answer(draft, "tpm-of-a", 750000.5, by=grace).right is True
    stored = {a.asked.id: (a.given, a.right) for a in review.review_of(draft, by=grace)}
    assert stored["tpm-or-count"] == (0, True)
    assert stored["tpm-of-a"] == (750000.5, True)
    assert stored["tpm-sums-to"] == (None, None)


def test_each_reviewer_has_their_own_review(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    assert all(a.given is None for a in review.review_of(draft, by=otto))


def test_an_answer_that_cannot_answer_is_refused_and_not_stored(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(NotAnAnswer):
        review.answer(draft, "tpm-or-count", True, by=grace)
    with pytest.raises(NotAnAnswer):
        review.answer(draft, "tpm-or-count", 7, by=grace)
    assert all(a.given is None for a in review.review_of(draft, by=grace))


def test_a_question_the_revision_lacks_is_refused(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NoSuchQuestion):
        review.answer(draft, "no-such-question", 0, by=grace)


def test_only_a_reviewer_reviews_and_only_while_submitted(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = ready(ada)
    with pytest.raises(review.WrongState):
        review.answer(draft, "tpm-or-count", 0, by=grace)
    review.submit(draft, revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.review_of(draft, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.answer(draft, "tpm-or-count", 0, by=ada)


def test_a_resubmission_starts_a_fresh_review(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    review.withdraw(draft, by=ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=ada, change="m")
    review.submit(draft, revision=3, by=ada)
    assert all(a.given is None for a in review.review_of(draft, by=grace))


def test_a_node_that_no_longer_reads_is_refused_not_a_500(
    ada: User, grace: User, ready: Ready
) -> None:
    from code_api.content.models import Provider

    draft = review.submit(ready(ada), revision=2, by=ada)
    Provider.objects.update(licences=[])
    with pytest.raises(drafts.Refused):
        review.review_of(draft, by=grace)


def test_submitting_the_same_revision_again_starts_a_fresh_review(
    ada: User, grace: User, ready: Ready
) -> None:
    # #188: a review belongs to a submission, not to a revision number.
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.answer(draft, "tpm-or-count", 0, by=grace)
    review.reject(draft, revision=2, reason="The key of tpm-of-a is wrong.", by=grace)
    review.submit(draft, revision=2, by=ada)
    assert all(a.given is None for a in review.review_of(draft, by=grace))


def test_the_review_reads_the_drafts_state_now(ada: User, grace: User, ready: Ready) -> None:
    # #188: an object read while submitted, then withdrawn, is not reviewed on its stale state.
    draft = review.submit(ready(ada), revision=2, by=ada)
    stale = Draft.objects.get(pk=draft.pk)
    review.withdraw(draft, by=ada)
    with pytest.raises(review.WrongState):
        review.review_of(stale, by=grace)


def test_answering_or_submitting_a_node_that_no_longer_reads_is_refused(
    ada: User, grace: User, ready: Ready
) -> None:
    from code_api.content.models import Provider

    draft = ready(ada)
    review.submit(draft, revision=2, by=ada)
    review.withdraw(draft, by=ada)
    Provider.objects.update(licences=[])
    with pytest.raises(review.ChecklistFails):
        review.submit(draft, revision=2, by=ada)
    Draft.objects.filter(pk=draft.pk).update(state="submitted")
    with pytest.raises(drafts.Refused):
        review.answer(draft, "tpm-or-count", 0, by=grace)
