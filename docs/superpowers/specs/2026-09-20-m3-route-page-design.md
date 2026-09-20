# M3 part 4 — the Route page

**Status: agreed 2026-09-20.** The fourth of phase M3's six parts (architecture spec R4).
The parts list is in [`2026-09-20-m3-in-parts.md`](../../notes/journal/2026-09-20-m3-in-parts.md);
part 3 built the spine this page sits on
([spec](2026-09-20-m3-spine-and-start-design.md)). It is the page the whole weaver was built for,
and it decides:

- what the page holds, measured against the L4 board;
- what a line is, and where a stop is drawn;
- what the selected-stop panel says;
- how the Route board is redrawn.

The operator made every decision here on 2026-09-20, question by question, and steered the scope
back towards the board: **the page is the board with the learner's history absent, not a smaller
page of its own design.**

---

## M3P4.1 What this part does

```
/route?goal=salmon[&known=…][&stop=k-mers][&view=list]
        │
        └─ GET /api/routes ──► header · facts · rail · map · panel · next up
```

**The board's composition, kept**: header → toolbar → facts → line rail → map → legend → *where
lines meet* → selected-stop panel → *next up* → milestones.

| Board element | In part 4 |
|---|---|
| **Learn Salmon**, the level span, the outcome sentence | **yes** — the goal's title, the route's span, and the goal's **claim** as the outcome |
| **Map · List** toggle | **yes**, both views |
| *7 stops to go · about 2 h 20 min · 6 of 13 settled* | **the two we can know**: *17 stops · about 3 h 4 min*. A settled count needs T7 |
| **Line rail** (*Data line · 2 to go*) | **yes**, as regions: *Molecular biology · 3 stops*, in `regions.yaml` order |
| **The map** — lines converging on the goal, thin connectors for needs off a line, one colour | **yes**, the whole thing (M3P4.2) |
| **Legend** (*Settled · Review due · Ready · Not written yet*) | **the states that exist**: *on your route*, *your goal*, *selected*. The others are T7 and M7 |
| **Where lines meet** | **yes, derived** from the crossings (M3P4.3), not the board's written prose, which is W3.4 |
| **Selected stop** — claim, level, time, needs, unlocks, *why it's on this route* | **yes**, from the route's stored reasons (M3P4.3) |
| *Questions 2 of 5*, *Proved by*, *In progress*, **Continue** | **no** — T7 and M6 |
| **Open page** | **yes**, to `/node/:id`, which part 5 builds |
| **Next up · 4 ready · any order** | **yes, derived**: the stops nothing on the route blocks |
| **Milestones**, the **step back** detour, the **Labs** ending | **no data exists**: problems are M6, a detour needs an answer (T6.1), Labs is a separate product |
| *Test yourself* | **no** — L13 and exam pools (T7.1) |

**One change to the API:** `claim` joins `StopOut`. The panel's first line and the header's
outcome sentence both need it, and the row already holds it — no extra query, one field.

**Side doors wait.** The toggle draws *goes-deeper* and *related* on the map (W3.2). Those nodes
are not route stops: they have no depth and no line, so they need a second layout, and the toggle
changes nothing about the route. It costs a later part, not this one.

**Done when:**

- `/route?goal=salmon` draws the fixtures' 17 stops as six lines converging on Salmon, with the
  List view beside it;
- a stop selects into `?stop=` and fills the panel, including every stored reason it is there;
- `&known=read-mapping` draws 14;
- every state is a sentence, as Start's are;
- the layout is a pure function with its own tests (M3P4.5);
- the **Route board is redrawn to the fixtures' 17 stops** across their real regions, keeping
  everything it draws for later phases;
- CI is green, and **the operator has looked at the page beside the redrawn board**.

## M3P4.2 The map

The board's geometry, read off it: lines run **left to right in one colour**, thick where a line
runs and **thin where a need crosses lines**; a stop is a circle with its title above and a small
mono line below; lines **converge on the goal** at the right; transitions between rows are **45°
elbows after a horizontal run**, not square corners.

**Positions come from the route:**

| Axis | From |
|---|---|
| **x — the column** | the stop's **depth**: 0 when nothing on this route blocks it, otherwise one more than the deepest thing it needs (longest path). The board's *stops at the same distance can be done in any order* is this layering |
| **y — the band** | its **region**, in `regions.yaml` order; one band per region the route touches |

- Two stops in the same band at the same depth take **sub-rows** inside the band; the band grows
  and the line still reads as one line.
- A band's **run** goes from its first stop to its last at the band's y, then **on to the goal**:
  every line ends at the goal, as the board says.
- A **need that crosses bands** is drawn as a thin link: a horizontal run, then a 45° diagonal.
- The **goal** is the deepest stop, drawn larger and labelled *your goal*.

**Colour stays lawful.** W10 gives one meaning per colour, so six regions cannot be six colours:
every line is the route colour, told apart by **position and the labelled rail**, exactly as the
board does it. The **selected** stop takes the blue *next / selected* ring — the only other colour
on the map. Dashes stay reserved for *not written yet* (M7).

**The layout is a pure function**, `apps/web/src/route/layout.ts`:

```ts
export interface Placed { id: string; x: number; y: number; goal: boolean }
export interface Band { region: RegionOut; y: number; height: number; stops: string[] }
export interface Layout {
  width: number; height: number;
  bands: Band[]; stops: Placed[];
  runs: string[];    // the thick line paths, one per band
  links: string[];   // the thin cross-band needs
}
export function layout(route: RouteOut): Layout
```

No React, no DOM: the hard part is tested directly against the Salmon route.

**Density and small screens** (W10's *Compact*): past a stop count the spacing tightens and the
second label line drops; below a phone width the page opens on **List**, and the map scrolls
horizontally rather than shrinking into an unreadable diagram.

**The List view** is the same stops in route order, grouped by depth — *these can be done in any
order* — each row with title, level, minutes and region, selecting into the same `?stop=`.

**Rejected:**

| Alternative | Why not |
|---|---|
| Lines computed as chains through the needs graph | closer to the board's three thematic lines, but a stop's line would change with the route, and it is a layout algorithm to own on top of the one we already need |
| One line per goal | collapses to a single line for every route we have |
| A graph layout library (elkjs, dagre) | a heavy dependency, positions we do not control, and curves where the identity asks for right angles and 45° elbows |
| A CSS grid of stops | connectors get crude exactly where lines merge, which is where the goal is |
| Six line colours | W10: one meaning per colour. Teal is *your route*; it cannot also mean *Algorithms* |

## M3P4.3 The panel, next up, and where lines meet

**The selected-stop panel**, row for row from the board:

| Row | From |
|---|---|
| title, claim | the stop (`claim` is the field this part adds) |
| **Level · Time** | `level`, `minutes` |
| **Needs** | its needs on this route — the inverse of `needed_by` |
| **Unlocks** | the stops that need it |
| **Why it's on this route** | one line per needing stop, with **its stored reason** (M2P2.2) |
| **Open page** | `/node/:id`, live in part 5 |

Nothing selected is a state: *Pick a stop to see why it's on your route.*

**Next up** — the board's *4 ready · any order* — is the stops **nothing on this route blocks**
(depth 0), at most four, each with its region and *unlocks N stops*. No history needed.

**Where lines meet** is derived: one line per crossing — *k-mers (Sequence analysis) feeds
de Bruijn graphs (Algorithms)* — and where each band ends. The board's written paragraph is
connecting text (W3.4) and stays out.

**The URL carries everything:** `/route?goal=…&known=…&stop=…&view=map|list`. A selected stop, a
known set and the List view are each a link that can be sent, and the back button walks them —
part 3's rule (M3P3.2).

**States, each a sentence:** *Weaving your route…*; the API's own words on 404 and 503;
*Can't reach the API · network error*; and with no `goal` at all, *No goal yet* with a link to
Start rather than an empty map.

## M3P4.4 The board redraw

`.design/Route.dc.html` is generated by `.design/build_pages.mjs`, where the map is hand-placed
SVG. The redraw:

- replaces the 13 invented stops with the fixtures' **17**, across their **six real regions**,
  with the coordinates the layout function produces, so the board and the page agree on geometry;
- renames the three invented lines (*Data*, *Reads*, *Index*) to the regions they became;
- **keeps everything the board draws for later phases** — settled states, review due, milestones,
  the step-back detour, the Labs ending — because the board is the target the later phases are
  measured against, not a picture of the MVP.

R4's 2026-09-19 note said the board is redrawn in M3's design round; this is that redraw, and the
note is updated to say it is done.

## M3P4.5 What the tests prove

**The layout** (`apps/web/src/route/layout.test.ts`), against the real Salmon shape:

| Test | Proves |
|---|---|
| 17 stops in six bands, in `regions.yaml` order | lines are regions |
| no stop is left of anything it needs | the layering is a longest-path layering |
| every band's run reaches the goal's column | *every line ends at your goal* |
| a need crossing bands is a thin link, one inside a band is not | the two weights the board uses |
| two stops of one region at one depth take sub-rows, and the band grows | collisions |
| the 14-stop `known` route lays out with one band fewer | known shortens the picture |

**The page** (`apps/web/src/route/RoutePage.test.tsx`):

| Test | Proves |
|---|---|
| the header shows the goal, its claim and the span; the facts show stops and time | the board's top |
| clicking a stop sets `?stop=`; a pasted `?stop=` opens the panel filled | selection in the URL |
| the panel lists needs, unlocks and every stored reason | the board's centrepiece |
| *Next up* holds only unblocked stops, at most four | derived, not faked |
| the List view shows the same stops grouped by depth and selects the same way | both views, one state |
| pending, 404, 503, unreachable and no-goal each render their sentence | no silent state |
| *Open page* links to `/node/:id` | the handover to part 5 |

Nothing in M2's route tests, M3 part 1's fixtures or part 2's search changes: this part reads.
