# M2 part 1 — walk back and order: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `code-weaver` turns a checked graph and goal ids into an ordered route over *needs*
links, and the runtime purity guard runs a weave.

**Architecture:** `code_weaver.graph` holds the weaver's own types (`Need`, `Topic`, `Graph`);
`Graph(...)` checks itself and raises `GraphError`. `code_weaver.weave` walks *needs* back from the
sorted goals, depth first in the author's order, then orders the stops with a heap keyed by
(region position, first-reached position). Tests fill the graph from `tests/fixtures/salmon`
through `code-schema`'s `read_content`; the package itself imports nothing outside the standard
library.

**Tech Stack:** Python 3.14 standard library only (`dataclasses`, `collections.abc`, `heapq`);
pytest; mypy strict; ruff.

**Spec:** `docs/superpowers/specs/2026-09-19-m2-walk-back-and-order-design.md`

## Global Constraints

- `code-weaver` is pure: it imports only what `tests/guards/purity.py`'s `ALLOWED["code-weaver"]`
  lists, and adding a module there is a reviewed change (Task 1 adds three).
- Tests never read `../comeni-code-content` (R1); they read `tests/fixtures/salmon/`.
- No set iteration or hash decides any output; outputs are tuples (M2P1.4).
- Ruff line length 100; ruff also formats Python blocks inside Markdown.
- Never commit to `main`; the work is on `m2-part-1-walk-back-and-order`.
- Commits are Conventional Commits with a body, ending
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Checks before each commit: `uv run ruff check . && uv run ruff format --check . && uv run mypy
  && uv run pytest`.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/code-weaver/src/code_weaver/graph.py` (create) | `Need`, `Topic`, `GraphError`, `Graph`; the build-time checks; the cycle search |
| `packages/code-weaver/src/code_weaver/weave.py` (create) | `Route`, `UnknownGoal`, `weave`; walk back and order |
| `packages/code-weaver/src/code_weaver/__init__.py` (modify) | docstring only |
| `tests/guards/purity.py` (modify) | `code-weaver`'s allowlist gains `collections.abc`, `dataclasses`, `heapq` |
| `tests/weaver/test_graph.py` (create) | the graph's checks |
| `tests/weaver/fixture_graph.py` (create) | the Salmon fixtures as a `Graph`, for tests |
| `tests/weaver/test_weave.py` (create) | the route, its order, goals, errors, determinism |
| `tests/guards/weave_probe.py` (create) | imported under the runtime hook; runs a weave |
| `tests/guards/test_purity_runtime.py` (modify) | a test that runs `weave_probe`; docstring |

---

### Task 1: The graph and its checks

**Files:**
- Create: `packages/code-weaver/src/code_weaver/graph.py`
- Modify: `packages/code-weaver/src/code_weaver/__init__.py`, `tests/guards/purity.py:37`
- Test: `tests/weaver/test_graph.py`

**Interfaces:**
- Produces: `Need(node: str, reason: str)`, `Topic(id: str, region: str, level: str, needs:
  tuple[Need, ...])`, `GraphError(ValueError)`, `Graph(topics: Iterable[Topic], regions:
  Sequence[str])` with attributes `topics: Mapping[str, Topic]` and `regions: tuple[str, ...]`.

- [ ] **Step 1: Write the failing tests**

`tests/weaver/test_graph.py`:

```python
"""The weaver's graph is checked when it is built (spec M2P1.2, M2P1.3)."""

import pytest

from code_weaver.graph import Graph, GraphError, Need, Topic

REGIONS = ["biology", "statistics"]


def topic(name: str, *needs: str, region: str = "biology") -> Topic:
    return Topic(
        id=name,
        region=region,
        level="foundations",
        needs=tuple(Need(node=n, reason=f"{name} uses {n}") for n in needs),
    )


def refusal(topics: list[Topic], regions: list[str] = REGIONS) -> str:
    with pytest.raises(GraphError) as caught:
        Graph(topics, regions)
    return str(caught.value)


def test_a_sound_graph_keeps_its_topics_and_region_order() -> None:
    graph = Graph([topic("b", "a"), topic("a")], REGIONS)
    assert graph.topics["b"].needs == (Need(node="a", reason="b uses a"),)
    assert sorted(graph.topics) == ["a", "b"]
    assert graph.regions == ("biology", "statistics")


def test_a_duplicate_id_is_refused() -> None:
    assert refusal([topic("a"), topic("a")]) == "duplicate id: a"


def test_an_unknown_region_is_refused() -> None:
    assert refusal([topic("a", region="nowhere")]) == (
        "a: region nowhere is not in the region list"
    )


def test_a_need_outside_the_graph_is_refused() -> None:
    assert refusal([topic("a", "ghost")]) == "a: needs ghost, which is not in the graph"


def test_a_cycle_is_refused_naming_its_ring() -> None:
    assert refusal([topic("a", "b"), topic("b", "c"), topic("c", "a")]) == (
        "needs cycle: a → b → c → a"
    )


def test_a_topic_that_needs_itself_is_a_cycle() -> None:
    assert refusal([topic("a", "a")]) == "needs cycle: a → a"


def test_a_cycle_nothing_leads_to_is_still_refused() -> None:
    topics = [topic("goal", "base"), topic("base"), topic("x", "y"), topic("y", "x")]
    assert refusal(topics) == "needs cycle: x → y → x"


def test_every_problem_is_listed_in_a_fixed_order() -> None:
    topics = [
        topic("p", "q"),
        topic("q", "p"),
        topic("a", "ghost"),
        topic("a"),
        topic("r", region="nowhere"),
    ]
    assert refusal(topics).splitlines() == [
        "duplicate id: a",
        "r: region nowhere is not in the region list",
        "a: needs ghost, which is not in the graph",
        "needs cycle: p → q → p",
    ]
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `uv run pytest tests/weaver/test_graph.py -q`
Expected: collection error, `ModuleNotFoundError: No module named 'code_weaver.graph'`.

- [ ] **Step 3: Widen the allowlist**

In `tests/guards/purity.py`, replace the `code-weaver` line:

```python
    "code-weaver": frozenset({"__future__", "collections.abc", "dataclasses", "heapq", "typing"}),
```

- [ ] **Step 4: Write `graph.py`**

`packages/code-weaver/src/code_weaver/graph.py`:

```python
"""The weaver's graph: topics, their needs and the region order (spec M2P1.2).

It is checked when it is built (M2P1.3), so a weave never fails for a reason of the graph's own.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass


class GraphError(ValueError):
    """The graph is wrong. The message lists every problem, one per line, in a fixed order."""


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
    """Topics by id, and the regions in the order of `regions.yaml`."""

    def __init__(self, topics: Iterable[Topic], regions: Sequence[str]) -> None:
        by_id: dict[str, Topic] = {}
        duplicates: list[str] = []
        for topic in topics:
            if topic.id in by_id:
                duplicates.append(f"duplicate id: {topic.id}")
            else:
                by_id[topic.id] = topic
        known = set(regions)
        problems = duplicates
        problems += [
            f"{t.id}: region {t.region} is not in the region list"
            for t in by_id.values()
            if t.region not in known
        ]
        problems += [
            f"{t.id}: needs {need.node}, which is not in the graph"
            for t in by_id.values()
            for need in t.needs
            if need.node not in by_id
        ]
        edges = {t.id: [n.node for n in t.needs if n.node in by_id] for t in by_id.values()}
        problems += [f"needs cycle: {' → '.join(ring)}" for ring in _rings(edges)]
        if problems:
            raise GraphError("\n".join(problems))
        self.topics: Mapping[str, Topic] = by_id
        self.regions: tuple[str, ...] = tuple(regions)


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
```

And `packages/code-weaver/src/code_weaver/__init__.py` becomes:

```python
"""Comeni Code's weaver: goal ids to a route over needs links (W3.3). Pure: standard library only."""
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `uv run pytest tests/weaver/test_graph.py tests/guards -q`
Expected: all pass.

- [ ] **Step 6: Run the checks and commit**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
git add packages/code-weaver tests/weaver/test_graph.py tests/guards/purity.py
git commit -m "feat(weaver): a graph type checked when built" -m "Need, Topic and Graph are the weaver's own types. Graph refuses duplicate ids, unknown regions, needs outside the graph and needs cycles, one line each in a fixed order (spec M2P1.3). The allowlist gains collections.abc, dataclasses and heapq." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The weave

**Files:**
- Create: `packages/code-weaver/src/code_weaver/weave.py`, `tests/weaver/fixture_graph.py`
- Test: `tests/weaver/test_weave.py`

**Interfaces:**
- Consumes: `Graph`, `Topic`, `Need`, `GraphError` from Task 1.
- Produces: `Route(goals: tuple[str, ...], stops: tuple[str, ...])`,
  `UnknownGoal(LookupError)` with `.ids: tuple[str, ...]`,
  `weave(graph: Graph, goals: Iterable[str]) -> Route`;
  the test helper `fixture_graph(*, every_level: str | None = None) -> Graph`.

- [ ] **Step 1: Write the fixture helper**

`tests/weaver/fixture_graph.py`:

```python
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
```

- [ ] **Step 2: Write the failing tests**

`tests/weaver/test_weave.py`:

```python
"""Walk back and order (spec M2P1.4, M2P1.5, M2P1.7)."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from code_schema.content import read_content
from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import Route, UnknownGoal, weave
from weaver.fixture_graph import FIXTURES, fixture_graph

TESTS = Path(__file__).resolve().parents[1]

SALMON_ROUTE = (
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
)


def topic(name: str, *needs: str, region: str = "a-region") -> Topic:
    return Topic(
        id=name,
        region=region,
        level="foundations",
        needs=tuple(Need(node=n, reason=f"{name} uses {n}") for n in needs),
    )


def test_salmon_gives_the_seventeen_stops_in_order() -> None:
    assert weave(fixture_graph(), ["salmon"]) == Route(goals=("salmon",), stops=SALMON_ROUTE)


def test_every_stop_follows_all_it_needs_for_every_goal() -> None:
    graph = fixture_graph()
    for goal in graph.topics:
        stops = weave(graph, [goal]).stops
        place = {stop: i for i, stop in enumerate(stops)}
        assert stops[-1] == goal
        for stop in stops:
            for need in graph.topics[stop].needs:
                assert place[need.node] < place[stop], (goal, stop, need.node)


def test_only_needs_are_followed() -> None:
    salmon = read_content(FIXTURES).nodes["salmon"]
    off_route = {link.node for link in (*salmon.goes_deeper, *salmon.related)}
    assert len(off_route) == 6
    assert off_route.isdisjoint(weave(fixture_graph(), ["salmon"]).stops)


def test_levels_never_change_the_route() -> None:
    for level in ("first-steps", "advanced"):
        assert weave(fixture_graph(every_level=level), ["salmon"]).stops == SALMON_ROUTE


def test_topic_order_in_the_graph_changes_nothing() -> None:
    graph = fixture_graph()
    reversed_graph = Graph(reversed(list(graph.topics.values())), graph.regions)
    assert weave(reversed_graph, ["salmon"]).stops == SALMON_ROUTE


def test_goals_are_a_set() -> None:
    graph = fixture_graph()
    route = weave(graph, ["tpm", "salmon", "tpm"])
    assert route == Route(goals=("salmon", "tpm"), stops=SALMON_ROUTE)
    assert weave(graph, ["salmon", "tpm"]) == route


def test_unknown_goals_are_named() -> None:
    with pytest.raises(UnknownGoal) as caught:
        weave(fixture_graph(), ["zzz", "salmon", "aaa"])
    assert caught.value.ids == ("aaa", "zzz")
    assert str(caught.value) == "not in the graph: aaa, zzz"


def test_no_goals_is_an_error() -> None:
    with pytest.raises(ValueError, match="at least one goal"):
        weave(fixture_graph(), [])


def test_region_breaks_a_tie_before_the_author_order() -> None:
    graph = Graph(
        [topic("g", "x", "y"), topic("x"), topic("y", region="first-region")],
        ["first-region", "a-region"],
    )
    assert weave(graph, ["g"]).stops == ("y", "x", "g")


def test_first_reached_breaks_a_tie_within_a_region() -> None:
    graph = Graph([topic("g", "z", "a"), topic("z"), topic("a")], ["a-region"])
    assert weave(graph, ["g"]).stops == ("z", "a", "g")


def test_a_need_comes_first_whatever_its_region() -> None:
    graph = Graph([topic("g", "x"), topic("x", region="last-region")], ["a-region", "last-region"])
    assert weave(graph, ["g"]).stops == ("x", "g")


SCRIPT = (
    "from code_weaver.weave import weave\n"
    "from weaver.fixture_graph import fixture_graph\n"
    "print(weave(fixture_graph(), ['salmon', 'em-algorithm']))\n"
)


def test_fresh_processes_print_byte_identical_routes() -> None:
    outputs = {
        subprocess.run(
            [sys.executable, "-c", SCRIPT],
            env={**os.environ, "PYTHONHASHSEED": seed, "PYTHONPATH": str(TESTS)},
            capture_output=True,
            check=True,
        ).stdout
        for seed in ("0", "1", "2", "random")
    }
    assert len(outputs) == 1
    assert b"'salmon'" in outputs.pop()
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `uv run pytest tests/weaver/test_weave.py -q`
Expected: collection error, `ModuleNotFoundError: No module named 'code_weaver.weave'`.

- [ ] **Step 4: Write `weave.py`**

`packages/code-weaver/src/code_weaver/weave.py`:

```python
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `uv run pytest tests/weaver -q`
Expected: all pass. If `test_salmon_gives_the_seventeen_stops_in_order` fails, compare with
the spec's M2P1.4 list before changing either: the spec's order was computed from the fixtures.

- [ ] **Step 6: See each pin fail once, then restore**

1. Sort `reached` by id before ordering (`_order(graph, sorted(...))`): the first-reached
   tie-break test and the Salmon test fail.
2. Key the heap on `position` only: the region tie-break and Salmon tests fail.
3. Replace `sorted(set(goals))` with `tuple(dict.fromkeys(goals))`: `test_goals_are_a_set`
   fails.

Restore each before the next.

- [ ] **Step 7: Run the checks and commit**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
git add packages/code-weaver tests/weaver
git commit -m "feat(weaver): weave goals into an ordered route" -m "weave(graph, goals) walks needs back from the sorted goals, depth first in the author's order, and places each stop after all it needs, ties by region then first-reached (spec M2P1.4). The Salmon fixtures give the 17 stops; fresh processes with other hash seeds print the same bytes; levels never change the route." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The purity guard runs a weave, and the paperwork

**Files:**
- Create: `tests/guards/weave_probe.py`, `docs/notes/journal/2026-09-19-m2-part-1-walk-back-and-order.md`
- Modify: `tests/guards/test_purity_runtime.py`, `docs/notes/journal/README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `Graph`, `Need`, `Topic`, `weave` from Tasks 1–2; `import_under_hook(modules,
  search_path)` from `tests/guards/purity.py`.

- [ ] **Step 1: Write the failing test**

Append to `tests/guards/test_purity_runtime.py`:

```python
GUARDS = Path(__file__).parent


def test_the_weaver_runs_a_weave_without_a_watched_event() -> None:
    result = import_under_hook(["weave_probe"], [GUARDS])
    assert result.returncode == 0, result.stderr
```

and replace its docstring's second paragraph with:

```python
"""The runtime purity guard, on the real packages and on a planted one (spec P1.4).

Since M2 part 1 the probe also runs a weave (`weave_probe`, spec M2P1.6), so a green guard says
something about behaviour, not only imports.
"""
```

- [ ] **Step 2: Run it to see it fail**

Run: `uv run pytest tests/guards/test_purity_runtime.py -q`
Expected: 1 failed, `ModuleNotFoundError: No module named 'weave_probe'` in stderr.

- [ ] **Step 3: Write the probe**

`tests/guards/weave_probe.py`:

```python
"""Imported under the runtime purity hook: builds a small graph and weaves it (spec M2P1.6)."""

from code_weaver.graph import Graph, Need, Topic
from code_weaver.weave import weave

GRAPH = Graph(
    [
        Topic(id="a", region="r", level="first-steps", needs=()),
        Topic(id="b", region="r", level="foundations", needs=(Need(node="a", reason="b uses a"),)),
    ],
    ["r"],
)

if weave(GRAPH, ["b"]).stops != ("a", "b"):
    raise RuntimeError("the probe's weave gave the wrong route")
```

- [ ] **Step 4: Run the guards to see them pass**

Run: `uv run pytest tests/guards -q`
Expected: all pass.

- [ ] **Step 5: The journal and CLAUDE.md**

- `docs/notes/journal/2026-09-19-m2-part-1-walk-back-and-order.md`, in the README's order:
  where things stand (each claim with its `uv run pytest tests/weaver -k …` command), what
  changed (commit hashes), decisions and why (the three questions), departures from this plan,
  what is next (part 2: why, known and level span), open questions, traps.
- `docs/notes/journal/README.md`: the box names the new entry; a table row above part 6's.
- `CLAUDE.md`: the layout line `packages/code-weaver/     pure, empty until M2` becomes
  `packages/code-weaver/     pure: Graph and weave (M2 part 1)`; the status line says M2 part 1
  is built.

- [ ] **Step 6: Run the checks and commit**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
git add tests/guards docs/notes/journal CLAUDE.md
git commit -m "test(guards): the runtime purity guard runs a weave" -m "weave_probe builds a two-topic graph and weaves it under the audit hook, which M0 part 1 left for M2 (spec M2P1.6). The journal records M2 part 1." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Push, open the pull request, merge only on green**

```bash
git push -u origin m2-part-1-walk-back-and-order
gh pr create --title "M2 part 1: walk back and order" --body "…ending with the Claude Code line"
gh pr checks <n> --watch > "$SCRATCH/checks.out" 2>&1; echo $? > "$SCRATCH/checks.rc"
```

Merge only if `checks.rc` holds `0`.
