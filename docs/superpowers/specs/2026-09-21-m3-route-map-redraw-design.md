# M3 part 4, reopened — the map is the canvas's metro map

**Status: agreed 2026-09-21.** The operator approved the prototype beside the canvas. A correction to part 4
([spec](2026-09-20-m3-route-page-design.md)), made before the part closes. It replaces M3P4.2's
geometry and the board redraw in that spec. Every other decision in part 4 stands.

## What went wrong

The operator put `/route?goal=salmon` beside the published canvas
(https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa) and found it looked nothing like it. Two
causes:

1. **The board was redrawn to fit the code.** Commit `7b48844` replaced the L4 board's map, and
   the five boards that share it, with the geometry `layout.ts` computed. The page was then
   checked against that board, so the check could not fail. The published canvas was never
   opened.
2. **The geometry is the wrong shape.** `layout.ts` stacks one band per region and pours every
   line into the goal at the right edge. The canvas's map has a different shape: lines leave a
   shared stop at 45°, run parallel, and meet the goal in a diamond. With labels that stay a
   fixed size over a map that shrinks, the bands also collide (*k-mers* on top of *Sequence
   alignment and scores*).

The page also left out things part 4's own spec kept: the legend, the breadcrumb and header
buttons, and the board's full width.

## M3P4R.1 The canvas is the reference

- **Revert `7b48844`.** `.design/` goes back to the published canvas. Changing the canvas is the
  operator's decision, not a side effect of a build.
- A screen is checked against the **published** canvas, open in a browser, at the page's real
  width. A board regenerated in the same change is never the reference.

## M3P4R.2 Where lines and stops go

A line is still a region (M3P4.2), and a column is still a stop's depth in *needs*. What changes
is where the lines go:

1. **The goal's line runs through the middle.** The other lines are placed above and below it,
   alternating outward. Of all the orders, the one chosen is the one that keeps needs *between*
   lines shortest, measured in lanes. Ties go to `regions.yaml` order, so the same route always
   gives the same map. With up to seven other lines every order is tried (5,040 at most). Beyond
   that, lines take `regions.yaml` order.
2. **A line starts where it branches.** Its first stop's deepest need on another line is its
   branch point, and the thick line leaves that stop and turns 45° out onto its own lane at once.
   This is the canvas's *DNA and genes*, with lines splitting up and down from it.
3. **Every line ends at the goal**: level, then a 45° turn in. Lines that come in at the same
   angle merge and run together, as on the canvas.
4. **Thin connectors** (a need that no line carries) run level along the stop they come from,
   then turn 45° to arrive at the stop that needs them, never earlier. Otherwise a connector
   joins a line early and seems to point at the wrong stop.
5. **Two stops in one column on one line**: the second sits a row further *out* from the middle,
   joined by thin connectors, and its lane makes room for that row.
6. **When 45° cannot fit** (the lanes are further apart than a column is wide), a thin connector
   runs straight. Thick lines always keep 45°. On Salmon this happens once: *Short-read
   sequencing* to *Mapping reads to a reference*.

## M3P4R.3 How a stop is drawn

- **Where lines meet** (a branch point, or a stop with a connector in or out) is a larger ring
  with a heavier ink stroke. Other stops are small rings. The goal is the largest ring, with the
  line-colour square inside and its name in mono to the right: the canvas's three marks.
- **Labels sit on the side away from the middle**: above for the goal's line and the lines above
  it, below for the lines under it. Titles wrap at about 20 characters, with the minutes in mono
  under the title.
- **Labels are SVG text** with a halo in the surface colour, so they scale with the map and stay
  readable where a connector passes. The buttons stay: an invisible HTML button over each stop
  keeps keyboard and screen-reader access.
- **The map does not scale below about 0.55.** Past that it scrolls sideways rather than shrink
  its text.

## M3P4R.4 The page, at the board's size

- The board's frame: up to 1440 px wide with 36 px sides, and the map beside a 360 px panel.
- Header: breadcrumb (*Home › Your routes*), then on the right *Map · List* and *Change goal*.
  *Test yourself* waits for exams.
- **Rail bars are neutral** (`border-2`), because a full teal bar reads as *done*.
- **The legend** under the map: the sentence, *Where lines meet*, *Your goal*. Stop states that
  do not exist yet are left out.
- *Next up* spans the width until milestones exist.
- **The Start page's preview** uses the same map. It is compared with the L1 board in the same
  change.

## Rejected

- **Keep the bands and fix the labels.** The collisions would go, but it would still be the
  wrong shape.
- **A layout library** (dagre, ELK). Rejected again, as in M3P4.2: curves and positions we do not
  control.
- **Hand-placed coordinates for Salmon.** A map that only works for one route is not computed
  (invariant 1 is about the route, but the map should keep to its spirit).
- **Lines as chains through the graph** instead of regions. Rejected in M3P4.2, and not needed
  for this shape.

## Open

- Whether the one steep connector should instead take a longer 45° path round the lines.
- How this behaves at 60 stops (the Compact density, W10). Unchanged from part 4.
