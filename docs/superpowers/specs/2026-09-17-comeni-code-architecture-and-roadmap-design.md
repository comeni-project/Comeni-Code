# Comeni Code — architecture and roadmap

**Status: design, not agreed implementation.** Written 2026-09-17. The third design document. It
settles the stack, where content lives, the shape of the repository, and the order in which the
product is built, **at the level of a skeleton**: each milestone gets its own detailed plan in
`docs/superpowers/plans/` before work on it starts. Section numbers like W3 refer to
[`2026-09-16-comeni-code-weaving-and-pages-design.md`](2026-09-16-comeni-code-weaving-and-pages-design.md);
numbers like R4 refer to this one.

---

## R1. Decisions

All decided by the operator on 2026-09-17.

| Question | Decision | Rejected, and why |
|---|---|---|
| Backend framework | **Django, with Django Ninja for the JSON API** | **FastAPI (as Labs)** — Code is mostly a content system and would have to build accounts, roles, permissions, admin, sessions and migrations by hand. **Django + Wagtail** — its revisions, moderation and media library are attractive, but its page tree and admin fight the graph model and the custom Studio screens (W7). **Hono** — a TypeScript backend would leave Python, where problem generators, checkers and figure validation belong, and away from what the team knows from Labs |
| Frontend | **React + Vite + TypeScript + TanStack Query + Tailwind**, as in Labs, with the W10 tokens | — |
| Data and queues | **Postgres**; **Redis**; **Celery** as the background worker, with celery beat for scheduled jobs | **RQ** — schedules need an add-on and rate limits are manual. **Dramatiq** — leaner, but scheduling is separate. **Django 6's Tasks framework** — an interface with no production worker, schedules or retries. **arq (as Labs)** — built for async code; Django is mostly synchronous. Code's jobs need retries (git, models), per-queue rate limits (models) and schedules (daily caps, review, stalled flags) |
| Models | **One LiteLLM gateway** (W9) | — |
| Running it | **Docker Compose** for now | hosting is later |
| Where content lives | **Drafts, reviews and history in Postgres; approved content as files in git**, landed by Studio (§5.4, W7 S10). The app serves learners from an index built from the landed files | **Database only** — loses diff, blame and review for content. **Git only** — every save a commit makes drafts, locking and review awkward |
| Where the content repository lives | **A separate repository**, like comeni-registry for Labs, CC BY 4.0, mounted into Code | **Inside Comeni-Code** — mixes content and code histories and licences |
| Accounts | **django-allauth**: sign in with **ORCID** or **GitHub** (OAuth / OpenID Connect) **or email and password**; a session cookie between the web app and the API; learners can start without an account and sign in to keep their progress; the team must sign in. Institutional sign-in can be added later with the same library | **OAuth only** — no passwords to store, but not everyone has ORCID or GitHub. **A lower-level OAuth library** (Authlib, social-auth) — account linking, email checks and two-factor are ours to build. **An external identity provider** — another service to run before it is needed. allauth is not an alternative to OAuth; it is the library that implements it |
| How content is landed | **Studio opens one pull request per batch** on the content repository, with provenance in its description; the repository's CI validates it and it **merges automatically when green**, behind branch protection. Pull requests from outside Studio need a maintainer's review and are recorded as *reviewed on GitHub* | **A direct commit** — the app's token could rewrite everything and a Studio bug would land unchecked. **A maintainer-merged pull request** — a second human review that duplicates Studio's and invites rubber-stamping (§5.5). **Direct commits plus tagged releases** — a person reviews batches too late to matter |
| The node on disk | **A folder per node**: `node.yaml` (claim, needs groups with reasons, related links, region, provenance), `body.md` in **MyST Markdown** accepting **only our directives and roles**, and YAML data files for figures and problems. The schema package converts the folder to and from the JSON blocks the app uses, with a round-trip test | **Markdoc-style tags** — the parser is JavaScript-only. **One YAML/JSON file** — prose reads and diffs poorly for reviewers. **Plain Markdown** — questions, problems and callouts would need an invented syntax. MyST has Python and JavaScript parsers, and scientific authors may know it from Jupyter Book |
| How the app gets content | **A worker keeps a checkout of the content repository's main branch**, pulls on each merge (webhook, with polling as a fallback) and rebuilds the index, recording the commit each entry came from. **Tagged releases** are cut as citable snapshots. **Tests use a small fixture set inside Comeni-Code** | **A git submodule** (as Labs mounts the registry) — new content would wait for someone to bump the pin and redeploy. **Following releases only** — slower, and landing already has its checks |
| The content repository | **`comeni-project/comeni-content`**, CC BY 4.0, **created at M0** so its CI and branch protection exist before any node lands | `comeni-nodes`, `comeni-library` |
| The v1 demo | **Salmon, end to end** | STAR (more linear); a smaller tool first |
| Sharing code with Labs | **None.** Share philosophy, repository shape and the visual identity; not packages | shared packages would couple two release cycles and make each harder to maintain |

This closes first-spec open question 6 (*where the content lives*).

---

## R2. Shape of the repository

Labs' shape, adapted: the logic that must be right lives in **framework-free packages**, and the
web application is a shell around them.

```
packages/
  code-schema/     node, block and link schema; validation            pure
  code-weaver/     goal → route over "needs" links                    pure
  code-figures/    figure component data schemas and their checks    pure   (later)
  code-problems/   seeded dataset generators and answer checkers      pure   (later)
apps/
  api/             Django project: accounts, content, studio, learn, requests, ai
  web/             React app: learner pages and Studio
tests/fixtures/    a small, fixed node set — tests never read the real content repository
compose.yaml       postgres, redis, api, worker, web; litellm when AI arrives
.design/  docs/
```

**Pure means no Django, no HTTP client, no model library.** A test enforces it from the first
milestone, as Labs' purity guard does: the weaver's promise — same graph, goal and state, same
route (W3.3) — should not depend on the web layer.

**One web app with two areas**, `/…` for learners and `/studio/…` for the team, sharing the node
renderer and the metro maps (W2). Whether it later splits is open (R8).

---

## R3. How content moves

```
 Studio (drafts in Postgres) ──checks──► review ──approve──► land ──► content repo (files)
                                                                         │
 learners ◄── API ◄── index in Postgres ◄──────── rebuilt from files ◄──┘
```

- **A node on disk** is a folder: `node.yaml`, a MyST `body.md` and YAML data files (R1). The
  schema package defines and validates it; the exact fields are decided in the M1 plan.
- **Landing** opens a pull request per batch on `comeni-content`, with provenance (W9); its CI
  validates and it merges automatically when green (R1).
- **A worker follows the content repository**: on each merge it pulls and rebuilds the index.
- **The index** is derived data: rebuildable from the files at any time, never edited.
- **The weaver reads the index**, never a draft, so learners only walk approved links.

---

## R4. Build order

Each milestone ends with something the operator can check against the design. Milestones 0–2 are
the backend-heavy ground; milestone 3 is the first look at screens, early, so the design can be
checked while there is still time to change it.

| # | Milestone | Done when | Checked against |
|---|---|---|---|
| **M0** | **Skeleton** — repository layout, compose (postgres, redis, api, Celery worker and beat, web), health endpoints, CI, the purity guard; **`comeni-content` created** with its licence, CI stub and branch protection | `docker compose up` shows a health page; CI is green; the purity guard fails when a pure package imports Django; the content repository refuses a direct push to main | R2 |
| **M1** | **Content core** — the node schema (blocks, needs groups, goes deeper, related), validation, the content repository with a handful of Salmon-route fixture nodes, the index | a command validates the fixtures and rejects broken ones with a message naming the file and field; the index rebuilds from files | W3.1–3.2, W5.1 |
| **M2** | **Weaver** — goal targets → route as a pure function, then a CLI and an API endpoint | the Salmon route matches the one drawn on the Route board; repeated runs are byte-identical; cycles are refused | W3.3 |
| **M3** | **Thin learner path** — Node page (blocks rendered), Route page (metro map from the weave), Start without AI (search for targets) | the pages beside the L5, L4 and L1 boards | W6, W10 |
| **M4** | **Studio core** — accounts and roles, workbench drafts, checks, review, land | one node goes draft → checked → approved → landed, and appears for learners | W7 S3, S6, S10; R3 |
| **M5** | **AI gateway** — LiteLLM, the declared call sites, usage records, goal suggestions, the assistant over the content API | a drafted block with provenance; usage on the AI pages | W9; S15–S17 |
| **M6** | **Figures and problems** — the first components, the figure composer, problem generators and checkers | the de Bruijn page works end to end, including its problem | W5.3; S4, S5 |
| **M7** | **Requests and weave review** — the request queue, implementing, connecting text, named tracks | a missing node goes from request to landed; a route becomes a named track | W3.4–3.6; S7–S9 |
| **M8** | **The learner loop** — knowledge state, review scheduler, Home, Explore, Your knowledge, placement | a returning learner's Home; review never shows a backlog | W6 |
| **M9** | **The Salmon demo** — the whole route authored and reviewed, ending in Labs | a new learner goes from *learn Salmon* to a pipeline to run | W12 |

**Why this order.** The schema and the weaver carry the product's central claim and need no UI, so
they are built and proved first. Screens come at M3 rather than last because the design was drawn
before the code, and the cheapest time to find that a board is wrong is before Studio is built on
it. AI arrives at M5, after the content path works without it — the no-AI lane (W9) is then
something the product already does, not a fallback added later.

---

## R5. What is checked, all the way through

- **Tests first**, as in Labs: the failing test, then the code.
- **Pure packages are tested on their own**, with determinism tests for the weaver.
- **Screens are compared with their boards** at each milestone that adds one, and the journal
  records the comparison.
- **Each milestone ends with a journal entry** and, where a decision moved, a spec edit.

---

## R6. What stays out of v1

Hosting and deployment beyond Compose; learner accounts beyond what M8 needs; the weekly problem;
solutions threads; S11 Quality (it needs traffic); the Labs *arriving from a decision* page (L11)
until Labs exposes a link to Code.

---

## R7. What this document does not decide

Module and class names, the database schema, API routes, the node file format, and the library
choices inside each milestone. Each belongs to that milestone's plan.

---

## R8. Open questions

Settled on 2026-09-17 and moved into R1: the worker library, landing, accounts, the node format,
and how the content repository is mounted.

1. **Search** — Postgres full-text search first; whether anything more is ever needed.
2. **One web app or two** — learner and Studio together (R2) or split later.
3. **Institutional sign-in** — which federations, and when.
4. **Content releases** — how often a citable snapshot is tagged, and whether it gets a DOI.
