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


def test_a_send_back_from_review_needs_a_request_or_a_note(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.RoleTooLow):
        review.send_back(draft, revision=2, reason="No.", by=ada)
    with pytest.raises(review.NothingToSendBack):
        review.send_back(draft, revision=2, reason="  ", by=grace)
    back = review.send_back(draft, revision=2, reason="The key of tpm-of-a is wrong.", by=grace)
    assert back.state == "open"
    event = history(draft)[-1]
    assert (event.kind, event.reason) == ("sent_back", "The key of tpm-of-a is wrong.")


def test_a_reviewer_who_contributed_may_not_send_it_back(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    review.submit(draft, revision=3, by=ada)
    with pytest.raises(review.Contributor):
        review.send_back(draft, revision=3, reason="Mine.", by=grace)


def test_a_send_back_from_review_names_the_submitted_revision(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    with pytest.raises(review.NotSubmittedRevision) as wrong:
        review.send_back(draft, revision=1, reason="Old.", by=grace)
    assert wrong.value.submitted == 2
    with pytest.raises(review.NotSubmittedRevision):
        review.send_back(draft, reason="No revision named.", by=grace)


def test_a_send_back_carries_the_requests(ada: User, grace: User, ready: Ready) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[
            review.Given("block/1", "changes", "Say what TPM is not."),
            review.Given("exam/tpm-of-a", "changes", "The key is off by one."),
            review.Given("node", "approved"),
        ],
        by=grace,
    )
    review.send_back(draft, revision=2, reason="", by=grace)
    back = review.sent_back(draft)
    assert back is not None
    assert (back.event.by, back.event.reason) == (grace, "")
    assert [(v.key, v.kind, v.note) for v in back.requests] == [
        ("block/1", "callout", "Say what TPM is not."),
        ("exam/tpm-of-a", "exam", "The key is off by one."),
    ]


def test_requests_come_in_reading_order(ada: User, grace: User, ready: Ready) -> None:
    # The final review: requests were in the order their rows were first written.
    draft = review.submit(ready(ada), revision=2, by=ada)
    for key in ("exam/tpm-of-a", "block/1"):
        review.set_verdicts(
            draft, revision=2, verdicts=[review.Given(key, "changes", f"Fix {key}.")], by=grace
        )
    review.send_back(draft, revision=2, reason="", by=grace)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=ada, change="m")
    back = review.sent_back(draft)
    assert back is not None
    assert [v.key for v in back.requests] == ["block/1", "exam/tpm-of-a"]


def test_requests_go_once_the_draft_is_submitted_again(
    ada: User, grace: User, ready: Ready
) -> None:
    # Review Focus 4.
    draft = review.submit(ready(ada), revision=2, by=ada)
    assert review.sent_back(draft) is None
    review.send_back(draft, revision=2, reason="Shorter, please.", by=grace)
    assert review.sent_back(draft) is not None
    review.submit(draft, revision=2, by=ada)
    assert review.sent_back(draft) is None


def test_an_approved_draft_sent_back_has_a_reason_and_no_requests(
    ada: User, otto: User, ready: Ready
) -> None:
    draft = review.submit(ready(ada), revision=2, by=ada)
    Draft.objects.filter(pk=draft.pk).update(state="approved")
    review.send_back(draft, reason="A typo in the claim.", by=otto)
    back = review.sent_back(draft)
    assert back is not None
    assert (back.event.reason, back.requests) == ("A typo in the claim.", [])


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
    review.send_back(draft, revision=2, reason="Too long.", by=grace)
    review.submit(draft, revision=2, by=ada)
    review.withdraw(draft, by=ada)
    events = history(draft)
    assert [(e.kind, e.by, e.revision) for e in events] == [
        ("opened", ada, 1),
        ("submitted", ada, 2),
        ("sent_back", grace, 2),
        ("submitted", ada, 2),
        ("withdrawn", ada, 2),
    ]
    assert replay(events) == Draft.objects.get(pk=draft.pk).state == "open"


def test_a_request_follows_its_block_through_the_authors_edits(
    ada: User, grace: User, ready: Ready
) -> None:
    from code_schema import Callout
    from code_schema.edits import delete_block, insert_block

    draft = review.submit(ready(ada), revision=2, by=ada)
    review.set_verdicts(
        draft,
        revision=2,
        verdicts=[
            review.Given("block/1", "changes", "Say what TPM is not."),
            review.Given("block/2", "changes", "Drop this."),
        ],
        by=grace,
    )
    review.send_back(draft, revision=2, reason="", by=grace)
    caveat = Callout(kind="caveat", title="Mind the length", markdown="Short ones vary more.\n")
    drafts.save(draft, based_on=2, edit=lambda n: insert_block(n, 1, caveat), by=ada, change="i")
    back = review.sent_back(draft)
    assert back is not None
    assert back.now == {"block/1": "block/2", "block/2": "block/3"}
    drafts.save(draft, based_on=3, edit=lambda n: delete_block(n, 3), by=ada, change="d")
    back = review.sent_back(draft)
    assert back is not None
    # Review Focus 5: a deleted block's request stays, pointing nowhere.
    assert back.now == {"block/1": "block/2", "block/2": None}
