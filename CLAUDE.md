# Comeni Code

**The learning platform of the comeni-project**, beside
[Comeni Labs](https://github.com/comeni-project/Comeni-Labs) and
[comeni-registry](https://github.com/comeni-project/comeni-registry). Labs' own `CLAUDE.md` says
*"Comeni-Code is a separate repo: the learning platform. Do not build it here"*; this is that repo.

**Status: design, nothing built.** No application code yet. Before doing anything, read the
newest entry in [`docs/notes/journal/`](docs/notes/journal/), then the specs in
[`docs/superpowers/specs/`](docs/superpowers/specs/) — the newest wins where they disagree. The
stack and the phases (M0–M9, with objectives) are in the 2026-09-17 architecture spec.

## The claim

> **You learn the thing you are about to run, and every sentence says where it came from.**

Code promises **provenance, not reproducibility**. Prose is written by models and people; do not
describe it as deterministic. The *route* is deterministic; the words are not.

## The model, in one paragraph

Nodes are standalone topic pages, reviewed by a person and reused everywhere. A learner's goal
resolves to one to three target nodes; the route is a pure walk over the nodes' directed *needs*
links. AI proposes targets, links, page drafts, figure data and short connecting text — it never
chooses the route. Missing nodes and unknown goals go to a request queue, and only a person moves
them on.

## Invariants

These are the design's load-bearing rules. A change that breaks one is a new decision, made in a
spec, not in code.

1. **The route is computed, not generated.** Same graph, goal and learner state → same route.
   A model is involved only in suggesting targets, which the learner confirms.
2. **Only *needs* links build routes.** *Goes deeper* and *related* change what a page offers,
   never a route. *Needs* links may not form a cycle.
3. **A node reads correctly with no route around it.** Only the connecting text varies per route;
   node bodies never do.
4. **Nothing leaves the request queue without a person.** Models may propose and group requests;
   they may not accept, merge or decline them.
5. **AI drafts, people approve.** Model-written text that reaches a learner unreviewed carries a
   *not yet reviewed* label. Nobody approves what they drafted.
6. **Content is validated blocks.** No free HTML, script or styling from an author or a model;
   figures are library components filled with data; images carry author and licence or are
   refused.
7. **Models are called only at declared sites** (spec W9): goal suggestions, page drafting, figure
   data and problems, connecting text, request grouping, assistant chats. Adding one is a reviewed
   change. All calls go through one LiteLLM gateway.
8. **Learners never chat.** The only learner-facing model call is goal suggestion, capped, with
   plain search as its fallback.
9. **Authors see aggregates, never an individual learner.**
10. **No streaks, XP, badges, leaderboards, hearts or backlog counts** (first spec, §9). A number
    may be a measurement, never a prize.
11. **Settled spends no colour.** One meaning per colour across Code and Labs (spec W10).
12. **Learners only ever see metro maps.** Neighbourhood and box drawings are Studio tools.

## Words

Use the vocabulary in §3 of the first spec and W3.2 of the second. In particular: **node**, never
"module" (a module is an nf-core process in Labs); **track** is a reviewed woven route; **goal**,
**needs**, **goes deeper**, **related**.

## Working here

- **Decisions go in specs**, with the alternatives rejected. Edit an older spec only to point at
  the newer decision.
- **Sessions go in the journal**, append-only; update the box at the top of its README.
- **Screens are generated.** Change `.design/build_pages.mjs` or `.design/_identity.mjs`, then run
  `node .design/build_pages.mjs`. Never hand-edit a `.dc.html`.
- **No mega plans.** When a phase starts, split it into parts; each part gets a short spec, then a
  specific plan, then test-first code, then a journal entry (architecture spec R5).
- **Research is cited** in the spec that uses it.
- **Commits** follow the house style: `docs(spec): …`, `design: …`, then `feat`/`fix`/… once there
  is code. One logical change per commit; the body says why.
- **Branch for work**; do not commit to `main` directly.
- **Do not build Labs features here**, and do not build Code inside Labs. **No code is shared
  between the two repositories** — philosophy, layout and identity only.
- **Pure packages stay pure.** `packages/` imports no Django, HTTP client or model library; a
  test will enforce it from M0.

## Layout

```
.design/                  design canvas generator and its output
.github/                  contributing, security, templates
docs/index.md             documentation map
docs/design/              how screens are made
docs/notes/journal/       session records, append-only
docs/superpowers/specs/   design documents
```
