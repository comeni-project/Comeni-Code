"""Review's transitions (M4.5 spec, M4R.3). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path

import pytest

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, review
from code_api.studio.log import history, replay
from code_api.studio.models import Draft
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def test_submitting_freezes_the_draft(ada: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    assert draft.state == "submitted"
    with pytest.raises(drafts.NotOpen):
        drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=ada, change="m")


def test_submitting_needs_the_checklist(ada: User) -> None:
    draft = drafts.open_existing("tpm", by=ada)  # no resource yet
    with pytest.raises(review.ChecklistFails) as failed:
        review.submit(draft, revision=1, by=ada)
    assert [item.rule for item in failed.value.items] == ["a resource"]


def test_submitting_names_the_latest_revision(ada: User, ready: Ready) -> None:
    with pytest.raises(drafts.Stale):
        review.submit(ready(ada), revision=1, by=ada)


def test_withdrawing_reopens_it_for_a_contributor_or_an_operator(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(drafts.NotAllowed):
        review.withdraw(draft, by=grace)
    assert review.withdraw(draft, by=ada).state == "open"
    review.submit(draft, revision=2, by=ada)
    assert review.withdraw(draft, by=otto).state == "open"


def test_a_rejection_needs_a_reason_and_a_reviewer_who_did_not_contribute(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.reject(draft, revision=2, reason="No.", by=ada)
    with pytest.raises(review.NeedsReason):
        review.reject(draft, revision=2, reason="  ", by=grace)
    rejected = review.reject(draft, revision=2, reason="The key of tpm-of-a is wrong.", by=grace)
    assert rejected.state == "open"
    assert history(draft)[-1].reason == "The key of tpm-of-a is wrong."


def test_a_reviewer_who_contributed_may_not_reject(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.Contributor):
        review.reject(draft, revision=3, reason="Mine.", by=grace)


def test_a_rejection_names_the_submitted_revision(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotSubmittedRevision) as wrong:
        review.reject(draft, revision=1, reason="Old.", by=grace)
    assert wrong.value.submitted == 2


def test_only_an_open_draft_is_submitted(ada: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.WrongState) as wrong:
        review.submit(draft, revision=2, by=ada)
    assert wrong.value.state == "submitted"


def test_sending_back_is_an_operators_with_a_reason(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    Draft.objects.filter(pk=draft.pk).update(state="approved")  # approve is Task 5's
    with pytest.raises(review.RoleTooLow):
        review.send_back(draft, reason="Wait.", by=grace)
    with pytest.raises(review.NeedsReason):
        review.send_back(draft, reason="", by=otto)
    assert review.send_back(draft, reason="A typo in the claim.", by=otto).state == "open"


def test_the_log_reads_back_in_order_and_replays_to_the_state(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.reject(draft, revision=2, reason="Too long.", by=grace)
    review.submit(draft, revision=2, by=ada)
    review.withdraw(draft, by=ada)
    events = history(draft)
    assert [(e.kind, e.by, e.revision) for e in events] == [
        ("opened", ada, 1),
        ("submitted", ada, 2),
        ("rejected", grace, 2),
        ("submitted", ada, 2),
        ("withdrawn", ada, 2),
    ]
    assert replay(events) == Draft.objects.get(pk=draft.pk).state == "open"
