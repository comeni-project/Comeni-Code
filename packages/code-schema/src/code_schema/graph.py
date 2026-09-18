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
    problems += _cycles(nodes, folders, link_lines)
    return problems


def strongly_connected(graph: dict[str, list[str]]) -> list[list[str]]:
    """Tarjan's algorithm, iteratively, so a deep chain cannot hit Python's recursion limit.

    Each group is sorted, and nodes and neighbours are visited in sorted order.
    """
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    groups: list[list[str]] = []
    counter = 0

    def visit(node: str) -> None:
        nonlocal counter
        index[node] = low[node] = counter
        counter += 1
        stack.append(node)
        on_stack.add(node)

    for start in sorted(graph):
        if start in index:
            continue
        visit(start)
        work = [(start, iter(sorted(graph.get(start, []))))]
        while work:
            node, successors = work[-1]
            descended = False
            for successor in successors:
                if successor not in index:
                    visit(successor)
                    work.append((successor, iter(sorted(graph.get(successor, [])))))
                    descended = True
                    break
                if successor in on_stack:
                    low[node] = min(low[node], index[successor])
            if descended:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
            if low[node] == index[node]:
                group: list[str] = []
                while True:
                    member = stack.pop()
                    on_stack.discard(member)
                    group.append(member)
                    if member == node:
                        break
                groups.append(sorted(group))
    return groups


def shortest_ring(graph: dict[str, list[str]], start: str, members: set[str]) -> list[str]:
    """The shortest way from `start` back to itself inside `members`, ending where it began.

    Breadth-first over sorted neighbours, so the same tangle always gives the same ring.
    """
    parent: dict[str, str] = {}
    frontier = [start]
    seen = {start}
    while frontier:
        following: list[str] = []
        for node in frontier:
            for successor in sorted(graph.get(node, [])):
                if successor not in members:
                    continue
                if successor == start:
                    chain = [node]
                    while chain[-1] != start:
                        chain.append(parent[chain[-1]])
                    return [*reversed(chain), start]
                if successor not in seen:
                    seen.add(successor)
                    parent[successor] = node
                    following.append(successor)
        frontier = following
    return [start]


def _cycles(
    nodes: dict[str, Node],
    folders: dict[str, str],
    link_lines: dict[str, dict[tuple[str, str], int]],
) -> list[Problem]:
    """One message per tangle, with one whole ring through its alphabetically first node.

    Every elementary cycle can be exponentially many, and five messages about one tangle hide the
    one wrong edge; the author needs a whole ring to find it.
    """
    problems: list[Problem] = []
    for kind, attribute in (("needs", "needs"), ("goes-deeper", "goes_deeper")):
        graph = {
            node_id: [link.node for link in getattr(node, attribute) if link.node in nodes]
            for node_id, node in nodes.items()
        }
        for group in strongly_connected(graph):
            if len(group) < 2:
                continue  # a node linking to itself is refused per node (part 2)
            start = group[0]
            ring = shortest_ring(graph, start, set(group))
            message = f"a cycle — {' → '.join(ring)}"
            if (more := len(group) - (len(ring) - 1)) > 0:
                noun, verb = ("node", "is") if more == 1 else ("nodes", "are")
                message += f", and {more} more {noun} {verb} caught in it"
            problems.append(
                Problem(
                    file=f"{folders[start]}/{NODE_FILE}",
                    field=kind,
                    line=link_lines.get(start, {}).get((kind, ring[1])),
                    message=message,
                )
            )
    return problems
