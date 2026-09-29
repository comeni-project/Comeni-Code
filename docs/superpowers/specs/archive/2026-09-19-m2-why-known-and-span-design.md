# M2 part 2 — why, known, and level span

**Status: agreed 2026-09-19.** This is part 2 of phase M2's four (architecture spec R4). The parts
list is in [`2026-09-19-m2-in-parts.md`](../../notes/journal/2026-09-19-m2-in-parts.md). It adds to
[part 1](2026-09-19-m2-walk-back-and-order-design.md)'s `Graph` and `weave`, and decides:

- what a stop says about why it is on the route;
- how topics the learner already knows leave the route;
- how the route's level span is found.

The operator made every decision here on 2026-09-19, question by question; an agent proposed them.

**Built on what exists, not on the first design.** W3.3 step 6 and the Route board describe a
*chain of reasons* back to the goal and an *unlocks* field. The operator's direction: every *needs*
link already stores its reason (M1 part 2), and the route is a search result whose job is to be
read at a glance. So the why is a **lookup of stored reasons**, not new data or a selection rule.

---

## M2P2.1 What this part does

```
Graph(topics, regions, levels) ──weave(graph, goals, known)──► Route(goals, stops, needed_by, span)
```

**Done when:**

- every stop on *Salmon*'s route lists the stops on that route that need it, with their stored
  reasons, in route order;
- with *read-mapping* known, *Salmon*'s route loses exactly *read-mapping*, *k-mers* and
  *sequence-alignment* (14 stops);
- *Salmon*'s span is *first-steps* to *intermediate*;
- part 1's tests still pass, changed only to pass `levels` and to compare `goals` and `stops`
  where they built a whole `Route`;
- every test in M2P2.6 passes, and CI is green.

With part 1, this closes R4's M2 *done when* for the weave itself; parts 3 and 4 reach it from a
command line and the API.

**Out of scope:** the CLI and the route's printed format (part 3); the API (part 4); where a
learner's known set comes from (stored evidence, T7); connecting text (W3.4).

## M2P2.2 Why a stop is on the route: `needed_by`

**Each stop lists every stop on this route that needs it, with the reason stored on that stop's
link.** Nothing is chosen and nothing new is stored: it is the node page's *needed by*
(M1P6.3) restricted to the route.

```python
@dataclass(frozen=True)
class NeededBy:
    node: str  # the stop that needs this one
    reason: str  # the reason stored on that stop's needs link
```

- **Only stops on this route.** *Transcripts and isoforms* is also needed by *kallisto*, which is
  not on *Salmon*'s route and so is not listed.
- **In route order**, so the first entry is where the learner uses it next. For *transcripts and
  isoforms*: *multi-mapping-reads*, then *tpm*, then *salmon*.
- **Every stop has an entry.** A goal no other goal needs has an empty tuple.
- A stop that lists the same need twice gives one entry, with the first reason.

**Rejected:**

| Alternative | Why not |
|---|---|
| An *unlocks* list and one *chain* of reasons back to a goal (W3.3's shape, the Route board's two fields) | two fields where the stored reasons already say it; a chain needs a rule to pick one path of many |
| Only the next stop that needs it | a selection rule to design and test, for what a page can do by showing the first entry |

## M2P2.3 What the learner knows: `known`

`weave(graph, goals, known=())`. **The walk back stops at a known topic**: it is not a stop, and its
own needs are not followed through it. What only it needed leaves the route with no rule of its
own; what another stop still needs stays.

- With *read-mapping* known, *Salmon*'s route loses *read-mapping*, *k-mers* and
  *sequence-alignment*. *Short-read sequencing* stays: *FASTQ* and *RNA-seq libraries* still need
  it.
- **A goal marked known stays on the route.** It was asked for.
- **A known id not in the graph is ignored.** Known sets will come from stored evidence, and a topic
  can be renamed or removed after it was recorded; a whole route should not fail for it. Goals not
  in the graph still raise `UnknownGoal` (M2P1.5).
- `known` is taken as a set: order and repeats change nothing.
- A known topic is never listed in `needed_by`, since it is not a stop.

## M2P2.4 The level span, and the level order

**`Graph` takes the level order the way it takes the region order**:

```python
Graph(topics, regions, levels)  # levels: lowest first
```

The CLI and the API fill it from `code-schema`'s `Level`, in its declared order (*first-steps*,
*foundations*, *introductory*, *intermediate*, *advanced*), so the order lives in one place.
**A topic whose level is not in `levels` is refused**, like an unknown region:
`a: level nowhere is not in the level list`, listed after the region problems.

`Route.span` is `(lowest, highest)` of the stops' levels in that order. *Salmon*'s is
`("first-steps", "intermediate")`. A route whose stops share one level gives it twice. The span is
reported, never used: levels still never add, remove or move a stop (T10.1).

**Rejected:** the five levels written again inside the weaver — the list would live in two places.

## M2P2.5 The route

`Route` keeps part 1's fields and gains two:

```python
@dataclass(frozen=True)
class Route:
    goals: tuple[str, ...]  # sorted, no repeats
    stops: tuple[str, ...]  # in order; unchanged from part 1
    needed_by: Mapping[str, tuple[NeededBy, ...]]  # every stop, in route order
    span: tuple[str, str]  # (lowest, highest) level among the stops
```

`stops` stays a tuple of ids, so part 1's order and its 17-stop pin are untouched. `needed_by` is
a `dict` filled in route order, so its `repr` is as deterministic as the rest.

## M2P2.6 What the tests prove

Added to `tests/weaver/`; the fixtures are read through `fixture_graph` as in part 1.

| Test | Proves |
|---|---|
| *transcripts-and-isoforms* on *Salmon*'s route is needed by *multi-mapping-reads*, *tpm*, *salmon*, in that order, with their stored reasons; *kallisto* is absent | the lookup, in route order, route only |
| every stop's `needed_by` equals the route stops whose needs name it, for every fixture goal | `needed_by` everywhere |
| *salmon*'s own entry is empty; with goals *salmon* and *tpm*, *tpm*'s entry holds *salmon* | goals |
| *read-mapping* known: 14 stops, the three gone, *short-read-sequencing* needed by *fastq* and *rna-seq-libraries* only | the walk stops at a known topic |
| a known goal stays; an unknown known id is ignored; known order and repeats change nothing | the edge cases |
| *Salmon*'s span is *first-steps* to *intermediate*; a one-level route gives that level twice | the span |
| an unknown level raises `GraphError` with its message, in its place among the other problems | the level order is checked |
| every level changed still gives part 1's route, and a span of that one level twice | levels never change the route |
| the determinism test prints the new fields, byte-identical across hash seeds | determinism holds for the whole route |

Part 1's tests change only to pass `levels`, and to compare `goals` and `stops` where they built a
whole `Route`; the runtime guard's probe passes `levels` too.
