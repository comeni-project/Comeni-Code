# 2026-09-19 — M2 part 1: walk back and order

**`code-weaver` weaves: `weave(graph, goals)` walks *needs* back from the goals and orders the
stops, and the fixtures' Salmon route comes out as its 17 stops.** Part 1 of M2's four
([parts list](2026-09-19-m2-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-19-m2-walk-back-and-order-design.md) and the
[plan](../../superpowers/plans/2026-09-19-m2-walk-back-and-order.md) are in the same pull request.

The operator decided the three questions and approved the design section by section; one agent
built it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| *Salmon* gives the 17 stops, in the pinned order | `uv run pytest tests/weaver -k seventeen` |
| Every stop follows all it needs, for every fixture topic as a goal | `uv run pytest tests/weaver -k every_stop` |
| Fresh processes with other hash seeds print byte-identical routes | `uv run pytest tests/weaver -k byte_identical` |
| A cycle is refused naming its ring; so are dangling needs, duplicate ids, unknown regions | `uv run pytest tests/weaver/test_graph.py` |
| Changing every level leaves the route unchanged | `uv run pytest tests/weaver -k levels` |
| The runtime purity guard runs a weave | `uv run pytest tests/guards -k weave` |
| The whole command set passes (322 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

**For route order, R4's M2 done-when now holds**: the route matches the reference, repeated runs
are byte-identical, a cycle is refused, and levels change nothing. Part 2 adds why-chains, the known
set and the level span to the same route.

**Each pin was seen failing:**
- the stops sorted by id before ordering;
- the heap keyed on first-reached position alone;
- goals kept in the order given;
- a planted `os.system` inside `_walk_back`, which the import-only probe misses and `weave_probe`
  catches.

## What changed this session

| Commit | What is now true |
|---|---|
| `14ddbca` (PR #56) | M2's four parts; R4's reference route is the fixtures' 17 stops |
| `4b30e10`, `1ad54d8` | the spec and the plan |
| `b6fe9ff` | `Graph`, `Topic`, `Need`, `GraphError`; the allowlist gains `collections.abc`, `dataclasses`, `heapq` |
| `9a45434` | `weave`, `Route`, `UnknownGoal`; `tests/weaver/fixture_graph.py` |

Plus the runtime guard's `weave_probe`, CLAUDE.md's status and layout, and this entry.

## Decisions made, and why

The operator's three answers, each with its rejected alternatives in the spec:

1. **The weaver has its own graph type** (M2P1.2): id, region, level and *needs* with reasons,
   plus the region order. The API will weave from the index without loading bodies. The weave
   imports only the standard library.
2. **Stops are ordered by region, then by first-reached position** (M2P1.4), as W3.3 says. Each
   region is finished before the next where the needs allow. The cost is distance:
   *transcripts-and-isoforms* is 4th, and *tpm*, which needs it, is 16th.
3. **A graph checks itself when built** (M2P1.3), raising `GraphError`. An unknown goal raises
   `UnknownGoal`. A broken graph means the data is wrong; an unknown goal means the request is.

Taken in the design without a separate question: **goals are a set** (sorted, no repeats), and
**the whole graph is checked**, including cycles no goal reaches.

**Where the build departed from the plan:**

- The plan said sorting the stops by id would break the Salmon test as well as the tie-break
  test. It breaks only the hand-built tie-break test: in *Salmon*'s one region with a real tie,
  *k-mers* comes before *sequence-alignment* both alphabetically and in the walk. The small
  graph is what pins first-reached order.
- `from weaver.fixture_graph import …` sorts with the third-party imports under ruff, as
  `schema.content_helpers` does; the plan is corrected.
- The package docstring was shortened to fit 100 characters; the plan is corrected.

## What is next

1. **M2 part 2: why, known, and level span.** Each stop's chain of *needs* reasons back to a goal;
   a known set removed with everything only it needed; the span, *First steps → Intermediate* for
   *Salmon*. The spec is brainstormed with the operator first.
2. Then part 3 (the CLI) and part 4 (the API).

## Open questions

- **The route's output format**, which the CLI prints and "byte-identical" is measured on. Part 3
  decides; part 1's determinism test compares `Route`'s `repr`.
- **Whether *needs* reasons appear in part 2's chains verbatim, or as titles only.** Part 2
  decides.

## Traps

- **Only the hand-built graphs pin first-reached order.** Salmon's order would survive sorting by
  id; a test of the tie-break must use a graph where the two disagree.
- **`GraphError` checks the whole graph**, so one bad topic anywhere refuses every weave. That is
  intended: validated content never has one.
- **`weave_probe` lives in `tests/guards/`** and is imported under the audit hook with only that
  folder on `PYTHONPATH`; it must import nothing but the weaver.
- **The allowlist is closed.** A new standard-library module in `code-weaver` fails the static
  guard until `tests/guards/purity.py` lists it.
