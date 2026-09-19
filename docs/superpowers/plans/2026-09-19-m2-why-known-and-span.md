# M2 part 2 — why, known, and level span: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a route lists, for each stop, the stops on it that need it with their stored reasons;
`weave` takes a known set; `Graph` takes the level order and the route reports its span.

**Architecture:** additions to part 1's `code_weaver.graph` and `code_weaver.weave`. `Graph`
gains a `levels` argument, checked like `regions`. `weave` gains `known=()`: the walk back stops at
a known topic. After ordering, `needed_by` is a lookup over the stops' stored needs, and `span`
is the lowest and highest stop level in `graph.levels` order.

**Tech Stack:** Python 3.14 standard library; pytest; mypy strict; ruff.

**Spec:** `docs/superpowers/specs/2026-09-19-m2-why-known-and-span-design.md`

## Global Constraints

- `code-weaver` imports only what `ALLOWED["code-weaver"]` lists (`__future__`,
  `collections.abc`, `dataclasses`, `heapq`, `typing`); this plan adds none.
- Tests never read `../comeni-code-content` (R1).
- No set iteration or hash decides any output; `needed_by` is a `dict` filled in route order.
- Part 1's tests change only to pass `levels`, and to compare `goals` and `stops` where they
  built a whole `Route` (M2P2.6).
- Ruff line length 100; never commit to `main`; Conventional Commits with a body ending
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Checks before each commit: `uv run ruff check . && uv run ruff format --check . && uv run mypy
  && uv run pytest`.

---

## File structure

| File | Change |
|---|---|
| `packages/code-weaver/src/code_weaver/graph.py` | `levels` argument, its check, `Graph.levels` |
| `packages/code-weaver/src/code_weaver/weave.py` | `NeededBy`; `Route.needed_by`, `Route.span`; `known`; needs off the route ignored when ordering |
| `tests/weaver/fixture_graph.py` | `LEVELS` from `code-schema`'s `Level`; passed to `Graph` |
| `tests/weaver/test_graph.py` | `levels` passed; the unknown-level test; the fixed-order test gains a line |
| `tests/weaver/test_weave.py` | `levels` passed; two whole-`Route` comparisons become field comparisons; the new tests |
| `tests/guards/weave_probe.py` | `levels` passed |

---

### Task 1: The level order in `Graph`

**Files:**
- Modify: `packages/code-weaver/src/code_weaver/graph.py`, `tests/weaver/fixture_graph.py`,
  `tests/weaver/test_graph.py`, `tests/weaver/test_weave.py`, `tests/guards/weave_probe.py`

**Interfaces:**
- Produces: `Graph(topics: Iterable[Topic], regions: Sequence[str], levels: Sequence[str])` with
  `Graph.levels: tuple[str, ...]`; `fixture_graph.LEVELS: list[str]`.

- [ ] **Step 1: Write the failing tests**

In `tests/weaver/test_graph.py`, add `LEVELS` below `REGIONS`, give `topic` a `level`
parameter, and pass `LEVELS` wherever a `Graph` is built:

```python
REGIONS = ["biology", "statistics"]
LEVELS = ["first-steps", "foundations"]


def topic(name: str, *needs: str, region: str = "biology", level: str = "foundations") -> Topic:
    return Topic(
        id=name,
        region=region,
        level=level,
        needs=tuple(Need(node=n, reason=f"{name} uses {n}") for n in needs),
    )


def refusal(topics: list[Topic], regions: list[str] = REGIONS) -> str:
    with pytest.raises(GraphError) as caught:
        Graph(topics, regions, LEVELS)
    return str(caught.value)
```

In `test_a_sound_graph_keeps_its_topics_and_region_order`, build with
`Graph([topic("b", "a"), topic("a")], REGIONS, LEVELS)` and add
`assert graph.levels == ("first-steps", "foundations")`. Add:

```python
def test_an_unknown_level_is_refused() -> None:
    assert refusal([topic("a", level="nowhere")]) == "a: level nowhere is not in the level list"
```

and in `test_every_problem_is_listed_in_a_fixed_order` add `topic("s", level="nowhere")` to the
topics and `"s: level nowhere is not in the level list"` right after the region line.

In `tests/weaver/fixture_graph.py`:

```python
from code_schema.node import Level

LEVELS = [level.value for level in Level]
```

and `return Graph(topics, list(content.regions), LEVELS)`.

In `tests/weaver/test_weave.py`, the three hand-built graphs pass `["foundations"]` as levels, and
the reversed graph passes `graph.levels`:

```python
    reversed_graph = Graph(reversed(list(graph.topics.values())), graph.regions, graph.levels)
```

In `tests/guards/weave_probe.py`, `["r"]` becomes `["r"], ["first-steps", "foundations"]`.

- [ ] **Step 2: Run them to see them fail**

Run: `uv run pytest tests/weaver tests/guards -q`
Expected: failures with `TypeError: Graph.__init__() takes 3 positional arguments but 4 were given`.

- [ ] **Step 3: Add the level order to `Graph`**

In `packages/code-weaver/src/code_weaver/graph.py`, the signature, the check after the region
check, and the attribute:

```python
    def __init__(
        self, topics: Iterable[Topic], regions: Sequence[str], levels: Sequence[str]
    ) -> None:
```

```python
        known_levels = set(levels)
        problems += [
            f"{t.id}: level {t.level} is not in the level list"
            for t in by_id.values()
            if t.level not in known_levels
        ]
```

```python
        self.levels: tuple[str, ...] = tuple(levels)
```

The class docstring becomes `"""Topics by id, and the region and level orders, lowest level
first."""`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `uv run pytest tests/weaver tests/guards -q`
Expected: all pass.

- [ ] **Step 5: Run the checks and commit**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
git add packages/code-weaver tests/weaver tests/guards/weave_probe.py
git commit -m "feat(weaver): the graph takes the level order" -m "Graph(topics, regions, levels) refuses a topic whose level is not in the list, after the region problems (spec M2P2.4). Tests fill it from code-schema's Level." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `needed_by`, `known` and the span

**Files:**
- Modify: `packages/code-weaver/src/code_weaver/weave.py`, `tests/weaver/test_weave.py`
- Create: `docs/notes/journal/2026-09-19-m2-part-2-why-known-and-span.md`
- Modify: `docs/notes/journal/README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `Graph.levels` from Task 1.
- Produces: `NeededBy(node: str, reason: str)`; `Route(goals, stops, needed_by:
  Mapping[str, tuple[NeededBy, ...]], span: tuple[str, str])`;
  `weave(graph: Graph, goals: Iterable[str], known: Iterable[str] = ()) -> Route`.

- [ ] **Step 1: Adjust part 1's two whole-`Route` comparisons**

In `tests/weaver/test_weave.py`:

```python
def test_salmon_gives_the_seventeen_stops_in_order() -> None:
    route = weave(fixture_graph(), ["salmon"])
    assert (route.goals, route.stops) == (("salmon",), SALMON_ROUTE)
```

```python
def test_goals_are_a_set() -> None:
    graph = fixture_graph()
    route = weave(graph, ["tpm", "salmon", "tpm"])
    assert (route.goals, route.stops) == (("salmon", "tpm"), SALMON_ROUTE)
    assert weave(graph, ["salmon", "tpm"]) == route
```

The `Route` import is no longer used there; import `NeededBy` instead (Step 2 uses it).

- [ ] **Step 2: Write the failing tests**

Append to `tests/weaver/test_weave.py`:

```python
LEARNED_FIRST = ("read-mapping", "k-mers", "sequence-alignment")


def test_a_stop_lists_the_route_stops_that_need_it_with_their_reasons() -> None:
    route = weave(fixture_graph(), ["salmon"])
    assert route.needed_by["transcripts-and-isoforms"] == (
        NeededBy(
            node="multi-mapping-reads",
            reason="Isoforms share exons, so a read from a shared exon fits all of them.",
        ),
        NeededBy(node="tpm", reason="TPM is measured per transcript."),
        NeededBy(
            node="salmon",
            reason="Salmon estimates abundance per transcript, and isoforms are why that is hard.",
        ),
    )


def test_needed_by_is_the_stored_needs_on_the_route_for_every_goal() -> None:
    graph = fixture_graph()
    for goal in graph.topics:
        route = weave(graph, [goal])
        assert tuple(route.needed_by) == route.stops
        for stop in route.stops:
            users = [s for s in route.stops if any(n.node == stop for n in graph.topics[s].needs)]
            assert [entry.node for entry in route.needed_by[stop]] == users, (goal, stop)


def test_a_goal_is_needed_only_by_other_goals() -> None:
    graph = fixture_graph()
    assert weave(graph, ["salmon"]).needed_by["salmon"] == ()
    both = weave(graph, ["salmon", "tpm"]).needed_by
    assert [entry.node for entry in both["tpm"]] == ["salmon"]


def test_the_walk_stops_at_a_known_topic() -> None:
    route = weave(fixture_graph(), ["salmon"], known=["read-mapping"])
    assert route.stops == tuple(s for s in SALMON_ROUTE if s not in LEARNED_FIRST)
    assert len(route.stops) == 14
    assert [entry.node for entry in route.needed_by["short-read-sequencing"]] == [
        "fastq-and-quality-scores",
        "rna-seq-libraries",
    ]


def test_known_edge_cases() -> None:
    graph = fixture_graph()
    assert weave(graph, ["salmon"], known=["salmon"]).stops == SALMON_ROUTE
    assert weave(graph, ["salmon"], known=["no-such-topic"]).stops == SALMON_ROUTE
    assert weave(graph, ["salmon"], known=["read-mapping", "k-mers", "read-mapping"]) == weave(
        graph, ["salmon"], known=["k-mers", "read-mapping"]
    )


def test_the_span_follows_the_level_order() -> None:
    graph = fixture_graph()
    assert weave(graph, ["salmon"]).span == ("first-steps", "intermediate")
    assert weave(graph, ["em-algorithm"]).span == ("first-steps", "intermediate")
    assert weave(graph, ["dna-and-genes"]).span == ("first-steps", "first-steps")


def test_every_level_changed_keeps_the_route_and_spans_one_level() -> None:
    route = weave(fixture_graph(every_level="advanced"), ["salmon"])
    assert route.stops == SALMON_ROUTE
    assert route.span == ("advanced", "advanced")
```

In `test_fresh_processes_print_byte_identical_routes`, the last line becomes:

```python
    assert b"NeededBy(node='salmon'" in outputs.pop()
```

- [ ] **Step 3: Run them to see them fail**

Run: `uv run pytest tests/weaver/test_weave.py -q`
Expected: `ImportError: cannot import name 'NeededBy'`.

- [ ] **Step 4: Write the additions to `weave.py`**

`packages/code-weaver/src/code_weaver/weave.py` becomes:

```python
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `uv run pytest tests/weaver tests/guards -q`
Expected: all pass.

- [ ] **Step 6: See each pin fail once, then restore**

1. In `_order`, drop `if need.node in position`: the known-topic tests fail (a `KeyError`, or
   stops never placed).
2. In `_needed_by`, drop `need.node in on_route and`: the known-topic tests fail with a `KeyError`
   (only a held topic is needed by a stop without being one).
3. In `_span`, use `min(levels)` and `max(levels)` of the plain strings: the *em-algorithm* span
   test fails (`introductory` sorts after `intermediate` alphabetically).
4. In `_walk_back`, append a held topic before the `continue`: the known tests fail.

Restore each before the next.

- [ ] **Step 7: The journal and CLAUDE.md**

- `docs/notes/journal/2026-09-19-m2-part-2-why-known-and-span.md`, in the README's order: where
  things stand (each claim with its `uv run pytest tests/weaver -k …` command), what changed
  (commit hashes), decisions and why (the three questions, and the operator's direction to build
  on the stored reasons rather than W3.3's chain), departures from this plan, what is next
  (part 3, the CLI), open questions, traps.
- `docs/notes/journal/README.md`: the box names the new entry; a table row above part 1's.
- `CLAUDE.md`: the status says M2 parts 1 and 2 are built and part 3 (the CLI) is next; the layout
  line becomes `packages/code-weaver/     pure: Graph and weave (M2 parts 1–2)`.

- [ ] **Step 8: Run the checks, commit, push, and merge only on green**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
git add packages/code-weaver tests/weaver docs/notes/journal CLAUDE.md
git commit -m "feat(weaver): needed_by, known and the level span" -m "Each stop lists the stops on the route that need it with their stored reasons; the walk back stops at a known topic; the route reports its span in the graph's level order (spec M2P2)." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin m2-part-2-why-known-and-span
gh pr create --title "M2 part 2: why, known and level span" --body "…ending with the Claude Code line"
gh pr checks <n> --watch > "$SCRATCH/checks.out" 2>&1; echo $? > "$SCRATCH/checks.rc"
```

Merge only if `checks.rc` holds `0`.
