"""The rules that need more than one node (spec M1P3.4).

Every message points at a line that exists: the missing half of a related link has no line, so
the message goes on the half that is written. A link to a node that exists but did not parse is
not checked further — that node's own problems are already reported, and one mistake should not
appear as five.
"""

from __future__ import annotations

import difflib

from code_schema.links import Link
from code_schema.node import NODE_FILE, Level, Node
from code_schema.problems import Problem

_ORDER = {level: index for index, level in enumerate(Level)}


def _links(node: Node) -> list[tuple[str, Link]]:
    return [
        *(("needs", link) for link in node.needs),
        *(("goes-deeper", link) for link in node.goes_deeper),
        *(("related", link) for link in node.related),
    ]


def graph_problems(
    nodes: dict[str, Node],
    folders: dict[str, str],
    link_lines: dict[str, dict[tuple[str, str], int]],
) -> list[Problem]:
    """Targets exist, related is on both nodes, goes-deeper never points down, no cycles."""
    problems: list[Problem] = []
    ids = sorted(folders)

    def at(node: Node, kind: str, target: str, message: str) -> Problem:
        return Problem(
            file=f"{folders[node.id]}/{NODE_FILE}",
            field=kind,
            line=link_lines.get(node.id, {}).get((kind, target)),
            message=message,
        )

    for node in (nodes[node_id] for node_id in sorted(nodes)):
        for kind, link in _links(node):
            target = link.node
            if target not in folders:
                message = f"{target} is not a node"
                if close := difflib.get_close_matches(target, ids, n=1):
                    message += f" — closest is `{close[0]}`"
                problems.append(at(node, kind, target, message))
                continue
            other = nodes.get(target)
            if other is None:
                continue
            if kind == "related" and node.id not in {peer.node for peer in other.related}:
                problems.append(
                    at(
                        node,
                        kind,
                        target,
                        f"{target} does not list {node.id} back "
                        f"— add it to {folders[target]}/{NODE_FILE}",
                    )
                )
            if kind == "goes-deeper" and _ORDER[other.level] < _ORDER[node.level]:
                problems.append(
                    at(
                        node,
                        kind,
                        target,
                        f"{target} is {other.level.value}, below {node.id} ({node.level.value})",
                    )
                )
    return problems
