"""Walk back from the goals and order the stops (spec M2P1.4; W3.3 steps 2 and 5)."""

import heapq
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from code_weaver.graph import Graph


class UnknownGoal(LookupError):
    """Goal ids that are not in the graph: a bad request, not a bad graph."""

    def __init__(self, ids: Sequence[str]) -> None:
        self.ids = tuple(ids)
        super().__init__(f"not in the graph: {', '.join(self.ids)}")


@dataclass(frozen=True)
class Route:
    goals: tuple[str, ...]  # sorted, no repeats
    stops: tuple[str, ...]  # in order; the goals are stops too


def weave(graph: Graph, goals: Iterable[str]) -> Route:
    wanted = tuple(sorted(set(goals)))
    if not wanted:
        raise ValueError("a route needs at least one goal")
    missing = [goal for goal in wanted if goal not in graph.topics]
    if missing:
        raise UnknownGoal(missing)
    return Route(goals=wanted, stops=_order(graph, _walk_back(graph, wanted)))


def _walk_back(graph: Graph, goals: Sequence[str]) -> list[str]:
    """Every topic the goals need, in the order first reached: depth first, the author's order."""
    reached: list[str] = []
    seen: set[str] = set()
    for goal in goals:
        stack = [goal]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            reached.append(current)
            stack.extend(need.node for need in reversed(graph.topics[current].needs))
    return reached


def _order(graph: Graph, reached: Sequence[str]) -> tuple[str, ...]:
    """Each stop after all it needs; ties by region's position, then first-reached position."""
    rank = {region: i for i, region in enumerate(graph.regions)}
    position = {stop: i for i, stop in enumerate(reached)}
    waiting: dict[str, int] = {}
    users: dict[str, list[str]] = {stop: [] for stop in reached}
    for stop in reached:
        needed = dict.fromkeys(need.node for need in graph.topics[stop].needs)
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
