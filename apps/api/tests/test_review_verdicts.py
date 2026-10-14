"""Verdicts per block (M4.9a spec, M4V.2). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.models import Draft, Verdict
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]
TPM_REVIEW = [
    ("node", "node"),
    ("block/0", "text"),
    ("block/1", "callout"),
    ("block/2", "text"),
    ("resource/0", "resource"),
    ("exam/tpm-sums-to", "exam"),
    ("exam/tpm-or-count", "exam"),
    ("exam/twice-as-long", "exam"),
    ("exam/tpm-of-a", "exam"),
    ("exam/tpm-steps", "exam"),
    ("exam/tpm-unit-name", "exam"),
]
Given = review.Given


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def shown(sheet: review.Sheet) -> dict[str, tuple[str | None, str]]:
    return {item.key.key: (item.verdict, item.note) for item in sheet.items}


def test_a_review_lists_every_key_in_reading_order(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    sheet = review.review_of(draft, by=grace)
    assert sheet.revision == 2
    assert [(i.key.key, i.key.kind) for i in sheet.items] == TPM_REVIEW
    assert all(i.verdict is None and i.note == "" for i in sheet.items)
    assert [i.answered is not None for i in sheet.items] == [False] * 5 + [True] * 6


def test_verdicts_are_set_as_a_list_and_read_back(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    sheet = review.set_verdicts(
        draft,
        revision=2,
        verdicts=[
            Given("node", "approved"),
            Given("block/1", "changes", "  Say what TPM is not. "),
        ],
        by=grace,
    )
    assert shown(sheet)["node"] == ("approved", "")
    assert shown(sheet)["block/1"] == ("changes", "Say what TPM is not.")
    assert shown(review.review_of(draft, by=grace)) == shown(sheet)
    stored = Verdict.objects.get(key="block/1")
    assert (stored.kind, stored.review.reviewer) == ("callout", grace)


def test_a_question_is_approved_only_once_answered(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotAnswered) as unanswered:
        review.set_verdicts(
            draft,
            revision=2,
            verdicts=[Given("node", "approved"), Given("exam/tpm-or-count", "approved")],
            by=grace,
        )
    assert unanswered.value.keys == ["exam/tpm-or-count"]
    assert not Verdict.objects.exists()  # all or nothing
    review.set_verdicts(
        draft, revision=2, verdicts=[Given("exam/tpm-or-count", "changes", "Ambiguous.")], by=grace
    )
    review.answer(draft, "tpm-or-count", 1, by=grace)  # wrong: counts, never blocks
    sheet = review.set_verdicts(
        draft, revision=2, verdicts=[Given("exam/tpm-or-count", "approved")], by=grace
    )
    assert shown(sheet)["exam/tpm-or-count"] == ("approved", "")


def test_changes_needs_a_note(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NeedsNote) as noteless:
        review.set_verdicts(
            draft, revision=2, verdicts=[Given("block/0", "changes", "   ")], by=grace
        )
    assert noteless.value.keys == ["block/0"]
    assert not Verdict.objects.exists()


def test_an_unknown_key_refuses_the_whole_list(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NoSuchKey) as unknown:
        review.set_verdicts(
            draft,
            revision=2,
            verdicts=[Given("node", "approved"), Given("block/9", "approved")],
            by=grace,
        )
    assert unknown.value.keys == ["block/9"]
    assert not Verdict.objects.exists()


def test_a_verdict_is_changed_and_cleared(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft, revision=2, verdicts=[Given("node", "changes", "Shorter.")], by=grace
    )
    review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=grace)
    assert shown(review.review_of(draft, by=grace))["node"] == ("approved", "")
    review.set_verdicts(draft, revision=2, verdicts=[Given("node", None)], by=grace)
    assert shown(review.review_of(draft, by=grace))["node"] == (None, "")
    # Review Focus 2: clearing what was never given does nothing.
    review.set_verdicts(draft, revision=2, verdicts=[Given("block/2", None)], by=grace)
    assert not Verdict.objects.exists()


def test_the_same_key_twice_keeps_the_last(ada: User, grace: User, ready: Ready) -> None:
    # Review Focus 1.
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[Given("node", "approved"), Given("node", "changes", "Second thoughts.")],
        by=grace,
    )
    assert [(v.key, v.verdict) for v in Verdict.objects.all()] == [("node", "changes")]


def test_who_may_give_verdicts(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=ada)
    review.withdraw(draft, by=ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.Contributor):
        review.set_verdicts(draft, revision=3, verdicts=[Given("node", "approved")], by=grace)


def test_an_operator_gives_verdicts_on_their_own_draft(otto: User, ready: Ready) -> None:
    draft = review.submit(ready(otto), revision=2, by=otto)
    sheet = review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=otto)
    assert shown(sheet)["node"] == ("approved", "")


def test_verdicts_name_the_submitted_revision(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotSubmittedRevision):
        review.set_verdicts(draft, revision=1, verdicts=[Given("node", "approved")], by=grace)
    review.withdraw(draft, by=ada)
    with pytest.raises(review.WrongState):
        review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=grace)


def test_a_resubmission_starts_with_no_verdicts(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(draft, revision=2, verdicts=[Given("node", "approved")], by=grace)
    review.withdraw(draft, by=ada)
    review.submit(draft, revision=2, by=ada)
    assert shown(review.review_of(draft, by=grace))["node"] == (None, "")
