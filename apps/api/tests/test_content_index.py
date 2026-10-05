"""The index and its rebuild (spec M1P5): all or nothing, the same twice, converging after edits.

Reads only the part 4 fixtures, or copies of them in tmp_path (R1). Needs Compose's Postgres.
"""

import shutil
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from code_api.content import index
from code_api.content.index import content_digest, rebuild_index
from code_api.content.models import (
    IndexBuild,
    Link,
    Node,
    Provider,
    Question,
    Region,
    Resource,
)
from code_schema import Level, block_json, read_content, read_node, write_node_folder
from code_schema import Link as SchemaLink
from code_schema import Node as SchemaNode

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"

pytestmark = pytest.mark.django_db


def dump() -> tuple[list[Any], ...]:
    """Every row of the three index tables, sorted: two equal dumps are the same index."""
    return (
        sorted(Region.objects.values_list("id", "name", "position")),
        sorted(
            Node.objects.values_list(
                "id", "title", "claim", "region_id", "level", "minutes", "blocks", "folder"
            )
        ),
        sorted(Link.objects.values_list("source_id", "kind", "position", "target_id", "reason")),
    )


def copy_of_fixtures(tmp_path: Path) -> Path:
    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    return root


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


def test_the_fixtures_rebuild_into_the_index() -> None:
    content = read_content(FIXTURES)
    links = sum(
        len(node.needs) + len(node.goes_deeper) + len(node.related)
        for node in content.nodes.values()
    )
    build = rebuild_index(FIXTURES, commit="abc123")
    assert build.outcome == IndexBuild.Outcome.APPLIED
    assert (build.node_count, build.problems, build.commit) == (26, [], "abc123")
    assert len(build.digest) == 64
    assert (Node.objects.count(), Region.objects.count(), Link.objects.count()) == (26, 6, links)
    salmon = Node.objects.get(id="salmon")
    assert (salmon.region_id, salmon.level, salmon.folder) == (
        "transcriptomics",
        "intermediate",
        "transcriptomics/salmon",
    )
    assert salmon.blocks == [block_json(block) for block in content.nodes["salmon"].blocks]
    assert list(Region.objects.order_by("position").values_list("id", flat=True)) == list(
        content.regions
    )


def test_two_rebuilds_give_the_same_index() -> None:
    first = rebuild_index(FIXTURES)
    before = dump()
    second = rebuild_index(FIXTURES)
    assert dump() == before
    assert second.digest == first.digest
    assert IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).count() == 2


def test_links_keep_the_authors_order() -> None:
    rebuild_index(FIXTURES)
    salmon = read_content(FIXTURES).nodes["salmon"]
    for kind, links in (("needs", salmon.needs), ("goes-deeper", salmon.goes_deeper)):
        stored = (
            Link.objects.filter(source_id="salmon", kind=kind)
            .order_by("position")
            .values_list("target_id", flat=True)
        )
        assert list(stored) == [link.node for link in links], kind


def test_a_folder_with_problems_changes_nothing(tmp_path: Path) -> None:
    rebuild_index(FIXTURES)
    before = dump()
    root = copy_of_fixtures(tmp_path)
    shutil.rmtree(root / "statistics" / "em-algorithm")
    expected = [str(problem) for problem in read_content(root).problems]
    assert expected  # salmon, kallisto and variational-bayes-em now point at nothing

    build = rebuild_index(root)

    assert build.outcome == IndexBuild.Outcome.REFUSED
    assert (build.problems, build.node_count) == (expected, 25)
    assert dump() == before
    assert IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).count() == 1


def test_the_digest_tracks_the_index_only(tmp_path: Path) -> None:
    root = copy_of_fixtures(tmp_path)
    first = content_digest(root, read_content(root))
    (root / "README.md").write_text("A readme is not part of the index.\n", encoding="utf-8")
    assert content_digest(root, read_content(root)) == first
    body = root / "statistics" / "likelihood" / "body.md"
    body.write_text(body.read_text(encoding="utf-8") + "One more line.\n", encoding="utf-8")
    assert content_digest(root, read_content(root)) != first


def test_a_failure_while_writing_leaves_the_old_index(monkeypatch: pytest.MonkeyPatch) -> None:
    rebuild_index(FIXTURES)
    before = dump()

    def fail(content: object) -> list[Link]:
        raise RuntimeError("the database went away")

    monkeypatch.setattr(index, "_link_rows", fail)
    with pytest.raises(RuntimeError):
        rebuild_index(FIXTURES)
    assert dump() == before
    assert IndexBuild.objects.count() == 1


def edit(root: Path) -> None:
    """A claim changed, a node removed with the link to it, a node added, needs reordered."""
    regions = set(read_content(root).regions)

    def node(folder: str) -> SchemaNode:
        read, problems = read_node(root / folder, regions=regions, root=root)
        assert read is not None and problems == []
        return read

    likelihood = node("statistics/likelihood")
    write_node_folder(
        replace(likelihood, claim="Likelihood is how probable a model makes the data you saw."),
        root / "statistics" / "likelihood",
    )
    salmon = node("transcriptomics/salmon")
    write_node_folder(
        replace(
            salmon,
            needs=tuple(reversed(salmon.needs)),
            goes_deeper=tuple(
                link for link in salmon.goes_deeper if link.node != "abundance-uncertainty"
            ),
        ),
        root / "transcriptomics" / "salmon",
    )
    shutil.rmtree(root / "statistics" / "abundance-uncertainty")
    write_node_folder(
        SchemaNode(
            id="paired-end-reads",
            title="Paired-end reads",
            claim="Paired-end reads are the two ends of one fragment, read towards each other.",
            region="sequencing",
            level=Level.FOUNDATIONS,
            minutes=8,
            body="Both ends of a fragment are read, which pins down where it came from.\n",
            needs=(
                SchemaLink(
                    node="short-read-sequencing",
                    reason="Paired-end reads come from a short-read sequencer.",
                ),
            ),
        ),
        root / "sequencing" / "paired-end-reads",
    )


def test_a_rebuild_after_an_edit_equals_a_fresh_build(tmp_path: Path) -> None:
    root = copy_of_fixtures(tmp_path)
    rebuild_index(root)
    edit(root)
    assert read_content(root).problems == ()

    rebuild_index(root)
    after_edit = dump()
    Link.objects.all().delete()
    Node.objects.all().delete()
    Region.objects.all().delete()
    rebuild_index(root)

    assert dump() == after_edit
    assert Node.objects.get(id="likelihood").claim.startswith("Likelihood is how probable")
    assert not Node.objects.filter(id="abundance-uncertainty").exists()
    assert Node.objects.filter(id="paired-end-reads").exists()
    needs = (
        Link.objects.filter(source_id="salmon", kind="needs")
        .order_by("position")
        .values_list("target_id", flat=True)
    )
    assert list(needs) == [
        link.node for link in reversed(read_content(FIXTURES).nodes["salmon"].needs)
    ]


# M3 part 1: providers, resources and questions are indexed too (spec M3P1.4).


def test_a_rebuild_stores_providers_resources_and_questions() -> None:
    rebuild_index(FIXTURES)
    assert list(Provider.objects.order_by("position").values_list("id", flat=True)) == [
        "khan-academy",
        "openstax",
        "galaxy-training",
    ]
    node = Node.objects.get(id="de-bruijn-graphs")
    resources = list(node.resources.order_by("position"))
    assert [resource.display for resource in resources] == ["link", "link", "link"]
    assert resources[0].provider_id == "khan-academy"
    assert resources[0].part == ""
    assert resources[0].video == ""  # Khan Academy is linked, never embedded (issue 76)
    questions = list(node.questions.order_by("position"))
    assert [question.question_id for question in questions] == ["kmers-per-read", "shared-unitig"]
    assert questions[0].kind == "number"
    assert questions[0].answer == 5
    assert questions[0].options == []
    assert questions[0].hints and questions[0].rationale
    assert questions[1].options[0] == {"text": "ACGTTG", "right": True}


def test_an_embedded_video_is_stored_with_the_video_it_plays(tmp_path: Path) -> None:
    root = copy_of_fixtures(tmp_path)
    with_an_embedded_video(root)
    rebuild_index(root)
    resource = Node.objects.get(id="de-bruijn-graphs").resources.order_by("position").first()
    assert resource is not None
    assert (resource.provider_id, resource.display) == ("open-video", "embed")
    assert resource.video == "youtube:Jnk_4Maf5Fk"


def test_a_node_with_no_resources_has_none() -> None:
    rebuild_index(FIXTURES)
    assert Node.objects.get(id="probability").resources.count() == 0
    assert Node.objects.get(id="probability").questions.count() == 0


def test_a_second_rebuild_replaces_them() -> None:
    rebuild_index(FIXTURES)
    rebuild_index(FIXTURES)
    assert Resource.objects.filter(node_id="de-bruijn-graphs").count() == 3
    assert Question.objects.filter(node_id="de-bruijn-graphs").count() == 2


def test_the_digest_covers_providers_yaml(tmp_path: Path) -> None:
    before = content_digest(FIXTURES, read_content(FIXTURES))
    root = copy_of_fixtures(tmp_path)
    registry = root / "providers.yaml"
    registry.write_text(registry.read_text().replace("Khan Academy", "Khan academy"))
    assert content_digest(root, read_content(root)) != before


def test_a_refused_build_leaves_the_resources_standing(tmp_path: Path) -> None:
    rebuild_index(FIXTURES)
    root = copy_of_fixtures(tmp_path)
    (root / "providers.yaml").unlink()
    build = rebuild_index(root)
    assert build.outcome == IndexBuild.Outcome.REFUSED
    assert Resource.objects.filter(node_id="de-bruijn-graphs").count() == 3
    assert Provider.objects.count() == 3


# M4.1.2: the index keeps each node's body as blocks (spec M4B.5).


def test_a_rebuild_stores_each_nodes_blocks() -> None:
    rebuild_index(FIXTURES)
    stored = Node.objects.get(id="de-bruijn-graphs").blocks
    assert [block["kind"] for block in stored] == ["text", "try", "text", "try", "text"]
    assert stored[1] == {"kind": "try", "question": "kmers-per-read"}
    callout = Node.objects.get(id="tpm").blocks[1]
    assert (callout["kind"], callout["callout"]) == ("callout", "misconception")
