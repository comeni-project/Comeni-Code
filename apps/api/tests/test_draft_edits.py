"""The content API's edits (M4.4 spec, M4W.4): each route makes exactly one revision, or none.

Every edit names the revision it was based on; a refused one answers with code-schema's own lines.
Needs Compose's Postgres.
"""

from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import rebuild_index
from code_api.studio.models import Revision

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"

TRY_QUESTION = {
    "id": "edge-count",
    "kind": "number",
    "ask": "How many edges does a 6-base read give a de Bruijn graph of 4-mers?",
    "answer": 3,
    "unit": "",
    "tolerance": None,
    "options": None,
    "hints": ["Count the 4-mers in the read."],
    "rationale": "A read of length L has L − k + 1 k-mers, and each is an edge.",
}
EXAM_QUESTION = {
    "id": "tpm-share",
    "kind": "number",
    "title": "Half the molecules",
    "stem": "If one transcript holds half the molecules in a sample, what is its TPM?\n",
    "answer": 500000,
    "unit": "",
    "tolerance": None,
    "options": None,
    "level": None,
    "rationale": "TPM is a share of a million, so half the molecules is 500,000.",
}


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


@pytest.fixture
def client() -> Client:
    client = Client()
    client.force_login(User.objects.create_user("ada@example.org", role=Role.AUTHOR))
    return client


def opened(client: Client, node_id: str) -> str:
    response = client.post(
        "/api/studio/drafts", {"node_id": node_id}, content_type="application/json"
    )
    assert response.status_code == 201, response.content
    return str(response.json()["public_id"])


def call(client: Client, method: str, url: str, body: dict[str, Any] | None = None) -> Any:
    return getattr(client, method)(url, body or {}, content_type="application/json")


def revisions(draft: str) -> list[str]:
    return list(
        Revision.objects.filter(draft__public_id=draft)
        .order_by("number")
        .values_list("change", flat=True)
    )


def test_fields_are_set_in_one_revision(client: Client) -> None:
    draft = opened(client, "tpm")
    response = call(
        client,
        "patch",
        f"/api/studio/drafts/{draft}/fields",
        {"revision": 1, "title": "TPM, briefly", "level": "foundations"},
    )
    assert response.status_code == 200, response.content
    body = response.json()
    assert (body["draft"]["revision"], body["draft"]["node"]["title"]) == (2, "TPM, briefly")
    assert revisions(draft)[-1] == "set title, level"


def test_a_bad_field_is_refused_with_code_schemas_line(client: Client) -> None:
    draft = opened(client, "tpm")
    response = call(
        client, "patch", f"/api/studio/drafts/{draft}/fields", {"revision": 1, "minutes": 0}
    )
    assert (response.status_code, response.json()["code"]) == (422, "CA0208")
    (problem,) = response.json()["problems"]
    assert problem["text"] == "transcriptomics/tpm/node.yaml:6: minutes: CS0014 0 is not at least 1"
    assert len(revisions(draft)) == 1


def test_a_stale_revision_is_409(client: Client) -> None:
    draft = opened(client, "tpm")
    call(client, "patch", f"/api/studio/drafts/{draft}/fields", {"revision": 1, "minutes": 11})
    response = call(
        client, "patch", f"/api/studio/drafts/{draft}/fields", {"revision": 1, "minutes": 12}
    )
    assert (response.status_code, response.json()["code"]) == (409, "CA0203")
    assert "revision 2" in response.json()["detail"]


def test_a_link_list_is_replaced(client: Client) -> None:
    draft = opened(client, "tpm")
    links = [{"node": "transcripts-and-isoforms", "reason": "TPM is measured per transcript."}]
    response = call(
        client, "put", f"/api/studio/drafts/{draft}/links/needs", {"revision": 1, "links": links}
    )
    assert response.json()["draft"]["node"]["needs"] == links
    assert revisions(draft)[-1] == "replaced the needs links"


def test_a_callout_block_is_inserted(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    block = {
        "kind": "callout",
        "callout": "caveat",
        "title": "Effective length",
        "markdown": "It is shorter.\n",
    }
    response = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/blocks",
        {"revision": 1, "at": 2, "block": block},
    )
    assert response.status_code == 200, response.content
    assert response.json()["draft"]["node"]["blocks"][2] == block
    assert revisions(draft)[-1] == "inserted a callout block at 2"


def test_a_try_block_comes_with_its_question_and_goes_with_it(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    inserted = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/blocks",
        {
            "revision": 1,
            "at": 4,  # after kmers-per-read, block 3 since the fixture's sequence block (M4.8c)
            "block": {"kind": "try", "question": "edge-count"},
            "question": TRY_QUESTION,
        },
    )
    assert inserted.status_code == 200, inserted.content
    ids = [question["id"] for question in inserted.json()["draft"]["node"]["questions"]]
    assert ids == [
        "kmers-per-read",
        "edge-count",
        "shared-unitig",
        "spell-the-path",
        "assembly-order",
    ]
    deleted = call(client, "delete", f"/api/studio/drafts/{draft}/blocks/4?revision=2")
    assert [q["id"] for q in deleted.json()["draft"]["node"]["questions"]] == [
        "kmers-per-read",
        "shared-unitig",
        "spell-the-path",
        "assembly-order",
    ]


def test_a_try_block_without_its_question_is_refused(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    response = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/blocks",
        {"revision": 1, "at": 2, "block": {"kind": "try", "question": "edge-count"}},
    )
    assert (response.status_code, response.json()["code"]) == (422, "CA0205")
    assert len(revisions(draft)) == 1


def test_a_block_moves_and_updates(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    moved = call(
        client, "post", f"/api/studio/drafts/{draft}/blocks/1/move", {"revision": 1, "to": 3}
    )
    assert moved.status_code == 200, moved.content
    text = {"kind": "text", "markdown": "A new lead.\n\n"}
    updated = call(
        client, "put", f"/api/studio/drafts/{draft}/blocks/0", {"revision": 2, "block": text}
    )
    assert updated.json()["draft"]["node"]["blocks"][0] == text
    assert revisions(draft)[1:] == ["moved block 1 to 3", "updated block 0"]


def test_a_position_out_of_range_is_refused(client: Client) -> None:
    draft = opened(client, "tpm")
    response = call(client, "delete", f"/api/studio/drafts/{draft}/blocks/40?revision=1")
    assert (response.status_code, response.json()["code"]) == (422, "CA0205")


def test_resources_are_replaced(client: Client) -> None:
    draft = opened(client, "tpm")
    resource = {
        "kind": "reading",
        "provider": "openstax",
        "url": "https://openstax.org/books/biology-2e/pages/17-1",
        "video": "",
        "part": "",
        "covers": "How sequencing reads are counted per transcript.",
        "licence": "CC BY 4.0",
        "display": "link",
        "level": "foundations",
    }
    response = call(
        client,
        "put",
        f"/api/studio/drafts/{draft}/resources",
        {"revision": 1, "resources": [resource]},
    )
    assert response.json()["draft"]["node"]["resources"] == [resource]


def test_the_exam_pool_is_built_a_question_at_a_time(client: Client) -> None:
    draft = opened(client, "tpm")
    added = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/exam",
        {"revision": 1, "question": EXAM_QUESTION},
    )
    assert added.status_code == 200, added.content
    assert added.json()["draft"]["node"]["exam"][-1]["id"] == "tpm-share"
    changed = EXAM_QUESTION | {"answer": 500001, "tolerance": 1}
    updated = call(
        client,
        "put",
        f"/api/studio/drafts/{draft}/exam/tpm-share",
        {"revision": 2, "question": changed},
    )
    assert updated.json()["draft"]["node"]["exam"][-1]["tolerance"] == 1
    gone = ["tpm-share", "tpm-of-a", "twice-as-long", "tpm-steps", "tpm-unit-name"]
    for revision, question_id in enumerate(gone, start=3):
        response = call(
            client, "delete", f"/api/studio/drafts/{draft}/exam/{question_id}?revision={revision}"
        )
    # Two of TPM's six left (M4.8c): saved, with CS0813's warning.
    assert response.status_code == 200
    assert [warning["code"] for warning in response.json()["warnings"]] == ["CS0813"]


def test_an_unknown_exam_question_is_refused(client: Client) -> None:
    draft = opened(client, "tpm")
    response = call(client, "delete", f"/api/studio/drafts/{draft}/exam/nothing-like-it?revision=1")
    assert (response.status_code, response.json()["code"]) == (422, "CA0205")


def test_a_discarded_draft_takes_no_edits(client: Client) -> None:
    draft = opened(client, "tpm")
    client.post(f"/api/studio/drafts/{draft}/discard")
    response = call(
        client, "patch", f"/api/studio/drafts/{draft}/fields", {"revision": 1, "minutes": 9}
    )
    assert (response.status_code, response.json()["code"]) == (404, "CA0201")


# #174: a save stores what was sent, or nothing.


@pytest.mark.parametrize(
    "block",
    [
        {"kind": "callout", "callout": "caveat", "title": "a\nb", "markdown": "Text.\n"},
        {"kind": "callout", "callout": "caveat", "title": "T", "markdown": "One.\n:::\nTwo.\n"},
    ],
)
def test_a_block_that_would_read_back_differently_is_refused(
    client: Client, block: dict[str, str]
) -> None:
    draft = opened(client, "de-bruijn-graphs")
    response = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/blocks",
        {"revision": 1, "at": 2, "block": block},
    )
    assert (response.status_code, response.json().get("code")) == (422, "CA0210"), response.content
    assert len(revisions(draft)) == 1


def test_an_unknown_block_kind_is_refused(client: Client) -> None:
    draft = opened(client, "tpm")
    block = {"kind": "figure", "markdown": "hi\n"}
    response = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/blocks",
        {"revision": 1, "at": 0, "block": block},
    )
    assert response.status_code == 422
    assert len(revisions(draft)) == 1


def test_an_unknown_answer_kind_is_refused(client: Client) -> None:
    draft = opened(client, "tpm")
    question = EXAM_QUESTION | {"kind": "bogus"}
    response = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": question}
    )
    assert response.status_code == 422
    assert len(revisions(draft)) == 1


def test_a_number_question_without_its_answer_says_so(client: Client) -> None:
    draft = opened(client, "tpm")
    question = EXAM_QUESTION | {"answer": None}
    response = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": question}
    )
    assert (response.status_code, response.json()["code"]) == (422, "CA0205")
    assert "answer" in response.json()["detail"]


def test_a_question_with_a_text_block_is_refused(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    body = {
        "revision": 1,
        "at": 0,
        "block": {"kind": "text", "markdown": "Lead.\n\n"},
        "question": TRY_QUESTION,
    }
    response = call(client, "post", f"/api/studio/drafts/{draft}/blocks", body)
    assert (response.status_code, response.json()["code"]) == (422, "CA0205")


def test_a_member_with_no_role_cannot_edit() -> None:
    nobody = Client()
    nobody.force_login(User.objects.create_user("norole@example.org"))
    response = call(nobody, "post", "/api/studio/drafts", {"node_id": "tpm"})
    assert (response.status_code, response.json()["code"]) == (403, "CA0102")


def test_an_edit_needs_the_csrf_token(client: Client) -> None:
    draft = opened(client, "tpm")
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(User.objects.get(email="ada@example.org"))
    response = call(
        strict, "patch", f"/api/studio/drafts/{draft}/fields", {"revision": 1, "minutes": 9}
    )
    assert response.status_code == 403
    assert len(revisions(draft)) == 1


# M4.8c: the new shapes through every edit (spec M4Q.5).

ORDER = {
    "id": "assembly-steps",
    "title": "Put the assembly steps in order",
    "kind": "order",
    "stem": "Put the steps of de Bruijn assembly in order.\n\n:::{sequence}\nACGTTG\n:::\n",
    "steps": [
        "Cut reads into k-mers",
        "Build the graph",
        "Simplify tips and bubbles",
        "Walk paths",
    ],
    "rationale": "Each step needs the one before.",
}
SEQUENCE = {
    "id": "spell-a-path",
    "title": "Spell the path",
    "claim": "reads a sequence off the graph",
    "kind": "sequence",
    "stem": "Spell the sequence along ACG → CGT → GTT.\n",
    "answer": "ACGTT",
    "accept": [],
    "rationale": "Each edge adds the last letter of its k-mer.",
}


@pytest.mark.parametrize("question", [ORDER, SEQUENCE], ids=["order", "sequence"])
def test_an_exam_question_of_a_new_kind_is_saved(client: Client, question: dict[str, Any]) -> None:
    draft = opened(client, "tpm")
    saved = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": question}
    )
    assert saved.status_code == 200, saved.content
    sent = next(q for q in saved.json()["draft"]["node"]["exam"] if q["id"] == question["id"])
    assert (sent["state"], sent["stem_text"], sent["kind"]) == (
        "draft",
        question["stem"],
        question["kind"],
    )


def test_an_exam_choice_of_two_options_is_refused_in_its_words(client: Client) -> None:
    draft = opened(client, "tpm")
    two = {
        "id": "two-only",
        "title": "Two only",
        "kind": "choice",
        "stem": "Pick one.\n",
        "options": [{"text": "A", "right": True}, {"text": "B", "plain": True}],
        "rationale": "A.",
    }
    refused = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": two}
    )
    assert refused.status_code == 422
    assert [problem["code"] for problem in refused.json()["problems"]] == ["CS0818"]


def test_a_sequence_block_is_inserted_through_the_api(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    saved = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/blocks",
        {"revision": 1, "at": 2, "block": {"kind": "sequence", "letters": "ACGT\n"}},
    )
    assert saved.status_code == 200, saved.content
    assert {"kind": "sequence", "letters": "ACGT\n"} in saved.json()["draft"]["node"]["blocks"]
