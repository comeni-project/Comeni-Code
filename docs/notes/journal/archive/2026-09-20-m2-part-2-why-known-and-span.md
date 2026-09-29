# 2026-09-20 — M2 part 2: why, known, and the level span

**A route now says why each stop is on it, drops what the learner already knows, and reports its
level span.** Part 2 of M2's four ([parts list](2026-09-19-m2-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-19-m2-why-known-and-span-design.md) and the
[plan](../../superpowers/plans/2026-09-19-m2-why-known-and-span.md) are in the same pull request.

**The shape of the why came from the operator, against the first design.** W3.3 and the Route board
describe a chain of reasons back to the goal and an *unlocks* list. The operator's correction:
every *needs* link already stores its reason (M1 part 2), and a route is a search result that has
to read at a glance — *"respect what was already discussed and built rather than the original plan,
we are changing stuff as we go"*. So the why is a lookup of stored reasons, with nothing new stored
and no rule picking one.

---

## Where things stand

| Claim | Check |
|---|---|
| Each stop lists the route stops that need it, in route order, with their stored reasons | `uv run pytest tests/weaver -k with_their_reasons` |
| That holds for every fixture topic as a goal, and the keys are the stops | `uv run pytest tests/weaver -k stored_needs` |
| A goal is listed only when another goal needs it | `uv run pytest tests/weaver -k only_by_other_goals` |
| *read-mapping* known leaves 14 stops: *k-mers* and *sequence-alignment* go, *short-read-sequencing* stays | `uv run pytest tests/weaver -k known_topic` |
| A known goal stays; an unknown known id is ignored; order and repeats change nothing | `uv run pytest tests/weaver -k known_edge` |
| *Salmon*'s span is first-steps to intermediate, in the graph's level order | `uv run pytest tests/weaver -k span` |
| An unknown level is refused, after the region problems | `uv run pytest tests/weaver -k unknown_level` |
| Part 1's route, order and determinism are unchanged | `uv run pytest tests/weaver -k "seventeen or byte_identical"` |
| The whole command set passes (332 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

**R4's M2 done-when now holds for the weave itself**: the reference route, byte-identical repeats,
a cycle refused, and levels that never change a route — now with a span reported. Parts 3 and 4
reach the same function from a command line and the API.

**Each pin was seen failing:** ordering without the route filter, `needed_by` not restricted to the
route, the span by plain string order, and a held topic kept as a stop.

## What changed this session

| Commit | What is now true |
|---|---|
| `2f65b35`, `34cac70` | the spec and the plan |
| `58abdc4` | `Graph(topics, regions, levels)`; an unknown level is refused |
| this commit | `NeededBy`, `Route.needed_by`, `Route.span`, `weave(..., known=())` |

Plus CLAUDE.md's status and layout, and this entry.

## Decisions made, and why

1. **`needed_by` is a lookup** (M2P2.2): for each stop, the stops on *this* route that need it, in
   route order, each with the reason stored on its link. *Rejected:* an *unlocks* list plus one
   chain back to the goal (two fields for what the stored reasons already say, and a chain needs a
   rule to pick one path of many); only the next stop that needs it (a selection rule, where a page
   can just show the first entry).
2. **The walk back stops at a known topic** (M2P2.3). What only it needed leaves the route with no
   rule of its own. A goal marked known stays; an unknown known id is ignored, because known sets
   will come from stored evidence and a topic can be renamed after it was recorded.
3. **The level order reaches the weaver as the region order does** (M2P2.4), from `code-schema`'s
   `Level`. *Rejected:* the five levels written again inside the weaver.

**Found while planning:** once a topic is known, the stops that needed it have needs pointing off
the route. The ordering step has to ignore those, or those stops are never placed. The spec did
not say it; the plan does.

**Where the build departed from the plan:** nowhere. The four breakages behaved as predicted,
including the span one, which only the *em-algorithm* route catches — alphabetically
*introductory* sorts after *intermediate*.

## What is next

1. **M2 part 3: the CLI.** `code-weaver route <goal>… --root <folder>`, reading files through
   `code-schema` and printing the route with its reasons. The spec is brainstormed with the
   operator first.
2. Then part 4, the API, which weaves from the index.

## Open questions

- **The route's printed format**, which part 3 decides; the determinism test compares `Route`'s
  `repr`.
- **Whether the CLI takes `--known`,** or leaves known sets to the API until learners have records.

## Traps

- **`needed_by` is per route, not per topic.** *Transcripts and isoforms* is also needed by
  *kallisto*, which is off *Salmon*'s route and so absent. The node page (`/api/nodes/{id}`) is
  where the whole list lives.
- **A known topic is never a stop,** so it has no `needed_by` entry, and stops that needed it show
  one fewer.
- **`Route` holds a `dict`**, so it cannot be hashed; it is filled in route order, which keeps its
  `repr` deterministic.
- **`Graph` now takes three arguments.** Every caller passes the level order, lowest first.
