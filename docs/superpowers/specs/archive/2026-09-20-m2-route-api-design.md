# M2 part 4 — the route API

**Status: agreed 2026-09-20.** This is the last of phase M2's four parts (architecture spec R4).
The parts list is in [`2026-09-19-m2-in-parts.md`](../../notes/journal/2026-09-19-m2-in-parts.md).
It serves parts [1](2026-09-19-m2-walk-back-and-order-design.md),
[2](2026-09-19-m2-why-known-and-span-design.md) and
[3](2026-09-20-m2-route-cli-design.md)'s weave from the index, and decides:

- how a route is asked for;
- what comes back;
- how the endpoint answers when it cannot weave.

The operator made every decision here on 2026-09-20, question by question; an agent proposed them.

---

## M2P4.1 What this part does

```
index (code_api.content) ──3 queries──► Graph ──weave(goals, known)──► GET /api/routes
```

**Done when:**

- `GET /api/routes?goal=salmon` returns the 17 stops of M2P1.4 with their cards, span and minutes;
- `known=read-mapping` returns 14 stops and echoes the known id;
- the answers of M2P4.4 hold;
- the endpoint's stops equal `code-weaver route`'s for the same goals;
- every test in M2P4.5 passes, and CI is green.

With parts 1–3, this closes M2 (M2P4.6).

**Out of scope:** the Route page (M3); goal resolution by a model (M5); connecting text (W3.4);
caching a built graph (M2P4.3); learner records, which is where a real known set comes from (T7).

## M2P4.2 Asking for a route

**`GET /api/routes?goal=<id>&goal=<id>&known=<id>`**, in the `content` router beside
`/api/nodes/{node_id}` (M1P6.3).

- **`goal`** is required and repeatable; **`known`** is optional and repeatable. This mirrors the
  command's repeated flags (M2P3.2), and a route is a read, so a GET is shareable and a browser
  can open it.
- The response reuses the node endpoint's `RegionOut` and `NeighbourOut` unchanged, so the web
  app's generated types line up:

```json
{
  "goals": ["salmon"],
  "known": [],
  "stops": [
    {
      "id": "dna-and-genes",
      "title": "DNA and genes",
      "level": "first-steps",
      "minutes": 10,
      "region": {"id": "molecular-biology", "name": "Molecular biology"},
      "needed_by": [
        {
          "id": "gene-expression",
          "title": "Gene expression",
          "level": "first-steps",
          "reason": "Expression is a gene being read, so it starts from what a gene is."
        }
      ]
    }
  ],
  "span": {"lowest": "first-steps", "highest": "intermediate"},
  "minutes": 184
}
```

- **`stops`** are in route order. Each is a card: what the Route board (L4) draws — title, level,
  time, and the region for the map's lines — plus `needed_by`, the whole list for this route
  (M2P2.2), each entry the needing stop with its stored reason.
- **`span`** is an object, not a two-item array, so the generated TypeScript names the two.
- **`minutes`** is the sum over the stops, as the command prints.
- **`known`** echoes only the ids that were in the index and were not goals: the ones that
  actually shortened the route.
- `openapi.json` and `apps/web/src/api/schema.ts` are regenerated; a test fails while either is
  stale.

**Rejected:**

| Alternative | Why not |
|---|---|
| `POST /api/routes` with a body | a route is a read; a shareable URL is what the Route page links to. A long known set is the argument for a body, but a learner's known set will come from the session, not the URL |
| `GET /api/nodes/{id}/route` | one goal only; W3.3 resolves a goal to one to three targets |
| Ids and reasons only | the Route page would need a request per stop for a title — what M1P6.3 already rejected for neighbours |
| A whole node per stop | Salmon's route would carry 17 Markdown bodies for a page that shows none |

## M2P4.3 Building the graph

Three queries, whatever the route's size:

1. every `Node` — id, title, level, minutes and region id, no bodies;
2. every `Link` of kind *needs*, ordered by source then `position`, so the author's order stands;
3. every `Region`, ordered by `position` — the order `regions.yaml` gave (M1P5.2), which is the
   weave's first tie-break.

`Graph(topics, regions, levels)` is then built, with the level order from `code-schema`'s `Level`
as the command does (M2P3.3), and `weave(graph, goals, known)` called. The stop cards are filled
from the rows already in memory, so nothing is read twice.

**The whole index is loaded on every request, and that is the MVP's bargain.** At 26 nodes it
costs nothing; at thousands the answer is a graph cached per index digest, or weaving in the
database. The index is already rebuilt whole from files for the same reason (M1P5.7), and it is
what changes when a central database arrives. *Note it; do not build it now.*

## M2P4.4 When it cannot weave

| Case | Answer |
|---|---|
| No applied build | **503** `{"detail": "The index has not been built yet."}` — the node endpoint's words (M1P6.4) |
| A goal is not in the index | **404** `{"detail": "No topic with id 'zzz'. It may have been removed or renamed."}`, naming every missing id, sorted |
| No `goal` at all | **422**, django-ninja's own validation |
| A known id is not in the index | ignored, and left out of `known` |
| The index cannot make a valid graph | **500**, an unhandled `GraphError` |

- **The build check runs only when a goal is missing**, as on the node endpoint, so a found route
  pays nothing.
- **404, not 422, for an unknown goal:** it is the same "that id is not in the index" case the
  node endpoint answers with 404, and a Route page linking to a renamed topic should behave as a
  node page does.
- **500 for a broken graph:** `rebuild_index` refuses content the validator rejects (M1P5.2), so
  an applied index cannot hold a cycle or a dangling need. If one appears, it is our bug, and a
  500 with the traceback in the logs says so instead of dressing it as a service problem.

## M2P4.5 What the tests prove

`apps/api/tests/test_routes_api.py`, with the fixtures rebuilt into the index, as
`test_nodes_api.py` does.

| Test | Proves |
|---|---|
| *Salmon*: 17 stops in M2P1.4's order, the first stop's whole card, `span` and `minutes` | the route and its cards |
| a stop's `needed_by` holds the needing stops with their stored reasons; *kallisto* is absent | `needed_by` is per route (M2P2.2) |
| `known=read-mapping`: 14 stops, `known` is `["read-mapping"]`, *k-mers* gone | the known set reaches `weave` |
| a known id not in the index: the full route, `known` empty | the echo means what it says |
| two goals: both in `goals`, the same 17 stops | goals are a set (M2P1.4) |
| an unknown goal: 404 naming it; no `goal`: 422; an empty index: 503 | M2P4.4 |
| three queries for one goal, and three for two | the graph costs one build per request |
| the endpoint's stops equal `code-weaver route`'s for the same goals | files and index weave alike |
| `/api/routes` is in the OpenAPI schema with 200, 404 and 503 | the docs show it |

## M2P4.6 M2 is done when

R4's *done when*, as the parts list states it (with 2026-09-19's note that the reference route is
the fixtures' 17 stops):

1. the Salmon route matches the reference — parts 1 and 3, and this part's first test;
2. repeated runs are byte-identical — part 1's determinism test;
3. a cycle is refused — part 1's `GraphError` tests;
4. the same graph with every level changed gives the same route — part 2's test.

The part 4 journal entry lists the four with their commands and records M2 done; CLAUDE.md's
status says M2 is complete and M3, the thin learner path, is next.
