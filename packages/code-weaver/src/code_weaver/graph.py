"""The weaver's graph: topics, their needs, and the region and level orders (spec M2P1.2).

It is checked when it is built (M2P1.3), so a weave never fails for a reason of the graph's own.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass


class GraphError(ValueError):
    """The graph is wrong. Every problem, as (code, message), in a fixed order; printed one per
    line as `CODE message`. The codes are CW codes declared in code-schema's registry (spec M4D.4);
    they are written here as literals so the weaver imports nothing outside the standard library.
    """

    def __init__(self, problems: Sequence[tuple[str, str]]) -> None:
        self.problems = tuple(problems)
        super().__init__("\n".join(f"{code} {message}" for code, message in self.problems))


@dataclass(frozen=True)
class Need:
    node: str
    reason: str


@dataclass(frozen=True)
class Topic:
    id: str
    region: str
    level: str
    needs: tuple[Need, ...]  # the author's order


class Graph:
    """Topics by id, and the region and level orders, lowest level first."""

    def __init__(
        self, topics: Iterable[Topic], regions: Sequence[str], levels: Sequence[str]
    ) -> None:
        by_id: dict[str, Topic] = {}
        duplicates: list[tuple[str, str]] = []
        for topic in topics:
            if topic.id in by_id:
                duplicates.append(("CW0001", f"duplicate id: {topic.id}"))
            else:
                by_id[topic.id] = topic
        known = set(regions)
        problems = duplicates
        problems += [
            ("CW0002", f"{t.id}: region {t.region} is not in the region list")
            for t in by_id.values()
            if t.region not in known
        ]
        known_levels = set(levels)
        problems += [
            ("CW0003", f"{t.id}: level {t.level} is not in the level list")
            for t in by_id.values()
            if t.level not in known_levels
        ]
        problems += [
            ("CW0004", f"{t.id}: needs {need.node}, which is not in the graph")
            for t in by_id.values()
            for need in t.needs
            if need.node not in by_id
        ]
        edges = {t.id: [n.node for n in t.needs if n.node in by_id] for t in by_id.values()}
        problems += [("CW0005", f"needs cycle: {' → '.join(ring)}") for ring in _rings(edges)]
        if problems:
            raise GraphError(problems)
        self.topics: Mapping[str, Topic] = by_id
        self.regions: tuple[str, ...] = tuple(regions)
        self.levels: tuple[str, ...] = tuple(levels)


def _rings(graph: dict[str, list[str]]) -> list[list[str]]:
    """One ring per tangle, through its alphabetically first topic; tangles in that order."""
    rings: list[list[str]] = []
    for group in sorted(_strongly_connected(graph)):
        start = group[0]
        if len(group) == 1 and start not in graph[start]:
            continue
        rings.append(_shortest_ring(graph, start, set(group)))
    return rings


def _strongly_connected(graph: dict[str, list[str]]) -> list[list[str]]:
    """Tarjan's algorithm, iteratively, as `code-schema`'s graph rules do; each group sorted."""
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
        work = [(start, iter(sorted(graph[start])))]
        while work:
            node, successors = work[-1]
            descended = False
            for successor in successors:
                if successor not in index:
                    visit(successor)
                    work.append((successor, iter(sorted(graph[successor]))))
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


def _shortest_ring(graph: dict[str, list[str]], start: str, members: set[str]) -> list[str]:
    """The shortest way from `start` back to itself inside `members`, breadth first."""
    parent: dict[str, str] = {}
    frontier = [start]
    seen = {start}
    while frontier:
        following: list[str] = []
        for node in frontier:
            for successor in sorted(graph[node]):
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
