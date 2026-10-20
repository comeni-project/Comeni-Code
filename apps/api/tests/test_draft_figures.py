"""A draft's figures (M6.4 spec, M6FG.5): added, set and removed as text, each one save, and their
review keys. Needs Compose's Postgres."""

from pathlib import Path
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts
from code_api.studio.keys import review_keys
from code_api.studio.models import Draft

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
TEXT = (
    "component: flow\n"
    "alt: Two boxes, reads then k-mers, joined by one arrow.\n"
    "data:\n"
    "  # the smallest flow\n"
    "  nodes:\n"
    "    - {id: reads, label: reads}\n"
    "    - {id: kmers, label: k-mers}\n"
    "  edges:\n"
    "    - {from: reads, to: kmers}\n"
)


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


@pytest.fixture
def client(ada: User) -> Client:
    client = Client()
    client.force_login(ada)
    return client


def opened(client: Client, node: str = "tpm") -> str:
    answer = client.post("/api/studio/drafts", {"node_id": node}, content_type="application/json")
    assert answer.status_code == 201, answer.content
    return str(answer.json()["public_id"])


def add(client: Client, draft: str, revision: int = 1, **extra: Any) -> Any:
    body = {
        "revision": revision,
        "at": 0,
        "component": "flow",
        "alt": "Two boxes and an arrow.",
        "caption": "Reads, then k-mers.",
        **extra,
    }
    return client.post(f"/api/studio/drafts/{draft}/figures", body, content_type="application/json")


def put(client: Client, draft: str, text: str, revision: int = 2, stem: str = "flow") -> Any:
    return client.put(
        f"/api/studio/drafts/{draft}/figures/{stem}",
        {"revision": revision, "text": text},
        content_type="application/json",
    )


def test_adding_a_figure_saves_its_file_and_its_block(client: Client) -> None:
    draft = opened(client)
    answer = add(client, draft)
    assert answer.status_code == 200, answer.content
    node = answer.json()["draft"]["node"]
    assert node["blocks"][0] == {
        "kind": "figure",
        "file": "flow",
        "caption": "Reads, then k-mers.\n",
    }
    (figure,) = node["figures"]
    assert (figure["stem"], figure["component"], figure["alt"]) == (
        "flow",
        "flow",
        "Two boxes and an arrow.",
    )
    assert figure["text"].startswith("component: flow\n")
    assert figure["data"]["edges"] == [{"from": "reads", "to": "k-mers"}]
    latest = drafts.latest(Draft.objects.get(public_id=draft))
    assert latest.figures == {"flow.yaml": figure["text"]}


def test_a_figure_is_set_and_its_text_kept_byte_for_byte(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    answer = put(client, draft, TEXT)
    assert answer.status_code == 200, answer.content
    assert answer.json()["draft"]["node"]["figures"][0]["text"] == TEXT
    assert drafts.latest(Draft.objects.get(public_id=draft)).figures == {"flow.yaml": TEXT}


def test_a_figure_that_would_not_validate_is_refused_with_its_path(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    answer = put(client, draft, TEXT + "  href: x\n")
    assert answer.status_code == 422, answer.content
    body = answer.json()
    assert body["code"] == "CA0208"
    assert [(p["code"], p["message"]) for p in body["problems"]] == [
        ("CS1002", "data.href: not allowed")
    ]
    broken = put(client, draft, "component: [\n")
    assert [p["code"] for p in broken.json()["problems"]] == ["CS1023"]
    assert drafts.latest(Draft.objects.get(public_id=draft)).number == 2  # nothing was stored


def test_an_unknown_component_is_refused_in_words(client: Client) -> None:
    answer = add(client, opened(client), component="pie")
    assert (answer.status_code, answer.json()["code"]) == (422, "CA0205")
    assert answer.json()["detail"].startswith("Pie is not a component (chart, flow,")


def test_removing_a_figure_takes_its_file_and_block(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    answer = client.delete(f"/api/studio/drafts/{draft}/figures/flow?revision=2")
    assert answer.status_code == 200, answer.content
    node = answer.json()["draft"]["node"]
    assert node["figures"] == []
    assert all(block["kind"] != "figure" for block in node["blocks"])


def test_a_changed_figure_changes_its_review_key(client: Client) -> None:
    draft = opened(client)
    add(client, draft)
    put(client, draft, TEXT)
    row = Draft.objects.get(public_id=draft)
    before, _ = drafts.node_of(row, row.revisions.get(number=2))
    after, _ = drafts.node_of(row, row.revisions.get(number=3))
    assert before is not None and after is not None
    first = next(k for k in review_keys(before) if k.kind == "figure")
    second = next(k for k in review_keys(after) if k.kind == "figure")
    assert first.key == second.key == "block/0"
    assert first != second  # the block is the same; its file's text is not


def test_a_try_questions_figure_is_part_of_its_key(client: Client) -> None:
    draft = opened(client, "de-bruijn-graphs")
    add(client, draft)
    shown = client.get(f"/api/studio/drafts/{draft}").json()["node"]
    at = next(n for n, block in enumerate(shown["blocks"]) if block["kind"] == "try")
    question = next(q for q in shown["questions"] if q["id"] == shown["blocks"][at]["question"])
    answer = client.put(
        f"/api/studio/drafts/{draft}/blocks/{at}",
        {"revision": 2, "block": shown["blocks"][at], "question": {**question, "figure": "flow"}},
        content_type="application/json",
    )
    assert answer.status_code == 200, answer.content
    asked = answer.json()["draft"]["node"]["questions"]
    assert next(q for q in asked if q["id"] == question["id"])["figure"] == "flow"
    put(client, draft, TEXT, revision=3)
    row = Draft.objects.get(public_id=draft)
    before, _ = drafts.node_of(row, row.revisions.get(number=3))
    after, _ = drafts.node_of(row, row.revisions.get(number=4))
    assert before is not None and after is not None
    key = f"try/{question['id']}"
    old = next(k for k in review_keys(before) if k.key == key)
    new = next(k for k in review_keys(after) if k.key == key)
    assert old != new


def test_review_draws_a_figure_with_its_file(client: Client) -> None:
    from code_api.studio.schemas import _content

    draft = opened(client)
    add(client, draft)
    put(client, draft, TEXT)
    row = Draft.objects.get(public_id=draft)
    node, _ = drafts.node_of(row)
    assert node is not None
    key = next(k for k in review_keys(node) if k.kind == "figure")
    shown = _content(key, None)
    assert shown.block is not None and shown.block.kind == "figure"
    assert [(f.stem, f.text) for f in shown.figures] == [("flow", TEXT)]
