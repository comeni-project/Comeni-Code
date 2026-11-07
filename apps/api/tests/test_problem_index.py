"""A node's problem in the index (M6.7 spec, M6PR.6): stored with its computed sample, read back
whole by the snapshot, and kept off the learner's page until M6.8. Needs Compose's Postgres."""

from pathlib import Path

import pytest
from django.test import Client

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


def test_the_learner_page_leaves_the_problem_out() -> None:
    rebuild_index(FIXTURES)
    page = Client().get("/api/nodes/de-bruijn-graphs").json()
    assert all(block["kind"] != "problem" for block in page["blocks"])
    assert "problem" not in page
