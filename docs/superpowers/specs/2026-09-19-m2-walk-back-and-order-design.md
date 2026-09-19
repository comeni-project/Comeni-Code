# M2 part 1 — walk back and order

**Status: agreed 2026-09-19.** This is part 1 of phase M2's four (architecture spec R4). The parts
list is in [`2026-09-19-m2-in-parts.md`](../../notes/journal/2026-09-19-m2-in-parts.md). It builds
the weave's steps 2 and 5 (W3.3) in `code-weaver`, and decides:

- what the weaver takes as its graph;
- how the stops of a route are ordered;
- how the weaver refuses a broken graph or an unknown goal.

The operator made every decision here on 2026-09-19, question by question; an agent proposed them.

---

## M2P1.1 What this part does

A pure function from a graph and goal ids to an ordered route over *needs* links.

```
Topics + region order ──Graph(...)──► checked graph ──weave(graph, goals)──► Route(goals, stops)
```

**Done when:**

- `weave` on the Salmon fixtures gives exactly M1P4.2's 17 stops, in the order of M2P1.4;
- repeated runs, in fresh processes with different hash seeds, print byte-identical output;
- a *needs* cycle is refused with a message naming its ring;
- the same graph with every level changed gives the same route;
- the runtime purity guard runs a weave (M2P1.6);
- every test in M2P1.7 passes, and CI is green.

**Out of scope:** why-chains, the known set and the level span (part 2); the CLI and any file
reading in the package (part 3); the API (part 4); resolving goals with a model (M5); *any-of*
choices (W3.2, not wired).

## M2P1.2 The graph is the weaver's own type

`packages/code-weaver/src/code_weaver/graph.py`:

```python
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
    def __init__(self, topics: Iterable[Topic], regions: Sequence[str]) -> None: ...
```

- **Only what weaving uses.** No title, claim or body: the API weaves from the index without
  loading pages (part 4).
- **`reason` and `level` are carried now** though part 1 reads neither, so part 2's why-chains and
  level span do not change the type. `level` is a plain string; the weaver never compares levels.
- **`regions` is the order of `regions.yaml`**, the first tie-break (M2P1.4).
- **Nothing in this part fills a `Graph`** from files or the index. Part 3's CLI fills it from
  `code-schema`'s `Content`, part 4 from the index. Only the CLI module will import `code-schema`;
  the weave never does. Part 1's tests fill it with a helper of their own.

**Rejected:**

| Alternative | Why not |
|---|---|
| `code-schema`'s `Content` or `Node` | the API would rebuild whole nodes, bodies included, from the index to weave; the weave would depend on `code-schema` |
| Plain dicts (`{id: [needed ids]}`) | untyped; reasons and levels arrive as parallel dicts that are easy to mismatch |

## M2P1.3 A graph is checked when it is built

`Graph(...)` raises **`GraphError`** when any of these holds, listing every problem found, one per
line, in a fixed order — so the same bad graph always gives the same message:

1. two topics share an id;
2. a topic's region is not in `regions`;
3. a *needs* entry names a topic that is not in the graph;
4. the *needs* links form a cycle — one line per tangle, naming one ring: `needs cycle: a → b → c
   → a`.

The whole graph is checked, not only what a weave reaches: a cycle anywhere means the data is
wrong. The cycle search is the same method as `code-schema`'s (strongly connected components, then
the shortest ring), written again rather than imported, because the weave has no dependencies.

A graph that was built cannot make a weave fail for a reason of its own. The API can build one per
index build and weave many times (part 4).

## M2P1.4 The weave

`packages/code-weaver/src/code_weaver/weave.py`:

```python
@dataclass(frozen=True)
class Route:
    goals: tuple[str, ...]  # sorted, no repeats
    stops: tuple[str, ...]  # in order; the goals are stops too


def weave(graph: Graph, goals: Iterable[str]) -> Route: ...
```

1. **Goals are a set.** Repeats are dropped and the rest sorted by id, so goal order never changes
   a route. No goals raises `ValueError`; ids not in the graph raise **`UnknownGoal`**, naming all
   of them, sorted.
2. **Walk back** (step 2): from each goal in sorted order, follow *needs* depth first in the
   author's order, recording the order in which each topic is first reached. Everything reached is
   a stop.
3. **Order** (step 5): repeatedly place the ready stop — one whose needs are all placed — with the
   lowest **(region's position in `regions`, first-reached position)**. Each region is finished
   before the next begins where the needs allow, like a line on the metro map (W2).
4. **Deterministic by construction:** no set iteration or hash decides anything, and the output is
   tuples.

A goal that another goal needs is simply a stop in its place: `["salmon", "tpm"]` gives the same
17 stops as `["salmon"]`.

**The Salmon route** from the fixtures, which the tests pin:

> dna-and-genes, gene-expression, splicing, transcripts-and-isoforms, short-read-sequencing,
> fastq-and-quality-scores, rna-seq-libraries, k-mers, sequence-alignment, read-mapping,
> multi-mapping-reads, probability, likelihood, mixture-models, em-algorithm, tpm, salmon

**Rejected:**

| Alternative | Why not |
|---|---|
| Depth first, each stop just before its first use; region plays no part | changes subject often; the author's order of the goal's *needs* decides the route's shape; contradicts W3.3's *ties broken by region* |

The cost of the chosen order is distance: *transcripts-and-isoforms* is 4th and *tpm*, which
needs it, is 16th. Part 2's why-chains say what each stop is for.

## M2P1.5 Refusals

| Case | Raised | By |
|---|---|---|
| duplicate id, unknown region, dangling need, *needs* cycle | `GraphError` | `Graph(...)` |
| a goal id not in the graph | `UnknownGoal` | `weave` |
| no goals | `ValueError` | `weave` |

A broken graph means the data is wrong; an unknown goal means the request is. The CLI (part 3)
turns each into an exit code, the API (part 4) turns `UnknownGoal` into a 404. Validated content
never has a dangling need or a cycle (M1 part 3); the weaver refuses them anyway, since R4 names
the cycle check and a graph may be filled from anywhere.

**Rejected:**

| Alternative | Why not |
|---|---|
| A result value, route or refusal, like `IndexBuild` | every caller checks which it got; the graph is re-checked on every weave |
| A plain container, with every check inside `weave` | the same cost on every weave, and a broken graph reads as a bad request |

## M2P1.6 The purity guard runs a weave

M0 part 1 left the runtime guard only importing packages, "until M2 makes it run a weave". Its
probe now also builds a small `Graph` and runs `weave` under the same hook, and the docstring of
`tests/guards/test_purity_runtime.py` says so. A green runtime guard then says something about
behaviour, not only imports.

## M2P1.7 What the tests prove

`tests/weaver/`, beside `tests/schema/`. The fixtures fill the graph through a test helper that
uses `code-schema`'s `read_content`; nothing reads `comeni-code-content` (R1).

| Test | Proves |
|---|---|
| *Salmon* gives the 17 stops of M2P1.4, in that order | walk back and order, against the reference route |
| for every topic in the fixtures as a goal, each stop comes after all it needs | the order is valid everywhere, not only for *Salmon* |
| *Salmon*'s five goes-deeper nodes and *kallisto* are not on its route | only *needs* is followed |
| every level changed gives the same route | a level never adds, removes or moves a stop (T10.1) |
| the weave, run in fresh processes with different `PYTHONHASHSEED`s, prints byte-identical output | determinism beyond one process |
| `["salmon", "tpm"]` has *Salmon*'s stops; goal order and repeats change nothing | goals are a set |
| unknown goals raise `UnknownGoal` naming each; no goals raise `ValueError` | request errors |
| a cycle, a dangling need, a duplicate id and an unknown region each raise `GraphError` with its message | graph errors, at build |
| small hand-built graphs: one where region decides, one where first-reached decides | each tie-break on its own |
| the runtime guard runs a weave without a watched event | M2P1.6 |

**Scaling.** The weave is linear in the part of the graph a goal reaches, plus a heap: fine for
thousands of topics. Building a `Graph` checks the whole graph once.
