"""The Salmon fixtures (spec M1P4): real content the validator accepts, and the route's shape.

Parts 5 and 6 load the same folder as their graph.
"""

from pathlib import Path

import pytest

from code_schema.cli import main
from code_schema.content import Content, read_content
from code_schema.node import Level
from code_schema.writer import write_node_yaml

ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "salmon"

ROUTE = {
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
}

# Each attached node, and every link that points at it: (kind, from).
ATTACHED = {
    "pufferfish-index": {("goes-deeper", "salmon")},
    "salmon-bias-models": {("goes-deeper", "salmon")},
    "decoy-sequences": {("goes-deeper", "salmon")},
    "variational-bayes-em": {("goes-deeper", "salmon"), ("goes-deeper", "em-algorithm")},
    "abundance-uncertainty": {("goes-deeper", "salmon")},
    "de-bruijn-graphs": {("goes-deeper", "k-mers"), ("needs", "pufferfish-index")},
    "graphs": {("needs", "de-bruijn-graphs")},
    "dynamic-programming": {("goes-deeper", "sequence-alignment")},
    "kallisto": {("related", "salmon")},
}

LEVELS = list(Level)


@pytest.fixture(scope="module")
def content() -> Content:
    return read_content(ROOT)


def needs_closure(content: Content, start: str) -> set[str]:
    """Every node a learner walks through to reach `start`, and `start` itself."""
    seen: set[str] = set()
    stack = [start]
    while stack:
        node_id = stack.pop()
        if node_id not in seen:
            seen.add(node_id)
            stack.extend(link.node for link in content.nodes[node_id].needs)
    return seen


def incoming(content: Content, target: str) -> set[tuple[str, str]]:
    links: set[tuple[str, str]] = set()
    for node in content.nodes.values():
        for kind, group in (
            ("needs", node.needs),
            ("goes-deeper", node.goes_deeper),
            ("related", node.related),
        ):
            links |= {(kind, node.id) for link in group if link.node == target}
    return links


def test_the_fixtures_have_no_problems(content: Content) -> None:
    assert [str(problem) for problem in content.problems] == []
    assert len(content.nodes) == 26


def test_the_command_accepts_them(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["validate", str(ROOT)]) == 0
    assert capsys.readouterr().out == "26 nodes, no problems\n"


def test_every_node_yaml_is_canonical(content: Content) -> None:
    for node_id, folder in content.folders.items():
        written = (ROOT / folder / "node.yaml").read_text(encoding="utf-8")
        assert written == write_node_yaml(content.nodes[node_id]), node_id


def test_the_route_to_salmon_is_the_seventeen_nodes(content: Content) -> None:
    assert needs_closure(content, "salmon") == ROUTE


def test_the_route_starts_only_at_first_steps(content: Content) -> None:
    starts = {node_id for node_id in ROUTE if not content.nodes[node_id].needs}
    assert starts == {"dna-and-genes", "probability"}
    assert {content.nodes[node_id].level for node_id in starts} == {Level.FIRST_STEPS}


def test_no_need_points_to_a_harder_level(content: Content) -> None:
    climbs = [
        (node.id, link.node)
        for node in content.nodes.values()
        for link in node.needs
        if LEVELS.index(content.nodes[link.node].level) > LEVELS.index(node.level)
    ]
    assert climbs == []


def test_each_attached_node_hangs_off_by_its_links(content: Content) -> None:
    assert set(content.nodes) == ROUTE | set(ATTACHED)
    for node_id, links in ATTACHED.items():
        assert incoming(content, node_id) == links, node_id


def test_kallisto_and_salmon_are_peers(content: Content) -> None:
    assert [link.node for link in content.nodes["salmon"].related] == ["kallisto"]
    assert [link.node for link in content.nodes["kallisto"].related] == ["salmon"]
