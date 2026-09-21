"""GET /api/routes (spec M2P4): a route from the index, with its cards, span and minutes.

Reads only the part 4 fixtures (R1). Needs Compose's Postgres.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from django.test import Client
from pytest_django import DjangoAssertNumQueries

from code_api.content.index import rebuild_index
from code_api.content.models import Link
from code_schema import read_content
from code_weaver.cli import main

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
CONTENT = read_content(FIXTURES)

pytestmark = pytest.mark.django_db

SALMON_ROUTE = [
    "dna-and-genes",
    "gene-expression",
    "splicing",
    "transcripts-and-isoforms",
    "short-read-sequencing",
    "fastq-and-quality-scores",
    "rna-seq-libraries",
    "k-mers",
    "sequence-alignment",
    "read-mapping",
    "multi-mapping-reads",
    "probability",
    "likelihood",
    "mixture-models",
    "em-algorithm",
    "tpm",
    "salmon",
]


@pytest.fixture
def index() -> None:
    rebuild_index(FIXTURES)


def route(client: Client, query: str) -> tuple[int, Any]:
    response = client.get(f"/api/routes?{query}")
    return response.status_code, response.json()


def test_salmon_comes_back_as_cards_with_its_span_and_minutes(client: Client, index: None) -> None:
    code, body = route(client, "goal=salmon")
    assert code == 200
    assert [stop["id"] for stop in body["stops"]] == SALMON_ROUTE
    assert body["goals"] == ["salmon"]
    assert body["known"] == []
    assert body["span"] == {"lowest": "first-steps", "highest": "intermediate"}
    assert body["minutes"] == 184
    assert body["stops"][0] == {
        "id": "dna-and-genes",
        "title": "DNA and genes",
        "claim": CONTENT.nodes["dna-and-genes"].claim,
        "level": "first-steps",
        "minutes": 10,
        "region": {"id": "molecular-biology", "name": "Molecular biology"},
        "needed_by": [
            {
                "id": "gene-expression",
                "title": "Gene expression",
                "level": "first-steps",
                "reason": "Expression is a gene being read, so it starts from what a gene is.",
            },
            {
                "id": "short-read-sequencing",
                "title": "Short-read sequencing",
                "level": "first-steps",
                "reason": "A sequencer reads DNA's letters, so it starts from what DNA is.",
            },
            {
                "id": "k-mers",
                "title": "k-mers",
                "level": "foundations",
                "reason": "k-mers are words cut from DNA sequences.",
            },
            {
                "id": "sequence-alignment",
                "title": "Sequence alignment and scores",
                "level": "foundations",
                "reason": "Alignment compares DNA sequences letter by letter.",
            },
        ],
    }


def test_needed_by_holds_only_stops_on_this_route(client: Client, index: None) -> None:
    _, body = route(client, "goal=salmon")
    stops = {stop["id"]: stop for stop in body["stops"]}
    assert [entry["id"] for entry in stops["transcripts-and-isoforms"]["needed_by"]] == [
        "multi-mapping-reads",
        "tpm",
        "salmon",
    ]
    assert stops["salmon"]["needed_by"] == []


def test_known_topics_shorten_the_route(client: Client, index: None) -> None:
    code, body = route(client, "goal=salmon&known=read-mapping")
    assert code == 200
    assert len(body["stops"]) == 14
    assert body["known"] == ["read-mapping"]
    assert "k-mers" not in {stop["id"] for stop in body["stops"]}


def test_a_known_id_outside_the_index_is_ignored(client: Client, index: None) -> None:
    _, body = route(client, "goal=salmon&known=no-such-topic")
    assert len(body["stops"]) == 17
    assert body["known"] == []


def test_two_goals_give_one_route(client: Client, index: None) -> None:
    _, body = route(client, "goal=tpm&goal=salmon")
    assert body["goals"] == ["salmon", "tpm"]
    assert [stop["id"] for stop in body["stops"]] == SALMON_ROUTE


def test_an_unknown_goal_is_404(client: Client, index: None) -> None:
    code, body = route(client, "goal=no-such-topic")
    assert code == 404
    assert body == {
        "detail": "No topic with id 'no-such-topic'. It may have been removed or renamed."
    }


def test_no_goal_is_422(client: Client, index: None) -> None:
    code, _ = route(client, "known=salmon")
    assert code == 422


def test_an_empty_index_is_503(client: Client) -> None:
    code, body = route(client, "goal=salmon")
    assert code == 503
    assert body == {"detail": "The index has not been built yet."}


def test_a_route_costs_three_queries(
    client: Client, index: None, django_assert_num_queries: DjangoAssertNumQueries
) -> None:
    with django_assert_num_queries(3):
        client.get("/api/routes?goal=salmon")
    with django_assert_num_queries(3):
        client.get("/api/routes?goal=salmon&goal=tpm")


def test_the_api_and_the_command_agree(
    client: Client, index: None, capsys: pytest.CaptureFixture[str]
) -> None:
    """Files and index weave alike: the command's titles, in order, are the endpoint's."""
    _, body = route(client, "goal=salmon&known=read-mapping")
    assert main(["route", "salmon", "--root", str(FIXTURES), "--known", "read-mapping"]) == 0
    printed = capsys.readouterr().out.splitlines()
    titles = [line.split("  ")[0][4:].strip() for line in printed[2:]]
    # The command cuts a title to its column; the endpoint does not.
    cut = [t if len(t) <= 26 else f"{t[:25]}…" for t in (s["title"] for s in body["stops"])]
    assert cut == titles


def test_the_authors_order_survives_a_different_row_order(client: Client, index: None) -> None:
    """The needs of read-mapping decide whether k-mers or sequence-alignment comes first."""
    links = list(Link.objects.filter(source_id="read-mapping", kind=Link.Kind.NEEDS))
    Link.objects.filter(source_id="read-mapping", kind=Link.Kind.NEEDS).delete()
    for link in reversed(links):  # same positions, opposite insertion order
        Link.objects.create(
            source_id=link.source_id,
            target_id=link.target_id,
            kind=link.kind,
            reason=link.reason,
            position=link.position,
        )
    _, body = route(client, "goal=salmon")
    assert [stop["id"] for stop in body["stops"]] == SALMON_ROUTE


def test_the_route_is_in_the_openapi_schema() -> None:
    schema = json.loads((Path(__file__).resolve().parents[1] / "openapi.json").read_text())
    responses = schema["paths"]["/api/routes"]["get"]["responses"]
    assert set(responses) == {"200", "404", "503"}


def test_a_stop_carries_its_claim(client: Client) -> None:
    """The Route page's panel and its outcome sentence both read the claim (M3P4.1)."""
    rebuild_index(FIXTURES)
    stops = client.get("/api/routes", {"goal": "salmon"}).json()["stops"]
    assert [stop["claim"] for stop in stops[:1]] == [CONTENT.nodes[stops[0]["id"]].claim]
    assert all(stop["claim"] == CONTENT.nodes[stop["id"]].claim for stop in stops)
