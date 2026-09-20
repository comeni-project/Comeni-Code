"""Walk back from the goals, order the stops, and say why each is there (spec M2P1.4, M2P2).

W3.3 steps 2, 4, 5 and 6.
"""

import heapq
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass

from code_weaver.graph import Graph


class UnknownGoal(LookupError):
    """Goal ids that are not in the graph: a bad request, not a bad graph."""

    def __init__(self, ids: Sequence[str]) -> None:
        self.ids = tuple(ids)
        super().__init__(f"not in the graph: {', '.join(self.ids)}")


@dataclass(frozen=True)
class NeededBy:
    node: str  # the stop that needs this one
    reason: str  # the reason stored on that stop's needs link


@dataclass(frozen=True)
class Route:
    goals: tuple[str, ...]  # sorted, no repeats
    stops: tuple[str, ...]  # in order; the goals are stops too
    needed_by: Mapping[str, tuple[NeededBy, ...]]  # every stop, in route order
    span: tuple[str, str]  # (lowest, highest) level among the stops


def weave(graph: Graph, goals: Iterable[str], known: Iterable[str] = ()) -> Route:
    wanted = tuple(sorted(set(goals)))
    if not wanted:
        raise ValueError("a route needs at least one goal")
    missing = [goal for goal in wanted if goal not in graph.topics]
    if missing:
        raise UnknownGoal(missing)
    held = {topic for topic in known if topic in graph.topics} - set(wanted)
    stops = _order(graph, _walk_back(graph, wanted, held))
    return Route(
        goals=wanted, stops=stops, needed_by=_needed_by(graph, stops), span=_span(graph, stops)
    )


def _walk_back(graph: Graph, goals: Sequence[str], held: set[str]) -> list[str]:
    """Every topic the goals need, in the order first reached; the walk stops at a held topic."""
    reached: list[str] = []
    seen: set[str] = set()
    for goal in goals:
        stack = [goal]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            if current in held:
                continue
            reached.append(current)
            stack.extend(need.node for need in reversed(graph.topics[current].needs))
    return reached


def _order(graph: Graph, reached: Sequence[str]) -> tuple[str, ...]:
    """Each stop after all it needs on the route; ties by region, then first-reached position."""
    rank = {region: i for i, region in enumerate(graph.regions)}
    position = {stop: i for i, stop in enumerate(reached)}
    waiting: dict[str, int] = {}
    users: dict[str, list[str]] = {stop: [] for stop in reached}
    for stop in reached:
        needed = dict.fromkeys(
            need.node for need in graph.topics[stop].needs if need.node in position
        )
        waiting[stop] = len(needed)
        for node in needed:
            users[node].append(stop)
    ready = [(rank[graph.topics[s].region], position[s], s) for s in reached if not waiting[s]]
    heapq.heapify(ready)
    stops: list[str] = []
    while ready:
        _, _, stop = heapq.heappop(ready)
        stops.append(stop)
        for user in users[stop]:
            waiting[user] -= 1
            if not waiting[user]:
                heapq.heappush(ready, (rank[graph.topics[user].region], position[user], user))
    return tuple(stops)


def _needed_by(graph: Graph, stops: Sequence[str]) -> dict[str, tuple[NeededBy, ...]]:
    """For each stop, the stops on the route that need it, in route order, with stored reasons."""
    on_route = set(stops)
    found: dict[str, list[NeededBy]] = {stop: [] for stop in stops}
    for stop in stops:
        named: set[str] = set()
        for need in graph.topics[stop].needs:
            if need.node in on_route and need.node not in named:
                named.add(need.node)
                found[need.node].append(NeededBy(node=stop, reason=need.reason))
    return {stop: tuple(found[stop]) for stop in stops}


def _span(graph: Graph, stops: Sequence[str]) -> tuple[str, str]:
    """The lowest and highest level among the stops, in the graph's level order."""
    rank = {level: i for i, level in enumerate(graph.levels)}
    levels = sorted((graph.topics[stop].level for stop in stops), key=rank.__getitem__)
    return (levels[0], levels[-1])
