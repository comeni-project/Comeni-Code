"""A draft's problem (M6.7 spec, M6PR.6): saved whole through its own edit, re-read byte for byte,
its block never deleted alone, one review key, landed beside the node's other files. Needs
Compose's Postgres."""

from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from django.test import Client

from code_api.accounts.models import User
from code_api.content.index import rebuild_index
from code_api.studio import drafts, landing
from code_api.studio.keys import review_keys
from code_api.studio.models import Draft

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
FOLDER = FIXTURES / "algorithms" / "de-bruijn-graphs"
PROBLEM = (FOLDER / "problem.yaml").read_text()


@pytest.fixture(autouse=True)
def _indexed() -> None:
    rebuild_index(FIXTURES)


@pytest.fixture
def client(ada: User) -> Client:
    client = Client()
    client.force_login(ada)
    return client


def opened(ada: User) -> str:
    return str(drafts.open_existing("de-bruijn-graphs", by=ada).public_id)


def at(client: Client, draft: str) -> dict[str, Any]:
    body: dict[str, Any] = client.get(f"/api/studio/drafts/{draft}").json()
    return body


def test_a_draft_starts_with_its_problem_and_sends_it(client: Client, ada: User) -> None:
    draft = opened(ada)
    node = at(client, draft)["node"]
    assert node["problem"]["text"] == PROBLEM
    assert node["problem"]["sample_dataset"].startswith("3\n")
    assert {"kind": "problem"} in node["blocks"]


def test_a_problem_is_saved_whole_and_reads_back(client: Client, ada: User) -> None:
    draft = opened(ada)
    changed = PROBLEM.replace("Construct a de Bruijn graph", "Build a de Bruijn graph")
    saved = client.put(
        f"/api/studio/drafts/{draft}/problem",
        {"revision": 1, "text": changed},
        content_type="application/json",
    )
    assert saved.status_code == 200, saved.content
    node = at(client, draft)["node"]
    assert node["problem"]["text"] == changed
    revision = drafts.latest(Draft.objects.get(public_id=draft))
    assert revision.problem_yaml == changed


def test_a_failing_problem_is_refused_with_its_codes(client: Client, ada: User) -> None:
    draft = opened(ada)
    refused = client.put(
        f"/api/studio/drafts/{draft}/problem",
        {"revision": 1, "text": PROBLEM.replace("kit: de-bruijn-edges", "kit: walk")},
        content_type="application/json",
    )
    assert refused.status_code == 422
    assert refused.json()["code"] == "CA0208"
    assert [p["code"] for p in refused.json()["problems"]] == ["CS1106"]


def test_a_problem_is_removed_with_its_block(client: Client, ada: User) -> None:
    draft = opened(ada)
    gone = client.delete(f"/api/studio/drafts/{draft}/problem?revision=1")
    assert gone.status_code == 200, gone.content
    node = at(client, draft)["node"]
    assert node["problem"] is None
    assert {"kind": "problem"} not in node["blocks"]


def test_the_problem_block_is_not_deleted_through_blocks(client: Client, ada: User) -> None:
    """Review Focus 5: CA0205, the file kept; a move keeps it too."""
    draft = opened(ada)
    blocks = at(client, draft)["node"]["blocks"]
    place = blocks.index({"kind": "problem"})
    refused = client.delete(f"/api/studio/drafts/{draft}/blocks/{place}?revision=1")
    assert refused.status_code == 422 and refused.json()["code"] == "CA0205"
    moved = client.post(
        f"/api/studio/drafts/{draft}/blocks/{place}/move",
        {"revision": 1, "to": 0},
        content_type="application/json",
    )
    assert moved.status_code == 200, moved.content
    node = at(client, draft)["node"]
    assert node["blocks"][0] == {"kind": "problem"} and node["problem"]["text"] == PROBLEM


def test_review_keys_the_problem_once(ada: User) -> None:
    draft = Draft.objects.get(public_id=opened(ada))
    node, _ = drafts.node_of(draft)
    assert node is not None
    keys = [key.key for key in review_keys(node)]
    assert keys.count("problem") == 1
    place = next(i for i, block in enumerate(node.blocks) if type(block).__name__ == "ProblemBlock")
    assert f"block/{place}" not in keys


class _Main:
    def __init__(self, held: set[str]) -> None:
        self.held = held

    def exists(self, path: str, head: str) -> bool:
        return path in self.held


def test_a_landing_carries_the_problem_and_its_removal(client: Client, ada: User) -> None:
    draft_id = opened(ada)
    draft = Draft.objects.get(public_id=draft_id)
    folder = draft.folder
    changed = PROBLEM.replace("Construct", "Build")
    client.put(
        f"/api/studio/drafts/{draft_id}/problem",
        {"revision": 1, "text": changed},
        content_type="application/json",
    )
    entry = SimpleNamespace(draft=draft, revision=2)
    files = landing._files(entry, "head", _Main(set()))  # type: ignore[arg-type]  # noqa: SLF001
    assert files[f"{folder}/problem.yaml"] == changed
    client.delete(f"/api/studio/drafts/{draft_id}/problem?revision=2")
    entry = SimpleNamespace(draft=draft, revision=3)
    held = _Main({f"{folder}/problem.yaml"})
    files = landing._files(entry, "head", held)  # type: ignore[arg-type]  # noqa: SLF001
    assert files[f"{folder}/problem.yaml"] is None
