# Comeni Code — architecture and roadmap

**Status: design, not agreed implementation.** Written 2026-09-17. The third design document. It
settles the stack, where content lives, the shape of the repository, and the order in which the
product is built, **at the level of objectives**. There is no plan for the whole product, and
there will not be one: each phase is split into parts as it starts, and each part gets its own
short spec and plan (R5). Section numbers like W3 refer to
[`2026-09-16-comeni-code-weaving-and-pages-design.md`](2026-09-16-comeni-code-weaving-and-pages-design.md);
numbers like R4 refer to this one.

**Revised the same day:** [`2026-09-17-code-as-tutor-design.md`](2026-09-17-code-as-tutor-design.md)
is now the current statement of the product. The stack and phases here stand. The phases below
say where that spec adds work.

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
| The node on disk | **A folder per node**: `node.yaml` (claim, needs, goes-deeper and related links, each with a reason, region, provenance), `body.md` in **MyST Markdown** accepting **only our directives and roles**, and YAML data files for figures and problems. The schema package converts the folder to and from the JSON blocks the app uses, with a round-trip test | **Markdoc-style tags** — the parser is JavaScript-only. **One YAML/JSON file** — prose reads and diffs poorly for reviewers. **Plain Markdown** — questions, problems and callouts would need an invented syntax. MyST has Python and JavaScript parsers, and scientific authors may know it from Jupyter Book |
| How the app gets content | **A worker keeps a checkout of the content repository's main branch**, pulls on each merge (webhook, with polling as a fallback) and rebuilds the index, recording the commit each entry came from. **Tagged releases** are cut as citable snapshots. **Tests use a small fixture set inside Comeni-Code** | **A git submodule** (as Labs mounts the registry) — new content would wait for someone to bump the pin and redeploy. **Following releases only** — slower, and landing already has its checks |
| The content repository | **`comeni-project/comeni-code-content`**, CC BY 4.0, **created at M0** so its CI and branch protection exist before any node lands | `comeni-content` (renamed the same day: the name should say which product it belongs to), `comeni-nodes`, `comeni-library` |
| The v1 demo | **Salmon, end to end** | STAR (more linear); a smaller tool first |
| Sharing code with Labs | **None.** Share philosophy, repository shape and the visual identity; not packages | shared packages would couple two release cycles and make each harder to maintain |

This closes first-spec open question 6 (*where the content lives*).

*Added 2026-09-17 (tutor spec T2): Code complements Khan Academy rather than competing with it.
Nodes point to outside resources, the first nodes are drafted from public outlines, and drafted
blocks are scored by a judge model.*

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
- **Landing** opens a pull request per batch on `comeni-code-content`, with provenance (W9); its CI
  validates and it merges automatically when green (R1).
- **A worker follows the content repository**: on each merge it pulls and rebuilds the index.
- **The index** is derived data: rebuildable from the files at any time, never edited.
- **The weaver reads the index**, never a draft, so learners only walk approved links.

---

## R4. The phases and their objectives

Each phase ends with something the operator can check against the design. Phases 0–2 are the
backend-heavy ground; phase 3 is the first look at screens, early, so the design can be checked
while there is still time to change it. **These are objectives, not plans** — how each is met is
decided part by part (R5).

### M0 — Skeleton
- A repository shaped as R2, with the pure packages, the Django project and the web app in place.
- Compose runs Postgres, Redis, the API, a Celery worker and beat, and the web app.
- CI runs on every pull request, and the purity guard runs in it.
- `comeni-code-content` has its licence, a CI stub and branch protection.
- **Done when** `docker compose up` shows a health page; CI is green; the purity guard fails when
  a pure package imports Django; the content repository refuses a direct push to main.

### M1 — Content core
- A node can be written as files (R1), validated, and read into the app.
- Needs, goes-deeper and related links, each with a reason, are part of the schema.
- A handful of Salmon-route fixture nodes exist, and an index can be rebuilt from files.
- **Done when** the validator accepts the fixtures and rejects a broken node with a message naming
  the file and field; the index rebuilds from files alone. *Against W3.1–3.2, W5.1.*
- *2026-09-17 (tutor spec T4, T6, T7): the schema also holds `resource` blocks, hints,
  rationales and `step_back_to`, and learner answers are stored as evidence. A small skeleton
  seeds the fixtures. Nodes also hold an exam pool (T7.1), so adding it later needs no content
  migration, and a **level** (T10.1), one of five.*

### M2 — Weaver
- Goal targets become a route by a pure function (W3.3), reachable from a CLI and the API.
- Every node on a route says why it is there.
- **Done when** the Salmon route matches the Route board; repeated runs are byte-identical; a cycle
  is refused. *Against W3.3.*
- *2026-09-17 (tutor spec T10.1): a node's **level** never adds or removes a stop. The weaver
  reports the route's **level span** (e.g. First steps → Advanced) as output. **Done when** also
  includes: the same graph with every level changed produces the same route. The Salmon route on
  the board starts at its First steps stop (13 stops).*
- *2026-09-19 (M2 parts list, journal): the reference route is the Salmon fixtures' **17 stops**
  (M1P4.2), not the board's 13 — M1 part 4 took *de Bruijn graphs* off the route. Its level span
  is **First steps → Intermediate**. The Route board is redrawn in M3's design round.*
  **Done 2026-09-20 (M3 part 4):** the L4 board draws those 17 stops in their five real regions,
  at the coordinates the page's layout computes, and every board that quotes this route follows —
  including the node titles the boards had invented before the fixtures existed.*

### M3 — Thin learner path
- A learner can find a target without AI, see its route as a metro map, and read a node.
- **Done when** the Start, Route and Node pages sit convincingly beside the L1, L4 and L5 boards.
  *Against W6, W10.*
- *2026-09-17: the Node page includes its **Learn it** section with at least one embedded and one
  linked resource (tutor spec T4), Read / Watch, the node's **level** tag, and `try` questions with
  hints and a rationale (T6.2). The Route page shows the route's **level span** (T10.1).*
- *2026-09-17 (tutor spec T10.2): First steps is in the MVP. A design round for First steps pages
  comes before M3's screens, and **done when** also includes a First steps node page beside its
  board.*
- *2026-09-20 (M3 parts list, journal): M3 is **six parts** — resources and try questions;
  search; the spine with **L1 Start**; **L4 Route**; **L5 Node**; **L5 First steps**. The pages
  carry **no stored learner state**: `known` comes from the URL as the weaver takes it, and
  progress per line, milestones and *not yet reviewed* wait for M4 and T7. `resource` and `try`
  blocks enter here **read-only** — the authoring UI is M4's workbench. A node's **body stays
  Markdown**; W5.1's block document arrives with that workbench. The Route board is redrawn from
  13 stops to 17 in part 4.*

### M4 — Studio core
- The team signs in with roles; an author drafts a node, checks run, a reviewer approves, and it
  lands on `comeni-code-content` through a pull request.
- **Done when** one node goes draft → checked → approved → landed, and learners see it after the
  worker picks up the merge. *Against W7 S3, S6, S10; R3.*
- *2026-09-17 (tutor spec T4, T6, T7.1, T10.1): the workbench also edits a node's **level**
  (with its writing guide), its **resources** (provider, part, licence, embed or link), hints
  and rationales, and its **exam pool** in the question builder (a question as blocks, with a
  typed answer). All of it works without AI; M5 adds drafting and scores. **Done when** also
  includes: the landed node has a level, at least one resource, and an exam pool of at least 4
  approved questions.*

### M5 — AI gateway
- Models are reachable only through LiteLLM at the declared call sites, and every call is recorded.
- Goal suggestions work for learners with a search fallback; the assistant works for authors
  through the content API.
- **Done when** a drafted block carries its provenance, and the AI pages show real usage.
  *Against W9; S15–S17.*
- *2026-09-17 (tutor spec T8): block evaluation, with a judge from a different model family,
  automatic redrafts below x, and review sorted by score. Also skeleton drafting and resource
  suggestion as declared call sites. **Done when** also includes: a drafted block shows its score
  and reasons, and a low score triggers a bounded redraft.*

### M6 — Figures and problems
- The first figure components, the figure composer, and problems with seeded datasets and checkers.
- **Done when** the de Bruijn page works end to end, including its problem. *Against W5.3; S4, S5.*
- *2026-09-17 (tutor spec T7.1): figures are also used in **exam questions**: in stems, in answer
  options, and as **figure-interaction answers** computed by the component. **Seeded variants**
  are checked across 20 seeds. **Done when** also includes: the de Bruijn exam question with
  figure options passes its 20-seed check.*

### M7 — Requests and weave review
- Missing nodes and unknown goals become requests that a person decides; connecting text is
  reviewed; routes become named tracks.
- **Done when** a missing node goes from request to landed, and a route becomes a named track.
  *Against W3.4–3.6; S7–S9.*
- *2026-09-17 (tutor spec T5): skeletons (S18). An outline becomes scored stubs and *needs*
  links that reach Requests.*

### M8 — The learner loop
- Knowledge state, review scheduling, Home, Explore, Your knowledge and placement.
- **Done when** a returning learner's Home is right, and review never shows a backlog. *Against W6.*
- *2026-09-17 (tutor spec T7.1): self-tests (L13) on the same engine as review. **Done when** also
  includes: an exam over "what I've done so far" is built from exam pools, graded automatically,
  and its per-node results change what the route shows.*
- *2026-09-17 (tutor spec T6.1, T10.1): **step backs** (a wrong answer offers a detour and
  returns to the same question), placement's **"you told us" hint** (asks lower levels first,
  never marks known), and the **level filter** in Explore. **Done when** also includes: a step
  back returns the learner to the question it came from.*

### M9 — The Salmon demo
- The whole Salmon route authored, reviewed and landed, ending in a Labs pipeline.
- **Done when** a new learner goes from *learn Salmon* to a pipeline they can run. *Against W12.*
- *2026-09-17 (tutor spec T10, T10.2): the Salmon route spans **First steps → Advanced**, and a
  learner starts wherever placement leaves them. The route takes them back a step when an answer
  shows a gap, gives the best existing video or reading at each stop, and offers self-tests.
  **Done when** also includes: a learner starting at First steps, without an account, reaches the
  pipeline.*

**Why this order.** The schema and the weaver carry the product's central claim and need no UI, so
they are built and proved first. Screens come at M3 rather than last because the design was drawn
before the code, and the cheapest time to find that a board is wrong is before Studio is built on
it. AI arrives at M5, after the content path works without it — the no-AI lane (W9) is then
something the product already does, not a fallback added later.

---

## R5. How a phase is built

**No mega plans.** A plan for a whole phase goes stale before its second week, and a plan for the
whole product is the kind of document that turns into a second, contradictory account of the
system — the lesson Labs recorded when it removed its old plans on 2026-09-02.

Instead, when a phase starts:

1. **Split it into parts** — each small enough to build, review and check in a few sessions. The
   list of parts goes in the journal, not in a document of its own.
2. **For each part, write a short spec** in `docs/superpowers/specs/`
   (`YYYY-MM-DD-<part>-design.md`): what it does, the decisions it needs, and the alternatives
   rejected. It may be a page.
3. **Then a specific plan** in `docs/superpowers/plans/` (`YYYY-MM-DD-<part>.md`): ordered,
   test-first steps for that part only.
4. **Build it**, tests first.
5. **Check it** against the phase's *done when* and, where it has a screen, against its board.
6. **Write the journal entry**, and edit a spec only where a decision moved.

Then the next part. A phase is finished when its *done when* holds.

**What is checked all the way through.** Tests are written first, as in Labs. The pure packages
are tested on their own, with determinism tests for the weaver. Screens are compared with their
boards whenever a part adds one, and the journal records the comparison.

---

## R6. What stays out of v1

Hosting and deployment beyond Compose; learner accounts beyond what M8 needs; the weekly problem;
solutions threads; S11 Quality's learner measures (they need traffic — *revised 2026-09-17: the
judge–human agreement view is in v1, because recording agreement is, tutor spec T8.3; see R8*); the Labs *arriving from a decision* page (L11)
until Labs exposes a link to Code.

*Added 2026-09-17 (tutor spec T12):*
- *learner chat;*
- *mastery levels and decay;*
- *automatic deployment of high-scoring blocks;*
- *our own screencasts.*

---

## R7. What this document does not decide

Module and class names, the database schema, API routes, the node file's exact fields, and the
library choices inside each phase. Each belongs to the spec of the part that needs it (R5).

---

## R8. Open questions

Settled on 2026-09-17 and moved into R1: the worker library, landing, accounts, the node format,
and how the content repository is mounted.

1. **Search** — Postgres full-text search first; whether anything more is ever needed.
2. **One web app or two** — learner and Studio together (R2) or split later.
3. **Institutional sign-in** — which federations, and when.
4. **Content releases** — how often a citable snapshot is tagged, and whether it gets a DOI.
5. **A sign-in shared with Labs** — OIDC with Code as the provider, or a separate identity
   service. Raised in Labs' journal on 2026-09-17
   (`Comeni-Labs/docs/notes/journal/2026-09-17-labs-in-the-hybrid-identity.md`). It does not
   block M0.
6. **A consent spec for minors' accounts** (tutor spec T10.2): parental consent, and how long
   minors' evidence is kept. It must exist before accounts open to under-13s.
7. **How much of S11 Quality is in v1.** Judge–human agreement is recorded from M5 and shown in v1.
   The tutor measures (T9) need traffic and may wait. Decide when M5 is split into parts.
8. **The tutor spec's open questions** (T14): the thresholds x and N, the embed allow-list, and how
   far down the AP-level start goes.
9. **Review of content pull requests that don't come from Studio** (M0 part 9 spec, P9.2). The
   content README promises a maintainer's review; with one maintainer a required approval blocks
   their own pull requests, and Studio has no GitHub identity yet to exempt. Decide with landing
   (M4).
