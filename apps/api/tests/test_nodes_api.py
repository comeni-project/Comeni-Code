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
from code_api.content.models import Node as StoredNode
from code_schema import Link, Node, read_content

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"
CONTENT = read_content(FIXTURES)

pytestmark = pytest.mark.django_db


def cards(links: Sequence[Link]) -> list[dict[str, object]]:
    """The cards the API should give for links written in the files, in their order."""
    return [
        {
            "id": link.node,
            "title": CONTENT.nodes[link.node].title,
            "level": CONTENT.nodes[link.node].level,
            "minutes": CONTENT.nodes[link.node].minutes,
            "reason": link.reason,
        }
        for link in links
    ]


def needed_by(target: str) -> list[dict[str, object]]:
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
            "minutes": node.minutes,
            "reason": next(link.reason for link in node.needs if link.node == target),
        }
        for node in sources
    ]


def get(client: Client, node_id: str) -> Any:
    return client.get(f"/api/nodes/{node_id}")


def with_an_embedded_video(root: Path) -> None:
    """The fixtures link every video (issue 76); a copy embeds one, so the path stays tested."""
    registry = root / "providers.yaml"
    registry.write_text(
        registry.read_text()
        + "  - id: open-video\n    name: Open video\n    licences: [CC BY 4.0]\n"
        + "    embed: true\n    players: [youtube]\n"
    )
    node = root / "algorithms" / "de-bruijn-graphs" / "node.yaml"
    text = node.read_text().replace("provider: khan-academy", "provider: open-video", 1)
    text = text.replace(
        "    licence: Khan Academy terms\n    display: link\n",
        "    video: youtube:Jnk_4Maf5Fk\n    licence: CC BY 4.0\n    display: embed\n",
        1,
    )
    node.write_text(text)


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
        "blocks": [{"kind": "text", "markdown": salmon.body}],
        "folder": "transcriptomics/salmon",
        "needs": cards(salmon.needs),
        "goes_deeper": cards(salmon.goes_deeper),
        "related": cards(salmon.related),
        "needed_by": needed_by("salmon"),
        # Salmon cites neither; de Bruijn graphs is the node that does (M3P1.5).
        "resources": [],
        "questions": [],
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
        expected.append(
            {
                "id": source,
                "title": node.title,
                "level": node.level,
                "minutes": node.minutes,
                "reason": reason,
            }
        )
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
        "detail": f"No topic with id '{node_id}'. It may have been removed or renamed.",
        "code": "CA0002",
    }


def test_no_index_yet_is_503(client: Client) -> None:
    response = get(client, "salmon")
    assert response.status_code == 503
    assert response.json() == {"detail": "The index has not been built yet.", "code": "CA0001"}


def test_refused_builds_are_no_index(client: Client, tmp_path: Path) -> None:
    broken = tmp_path / "content"
    shutil.copytree(FIXTURES, broken)
    shutil.rmtree(broken / "statistics" / "em-algorithm")
    assert rebuild_index(broken).outcome == "refused"
    assert get(client, "salmon").status_code == 503


def test_a_node_costs_five_queries(
    client: Client, django_assert_num_queries: DjangoAssertNumQueries
) -> None:
    rebuild_index(FIXTURES)
    with django_assert_num_queries(5):
        assert get(client, "salmon").status_code == 200


def test_the_schema_lists_the_node_route(client: Client) -> None:
    operation = client.get("/api/openapi.json").json()["paths"]["/api/nodes/{node_id}"]["get"]
    assert set(operation["responses"]) == {"200", "404", "503"}


# M3 part 1: the Learn it section and the try questions (spec M3P1.4).


def test_a_node_returns_its_resources_in_the_authors_order(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "de-bruijn-graphs").json()
    assert [resource["display"] for resource in body["resources"]] == ["link", "link", "link"]
    first = body["resources"][0]
    assert first["provider"] == {"id": "khan-academy", "name": "Khan Academy"}
    assert first["kind"] == "video"
    assert first["part"] == ""
    assert first["video"] is None  # Khan Academy is linked, never embedded (issue 76)
    assert first["licence"] == "Khan Academy terms"
    assert first["level"] == "foundations"
    assert first["covers"] == CONTENT.nodes["de-bruijn-graphs"].resources[0].covers


def test_an_embedded_resource_names_the_video_it_plays(client: Client, tmp_path: Path) -> None:
    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    with_an_embedded_video(root)
    rebuild_index(root)
    first = get(client, "de-bruijn-graphs").json()["resources"][0]
    assert (first["provider"]["id"], first["display"]) == ("open-video", "embed")
    assert first["video"] == "youtube:Jnk_4Maf5Fk"


def test_a_number_question_comes_with_its_hints_and_rationale(client: Client) -> None:
    rebuild_index(FIXTURES)
    question = get(client, "de-bruijn-graphs").json()["questions"][0]
    assert question["id"] == "kmers-per-read"
    assert question["kind"] == "number"
    assert question["answer"] == 5
    assert question["options"] is None
    assert question["unit"] is None and question["tolerance"] is None
    assert len(question["hints"]) == 2
    assert question["rationale"].startswith("A sequence of length L")


def test_a_choice_question_comes_with_its_options(client: Client) -> None:
    rebuild_index(FIXTURES)
    question = get(client, "de-bruijn-graphs").json()["questions"][1]
    assert question["kind"] == "choice"
    assert question["answer"] is None
    assert question["options"] == [
        {"text": "ACGTTG", "right": True},
        {"text": "TTGCA", "right": False},
        {"text": "ACGTTGCA", "right": False},
    ]


def test_a_node_with_neither_returns_empty_lists(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "probability").json()
    assert body["resources"] == []
    assert body["questions"] == []


# M4.1.2: a node is served as blocks, and its body is not (spec M4B.5).


def test_a_node_serves_its_blocks_and_no_body(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = get(client, "tpm").json()
    assert "body" not in body
    assert [block["kind"] for block in body["blocks"]] == ["text", "callout", "text"]
    callout = CONTENT.nodes["tpm"].blocks[1]
    assert body["blocks"][1] == {
        "kind": "callout",
        "callout": "misconception",
        "title": "TPM is not a count of reads",
        "markdown": getattr(callout, "markdown", None),
    }


def test_a_placed_question_is_a_try_block(client: Client) -> None:
    rebuild_index(FIXTURES)
    blocks = get(client, "de-bruijn-graphs").json()["blocks"]
    assert [block["question"] for block in blocks if block["kind"] == "try"] == [
        "kmers-per-read",
        "shared-unitig",
    ]


# M4.1.3 (spec M4R.4): a stored block is read by one codec, and a callout's kind is closed.


def test_a_stored_block_kind_the_api_does_not_know_is_an_error(client: Client) -> None:
    rebuild_index(FIXTURES)
    StoredNode.objects.filter(id="tpm").update(blocks=[{"kind": "figure", "markdown": "x"}])
    with pytest.raises(ValueError, match="figure"):
        get(client, "tpm")


def test_a_callouts_kind_is_one_of_three_in_the_schema(client: Client) -> None:
    schemas = client.get("/api/openapi.json").json()["components"]["schemas"]
    assert schemas["CalloutBlockOut"]["properties"]["callout"]["enum"] == [
        "misconception",
        "caveat",
        "convention",
    ]
