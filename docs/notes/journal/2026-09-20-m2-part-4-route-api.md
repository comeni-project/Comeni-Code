# 2026-09-20 — M2 part 4: the route API, and M2 done

**`GET /api/routes?goal=salmon` weaves from the index and returns the stops as cards, with each
stop's *needed by*, the level span and the total minutes. With it, M2 is done.** Part 4 of M2's
four ([parts list](2026-09-19-m2-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-20-m2-route-api-design.md) and the
[plan](../../superpowers/plans/2026-09-20-m2-route-api.md) are in the same pull request.

The operator decided the three questions and approved the design section by section; one agent
built it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| *Salmon*: 17 stops as cards, span *first-steps → intermediate*, 184 minutes | `uv run pytest apps/api/tests/test_routes_api.py -k span_and_minutes` |
| A stop's *needed by* holds only stops on this route, in route order | `uv run pytest apps/api/tests/test_routes_api.py -k only_stops` |
| `known=read-mapping` gives 14 stops and echoes the id; an id outside the index is ignored | `uv run pytest apps/api/tests/test_routes_api.py -k known` |
| An unknown goal is 404, no goal is 422, an empty index is 503 | `uv run pytest apps/api/tests/test_routes_api.py -k "404 or 422 or 503"` |
| Three queries, for one goal and for two | `uv run pytest apps/api/tests/test_routes_api.py -k queries` |
| The endpoint and the command give the same stops, in the same order | `uv run pytest apps/api/tests/test_routes_api.py -k agree` |
| The author's order of *needs* survives a different row order in Postgres | `uv run pytest apps/api/tests/test_routes_api.py -k row_order` |
| The whole command set passes (360 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

**M2 is done.** R4's *done when*, with 2026-09-19's note that the reference route is the fixtures'
17 stops:

| Done when | Check |
|---|---|
| the Salmon route matches the reference | `uv run pytest tests/weaver -k seventeen`; `uv run code-weaver route salmon --root tests/fixtures/salmon`; `uv run pytest apps/api/tests/test_routes_api.py -k span_and_minutes` |
| repeated runs are byte-identical | `uv run pytest tests/weaver -k byte_identical` |
| a cycle is refused | `uv run pytest tests/weaver -k cycle` |
| the same graph with every level changed gives the same route | `uv run pytest tests/weaver -k levels` |

**Each pin was seen failing:** the regions ordered by id instead of `position`, the *needs* links
fetched unordered, `known` dropped on the way to `weave`, and the build check moved before the
weave.

## What changed this session

| Commit | What is now true |
|---|---|
| `95cfc2d`, `4c2d61d` | the spec and the plan |
| `770c1d3` | `code_api/content/routes.py`, the router at `/api/routes`, `openapi.json` and `schema.ts` |

Plus CLAUDE.md's status and layout, and this entry.

## Decisions made, and why

1. **`GET /api/routes?goal=&known=`, repeatable** (M2P4.2), mirroring the command's flags. A route
   is a read, and a shareable URL is what the Route page will link to. *Rejected:* a POST with a
   body (the long-known-set argument is for when a learner's session supplies it, not the URL); a
   nested `/api/nodes/{id}/route` (one goal only, while W3.3 resolves a goal to one to three).
2. **A card per stop** (M2P4.2): id, title, level, minutes, region, and the whole `needed_by` for
   this route. It reuses the node endpoint's `RegionOut` and `NeighbourOut`, so the web app's
   generated types line up. *Rejected:* ids only (a request per stop for a title); whole nodes
   (17 Markdown bodies for a page that shows none).
3. **404 for an unknown goal, 503 before any build, 500 for a broken graph** (M2P4.4). The first
   two are the node endpoint's words; the third is honest, because `rebuild_index` refuses content
   the validator rejects, so a broken index would be our bug.
4. **The whole index is loaded per request** (M2P4.3), three queries. At the operator's direction:
   *"just leave a note for whole index we just need the mvp now"*. The answer later is a graph
   cached per index digest, or weaving in the database.

**Where the build departed from the plan:**

- The plan's expected `needed_by` for *DNA and genes* named two stops; the fixtures give four
  (*k-mers* and *Sequence alignment and scores* also need it). The code was right.
- The command cuts a title to its column and the endpoint does not, so the agree-test compares
  the endpoint's titles cut the same way.
- django-ninja's `Query(...)` as a default fails mypy's `type-arg`; the parameters are
  `Annotated[list[str], Query()]` instead.
- **A gap the breakages found:** fetching the *needs* links without `order_by` still passed, because
  Postgres happened to return them in insertion order. A new test rewrites those rows in the
  opposite order and asserts the route is unchanged; that test does fail without `order_by`.

## What is next

1. **M3, the thin learner path** (R4): a learner finds a target without AI, sees the route as a
   metro map, and reads a node. It starts with a parts list in a new journal entry, for the
   operator's approval (R5), and it is the first phase with screens — each compared with its
   board.
2. **The master's-class seeds**, when the operator sends them; the fixtures go into
   `comeni-code-content` then.

## Open questions

- **Where the Route board's 13 stops are redrawn** to the fixtures' 17, in M3's design round.
- **Whether `/api/routes` needs a list of goals to choose from** — the Start page's search decides
  in M3.
- **Whether `IndexBuild` rows need pruning** (carried from M1 part 5).

## Traps

- **The endpoint loads the whole index on every request.** Fine at 26 nodes; the note in M2P4.3
  says what to do when it is not.
- **`needed_by` here is per route**, not the node page's full list: a stop off the route never
  appears.
- **`known` in the response is only what was applied** — ids in the index that were not goals.
- **`openapi.json` and `schema.ts` are committed.** Any change to the endpoint regenerates both,
  or a Python test and a web test fail.
- **The API tests need Compose's Postgres**, like the rest of `apps/api/tests`.
