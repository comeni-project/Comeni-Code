# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Comeni Code

**The learning platform of the comeni-project**, beside
[Comeni Labs](https://github.com/comeni-project/Comeni-Labs) and
[comeni-registry](https://github.com/comeni-project/comeni-registry). Labs' own `CLAUDE.md` says
*"Comeni-Code is a separate repo: the learning platform. Do not build it here"*; this is that repo.

**Status: design finished; building starts at phase M0 (Skeleton).** No application code yet, so
there are no build, lint or test commands yet. Add them here when the first M0 part lands.

**Read first, in this order:**

1. This file.
2. [`docs/notes/journal/`](docs/notes/journal/): its README (the rules and the box naming the
   entry to read), then the newest entry.
3. The architecture spec, `docs/superpowers/specs/2026-09-17-…-architecture-and-roadmap-design.md`,
   which you work from: R1 stack, R2 repository shape, R3 content flow, R4 phases M0–M9 with
   *done when*, R5 how a phase is built, R7 what part specs decide, R8 open questions.
4. As needed: the 2026-09-16 spec (W-sections: weaving, pages, AI, identity) and the 2026-09-02
   spec. **The newest spec wins** where they disagree.
5. [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for commit and pull-request style.

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

## Decided, do not reopen (architecture spec R1)

- **Backend:** Django + Django Ninja. **Web:** React + Vite + TypeScript + TanStack Query +
  Tailwind, with the hybrid identity tokens from `.design/_identity.mjs`.
- **Infrastructure:** Postgres, Redis, Celery with celery beat, Docker Compose. One LiteLLM
  gateway, arriving at M5.
- **Pure packages** in `packages/` (`code-schema`, `code-weaver`; later `code-figures`,
  `code-problems`) import no Django, no HTTP client and no model library.
- **Content:** drafts are stored in Postgres. Approved content is stored as files in
  `comeni-project/comeni-code-content` (sibling checkout `../comeni-code-content`), one folder per
  node: `node.yaml`, a MyST `body.md` and YAML data files. Content lands through a pull request
  that auto-merges when its CI is green. A worker follows that repo's `main` and rebuilds the
  index. **Tests use `tests/fixtures/` and never read the real content repo.**
- **Accounts:** django-allauth (ORCID, GitHub, email/password), with a session cookie.
- **Labs** (`../Comeni-Labs`) is a reference for its purity guard (`tests/guards/`), CI and repo
  shape. **Read it; never import from it.**
- **v1 demo:** "learn Salmon", end to end (M9).

## Building a phase (architecture spec R5, required)

1. **No mega plans.** Never write a plan for a whole phase or for the product.
2. **Split the phase into parts**, each one buildable and reviewable in a few sessions. The
   parts list goes in a new journal entry, not in a document of its own.
3. **Each part gets a short spec** in `docs/superpowers/specs/YYYY-MM-DD-<part>-design.md`: what
   the part does, the decisions it needs (R7: module names, and tooling inside the stack such as
   the workspace tool, test runner and lint), and the alternatives rejected.
4. **Stop for the operator's approval** of the parts list and the part spec before planning.
5. **Then a specific plan** in `docs/superpowers/plans/YYYY-MM-DD-<part>.md`, with ordered,
   test-first steps. **Build it test-first**, check it against the phase's *done when* (and its
   board, if it has a screen), then write a journal entry. Then start the next part.

Use the superpowers skills: brainstorming for a part spec, writing-plans for its plan, and
test-driven-development and executing-plans for the build. Drive the work yourself; use
subagents only for review or for a second opinion on a design.

**Estimates:** if one is wrong by more than about double, stop and say so, with options. Do not
push through.

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
- **Branch for work** (`feat/…`, `docs/…`, `ci/…`); never commit to `main`. Merges go through
  pull requests. Commit and push only when asked, or when the approved plan says to.
- **Attribution:** end commits with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`,
  and pull-request descriptions with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Confirm outward-facing actions first:** GitHub settings (such as branch protection),
  creating repositories, publishing.
- **The design canvas** is at https://claude.ai/artifact/RxgqwSDJ2N3UTSg4HUotxJ. From M3, each
  screen is compared with its board.
- **Do not build Labs features here**, and do not build Code inside Labs. **No code is shared
  between the two repositories** — philosophy, layout and identity only.
- **Pure packages stay pure.** `packages/` imports no Django, HTTP client or model library; a
  test will enforce it from M0.

## Pending questions

- **A sign-in shared with Labs:** OIDC with Code as the provider, or a separate identity service.
  Labs recorded this on 2026-09-17
  (`../Comeni-Labs/docs/notes/journal/2026-09-17-labs-in-the-hybrid-identity.md`). It does not
  block M0. Add it to R8 of the architecture spec the next time that spec is edited.

## Environment

Fedora Linux. `gh` is authenticated for `comeni-project`. Docker, Node and `uv` are installed.
There is no Chrome, so to look at a page use `firefox --headless --screenshot`. If the system
Python lacks PyYAML, use `/home/gibli/Documents/GitHub/Comeni-Labs/.venv/bin/python`.

## Layout

Target shape (R2): `packages/` (pure), `apps/api/` (Django), `apps/web/` (React),
`tests/fixtures/`, `compose.yaml`. Today only the following exists:

```
.design/                  design canvas generator and its output
.github/                  contributing, security, templates
docs/index.md             documentation map
docs/design/              how screens are made
docs/notes/journal/       session records, append-only
docs/superpowers/specs/   design documents
```
