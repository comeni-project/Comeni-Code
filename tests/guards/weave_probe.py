"""Imported under the runtime purity hook: builds a small graph and weaves it (spec M2P1.6)."""

from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import weave

GRAPH = Graph(
    [
        Topic(id="a", region="r", level="first-steps", needs=()),
        Topic(id="b", region="r", level="foundations", needs=(Need(node="a", reason="b uses a"),)),
    ],
    ["r"],
    ["first-steps", "foundations"],
)

if weave(GRAPH, ["b"]).stops != ("a", "b"):
    raise RuntimeError("the probe's weave gave the wrong route")
