"""Verify against the graph, and M4's checklist (M4.4 spec, M4W.5). Needs Compose's Postgres.

The last test is #122's own check: a new node built only through the API writes files that
`code-schema validate` accepts beside the content it joins.
"""

import shutil
from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import rebuild_index
from code_schema import read_content

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


@pytest.fixture
def client() -> Client:
    client = Client()
    client.force_login(User.objects.create_user("ada@example.org", role=Role.AUTHOR))
    return client


def call(client: Client, method: str, url: str, body: dict[str, Any] | None = None) -> Any:
    response = getattr(client, method)(url, body or {}, content_type="application/json")
    return response


def opened(client: Client, body: dict[str, Any]) -> str:
    response = call(client, "post", "/api/studio/drafts", body)
    assert response.status_code == 201, response.content
    return str(response.json()["public_id"])


RESOURCE = {
    "kind": "reading",
    "provider": "openstax",
    "url": "https://openstax.org/books/biology-2e/pages/17-1",
    "video": "",
    "part": "",
    "covers": "How fragments are read from transcripts.",
    "licence": "CC BY 4.0",
    "display": "link",
    "level": "foundations",
}


def exam_question(n: int) -> dict[str, Any]:
    return {
        "id": f"rate-{n}",
        "kind": "number",
        "title": f"Reads at {n * 10} per kilobase",
        "stem": f"At {n * 10} reads per kilobase, how many reads does a 2 kb transcript collect?\n",
        "answer": n * 20,
        "unit": "",
        "tolerance": None,
        "options": None,
        "level": None,
        "rationale": "Reads scale with length at a fixed rate.",
    }


def test_an_untouched_draft_verifies_clean(client: Client) -> None:
    draft = opened(client, {"node_id": "tpm"})
    body = call(client, "get", f"/api/studio/drafts/{draft}/verify").json()
    assert body == {"clean": True, "problems": []}


def test_a_link_to_a_node_nowhere_is_reported(client: Client) -> None:
    draft = opened(client, {"node_id": "tpm"})
    links = [{"node": "no-such-node", "reason": "A reason for the test."}]
    saved = call(
        client, "put", f"/api/studio/drafts/{draft}/links/needs", {"revision": 1, "links": links}
    )
    assert saved.status_code == 200, saved.content
    body = call(client, "get", f"/api/studio/drafts/{draft}/verify").json()
    assert body["clean"] is False
    assert any("no-such-node" in problem["text"] for problem in body["problems"])


def test_a_needs_cycle_the_draft_makes_is_reported(client: Client) -> None:
    # salmon needs tpm; a draft of tpm that needs salmon closes the ring.
    draft = opened(client, {"node_id": "tpm"})
    current = call(client, "get", f"/api/studio/drafts/{draft}").json()["node"]["needs"]
    links = [*current, {"node": "salmon", "reason": "A reason that closes a ring."}]
    call(client, "put", f"/api/studio/drafts/{draft}/links/needs", {"revision": 1, "links": links})
    body = call(client, "get", f"/api/studio/drafts/{draft}/verify").json()
    assert body["clean"] is False
    assert any(
        "cycle" in problem["text"] or "ring" in problem["text"] for problem in body["problems"]
    )


def test_the_checklist_wants_four_exam_questions(client: Client) -> None:
    draft = opened(client, {"node_id": "tpm"})
    call(
        client,
        "put",
        f"/api/studio/drafts/{draft}/resources",
        {"revision": 1, "resources": [RESOURCE]},
    )
    # TPM's pool holds six since M4.8c: three go, leaving three.
    for revision, question in enumerate(("tpm-of-a", "tpm-steps", "tpm-unit-name"), start=2):
        call(client, "delete", f"/api/studio/drafts/{draft}/exam/{question}?revision={revision}")
    three = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    assert three["passed"] is False
    (failed,) = [item for item in three["items"] if not item["passed"]]
    assert failed["rule"] == "four exam questions"
    added = call(
        client,
        "post",
        f"/api/studio/drafts/{draft}/exam",
        {"revision": 5, "question": exam_question(1)},
    )
    assert added.status_code == 200, added.content
    four = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    assert four["passed"] is True


def test_the_checklist_wants_a_resource_and_a_clean_verify(client: Client) -> None:
    draft = opened(client, {"node_id": "probability"})  # no resources, no exam pool
    body = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    assert {item["rule"]: item["passed"] for item in body["items"]} == {
        "verifies clean": True,
        "a level": True,
        "a resource": False,
        "four exam questions": False,
    }


def test_a_new_node_built_only_through_the_api_validates_beside_the_content(
    client: Client, tmp_path: Path
) -> None:
    new = {
        "node_id": "effective-length",
        "new": {
            "title": "Effective length",
            "claim": "A transcript's effective length counts where a fragment can start on it.",
            "region": "transcriptomics",
            "level": "intermediate",
            "minutes": 8,
        },
    }
    draft = opened(client, new)
    revision = 1
    steps: list[tuple[str, str, dict[str, Any]]] = [
        (
            "put",
            "links/needs",
            {"links": [{"node": "tpm", "reason": "Effective length is what TPM divides by."}]},
        ),
        (
            "put",
            "resources",
            {
                "resources": [
                    {
                        "kind": "reading",
                        "provider": "openstax",
                        "url": "https://openstax.org/books/biology-2e/pages/17-1",
                        "video": "",
                        "part": "",
                        "covers": "How fragments are read from transcripts.",
                        "licence": "CC BY 4.0",
                        "display": "link",
                        "level": "foundations",
                    }
                ]
            },
        ),
        (
            "post",
            "blocks",
            {
                "at": 1,
                "block": {"kind": "text", "markdown": "\nA fragment starts anywhere it fits.\n"},
            },
        ),
    ]
    steps += [("post", "exam", {"question": exam_question(n)}) for n in range(1, 5)]
    for method, path, body in steps:
        response = call(
            client, method, f"/api/studio/drafts/{draft}/{path}", body | {"revision": revision}
        )
        assert response.status_code == 200, (path, response.content)
        revision += 1
    assert call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()["passed"] is True

    files = call(client, "get", f"/api/studio/drafts/{draft}/revisions/{revision}").json()
    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    folder = root / "transcriptomics" / "effective-length"
    folder.mkdir()
    (folder / "node.yaml").write_text(files["node_yaml"], encoding="utf-8")
    (folder / "body.md").write_text(files["body_md"], encoding="utf-8")
    (folder / "exam.yaml").write_text(files["exam_yaml"], encoding="utf-8")
    content = read_content(root)
    assert [str(problem) for problem in content.problems] == []
    assert len(content.nodes["effective-length"].exam) == 4


def test_verify_on_a_draft_that_no_longer_parses_lists_its_problems(client: Client) -> None:
    from code_api.content.models import Provider

    draft = opened(client, {"node_id": "de-bruijn-graphs"})
    Provider.objects.update(licences=[])
    body = call(client, "get", f"/api/studio/drafts/{draft}/verify").json()
    assert body["clean"] is False and body["problems"]
    assert call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()["passed"] is False


def test_a_discarded_draft_is_not_checked(client: Client) -> None:
    draft = opened(client, {"node_id": "tpm"})
    client.post(f"/api/studio/drafts/{draft}/discard")
    for check in ("verify", "checklist"):
        response = call(client, "get", f"/api/studio/drafts/{draft}/{check}")
        assert (response.status_code, response.json()["code"]) == (404, "CA0201")


def test_the_checklist_carries_verifys_problems(client: Client) -> None:
    # One request for the workbench's Checks (M4K.6): the items and the problems behind them.
    draft = opened(client, {"node_id": "tpm"})
    links = [{"node": "no-such-node", "reason": "A reason for the test."}]
    call(client, "put", f"/api/studio/drafts/{draft}/links/needs", {"revision": 1, "links": links})
    body = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    verified = call(client, "get", f"/api/studio/drafts/{draft}/verify").json()
    assert body["problems"] == verified["problems"]
    assert any("no-such-node" in problem["text"] for problem in body["problems"])
