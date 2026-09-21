# 2026-09-21 — M3 part 4, reopened: the map is the canvas's metro map

**Part 4 was built against the wrong reference.** The operator put `/route?goal=salmon` beside the
published canvas (https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa) in Chrome and found it
looked nothing like it. This session redrew the map and both pages to the canvas. The
[spec](../../superpowers/specs/2026-09-21-m3-route-map-redraw-design.md) (M3P4R) and the
[plan](../../superpowers/plans/2026-09-21-m3-route-map-redraw.md) amend
[part 4's](2026-09-20-m3-part-4-route-page.md).

---

## What went wrong, so it does not happen again

1. **The board was fitted to the code.** Commit `7b48844` redrew the L4 map, and the five boards
   that share it, to the geometry `layout.ts` computed. The page was then checked against that
   board, so it could only pass. Nobody opened the published canvas.
2. **The geometry was the wrong shape.** It stacked one band per region and poured every line
   into the goal from the right. The canvas has a trunk and branches: lines leave a shared stop at
   45°, run parallel, and meet in a diamond at the goal.
3. **Labels were fixed-size HTML over a shrinking SVG**, so *k-mers* landed on *Sequence alignment
   and scores*.
4. **The page left out things its own spec kept**: the legend, the breadcrumb and header buttons,
   and the board's width.

**The rule now (M3P4R.1):** a screen is compared with the *published* canvas, open in a browser,
at the page's real width. A board regenerated in the same change is never the reference. Chrome
is available to the agent (Claude in Chrome); `firefox --headless --screenshot` is the fallback.

## Where things stand

| Claim | Check |
|---|---|
| `.design/` is the published canvas again | `git diff 7b48844^ -- .design/` is empty; `node .design/build_pages.mjs` changes nothing |
| The goal's line runs through the middle; the others take the order with the shortest needs between lines | `npm test -- src/route/layout.test.ts` (*keeps needs between lines shortest*, which tries all 24 orders) |
| Thick lines run only level or at 45°, start where they branch, and end at the goal | `layout.test.ts` (*the lines*) |
| Thin connectors turn in at the stop that needs them | `layout.test.ts` (*the thin connectors*) |
| Labels are SVG and wrapped; stops take the canvas's three marks; the selected stop is ringed | `npm test -- src/route/RouteMap.test.tsx` |
| The page has the board's frame, legend and neutral rail | `npm test -- src/route/RoutePage.test.tsx` |
| Start draws the route as the map, with candidates folded once one is chosen | `npm test -- src/start/StartPage.test.tsx` |
| The web checks all pass (106 tests) | `npm run lint && npm run typecheck && npm test && npm run build` |
| The stack serves it | `docker compose up -d --wait --build`, then `ops/stack-check.sh` |
| It looks like the canvas | Seen in Chrome beside L4 and L1: light, dark, and at 420 px |

## What changed

| Commit | What is now true |
|---|---|
| `0d5dbd0` | the spec and the plan |
| `9bb20f6` | the boards are the published canvas; `CLAUDE.md` links the canvas that exists (the old link gave *Page not found*) |
| `6b5a7d8` | `layout.ts`: lanes around the goal's line, branches, a diamond, connectors that arrive late; `bands` is now `lines` |
| `5fc34dd` | `RouteMap.tsx`: SVG labels with a halo, three marks, a selection ring, and a sideways scroll below 0.55 scale |
| `6188e32` | the Route page in the board's frame: breadcrumb, *Change goal*, legend, neutral rail, a panel in the board's style, *Next up* and *Where lines meet* as two cards |
| `684f07d` | the Start page is L1: centred question, the input and its button in one box, ticked cards, the route as the map on the drafting grid |
| `a3ecaca` | at a phone's width the rail drops below the count, and the gutter is 16 px |

## Decisions made, and why

1. **Line order is searched, not fixed.** Placing regions in `regions.yaml` order put *Sequencing*
   and *Sequence analysis* far apart even though they share needs. Every order is tried (up to
   seven lines besides the goal's) and the cheapest wins, with ties going to route order. It is
   still deterministic.
2. **Branches leave early; connectors arrive late.** A connector that turned early merged into a
   line before the stop it serves. From *Gene expression* it seemed to feed *FASTQ*, not *RNA-seq
   reads and libraries*.
3. **One steep connector is allowed.** *Short-read sequencing* → *Mapping reads* crosses three
   lanes in one column, so 45° cannot fit. The spec lists it as open.
4. ***Where lines meet* holds the milestones' place**, one row per stop where another line comes
   in, rather than thirteen sentences.
5. **Start's candidates fold away** once one is chosen, behind *+ Add another target*, as on the
   board.

## Absent on purpose

*Settled*, *review due*, *ready* and *in progress*; *13 to go* and *About 5 days*; *Questions
answered*, *Proved by* and *Continue*; *Test yourself*; milestones; the step-back card; *How it
fits together*; *Place me first*. Each needs learner records (T7), exams, problems (M6) or
connecting text (W3.4), and none is faked.

## What is next

1. **The operator looks again** at `/route?goal=salmon` and `/?q=salmon&goal=salmon` beside the
   canvas. Then part 4 closes and its pull request goes up.
2. **M3 part 5, the Node page**, compared with the published L5 board from the start.

## Traps

- **`layout` tests read `SALMON`**, the API's real answer. If the fixtures change, regenerate it
  (its header says how) and expect the lane order to be re-checked by the 24-order test.
- **Labels are SVG with `paint-order: stroke`.** The halo is `stroke-surface`, so on the Start
  page's grid it shows as a faint surface-coloured box. That is deliberate.
- **The browser caches the bundle.** After `docker compose up --build`, reload before judging.
