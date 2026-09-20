"""GET /api/search (spec M3P2.4): typed words to candidate goals, from the index.

Reads only the part 4 fixtures (R1). Needs Compose's Postgres.
"""

from pathlib import Path
from typing import Any

import pytest
from django.test import Client
from pytest_django import DjangoAssertNumQueries

from code_api.content.index import rebuild_index
from code_schema import read_content
from code_weaver.cli import targets_of
from code_weaver.find import find

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
CONTENT = read_content(FIXTURES)

pytestmark = pytest.mark.django_db


def search(client: Client, query: str, **extra: Any) -> Any:
    return client.get("/api/search", {"q": query, **extra})


def test_a_name_finds_its_topic(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = search(client, "salmon").json()
    first = body["results"][0]
    assert first["id"] == "salmon"
    assert first["title"] == "Salmon"
    assert first["claim"] == CONTENT.nodes["salmon"].claim
    assert first["level"] == "intermediate"
    assert first["minutes"] == 15
    assert first["region"] == {"id": "transcriptomics", "name": "Transcriptomics"}
    assert body["query"] == "salmon"
    assert body["unmatched"] == []


def test_a_question_finds_the_topic_that_answers_it(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = search(client, "why my reads don't map").json()
    assert body["results"][0]["id"] == "read-mapping"


def test_no_match_is_an_empty_list_with_the_word(client: Client) -> None:
    rebuild_index(FIXTURES)
    response = search(client, "nanopore")
    assert response.status_code == 200
    assert response.json() == {"query": "nanopore", "unmatched": ["nanopore"], "results": []}


def test_the_limit_is_kept(client: Client) -> None:
    rebuild_index(FIXTURES)
    assert len(search(client, "reads", limit=3).json()["results"]) == 3


def test_ten_come_back_by_default(client: Client) -> None:
    rebuild_index(FIXTURES)
    assert len(search(client, "reads").json()["results"]) == 10


def test_a_blank_query_is_422(client: Client) -> None:
    rebuild_index(FIXTURES)
    response = search(client, "   ")
    assert response.status_code == 422
    assert response.json() == {"detail": "A search needs a word."}


def test_no_query_at_all_is_422(client: Client) -> None:
    rebuild_index(FIXTURES)
    assert client.get("/api/search").status_code == 422


@pytest.mark.parametrize("limit", [0, 51, "many"])
def test_a_limit_outside_the_range_is_422(client: Client, limit: object) -> None:
    rebuild_index(FIXTURES)
    assert search(client, "reads", limit=limit).status_code == 422


def test_an_empty_index_is_503(client: Client) -> None:
    response = search(client, "salmon")
    assert response.status_code == 503
    assert response.json() == {"detail": "The index has not been built yet."}


def test_a_search_costs_one_query(
    client: Client, django_assert_num_queries: DjangoAssertNumQueries
) -> None:
    rebuild_index(FIXTURES)
    with django_assert_num_queries(1):
        assert search(client, "reads").status_code == 200


def test_the_endpoint_and_the_command_agree(client: Client) -> None:
    rebuild_index(FIXTURES)
    expected = find(targets_of(CONTENT), "why my reads don't map").ids
    body = search(client, "why my reads don't map").json()
    assert [result["id"] for result in body["results"]] == list(expected)


def test_the_schema_lists_the_search_route(client: Client) -> None:
    operation = client.get("/api/openapi.json").json()["paths"]["/api/search"]["get"]
    assert set(operation["responses"]) >= {"200", "422", "503"}
