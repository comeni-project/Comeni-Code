"""The index and its rebuild (spec M1P5): all or nothing, the same twice, converging after edits.

Reads only the part 4 fixtures, or copies of them in tmp_path (R1). Needs Compose's Postgres.
"""

import shutil
from pathlib import Path
from typing import Any

import pytest

from code_api.content.index import content_digest, rebuild_index
from code_api.content.models import IndexBuild, Link, Node, Region
from code_schema import read_content

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"

pytestmark = pytest.mark.django_db


def dump() -> tuple[list[Any], ...]:
    """Every row of the three index tables, sorted: two equal dumps are the same index."""
    return (
        sorted(Region.objects.values_list("id", "name", "position")),
        sorted(
            Node.objects.values_list(
                "id", "title", "claim", "region_id", "level", "minutes", "body", "folder"
            )
        ),
        sorted(Link.objects.values_list("source_id", "kind", "position", "target_id", "reason")),
    )


def copy_of_fixtures(tmp_path: Path) -> Path:
    root = tmp_path / "content"
    shutil.copytree(FIXTURES, root)
    return root


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
    assert salmon.body == content.nodes["salmon"].body
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
