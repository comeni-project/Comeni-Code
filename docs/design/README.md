# Design

The screens are specified in W6–W7 of the
[2026-09-16 spec](../superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md), and the
visual identity in its W10. This page says how the drawings are made.

## The canvas is generated

Every board is written by a script, so a change to a token or a shared piece reaches every page at
once and nothing drifts:

| File | Holds |
|---|---|
| [`.design/tokens.json`](../../.design/tokens.json) | the hybrid identity's values: light and dark tokens, fonts, radii. The boards and the web app's Tailwind theme both read it |
| [`.design/_identity.mjs`](../../.design/_identity.mjs) | the hybrid identity drawn: shared pieces, the identity boards for Code and Labs |
| [`.design/build_pages.mjs`](../../.design/build_pages.mjs) | every page, the network and route maps, figure components, and the canvas layout |
| `.design/*.dc.html`, `.design/canvas.json` | generated output — committed, never edited by hand |

```bash
node .design/build_pages.mjs     # rebuilds every board and canvas.json
```

The boards are Design Components, one HTML file per artboard, laid out by `canvas.json` on three
pages: **Learn**, **Studio** and **Identity**. They are published as a design canvas with the Claude
Design preview in Claude Code; published copies are views, and the generator is the source.

## What every screen follows

- **The colour law.** One meaning per colour, in both products: teal-green is your route or
  *valid*, blue is next or selected, amber is measured or stale (or *not yet reviewed*), red is
  needs-you or wrong, and **settled spends no colour**.
- **States are words as well as colours.** Nothing is shown by colour alone.
- **Data is set in Geist Mono**; everything else in Lexend. Text is 11 px or larger — except the
  small mono annotations on the maps (10–10.5 px), which do not yet meet the spec's rule and need
  revisiting.
- **Learners only ever see metro maps.** Box-and-arrow and neighbourhood drawings are Studio
  editing tools.
- **Sample numbers are samples.** Names in brackets are placeholders.

## What is drawn

| Learn | Studio |
|---|---|
| L1 Start · L2 Placement · L3 Home · L4 Route · L5 Node · L5 Node at First steps (design-round draft) · L9 Your knowledge · L12 Explore · L13 Exam (set up, results) · account menu | S2 Graph · S3 Node workbench · S4 Figure composer · S6 Review · S7 Requests · S8 Implementing · S9 Weave review · S11 Quality · S15 Assistant · S16–S17 AI · S18 Skeletons |

**Revised 2026-09-17 for the [tutor spec](../superpowers/specs/2026-09-17-code-as-tutor-design.md):**
- **L5 Node:** a *Learn it* section with Read / Watch and outside resources, hints in checks, and a
  step back in feedback.
- **L4 Route:** a suggested step back and the level the route starts at.
- **S3 Workbench:** a Resources tab and block scores.
- **S17 AI:** the new call sites and the scoring settings.
- **New boards:** L2, S6, S11 and S18; then **L13 Exam** in two boards (set up and in progress; results per page on the map), with **Test yourself** on Route and Home, an **Exam pool** tab in the Workbench, and a pool-question row in Quality (T7.1).
- **Levels (T10.1):** a level tag (no colour, since a level describes the page, not the learner) on
  Node, Route (span, and where it starts for you), Start, Placement (a "you told us" hint), Explore
  (a *Reaches down to* filter and each track's span), Graph (a level-jump warning), Workbench (level
  and writing guide), Skeletons and the question builder. The Salmon route gains its First steps
  stop, so it has 13 stops everywhere.
- **L5 Node at First steps:** a first draft for that level's design round (T10.2). One column,
  19–21 px body text, short numbered sections, big answer buttons, Read / Watch, and the next stop
  with its level. Same identity and rules: no points, streaks or mascots.
- **S3 Exam pool (question builder):** a question is a block document built like a page: a stem with text, figures, images, math, tables or sequences; an answer that is a choice (options holding figures), a number, a sequence, a figure interaction or an order; seeded variants, distractors mapped to misconceptions, and a preview as in a test.

Not yet drawn: L6 Problem (its full block is inside L5), L7 Review, L8 Weekly, L11 From Labs,
S1 Inbox and the smaller settings pages.

**Where the canvas is published.** The current canvas, all 26 boards, is
https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa (a private artifact on the operator's current
account). The earlier canvas, from before the tutor changes, is on the operator's previous
account. Both are views; the generator is the source. When republishing, the canvas type needs a
`<script data-dc-script>` block on every board, and the publishing step adds a minimal one to the
boards the generator writes without it.
