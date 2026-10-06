"""Review through the API (M4.5 spec, M4R.6). Needs Compose's Postgres."""

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.models import Draft
from code_schema.edits import set_fields

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
Ready = Callable[[User], Draft]
TPM_KEYS = {"tpm-sums-to": 1000000, "tpm-or-count": 0, "twice-as-long": 0, "tpm-of-a": 750000}


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


def as_(user: User) -> Client:
    client = Client()
    client.force_login(user)
    return client


def call(user: User, method: str, url: str, body: dict[str, Any] | None = None) -> Any:
    client = as_(user)
    if method == "get":
        return client.get(url)
    return getattr(client, method)(url, body or {}, content_type="application/json")


def at(draft: Draft, path: str = "") -> str:
    return f"/api/studio/drafts/{draft.public_id}{path}"


def submitted(ada: User, ready: Ready) -> Draft:
    draft = ready(ada)
    response = call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert response.status_code == 200, response.content
    return draft


def answer_all(draft: Draft, by: User, skip: tuple[str, ...] = ()) -> None:
    for question_id, key in TPM_KEYS.items():
        if question_id not in skip:
            response = call(by, "put", at(draft, f"/review/answers/{question_id}"), {"given": key})
            assert response.status_code == 200, response.content


def code_of(response: Any) -> tuple[int, str]:
    return response.status_code, response.json()["code"]


def test_the_whole_walk_through_the_api(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    sent = call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert (sent.json()["state"], sent.json()["submitted_revision"]) == ("submitted", 2)
    unanswered = call(grace, "get", at(draft, "/review")).json()
    assert unanswered[1] == {
        "id": "tpm-or-count",
        "pool": "exam",
        "kind": "choice",
        "ask": "What does a transcript's TPM tell you?",
        "options": [
            "Its share of the transcript molecules in the sample",
            "How many reads mapped to it",
            "How long the transcript is",
        ],
        "unit": "",
        "given": None,
        "right": None,
        "right_option": None,
        "value": None,
        "tolerance": None,
        "rationale": None,
    }
    graded = call(grace, "put", at(draft, "/review/answers/tpm-or-count"), {"given": 1}).json()
    assert (graded["given"], graded["right"], graded["right_option"]) == (1, False, 0)
    assert graded["rationale"].startswith("TPM divides each transcript's reads")
    number = call(grace, "put", at(draft, "/review/answers/tpm-of-a"), {"given": 750000}).json()
    assert (number["right"], number["value"], number["tolerance"], number["unit"]) == (
        True,
        750000,
        1,
        "TPM",
    )
    answer_all(draft, grace)
    approved = call(grace, "post", at(draft, "/approve"), {"revision": 2})
    assert approved.status_code == 200, approved.content
    assert (approved.json()["state"], approved.json()["submitted_revision"]) == ("approved", 2)
    events = call(ada, "get", at(draft, "/events")).json()
    assert [(e["kind"], e["by"]["email"], e["revision"]) for e in events] == [
        ("opened", "ada@example.org", 1),
        ("submitted", "ada@example.org", 2),
        ("approved", "grace@example.org", 2),
    ]
    assert (events[-1]["answered"], events[-1]["wrong"], events[-1]["self_approved"]) == (
        4,
        0,
        False,
    )


def test_reject_and_withdraw_and_send_back(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    rejected = call(grace, "post", at(draft, "/reject"), {"revision": 2, "reason": "Too long."})
    assert rejected.json()["state"] == "open"
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert call(ada, "post", at(draft, "/withdraw")).json()["state"] == "open"
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    answer_all(draft, grace)
    call(grace, "post", at(draft, "/approve"), {"revision": 2})
    back = call(otto, "post", at(draft, "/send-back"), {"reason": "A typo in the claim."})
    assert (back.json()["state"], back.json()["submitted_revision"]) == ("open", None)
    kinds = [e["kind"] for e in call(ada, "get", at(draft, "/events")).json()]
    assert kinds[-1] == "sent_back"


def test_an_operator_self_approves_with_a_reason(otto: User, ready: Ready) -> None:
    draft = submitted(otto, ready)
    answer_all(draft, otto)
    assert code_of(call(otto, "post", at(draft, "/approve"), {"revision": 2})) == (422, "CA0214")
    done = call(otto, "post", at(draft, "/approve"), {"revision": 2, "reason": "Team of one."})
    assert done.status_code == 200, done.content
    event = call(otto, "get", at(draft, "/events")).json()[-1]
    assert (event["self_approved"], event["reason"]) == (True, "Team of one.")


def test_approving_an_open_draft_is_ca0211(grace: User, ada: User, ready: Ready) -> None:
    draft = ready(ada)
    response = call(grace, "post", at(draft, "/approve"), {"revision": 2})
    assert code_of(response) == (409, "CA0211")
    assert "open" in response.json()["detail"]


def test_submitting_without_a_resource_is_ca0212(ada: User) -> None:
    draft = drafts.open_existing("tpm", by=ada)
    response = call(ada, "post", at(draft, "/submit"), {"revision": 1})
    assert code_of(response) == (422, "CA0212")
    assert [item["rule"] for item in response.json()["items"]] == ["a resource"]


def test_a_reviewer_who_contributed_is_ca0213(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    call(ada, "post", at(draft, "/submit"), {"revision": 3})
    answer_all(draft, grace)
    assert code_of(call(grace, "post", at(draft, "/approve"), {"revision": 3})) == (403, "CA0213")


def test_a_rejection_without_a_reason_is_ca0214(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = call(grace, "post", at(draft, "/reject"), {"revision": 2, "reason": ""})
    assert code_of(response) == (422, "CA0214")


def test_approving_with_questions_unanswered_is_ca0215(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    answer_all(draft, grace, skip=("twice-as-long", "tpm-of-a"))
    response = call(grace, "post", at(draft, "/approve"), {"revision": 2})
    assert code_of(response) == (422, "CA0215")
    assert "twice-as-long, tpm-of-a" in response.json()["detail"]


def test_approving_another_revision_is_ca0216(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    answer_all(draft, grace)
    assert code_of(call(grace, "post", at(draft, "/approve"), {"revision": 1})) == (409, "CA0216")


def test_answering_a_question_not_asked_is_ca0217(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = call(grace, "put", at(draft, "/review/answers/no-such-question"), {"given": 0})
    assert code_of(response) == (404, "CA0217")


@pytest.mark.parametrize("given", [True, "0", 1.0, None])
def test_an_answer_of_the_wrong_kind_is_ca0218_and_not_stored(
    ada: User, grace: User, ready: Ready, given: object
) -> None:
    draft = submitted(ada, ready)
    response = call(grace, "put", at(draft, "/review/answers/tpm-or-count"), {"given": given})
    assert code_of(response) == (422, "CA0218")
    assert all(q["given"] is None for q in call(grace, "get", at(draft, "/review")).json())


def test_an_author_approving_is_ca0102(ada: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    assert code_of(call(ada, "post", at(draft, "/approve"), {"revision": 2})) == (403, "CA0102")
    assert code_of(call(ada, "get", at(draft, "/review"))) == (403, "CA0102")


def test_withdrawing_someone_elses_draft_is_ca0206(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    assert code_of(call(grace, "post", at(draft, "/withdraw"))) == (403, "CA0206")


def test_submitting_a_stale_revision_is_ca0203(ada: User, ready: Ready) -> None:
    draft = ready(ada)
    assert code_of(call(ada, "post", at(draft, "/submit"), {"revision": 1})) == (409, "CA0203")


def test_the_review_of_a_node_that_no_longer_reads_is_ca0208(
    ada: User, grace: User, ready: Ready
) -> None:
    from code_api.content.models import Provider

    draft = submitted(ada, ready)
    Provider.objects.update(licences=[])
    assert code_of(call(grace, "get", at(draft, "/review"))) == (422, "CA0208")


def test_an_edit_or_a_discard_on_a_submitted_draft_is_ca0211(ada: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    edit = call(ada, "patch", at(draft, "/fields"), {"revision": 2, "minutes": 9})
    assert code_of(edit) == (409, "CA0211")
    assert "submitted" in edit.json()["detail"]
    assert code_of(call(ada, "post", at(draft, "/discard"))) == (409, "CA0211")


def test_verify_and_the_checklist_answer_for_a_submitted_draft(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    assert call(grace, "get", at(draft, "/verify")).json()["clean"] is True
    assert call(grace, "get", at(draft, "/checklist")).json()["passed"] is True


def test_the_list_filters_by_state(ada: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    other = drafts.open_existing("salmon", by=ada)
    listed = call(ada, "get", "/api/studio/drafts?state=submitted").json()
    assert [d["public_id"] for d in listed] == [str(draft.public_id)]
    assert [d["public_id"] for d in call(ada, "get", "/api/studio/drafts").json()] == [
        str(other.public_id)
    ]


def test_opening_a_node_under_review_is_ca0202(ada: User, ready: Ready) -> None:
    submitted(ada, ready)
    response = call(ada, "post", "/api/studio/drafts", {"node_id": "tpm"})
    assert code_of(response) == (409, "CA0202")
    assert "already has a submitted draft" in response.json()["detail"]
