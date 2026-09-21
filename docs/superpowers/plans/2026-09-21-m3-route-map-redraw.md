# The Route map redrawn as the canvas's metro map: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/route?goal=salmon` and the Start page's preview draw the route as the published
canvas's metro map, and the Route page takes the L4 board's frame.

**Architecture:** `apps/web/src/route/layout.ts` is still one pure function of a `RouteOut`, but
its geometry changes. Lines take lanes around the goal's line, branch at 45° and meet in a
diamond. `RouteMap.tsx` draws the labels in SVG, so they scale with the map, and keeps an HTML
button over each stop. The page shells change in Tailwind only.

**Tech stack:** React 19, TypeScript 7, Tailwind 4, vitest and Testing Library, Biome.

**Spec:** [`2026-09-21-m3-route-map-redraw-design.md`](../specs/2026-09-21-m3-route-map-redraw-design.md)
(M3P4R.1 to M3P4R.4), amending [part 4's spec](../specs/2026-09-20-m3-route-page-design.md).
The prototype that settled the geometry was shown to the operator on 2026-09-21.

## Global constraints

- **The reference is the published canvas**, https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa,
  opened in a browser. `.design/` must equal it.
- `layout` stays pure and deterministic, tested against `salmon.fixture.ts`, the API's real
  answer.
- Thick lines only ever run level or at 45°.
- One colour for every line (W10). Stop states that don't exist yet (settled, review due, ready)
  are not drawn.
- The web commands pass: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (in
  `apps/web`, Node 24).

---

### Task 1: The canvas back in `.design/`

**Files:** `.design/*` (restored from `7b48844^`), `CLAUDE.md` (the canvas link).

- [ ] Run `git checkout 7b48844^ -- .design/`, then `node .design/build_pages.mjs`, then
      `git status --short .design`. Expected: regenerating changes nothing, so the output matches
      the restored files.
- [ ] In `CLAUDE.md`, change the design canvas link from `RxgqwSDJ2N3UTSg4HUotxJ` (which gives
      "Page not found") to `WGDwxV8gHZwSxyzSQAJKPa`.
- [ ] Commit: `design: the boards are the published canvas again`. The body says why: the part 4
      redraw fitted the board to the code.

### Task 2: The geometry

**Files:** rewrite `apps/web/src/route/layout.ts` and `apps/web/src/route/layout.test.ts`.

**Interfaces (produced):**

```ts
export const COLUMN = 230, LANE = 100, ROW = 92, LEAD = 70;
export interface Placed { id: string; x: number; y: number; depth: number; goal: boolean;
  meets: boolean; label: "above" | "below" | "right" }
export interface Line { region: RegionOut; lane: number; stops: string[] } // route (regions.yaml) order
export interface Layout { box: { x: number; y: number; width: number; height: number };
  lines: Line[]; stops: Placed[]; runs: string[]; links: string[];
  needs: Map<string, string[]>; unlocks: Map<string, string[]> }
export function layout(route: RouteOut): Layout;
export function elbow(a: Point, b: Point, early?: boolean): string;
export function wrapTitle(title: string, most?: number): string[];
```

`bands` becomes `lines`. Consumers (`RoutePage.tsx` `Facts`, `NextUp.tsx`) change in the same
task: `drawn.bands` → `drawn.lines`, with the same `region` and `stops` fields.

- [ ] **Write the failing tests** in `layout.test.ts`. Parse each path into points
      (`M x y`, `H x`, `L x y`) with a helper `segments(path)`, then assert the following.
  - 17 stops. `lines` are the five regions in route order.
  - No stop is left of something it needs. Each stop is one column past its deepest need. The
    stops with no needs share the first column.
  - Salmon is the only goal, the rightmost stop, at `y = 0`, and its line has lane 0.
  - Lanes for Salmon: molecular biology −1, sequencing +1, sequence analysis −2, statistics +2.
    No other order of those four has a smaller total cross-line distance, which the test checks
    by trying all 24.
  - Every run ends at Salmon's point.
  - Every thick segment is level or exactly 45°.
  - Runs start at their branch points. Sequencing's and sequence analysis's start at *DNA and
    genes*, transcriptomics's at *Transcripts and isoforms*, statistics's at *Probability*.
  - Every connector ends at a stop that needs the stop it starts from, and its last segment
    arrives at that stop directly: level on the same row, otherwise diagonal.
  - A connector's segment is steeper than 45° only when its rise is more than its run.
  - *Sequence alignment and scores* sits one `ROW` further out than *k-mers* (above it, because
    lane −2 is above), and a connector reaches it.
  - `meets`: *DNA and genes* yes, *Likelihood* no.
  - Labels: lanes ≤ 0 above, lanes > 0 below, the goal right.
  - The shortened route (`SALMON_KNOWN`) lays out 14 stops.
  - The same layout twice. An empty route gives no stops and a positive box.
  - `wrapTitle("Reads that map to several places")` gives
    `["Reads that map to", "several places"]`, and `wrapTitle("k-mers")` gives `["k-mers"]`.
- [ ] Run `npm test -- src/route/layout.test.ts`. Expected: FAIL, because `lines`, `meets`,
      `label` and `wrapTitle` do not exist yet.
- [ ] **Implement `layout.ts`** as prototyped: relations and depths as before, then the steps
      below.
  1. **Anchor goal.** The deepest of `route.goals`, the first one on a tie.
  2. **Lane order.** Brute-force the orders of the other regions over the slots −1, +1, −2, +2, …
     Cost is the sum of `|lane(a) − lane(b)|` over needs between regions, leaving out needs into
     the anchor. The first order with the lowest cost wins, trying permutations in route order.
     Past `MOST_ORDERED = 7` other lines, use route order.
  3. **Rows.** Within a region and a column, the k-th stop gets row k.
  4. **Lane y.** Stack outward from 0: `LANE` plus the inner lane's extra rows × `ROW`.
  5. **A stop's y.** Its lane's y plus side × row × `ROW`.
  6. **Runs.** A lane's row-0 stops by x, preceded by the branch point (the first stop's
     deepest need on another line; ties go to the nearest lane, then route order) and followed
     by the anchor. The first hop is an `elbow(…, early = true)`, the rest late.
  7. **Links.** One for every need no run carries, unless both stops are on the same row of the
     same region. Leave out needs into the anchor from a stop on the anchor's row.
  8. **`meets`.** Branch points, both ends of every link, and the goal.
  9. **Box.** Min and max of the points, plus margins of 130 left, 210 right and 90 top and
     bottom.
- [ ] Update `Facts` and `NextUp` to use `lines`.
- [ ] Run `npm test` and `npm run typecheck`. Expected: `layout.test.ts` passes. `RouteMap`
      tests may fail until task 3.
- [ ] Commit: `feat(web): the route map takes the canvas's shape`.

### Task 3: Drawing it

**Files:** `apps/web/src/route/RouteMap.tsx` and `RouteMap.test.tsx`.

- [ ] **Failing tests** to add:
  - Each stop's title is drawn as SVG text inside the `img`, wrapped: `within(img).getByText("several places")`.
  - The goal is drawn with the goal mark (`data-mark="goal"`).
  - *DNA and genes* has `data-mark="meets"`.
  - The selected stop has a dashed ring (`data-selected`).
  - The 17 buttons stay, with the same accessible names.
- [ ] Run `npm test -- src/route/RouteMap.test.tsx`. Expected: FAIL.
- [ ] **Implement**, drawing in this order:
  - links, each with an 8-unit surface-colour casing under a 2.5-unit line;
  - runs, 8 units wide, round caps;
  - stop marks: the goal at r 14 with a 10-unit `fill-line` square; where lines meet at r 10 with
    a 3-unit `stroke-ink`; the rest at r 7.5 with a 2.2-unit `stroke-ink-3`; all filled with the
    surface colour;
  - the selected stop's ring: r + 8, `stroke-sel`, dashed 3 3;
  - labels: the name at 17 units (weight 600 where lines meet), minutes in mono at 14 units,
    placed per `label`, and the goal's name in mono at 20 units with *your goal* at 14 in
    `fill-btn`. The halo is `paint-order: stroke`, with the stroke in the surface colour, 6 units
    wide.

  Buttons are 36 px transparent circles centred on each stop, with a focus ring. The wrapper sets
  `min-width: box.width × 0.55 px` and scrolls sideways past that.
- [ ] Run `npm test`. Expected: all pass. Then commit: `feat(web): the map draws its own labels, as the canvas does`.

### Task 4: The Route page's frame

**Files:** `apps/web/src/route/RoutePage.tsx`, `NextUp.tsx`, `RoutePage.test.tsx`.

- [ ] **Failing tests:**
  - The breadcrumb `Home` links to `/`.
  - A *Change goal* link goes to `/`.
  - The legend sentence reads "Every line ends at your goal. Thin lines are extra needs. Stops at
    the same distance can be done in any order."
  - The rail's bars are not `bg-line`.
- [ ] **Implement:**
  - `main`: `mx-auto max-w-[1440px] px-9 py-6`.
  - Header row: the left side holds the breadcrumb, h1, tags and outcome; the right side, from
    `pt-[26px]`, holds the Map · List toggle and *Change goal*.
  - Rail bars: `bg-border-2`.
  - Map panel: `grid-cols-[minmax(0,1fr)_360px]`, with the legend (sentence, *Where lines meet*
    mark, *Your goal* mark) under the map.
  - *Next up*: a panel of cards in two columns, spanning the width; *Where lines meet* stays under
    it.
- [ ] Run `npm test`. Expected: all pass. Commit: `feat(web): the Route page in the board's frame`.

### Task 5: The Start page's preview

**Files:** `apps/web/src/start/StartPage.tsx`, `RoutePreview.tsx`, `StartPage.test.tsx`.

- [ ] **Failing test:** once a goal is chosen, the preview shows the map
      (`getByRole("img", { name: /17 stops/ })`) and the facts, and still offers *Start from the
      beginning*.
- [ ] **Implement, matching L1:**
  - A centred hero: h1 44 px, the lede centred, and the input with its button inside one bordered
    box.
  - Example chips centred.
  - Results in one wide panel (`max-w-[1040px]`): *1 · Is this what you mean?* above *2 · Your
    route*, with the facts inline and `RouteMap` in place of the numbered list.
  - Behaviour unchanged.
- [ ] Run `npm test`. Expected: all pass. Commit: `feat(web): the Start page's preview is the route map`.

### Task 6: Seen beside the canvas, then recorded

- [ ] Run `npm run lint && npm run typecheck && npm test && npm run build`, then
      `docker compose up -d --wait --build` and `ops/stack-check.sh`.
- [ ] In Chrome, with the canvas tab open, compare `/route?goal=salmon` with L4 and `/?q=salmon`
      with L1, in light and dark and at a phone width. Fix what differs, and list what is
      absent on purpose.
- [ ] Mark the spec agreed. Write the journal entry
      `docs/notes/journal/2026-09-21-m3-part-4-map-redraw.md` and update the README box.
      Update `CLAUDE.md`'s status line.
- [ ] Commit: `docs: the journal entry for the map redraw`.
