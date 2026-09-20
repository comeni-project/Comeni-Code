# 2026-09-20 — M3 part 4: the Route page

**The page the weaver was built for.** `/route?goal=salmon` draws the woven route as a metro map —
a line per region, a column per depth in *needs* — with the stop you pick explaining why it is
there, in the words its author wrote. The L4 board is redrawn to the fixtures' real 17 stops.
Part 4 of M3's six ([parts list](2026-09-20-m3-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-20-m3-route-page-design.md) and the
[plan](../../superpowers/plans/2026-09-20-m3-route-page.md) are in the same pull request.

The operator decided the four questions, and then steered the scope: **the page is the board with
the learner's history absent, not a smaller page of its own design.** That correction shaped
everything below.

---

## Where things stand

| Claim | Check |
|---|---|
| The 17 stops lay out in five bands, none left of what it needs | `npm run test -- src/route/layout.test.ts` |
| Every line ends at the goal, and no line bends vertically | `npm run test -- src/route/layout.test.ts` (*ends every band's run*, *never bends*) |
| A stop shows its title, time and region to a screen reader | `npm run test -- src/route/RouteMap.test.tsx` |
| The page names the goal, its claim, the span, the stops and the time | `npm run test -- src/route/RoutePage.test.tsx` |
| A pasted `?stop=` fills the panel, with needs, unlocks and every stored reason | `npm run test -- src/route/RoutePage.test.tsx` (*fills the panel*) |
| *Next up* holds only unblocked stops; the junctions are named | `npm run test -- src/route/RoutePage.test.tsx` (*what comes next*) |
| A stop carries its claim from the API | `uv run pytest apps/api/tests/test_routes_api.py -k claim` |
| The board draws the same 17 stops at the same coordinates | `node .design/build_pages.mjs`, then open `.design/Route.dc.html` |
| The stack serves it | `docker compose up -d --wait --build`, `ops/stack-check.sh`, then `/route?goal=salmon` |
| The whole command set passes (513 Python, 66 web) | `uv run ruff check . && uv run mypy && uv run pytest`; `npm run lint && npm run test && npm run typecheck` |

## What changed this session

| Commit | What is now true |
|---|---|
| `0a27c0b` | the spec and the plan |
| `2d48733` | `StopOut.claim`, at no extra query |
| `3a62ad0` | `layout.ts`: the map's geometry as a pure function, with the API's own answer as its fixture |
| `4468dba` | `RouteMap.tsx`: SVG paths with real buttons over them |
| `7bd832f` | `RoutePage.tsx`: the header, the facts, the rail, the List view, the states |
| `1eaa8b1` | `StopPanel.tsx` and `NextUp.tsx`: why a stop is here, what can start now, where lines meet |
| `7b48844` | the L4 board redrawn, and every board that quotes this route with it |

Plus CLAUDE.md's status and layout, R4's note marked done, and this entry.

## Decisions made, and why

1. **A line is a region** (M3P4.2). Every stop has exactly one, `regions.yaml` fixes their order,
   and the weave already breaks ties by it — so the lines are data rather than a second algorithm
   to own. The board's three invented lines (*Data*, *Reads*, *Index*) become the five the route
   actually crosses. *Rejected:* chains through the needs graph (a stop's line would change with
   the route); one line per goal (collapses to one line for every route we have).
2. **A column is the stop's depth in *needs*** — the longest path — which is exactly the board's
   *stops at the same distance can be done in any order*.
3. **Our own SVG, no layout library** (M3P4.2). The identity asks for right angles and 45° elbows;
   a generic DAG layouter gives curves and positions we do not control. The geometry is a pure
   function, so the hard part is tested directly against the route the API answers.
4. **One colour for every line.** W10 gives one meaning per colour: teal is *your route*, blue is
   *selected*. Five regions cannot be five colours, so the lines are told apart by position and by
   the rail — which is how the board does it too.
5. **Selection lives in `?stop=`** (M3P4.3), with `goal`, `known` and `view`. A selected stop is a
   link you can send, and the back button walks the choices — part 3's rule.
6. **The panel is stored content only**: claim, level, time, needs, unlocks, and one entry per
   stop that needs this one with **the reason its author wrote** (M2P2.2). *Next up* and *where
   lines meet* are derived from the same graph. The board's *questions answered*, *proved by* and
   *in progress* need T7 and M6 and are absent, not faked.
7. **The board keeps its future.** The redraw changes the route it draws, not what it promises:
   settled and review-due states, a not-yet-written stop, milestones, the step-back detour and the
   Labs ending all stay, because the board is what later phases are measured against.
8. **Side doors wait** (W3.2): *goes-deeper* and *related* nodes are not route stops, so they have
   no depth and no line — a second layout, for a later part.

**Where the build departed from the plan:**

- **The route crosses five regions, not six.** *Algorithms* is not on it: M1 part 4 put *de Bruijn
  graphs* below the route rather than on it. The spec was corrected before any code was written —
  the plan had said to read the fixture rather than trust it, and that paid.
- **The first geometry zig-zagged.** A band with two stops in one column had its line drop
  vertically between them, which a metro line never does. A run now stays on the band's first row,
  and a stop sharing a column sits a row lower, reached by a thin link — the board's *thin lines
  are extra needs*. A stop whose needs all share its row gets a spur, so nothing floats free.
- **The goal's own band drew itself twice**, because the run appended the goal it already ended at.
- **The lines were named twice**, once in the rail and once inside the map. The board names them in
  the rail, so the map now labels stops only.
- **The board's map is shared by five boards.** Redrawing it moved the weave-review pins and broke
  the exam-results marks, which key off the stop ids. Both follow the new coordinates.
- **The boards had invented node titles** — *Sequencing reads*, *FASTQ on disk*, *RNA-seq
  experiments*, *Reference transcriptome*, *Expectation–maximisation* — from before the content
  existed. They are now the titles M1 part 4 gave those nodes, across every board.

## What is next

1. **The operator looks** at `/route?goal=salmon` beside the redrawn `.design/Route.dc.html`. The
   part does not close before that.
2. **M3 part 5, the Node page**: the route strip, *Learn it*, the level tag, try questions inline,
   and the side column — the first page that reads what part 1 added.
3. **`providers.yaml` in `comeni-code-content`** — still waiting on the operator.

## Open questions

- **How the map behaves on a much longer route.** Salmon is 17 stops over six columns; the
  spacing is fixed, and a 60-stop route would need the Compact density W10 describes.
- **Whether the fan-in to the goal should be staggered.** Every line turns into the goal at its
  own angle; with five lines the diagonals are long, and the board's three were short.
- **Whether *where lines meet* should be prose** once W3.4's connecting text exists, rather than a
  list of junctions.
- **Whether the List view should group by line instead of by column.**

## Traps

- **`layout` is pure and tested against `salmon.fixture.ts`**, which is the API's real answer
  captured from the index. Regenerate it (the header says how) rather than hand-editing it.
- **A run stays on its band's first row.** If you add vertical segments, the map stops reading as
  a metro map — there is a test for it.
- **The map's stops are HTML buttons over an SVG**, positioned as percentages. They only line up
  because the wrapper keeps the layout's aspect ratio.
- **Five boards share `routeMetro`.** Changing the map's coordinates moves the weave-review pins
  and the exam-results marks with it.
- **`?stop=` is part of the page's state.** Anything that rewrites the search params must keep it.
