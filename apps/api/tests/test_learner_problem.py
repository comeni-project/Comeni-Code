"""The learner's problem (M6.8a spec, M6LP.2–M6LP.4): what the node's page is sent, its version,
a seed's dataset and the answer checked by the kit. Needs Compose's Postgres."""

from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from code_problems import KITS, registry
from django.test import Client

from code_api.content import problems
from code_api.content.index import rebuild_index
from code_schema import read_content

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
NODE = "de-bruijn-graphs"
FOLDER = FIXTURES / "algorithms" / NODE


@pytest.fixture
def page() -> dict[str, Any]:
    rebuild_index(FIXTURES)
    body: dict[str, Any] = Client().get(f"/api/nodes/{NODE}").json()
    return body


def test_the_de_bruijn_page_sends_its_problem(page: dict[str, Any]) -> None:
    problem = page["problem"]
    assert problem["title"] == "Construct a de Bruijn graph"
    assert problem["rung"] == 3
    assert problem["kit"] == "de-bruijn-edges"
    assert problem["hints"] == [
        "The same k-mer can come from many reads.",
        "Each read adds one edge for every pair of k-mers next to each other in it.",
    ]
    assert problem["callouts"] == ["Every edge appears once"]
    assert problem["size"] == 2482
    assert problem["given"] == "k on the first line, then the reads, one per line"
    assert problem["returns"].startswith('edges as "A -> B"')
    assert problem["sample_dataset"].startswith("3\n")
    version = problem["version"]
    assert len(version) == 12 and all(ch in "0123456789abcdef" for ch in version)
    for secret in ("text", "params", "mistakes", "rationale", "answer"):
        assert secret not in problem


def test_the_block_is_in_its_place(page: dict[str, Any]) -> None:
    blocks = read_content(FIXTURES).nodes[NODE].blocks
    at = next(i for i, block in enumerate(blocks) if type(block).__name__ == "ProblemBlock")
    assert page["blocks"][at] == {"kind": "problem"}


def test_a_node_without_a_problem_sends_null() -> None:
    rebuild_index(FIXTURES)
    page = Client().get("/api/nodes/salmon").json()
    assert page["problem"] is None
    assert all(block["kind"] != "problem" for block in page["blocks"])


def test_version_follows_the_kit(page: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    """A deploy that changes a kit's generate changes the version (M6LP.2)."""
    before = page["problem"]["version"]
    kit = KITS["de-bruijn-edges"]
    original = kit.generate

    def shifted(params: Any, rng: Any) -> Any:
        made = original(params, rng)
        return type(made)(made.text + "ACGTACGT\n", made.name, made.size + 1)

    monkeypatch.setitem(registry.KITS, kit.name, replace(kit, generate=shifted))  # type: ignore[index]
    problems.forget()
    after = Client().get(f"/api/nodes/{NODE}").json()["problem"]["version"]
    assert after != before
