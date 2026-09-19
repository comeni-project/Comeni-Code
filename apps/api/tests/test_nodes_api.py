"""GET /api/nodes/{node_id} (spec M1P6.3, M1P6.4): a node and its neighbours, from the index.

Reads only the part 4 fixtures, or copies of them in tmp_path (R1). Needs Compose's Postgres.
"""

import shutil
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest
from django.test import Client
from pytest_django import DjangoAssertNumQueries

from code_api.content.index import rebuild_index
from code_schema import Link, Node, read_content

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
CONTENT = read_content(FIXTURES)

pytestmark = pytest.mark.django_db


def cards(links: Sequence[Link]) -> list[dict[str, str]]:
    """The cards the API should give for links written in the files, in their order."""
    return [
        {
            "id": link.node,
            "title": CONTENT.nodes[link.node].title,
            "level": CONTENT.nodes[link.node].level,
            "reason": link.reason,
        }
        for link in links
    ]


def needed_by(target: str) -> list[dict[str, str]]:
    """The cards for the nodes whose files say they need `target`, sorted by title ignoring case."""
    sources = sorted(
        (
            node
            for node in CONTENT.nodes.values()
            if any(link.node == target for link in node.needs)
        ),
        key=lambda node: (node.title.casefold(), node.id),
    )
    return [
        {
            "id": node.id,
            "title": node.title,
            "level": node.level,
            "reason": next(link.reason for link in node.needs if link.node == target),
        }
        for node in sources
    ]


def get(client: Client, node_id: str) -> Any:
    return client.get(f"/api/nodes/{node_id}")


def test_a_node_comes_with_the_three_kinds_of_link(client: Client) -> None:
    rebuild_index(FIXTURES)
    salmon: Node = CONTENT.nodes["salmon"]
    response = get(client, "salmon")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "id": "salmon",
        "title": "Salmon",
        "claim": salmon.claim,
        "region": {"id": "transcriptomics", "name": "Transcriptomics"},
        "level": "intermediate",
        "minutes": 15,
        "body": salmon.body,
        "folder": "transcriptomics/salmon",
        "needs": cards(salmon.needs),
        "goes_deeper": cards(salmon.goes_deeper),
        "related": cards(salmon.related),
        "needed_by": needed_by("salmon"),
    }
    assert [card["id"] for card in body["needs"]][0] == "rna-seq-libraries"
    assert len(body["goes_deeper"]) == 5
    assert [card["id"] for card in body["related"]] == ["kallisto"]
    # Three of the nodes attached below Salmon need it back; kallisto is related, not a need.
    assert {card["id"] for card in body["needed_by"]} == {
        "abundance-uncertainty",
        "decoy-sequences",
        "salmon-bias-models",
    }


def test_needed_by_is_derived_with_the_needing_nodes_reason(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "em-algorithm").json()
    # Sorted by title ignoring case: kallisto, Salmon, Variational Bayesian EM.
    expected = []
    for source in ("kallisto", "salmon", "variational-bayes-em"):
        node = CONTENT.nodes[source]
        (reason,) = [link.reason for link in node.needs if link.node == "em-algorithm"]
        expected.append({"id": source, "title": node.title, "level": node.level, "reason": reason})
    assert body["needed_by"] == expected


def test_a_first_steps_node_needs_nothing(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "probability").json()
    assert (body["level"], body["needs"]) == ("first-steps", [])
    assert [card["id"] for card in body["needed_by"]] == ["likelihood"]


@pytest.mark.parametrize("node_id", ["no-such-topic", "Bad_ID"])
def test_an_id_not_in_the_index_is_404(client: Client, node_id: str) -> None:
    rebuild_index(FIXTURES)
    response = get(client, node_id)
    assert response.status_code == 404
    assert response.json() == {
        "detail": f"No topic with id '{node_id}'. It may have been removed or renamed."
    }


def test_no_index_yet_is_503(client: Client) -> None:
    response = get(client, "salmon")
    assert response.status_code == 503
    assert response.json() == {"detail": "The index has not been built yet."}


def test_refused_builds_are_no_index(client: Client, tmp_path: Path) -> None:
    broken = tmp_path / "content"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    assert rebuild_index(broken).outcome == "refused"
    assert get(client, "salmon").status_code == 503


def test_a_node_costs_three_queries(
    client: Client, django_assert_num_queries: DjangoAssertNumQueries
) -> None:
    rebuild_index(FIXTURES)
    with django_assert_num_queries(3):
        assert get(client, "salmon").status_code == 200


def test_the_schema_lists_the_node_route(client: Client) -> None:
    operation = client.get("/api/openapi.json").json()["paths"]["/api/nodes/{node_id}"]["get"]
    assert set(operation["responses"]) == {"200", "404", "503"}
