"""`flow`: boxes and arrows, laid out in the browser (M6.4 spec, M6FG.3).

Cycles are allowed: the layout breaks them. The checks are what a schema cannot say: every edge
and group names something that exists, and no id is used twice.
"""

from collections.abc import Mapping

from code_figures.findings import Finding

MISSING = "CS1007"  # an edge or a node's group naming nothing
TWICE = "CS1008"  # an id used twice

STARTER: Mapping[str, object] = {
    "nodes": [{"id": "reads", "label": "reads"}, {"id": "k-mers", "label": "k-mers"}],
    "edges": [{"from": "reads", "to": "k-mers"}],
}


def _ids(items: list[Mapping[str, object]], where: str) -> tuple[set[object], list[Finding]]:
    seen: set[object] = set()
    found: list[Finding] = []
    for at, item in enumerate(items):
        if item["id"] in seen:
            found.append(Finding(TWICE, f"{where}[{at}].id", f"{item['id']} is used twice"))
        seen.add(item["id"])
    return seen, found


def check(data: Mapping[str, object]) -> list[Finding]:
    nodes, edges = data["nodes"], data["edges"]
    groups = data.get("groups", [])
    assert isinstance(nodes, list) and isinstance(edges, list) and isinstance(groups, list)
    names, found = _ids(nodes, "data.nodes")
    group_names, twice = _ids(groups, "data.groups")
    found += twice
    for at, node in enumerate(nodes):
        if "group" in node and node["group"] not in group_names:
            found.append(
                Finding(MISSING, f"data.nodes[{at}].group", f"no group is {node['group']}")
            )
    for at, edge in enumerate(edges):
        for end in ("from", "to"):
            if edge[end] not in names:
                found.append(Finding(MISSING, f"data.edges[{at}].{end}", f"no node is {edge[end]}"))
    return found


def derive(data: Mapping[str, object]) -> dict[str, object]:
    return {}
