# M3 part 4 — the Route page: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/route?goal=salmon` draws the woven route as a metro map with a selected-stop panel,
beside the redrawn L4 board.

**Architecture:** a pure layout function turns `RouteOut` into geometry (lines = regions, columns
= depth in *needs*); an SVG component draws it; the page carries goal, known, stop and view in the
URL.

**Tech Stack:** React 19, React Router 8, TypeScript 7 strict, Tailwind 4 with the generated
tokens, vitest + Testing Library, Biome. Django 6.1 and django-ninja for the one API field.

**Spec:** [`docs/superpowers/specs/2026-09-20-m3-route-page-design.md`](../specs/2026-09-20-m3-route-page-design.md)

## Global Constraints

- **The identity is the law** (W10): tokens only, never a raw hex. **One meaning per colour** —
  teal is *your route*, blue is *selected*; regions are told apart by position and label, never by
  colour. Right angles and 45° elbows, no curves. Nothing under 11 px. WCAG AA.
- **Every state is a sentence**, as `StartPage.tsx` does it.
- **Types come from `src/api/schema.ts`**; do not hand-write a response type.
- **The layout is pure**: no React, no DOM, no dates, no randomness. Same route in, same geometry
  out.
- **Read the exit code of every check.** `npm run test | grep` hides a failing suite (part 3's
  trap). Run `npm run lint`, `npm run test`, `npm run typecheck` and read `$?`.
- **Node 24 must be on `PATH`** (`~/.local/node24/bin`), or `npm install` refuses.
- Dependencies pinned exactly; **no new dependency in this part**.
- Conventional Commits with a body ending `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Never commit to `main`; the branch is `m3-part-4-route-page`.

---

### Task 1: `claim` joins a stop

**Files:**
- Modify: `apps/api/src/code_api/content/routes.py`
- Modify: `apps/api/tests/test_routes_api.py`
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`

**Interfaces:**
- Produces: `StopOut.claim: str`, filled from the `Node` row already loaded.

- [ ] **Step 1: Write the failing test**

```python
def test_a_stop_carries_its_claim(client: Client) -> None:
    rebuild_index(FIXTURES)
    body = client.get("/api/routes", {"goal": "salmon"}).json()
    first = body["stops"][0]
    assert first["claim"] == CONTENT.nodes[first["id"]].claim
```

- [ ] **Step 2: Run it and watch it fail**

Run: `uv run pytest apps/api/tests/test_routes_api.py -k claim` (Compose's Postgres up).

- [ ] **Step 3: Add the field**

`claim: str` on `StopOut`, filled beside `title` in the stop card. The query does not change —
`_index()` already loads whole `Node` rows.

- [ ] **Step 4: Regenerate and run**

```bash
uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json
cd apps/web && npm run api-types && npm run test; echo $?
```

Run: `uv run pytest apps/api/tests -q`

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web/src/api/schema.ts
git commit -m "feat(api): a route's stops carry their claim"
```

---

### Task 2: The layout

**Files:**
- Create: `apps/web/src/route/layout.ts`, `apps/web/src/route/layout.test.ts`
- Create: `apps/web/src/route/salmon.fixture.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Placed { id: string; x: number; y: number; goal: boolean; depth: number }
  export interface Band { region: RegionOut; y: number; height: number; stops: string[] }
  export interface Layout {
    width: number; height: number;
    bands: Band[]; stops: Placed[]; runs: string[]; links: string[];
    needs: Map<string, string[]>; unlocks: Map<string, string[]>;
  }
  export function layout(route: RouteOut): Layout
  ```
  `needs` and `unlocks` are exported because the panel and *Next up* need exactly them, and they
  are derived here once.

- [ ] **Step 1: Capture the real route as a fixture**

With the stack up and the index rebuilt:

```bash
curl -s "http://127.0.0.1:8090/api/routes?goal=salmon" > /tmp/salmon-route.json
curl -s "http://127.0.0.1:8090/api/routes?goal=salmon&known=read-mapping" > /tmp/salmon-known.json
```

Write `salmon.fixture.ts` exporting both as `RouteOut` constants, with a comment saying they were
captured from the fixtures' index and how. **Do not hand-write them**: the point is that the
layout is tested against what the API really answers.

- [ ] **Step 2: Write the failing tests**

```ts
import { SALMON, SALMON_KNOWN } from "./salmon.fixture";
import { layout } from "./layout";

const bands = (l: Layout) => l.bands.map((band) => band.region.id);

it("draws every stop once, in six bands", () => {
  const l = layout(SALMON);
  expect(l.stops).toHaveLength(17);
  expect(bands(l)).toEqual([
    "molecular-biology", "sequencing", "sequence-analysis",
    "algorithms", "statistics", "transcriptomics",
  ]);
});

it("never draws a stop left of something it needs", () => {
  const l = layout(SALMON);
  const at = new Map(l.stops.map((stop) => [stop.id, stop.x]));
  for (const [id, needed] of l.needs) {
    for (const need of needed) expect(at.get(need)!).toBeLessThan(at.get(id)!);
  }
});

it("puts the goal last, and marks it", () => { … });
it("ends every band's run at the goal's column", () => { … });
it("links a need that crosses bands, and leaves one inside a band to the run", () => { … });
it("gives two stops of one region at one depth their own rows", () => { … });
it("lays out the known route with one stop fewer per dropped stop", () => {
  expect(layout(SALMON_KNOWN).stops).toHaveLength(14);
});
it("is the same geometry twice", () => {
  expect(layout(SALMON)).toEqual(layout(SALMON));
});
```

Read the fixture before pinning the band list: the order is the order regions first appear in the
route, which is `regions.yaml` order because the weave sorts by region position (M2P1.3). Check it
rather than trusting this plan.

- [ ] **Step 3: Run them and watch them fail**

Run: `cd apps/web && npx vitest run src/route/layout.test.ts`

- [ ] **Step 4: Write `layout.ts`**

```ts
const COLUMN = 210;   // x between depths
const ROW = 46;       // y between sub-rows inside a band
const PAD = 54;       // space above and below a band's rows
const MARGIN = 90;    // left and right margin, for labels

/** `needed_by` is who needs me; the map wants the other direction. */
function needsOf(route: RouteOut): Map<string, string[]> {
  const needs = new Map(route.stops.map((stop) => [stop.id, [] as string[]]));
  for (const stop of route.stops) {
    for (const needing of stop.needed_by) needs.get(needing.id)?.push(stop.id);
  }
  return needs;
}

/** Longest path: "stops at the same distance can be done in any order" (the board). */
function depths(route: RouteOut, needs: Map<string, string[]>): Map<string, number> { … }

/** A horizontal run then a 45° elbow, as the board draws it: `M x1 y1 H x2-|dy| L x2 y2`. */
function elbow(x1: number, y1: number, x2: number, y2: number): string { … }
```

Bands are the regions in first-appearance order. Inside a band, stops sort by depth; stops sharing
a depth take successive rows, and the band's height is `PAD * 2 + (rows - 1) * ROW`. A band's run
is the polyline through its stops in depth order, continued to the goal. A need crossing bands is
an `elbow` from the need to the stop.

- [ ] **Step 5: Run the tests until they pass**

Run: `cd apps/web && npx vitest run src/route/layout.test.ts; echo $?`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/route
git commit -m "feat(web): the route's geometry, as a pure function"
```

---

### Task 3: The map

**Files:**
- Create: `apps/web/src/route/RouteMap.tsx`, `apps/web/src/route/RouteMap.test.tsx`

**Interfaces:**
- Consumes: `layout`, `RouteOut`.
- Produces: `<RouteMap route={…} selected={id | null} onSelect={(id) => …} />`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("draws a button per stop, titled", () => { … 17 buttons … });
it("marks the goal", () => { … "your goal" … });
it("tells the parent which stop was clicked", () => { … onSelect called with "k-mers" … });
it("rings the selected stop", () => { … aria-pressed or aria-current … });
it("names the bands beside the map", () => { … "Molecular biology" … });
```

Each stop is a `<button>` inside the SVG (a `<g role="button">` is not focusable by default; use a
real `<foreignObject>`-free approach: `<g>` with `tabIndex` and `role="button"` **and** an
`aria-label`, or wrap the SVG's stops in an overlaid list). Decide by what Testing Library and a
keyboard can both reach; the identity's law is that the map is usable without a mouse.

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Draw it**

One `<svg viewBox="0 0 width height">`; the thick runs, then the thin links, then the stops.
Titles above each circle, minutes below in mono. Tokens only: `stroke-line` for runs and links,
`fill-surface`/`stroke-ink` for a stop, `stroke-sel` for the selected ring.

- [ ] **Step 4: Run every web check with its exit code**

```bash
cd apps/web && npm run lint; echo $?; npm run test; echo $?; npm run typecheck; echo $?
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): the route drawn as lines meeting at the goal"
```

---

### Task 4: The page, its facts and its states

**Files:**
- Create: `apps/web/src/route/RoutePage.tsx`, `apps/web/src/route/RoutePage.test.tsx`
- Modify: `apps/web/src/App.tsx` (the `/route` path)

**Interfaces:**
- Consumes: `fetchRoute`, `useSearchParams`, `RouteMap`.
- Produces: the page at `/route`, reading `goal`, `known`, `stop` and `view`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows the goal, its claim and the span", async () => { … "Learn Salmon" … });
it("shows the stop count and the time", async () => { … "17 stops" … "about 3 h 4 min" … });
it("names each band in the rail with its stop count", async () => { … "Molecular biology" … "3 stops" … });
it("says Weaving your route… while it waits", () => { … });
it("prints the API's sentence on a 404", async () => { … });
it("says there is no goal yet, with a way back to Start", () => { … link to "/" … });
it("switches to the List view and keeps the stops", async () => { … ?view=list … });
```

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Build the page**

Header (title *Learn <goal titles>*, the goal's claim, the span), toolbar (Map · List), the facts
row, the rail of bands, then the map or the list. `useQuery` keyed `["route", ...goals, ...known]`.
Everything in the URL: `goal`, `known`, `stop`, `view`.

- [ ] **Step 4: Run every web check with its exit code**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): the Route page, its facts and its states"
```

---

### Task 5: The panel, next up, and where lines meet

**Files:**
- Create: `apps/web/src/route/StopPanel.tsx`, `apps/web/src/route/NextUp.tsx`
- Modify: `apps/web/src/route/RoutePage.tsx`, `apps/web/src/route/RoutePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("fills the panel from a pasted ?stop=", async () => { … claim, level, minutes … });
it("lists what the stop needs and what it unlocks", async () => { … });
it("gives every stored reason the stop is on this route", async () => { … the reason text … });
it("says to pick a stop when none is selected", async () => { … });
it("selects a stop into the url when the map is clicked", async () => { … ?stop=k-mers … });
it("offers at most four unblocked stops under Next up", async () => { … });
it("says where the lines meet", async () => { … "feeds" … });
it("links Open page to the node", async () => { … href="/node/k-mers" … });
```

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Build the three pieces**

The panel from `layout`'s `needs`/`unlocks` and the stop's `needed_by` reasons; *Next up* from the
depth-0 stops with `unlocks.get(id).length`; *where lines meet* from the cross-band links, named
with both regions.

- [ ] **Step 4: Run every check, web and Python**

```bash
cd apps/web && npm run lint; echo $?; npm run test; echo $?; npm run typecheck; echo $?
cd ../.. && uv run ruff check . && uv run mypy && uv run pytest -q
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): the selected stop says why it is on the route"
```

---

### Task 6: The board redraw

**Files:**
- Modify: `.design/build_pages.mjs` (the `route()` board), regenerating `.design/Route.dc.html`
- Modify: `docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md`
  (M2's dated note: the redraw is done)

- [ ] **Step 1: Take the geometry from the layout**

Print the layout's stops and paths for the Salmon route (a scratch script or a temporary test) and
use those coordinates, scaled to the board's canvas, so the board and the page agree.

- [ ] **Step 2: Redraw**

The 17 fixture stops, six lines named for their regions, the rail renamed. **Keep** every element
drawn for later phases: settled/review-due/ready states, *not written yet*, milestones, the
step-back detour, the Labs ending, *Test yourself*.

- [ ] **Step 3: Regenerate and look**

```bash
node .design/build_pages.mjs
```

Open `.design/Route.dc.html`. It must still read as the L4 board, with the real route in it.

- [ ] **Step 4: Commit**

```bash
git add .design docs/superpowers/specs
git commit -m "design(route): the board draws the fixtures' 17 stops"
```

---

### Task 7: The checks, the stack, and the operator's look

- [ ] **Step 1: Run everything, reading exit codes**

```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest; echo $?
cd apps/web && npm run lint; echo $?; npm run test; echo $?; npm run typecheck; echo $?
cd ../.. && docker compose up -d --wait --build && ops/stack-check.sh; echo $?
uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon
```

- [ ] **Step 2: Ask the operator to look**

`http://127.0.0.1:8090/route?goal=salmon` beside `.design/Route.dc.html`, with the list of what is
deliberately absent (M3P4.1). **The part does not close until they answer**, and what they say
goes in the journal entry.

- [ ] **Step 3: CLAUDE.md, the journal entry, the README box**

`docs/notes/journal/2026-09-20-m3-part-4-route-page.md`: where things stand, what changed with
hashes, the decisions and their rejections, what is next (part 5, the Node page), open questions,
traps.

- [ ] **Step 4: The pull request**

```bash
git push -u origin m3-part-4-route-page
gh pr create --title "M3 part 4: the Route page" --body "…"
gh pr checks <n> --watch; echo $? > scratchpad/checks<n>.rc
```

Merge only when that file holds 0 **and** the operator has looked.
