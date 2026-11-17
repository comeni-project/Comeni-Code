# Specs

The design documents. Each one records what was decided, when, by which role, **and what was
rejected and why** — the part that is expensive to reconstruct later. They are this project's
decision records.

| Spec | Status | Settles |
|---|---|---|
| [2026-09-02 — Comeni Code design](2026-09-02-comeni-code-design.md) | design; partly superseded | what Code is, why its predecessors died, the node as typed holes, the review risk, why the game layer is refused |
| [2026-09-16 — weaving, pages and identity](2026-09-16-comeni-code-weaving-and-pages-design.md) | design | woven routes, every page, content blocks and the content API, where the AI runs, the visual identity, order of work |
| [2026-09-17 — architecture and roadmap](2026-09-17-comeni-code-architecture-and-roadmap-design.md) | design | the stack (Django + Ninja, React, Postgres, Redis, LiteLLM, Compose), where content lives, the repository shape, phases M0–M9 and their objectives, and how each is built part by part |
| [2026-09-17 — the tutor on top of what exists](2026-09-17-code-as-tutor-design.md) | **current statement of the product** | Code complements Khan Academy: outside resources and video, skeletons from public outlines, step backs and hints, learner state as evidence, **self-tests from node exam pools** (T7.1), AI block scores (automatic deployment deferred), **five content levels** (First steps → Advanced) and rules for young learners; what is deferred past v1 |
| [2026-11-16 — M5.3 block scores](2026-11-16-m5-block-scores-design.md) | part design | fresh-call judge, versioned rubrics, bounded redrafts, private score history, Review ordering and reviewer agreement |
| [2026-11-16 — M5.4 goal suggestions](2026-11-16-m5-goal-suggestions-design.md) | part design | learner goal suggestions constrained to indexed candidates and reviewed peers, with plain-search fallback |
| [2026-11-16 — M5.5 author assistant](2026-11-16-m5-author-assistant-design.md) | part design | private draft chat that creates bounded M5.2 proposals for author review |
| [2026-11-16 — M7.1 request foundation](2026-11-16-m7-request-foundation-design.md) | part design | persistent intake, explicit human decisions, version checks and per-person audit |
| [2026-11-16 — M7.2 Requests](2026-11-16-m7-requests-design.md) | part design | bounded learner intake, private receipts and staff triage |
| [2026-11-16 — M7.3 Implementing](2026-11-16-m7-implementing-design.md) | part design | assignment, draft handoff and stages derived from the existing workflow |
| [2026-11-16 — M7.4 connecting text](2026-11-16-m7-connecting-text-design.md) | part design | optional route prose bound to exact claims and route order |
| [2026-11-16 — M7.5 weave review and tracks](2026-11-16-m7-tracks-design.md) | part design | versioned human text review, publication gate and canonical-goal catalogue |

**Finished specs** (the parts of M0–M3 and of M4, one per part, and the docs compaction of
2026-09-29) are in [`archive/`](archive/). Each records what it decided and rejected;
`docs/notes/now.md` holds what is still true of them.

## Rules

- **The newer spec wins where two disagree**, and the older one is edited only to point at the
  newer decision. The reasoning stays where it was made.
- **A spec is not a plan.** Plans — ordered, test-first steps — live in `docs/superpowers/plans/`,
  **one per part, never one per phase or product** (architecture spec R5). A part's spec comes
  first and may be a page.
- **Name the file** `YYYY-MM-DD-<topic>-design.md`, dated the day the design was agreed.
- **Cite research** in the spec's sources, and say which decision it supports.
