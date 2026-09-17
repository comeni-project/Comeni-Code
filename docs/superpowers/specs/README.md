# Specs

The design documents. Each one records what was decided, when, by which role, **and what was
rejected and why** — the part that is expensive to reconstruct later. They are this project's
decision records.

| Spec | Status | Settles |
|---|---|---|
| [2026-09-02 — Comeni Code design](2026-09-02-comeni-code-design.md) | design; partly superseded | what Code is, why its predecessors died, the node as typed holes, the review risk, why the game layer is refused |
| [2026-09-16 — weaving, pages and identity](2026-09-16-comeni-code-weaving-and-pages-design.md) | design | woven routes, every page, content blocks and the content API, where the AI runs, the visual identity, order of work |

## Rules

- **The newer spec wins where two disagree**, and the older one is edited only to point at the
  newer decision. The reasoning stays where it was made.
- **A spec is not a plan.** Plans — the ordered, test-first steps to build something — will live
  in `docs/superpowers/plans/` when the first one is written.
- **Name the file** `YYYY-MM-DD-<topic>-design.md`, dated the day the design was agreed.
- **Cite research** in the spec's sources, and say which decision it supports.
