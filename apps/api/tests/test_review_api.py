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
TPM_KEYS: dict[str, object] = {
    "tpm-sums-to": 1000000,
    "tpm-or-count": 0,
    "twice-as-long": 0,
    "tpm-of-a": 750000,
    "tpm-steps": [
        "Count the reads on each transcript",
        "Divide each count by the transcript's effective length",
        "Add up the rates across the sample",
        "Scale each rate so the rates add up to a million",
    ],
    "tpm-unit-name": "Transcripts per million",
}


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


TPM_REVIEW_KEYS = [
    "node",
    "block/0",
    "block/1",
    "block/2",
    "resource/0",
    *(f"exam/{question_id}" for question_id in TPM_KEYS),
]


def items(draft: Draft, by: User) -> list[dict[str, Any]]:
    response = call(by, "get", at(draft, "/review"))
    assert response.status_code == 200, response.content
    found: list[dict[str, Any]] = response.json()["items"]
    return found


def question(draft: Draft, by: User, question_id: str) -> dict[str, Any]:
    return next(i["question"] for i in items(draft, by) if i["key"] == f"exam/{question_id}")


def verdicts(draft: Draft, by: User, given: list[dict[str, Any]], revision: int = 2) -> Any:
    return call(by, "put", at(draft, "/review/verdicts"), {"revision": revision, "verdicts": given})


def approve_every_key(draft: Draft, by: User) -> None:
    response = verdicts(draft, by, [{"key": k, "verdict": "approved"} for k in TPM_REVIEW_KEYS])
    assert response.status_code == 200, response.content


def test_the_whole_walk_through_the_api(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    sent = call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert (sent.json()["state"], sent.json()["submitted_revision"]) == ("submitted", 2)
    unanswered = [i["question"] for i in items(draft, grace) if i["question"]]
    hidden = ("right_option", "value", "tolerance", "rationale")
    assert all(q[key] is None for q in unanswered for key in hidden)  # #188: no key unanswered
    assert unanswered[1] == {
        "id": "tpm-or-count",
        "pool": "exam",
        "kind": "choice",
        "ask": "What does a transcript's TPM tell you?",
        "stem": [{"kind": "text", "markdown": "What does a transcript's TPM tell you?\n"}],
        "options": [
            "Its share of the transcript molecules in the sample",
            "How many reads mapped to it",
            "How long the transcript is",
        ],
        "unit": "",
        "steps": None,
        "hints": [],
        "given": None,
        "right": None,
        "right_option": None,
        "right_steps": None,
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
    approve_every_key(draft, grace)
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
        6,
        0,
        False,
    )
    assert events[-1]["blocks"] == 11


def test_send_back_from_review_withdraw_and_send_back(
    ada: User, grace: User, otto: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    body = {"revision": 2, "reason": "Too long."}
    assert call(grace, "post", at(draft, "/send-back"), body).json()["state"] == "open"
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert call(ada, "post", at(draft, "/withdraw")).json()["state"] == "open"
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    answer_all(draft, grace)
    approve_every_key(draft, grace)
    call(grace, "post", at(draft, "/approve"), {"revision": 2})
    back = call(otto, "post", at(draft, "/send-back"), {"reason": "A typo in the claim."})
    assert (back.json()["state"], back.json()["submitted_revision"]) == ("open", None)
    kinds = [e["kind"] for e in call(ada, "get", at(draft, "/events")).json()]
    assert kinds[-1] == "sent_back"


def test_an_operator_self_approves_with_a_reason(otto: User, ready: Ready) -> None:
    draft = submitted(otto, ready)
    answer_all(draft, otto)
    approve_every_key(draft, otto)
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


def test_an_order_shows_its_written_steps_once_answered(
    ada: User, grace: User, ready: Ready
) -> None:
    """#264: as a choice shows its right option once answered, an order shows its key."""
    draft = ready(ada)
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    steps = TPM_KEYS["tpm-steps"]
    assert isinstance(steps, list)
    before = question(draft, grace, "tpm-steps")
    assert before["right_steps"] is None
    given = list(reversed(steps))
    after = call(grace, "put", at(draft, "/review/answers/tpm-steps"), {"given": given}).json()
    assert (after["right"], after["right_steps"]) == (False, steps)


def test_a_reviewer_who_contributed_is_ca0213(ada: User, grace: User, ready: Ready) -> None:
    draft = ready(ada)
    drafts.save(draft, based_on=2, edit=lambda n: set_fields(n, minutes=9), by=grace, change="m")
    call(ada, "post", at(draft, "/submit"), {"revision": 3})
    answer_all(draft, grace)
    given = [{"key": "node", "verdict": "approved"}]
    assert code_of(verdicts(draft, grace, given, revision=3)) == (403, "CA0213")
    assert code_of(call(grace, "post", at(draft, "/approve"), {"revision": 3})) == (403, "CA0213")


def test_a_send_back_from_review_with_nothing_to_say_is_ca0223(
    ada: User, grace: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    response = call(grace, "post", at(draft, "/send-back"), {"revision": 2, "reason": " "})
    assert code_of(response) == (422, "CA0223")


def test_sending_back_an_approval_without_a_reason_is_ca0214(
    ada: User, otto: User, ready: Ready
) -> None:
    draft = submitted(ada, ready)
    Draft.objects.filter(pk=draft.pk).update(state="approved")
    assert code_of(call(otto, "post", at(draft, "/send-back"), {"reason": ""})) == (422, "CA0214")


def test_approving_with_keys_not_approved_is_ca0222(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    answer_all(draft, grace)
    verdicts(draft, grace, [{"key": k, "verdict": "approved"} for k in TPM_REVIEW_KEYS[2:]])
    response = call(grace, "post", at(draft, "/approve"), {"revision": 2})
    assert code_of(response) == (422, "CA0222")
    assert "node, block/0" in response.json()["detail"]


def test_a_key_the_revision_lacks_is_ca0219(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "block/9", "verdict": "approved"}])
    assert code_of(response) == (404, "CA0219")
    assert "block/9" in response.json()["detail"]


def test_approving_a_question_not_answered_is_ca0220(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "exam/tpm-of-a", "verdict": "approved"}])
    assert code_of(response) == (422, "CA0220")
    assert "exam/tpm-of-a" in response.json()["detail"]


def test_changes_without_a_note_is_ca0221(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "node", "verdict": "changes", "note": ""}])
    assert code_of(response) == (422, "CA0221")


def test_the_review_carries_each_keys_content(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    shown = {i["key"]: i for i in items(draft, grace)}
    assert list(shown) == TPM_REVIEW_KEYS
    assert shown["node"]["fields"]["title"] == "What TPM measures"
    assert shown["block/1"]["block"]["kind"] == "callout"
    assert shown["resource/0"]["resource"]["provider"] == "openstax"
    assert shown["exam/tpm-of-a"]["question"]["value"] is None  # hidden until answered
    assert all(i["verdict"] is None and i["note"] == "" for i in shown.values())


def test_verdicts_come_back_with_the_review(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    response = verdicts(draft, grace, [{"key": "block/0", "verdict": "changes", "note": "Long."}])
    assert response.status_code == 200, response.content
    item = next(i for i in response.json()["items"] if i["key"] == "block/0")
    assert (item["verdict"], item["note"]) == ("changes", "Long.")
    cleared = verdicts(draft, grace, [{"key": "block/0", "verdict": None}])
    assert next(i for i in cleared.json()["items"] if i["key"] == "block/0")["verdict"] is None


def test_the_author_reads_the_requests_on_the_draft(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    verdicts(
        draft,
        grace,
        [
            {"key": "block/1", "verdict": "changes", "note": "Say what TPM is not."},
            {"key": "exam/tpm-of-a", "verdict": "changes", "note": "The key is off by one."},
        ],
    )
    call(grace, "post", at(draft, "/send-back"), {"revision": 2, "reason": "Two small things."})
    requests = call(ada, "get", at(draft)).json()["requests"]
    assert (requests["by"]["email"], requests["reason"]) == (
        "grace@example.org",
        "Two small things.",
    )
    assert [(r["key"], r["kind"], r["note"]) for r in requests["items"]] == [
        ("block/1", "callout", "Say what TPM is not."),
        ("exam/tpm-of-a", "exam", "The key is off by one."),
    ]
    call(ada, "post", at(draft, "/submit"), {"revision": 2})
    assert call(ada, "get", at(draft)).json()["requests"] is None


def test_approving_another_revision_is_ca0216(ada: User, grace: User, ready: Ready) -> None:
    draft = submitted(ada, ready)
    answer_all(draft, grace)
    approve_every_key(draft, grace)
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
    assert all(i["question"]["given"] is None for i in items(draft, grace) if i["question"])


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
    assert "tpm already has a draft (submitted)," in response.json()["detail"]


def test_ca0202_names_an_open_draft_in_good_english(ada: User) -> None:
    # #189: "already has a open draft" regressed in #188's fix.
    drafts.open_existing("tpm", by=ada)
    response = call(ada, "post", "/api/studio/drafts", {"node_id": "tpm"})
    assert "tpm already has a draft (open)," in response.json()["detail"]
