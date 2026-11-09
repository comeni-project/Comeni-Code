"""A node's problem in the index (M6.7 spec, M6PR.6): stored with its computed sample, read back
whole by the snapshot. The learner's page is test_learner_problem.py's. Needs Compose's Postgres."""

from pathlib import Path

import pytest

from code_api.content.index import rebuild_index
from code_api.content.models import NodeProblem
from code_api.content.snapshot import node_from_index
from code_schema import read_content

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"


def test_a_rebuild_stores_the_problem_and_its_sample() -> None:
    rebuild_index(FIXTURES)
    row = NodeProblem.objects.get(node_id="de-bruijn-graphs")
    folder = FIXTURES / "algorithms" / "de-bruijn-graphs"
    assert row.text == (folder / "problem.yaml").read_text()
    assert (row.title, row.rung, row.kit) == ("Construct a de Bruijn graph", 3, "de-bruijn-edges")
    assert row.sample_dataset.startswith("3\n")
    assert "->" in row.sample_output
    assert NodeProblem.objects.count() == 1


def test_the_snapshot_gives_the_problem_back() -> None:
    rebuild_index(FIXTURES)
    node = node_from_index("de-bruijn-graphs")
    assert node is not None
    assert node.problem == read_content(FIXTURES).nodes["de-bruijn-graphs"].problem


def test_a_problem_a_tightened_kit_refuses_still_reads_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """#420: after a deploy that tightens a kit, the index still gives the node back, problem and
    all; a draft's own read is where the problem is refused, as for a dropped registry (#173)."""
    from dataclasses import replace

    from code_problems import registry

    from code_schema import problem_file

    rebuild_index(FIXTURES)
    kit = registry.KITS["de-bruijn-edges"]
    monkeypatch.setitem(registry.KITS, kit.name, replace(kit, max_bytes=10))
    monkeypatch.setattr(problem_file, "_RUNS", {})
    node = node_from_index("de-bruijn-graphs")
    assert node is not None and node.problem is not None
    assert (
        node.problem.text
        == (FIXTURES / "algorithms" / "de-bruijn-graphs" / "problem.yaml").read_text()
    )
    assert (
        node.problem.sample.dataset.text
        == NodeProblem.objects.get(node_id="de-bruijn-graphs").sample_dataset
    )
