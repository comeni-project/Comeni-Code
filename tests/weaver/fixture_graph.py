"""The Salmon fixtures as the weaver's graph, for the tests (spec M2P1.7).

Tests never read the real content repository (R1).
"""

from pathlib import Path

from code_schema.content import read_content
from code_weaver.graph import Graph, Need, Topic

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "salmon"


def fixture_graph(*, every_level: str | None = None) -> Graph:
    """The fixtures' graph; with `every_level`, every topic is given that level instead."""
    content = read_content(FIXTURES)
    assert content.problems == ()
    topics = [
        Topic(
            id=node.id,
            region=node.region,
            level=every_level or node.level.value,
            needs=tuple(Need(node=link.node, reason=link.reason) for link in node.needs),
        )
        for node in content.nodes.values()
    ]
    return Graph(topics, list(content.regions))
