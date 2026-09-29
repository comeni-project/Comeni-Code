# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Comeni Code

**The learning platform of the comeni-project**, beside
[Comeni Labs](https://github.com/comeni-project/Comeni-Labs) and
[comeni-registry](https://github.com/comeni-project/comeni-registry). Labs' own `CLAUDE.md` says
*"Comeni-Code is a separate repo: the learning platform. Do not build it here"*; this is that repo.

**Where the work is: [`docs/notes/now.md`](docs/notes/now.md)**, then any entry in
[`docs/notes/journal/`](docs/notes/journal/) (those are not compacted yet). This file holds what
stays true between tasks; history is in the journal, never here. It is held to 300 lines by
`tests/repo/test_doc_sizes.py`.

**First-time setup** (from the repository root, where every command runs):

```
cp .env.example .env                   # local values for every CODE_* variable
docker compose up -d --wait postgres redis   # Postgres 18 on :5433, Redis 8 on :6380
uv sync --locked --all-packages
uv run python apps/api/manage.py migrate
```

**Two ways to run it.** The whole stack in Compose (migrate, api, worker, beat and web beside
Postgres and Redis): `docker compose up -d --wait`, then open http://127.0.0.1:8090. For
development, keep only `postgres redis` in Compose and run the API, worker, beat and `npm run dev`
natively (below). **`docker compose down -v` deletes the development database;** to stop just the
app services, `docker compose rm -sf migrate api worker beat web`.

**Node 24 for the web app**: `engine-strict` refuses any other, so put Node 24 first on `PATH`
and check with `node --version`, then `cd apps/web && npm ci`. On Fedora, `nodejs24` installs
`node-24`, `npm-24` and `npx-24` beside Node 22; link them as `node`, `npm` and `npx` in
`~/.local/node24/bin` and put that directory first on `PATH`.

**Commands** (CI runs exactly these):

```
uv sync --locked --all-packages     # install the workspace (Python 3.14)
uv run python apps/api/manage.py check                              # Django's checks
uv run python apps/api/manage.py makemigrations --check --dry-run   # models match migrations
uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json   # after any API change, then npm run api-types in apps/web
uv run python apps/api/manage.py collectstatic --noinput            # fills CODE_STATIC_ROOT
uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon   # fill a local index; exit 0/1/2
uv run celery -A code_api worker -l info                            # background worker
uv run celery -A code_api beat -l info                              # scheduler (separate process)
ops/stack-check.sh                  # check a running Compose stack through web (CI runs it)
uv run ruff check .                 # lint
uv run ruff format --check .        # formatting (also Python blocks inside Markdown)
uv run mypy                         # strict types over packages/, apps/api/ and tests/
uv run pytest                       # all tests
uv run code-schema validate ../comeni-code-content   # the node format, as content CI checks it
uv run code-weaver route salmon --root tests/fixtures/salmon   # weave a route; exit 0/1/2
uv run code-weaver find "why my reads don't map" --root tests/fixtures/salmon   # the candidates a goal is picked from
```

**Web commands** (in `apps/web`, on Node 24):

```
npm run lint        # Biome: lint and formatting
npm run typecheck   # TypeScript 7, strict
npm test            # vitest
npm run build       # vite build
npm run dev         # http://127.0.0.1:5173
npm run tokens      # regenerate src/styles/tokens.css after changing .design/tokens.json
npm run api-types   # regenerate src/api/schema.ts from apps/api/openapi.json
```

**`npm run dev` proxies `/api` to `CODE_WEB_API_ORIGIN`** (default `http://127.0.0.1:8000`, where
`runserver` listens). Run the API, worker and beat too, or the health page says what is down.

**Adding a pure package** means declaring its allowlist in `tests/guards/purity.py`. An
undeclared directory under `packages/` fails the guard. The guards are two partial checks
(static imports and a runtime audit hook), and the honest claim is their union.

**Settings come only from `CODE_*` variables**, read by `code_api/config/env.py`, and nothing
else reads the environment. mypy and pytest load the settings too, so they need `.env` (or the
variables). Tests marked `django_db` need Postgres running, and tests that use Redis need Compose's `redis`; the rest don't.

**Read first, in this order:**

1. This file.
2. [`docs/notes/now.md`](docs/notes/now.md), then any entry still in `docs/notes/journal/`.
3. **The tutor spec, `docs/superpowers/specs/2026-09-17-code-as-tutor-design.md`: the current
   statement of the product** (T-sections): Code as the tutor on top of existing material,
   outside resources, skeletons, step backs, evidence, block scores, and what is deferred.
4. The architecture spec,
   `docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md`, which you
   build from: R1 stack, R2 repository shape, R3 content flow, R4 phases M0–M9 with *done when*,
   R5 how a phase is built, R7 what part specs decide, R8 open questions.
5. As needed: the 2026-09-16 spec (W-sections: weaving, pages, AI, identity) and the 2026-09-02
   spec. **The newest spec wins** where they disagree. Finished part specs and plans are in
   `docs/superpowers/specs/archive/` and `docs/superpowers/plans/archive/`; the research is in
   `docs/notes/research/`.
6. [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for commit and pull-request style.

## The claim

> **You learn the thing you are about to run, and every sentence says where it came from.**

Code promises **provenance, not reproducibility**. Prose is written by models and people; do not
describe it as deterministic. The *route* is deterministic; the words are not.

## The model, in one paragraph

**Code is the tutor on top of material that already exists, for self-directed learners at every
level**, from first steps in a science to research. Each node has a content **level**, which
shapes depth, tone and examples, not the product design. Khan Academy serves school-age learners
inside a school system; Code builds the route and does the structuring a teacher would. It does not try to out-write Khan
Academy; it organises the best existing teaching into the right order for one learner's goal.
Nodes are standalone topic pages, reviewed by a person and reused everywhere, and each points
outward to the best existing video or reading. A learner's goal resolves to one to three target
nodes; the route is a pure walk over the nodes' directed *needs* links, so courses build
themselves. The loop is diagnose (placement), sequence (weaver), explain (node and resources),
check (with hints), step back when an answer reveals a gap, review, and self-tests whose
per-node results confirm what the learner knows. AI proposes targets,
links, skeletons from public course outlines, page drafts, figure data and short connecting text,
and a judge model scores every drafted block; AI never chooses the route. Missing nodes and
unknown goals go to a request queue, and only a person moves them on.

## Invariants

These are the design's load-bearing rules. A change that breaks one is a new decision, made in a
spec, not in code.

1. **The route is computed, not generated.** Same graph, goal and learner state → same route.
   A model is involved only in suggesting targets, which the learner confirms.
2. **Only *needs* links build routes.** *Goes deeper* and *related* change what a page offers,
   never a route. *Needs* links may not form a cycle. **v1 has three kinds** — what comes before,
   what lies below, what stands beside (W3.2) — **each with a reason**; anything else is derived
   (*needed by*), a block, or a region. Two optional paths (*helps*, *any-of*) are designed in W3.2
   and wired only when content needs them; neither ever changes a route unless the learner opens it.
3. **A node reads correctly with no route around it.** Only the connecting text varies per route;
   node bodies never do.
4. **Nothing leaves the request queue without a person.** Models may propose and group requests;
   they may not accept, merge or decline them.
5. **AI drafts, people approve.** Model-written text that reaches a learner unreviewed carries a
   *not yet reviewed* label. Nobody approves what they drafted, and a judge model is never from
   the drafter's model family. Automatic deployment of high-scoring blocks is deferred until
   judge–human agreement is measured (tutor spec T8.4).
6. **Content is validated blocks.** No free HTML, script or styling from an author or a model;
   figures are library components filled with data; images carry author and licence or are
   refused; outside resources are `resource` blocks with a recorded licence, embedded only from
   allowed providers.
7. **Models are called only at declared sites** (spec W9, tutor spec T13.1): goal suggestions,
   page drafting, figure data and problems, connecting text, request grouping, assistant chats,
   skeleton drafting, resource suggestion, block evaluation. Adding one is a reviewed change. All
   calls go through one LiteLLM gateway.
8. **Learners never chat in v1.** The only learner-facing model call is goal suggestion, capped,
   with plain search as its fallback. A learner chat later is a reviewed change with its own spec.
9. **Authors see aggregates, never an individual learner.**
10. **No streaks, XP, badges, leaderboards, hearts or backlog counts** (first spec, §9). A number
    may be a measurement, never a prize. Block scores are never shown to learners.
11. **Settled spends no colour.** One meaning per colour across Code and Labs (spec W10).
12. **Learners only ever see metro maps.** Neighbourhood and box drawings are Studio tools.
13. **Code organises; it does not copy.** Others' material is linked, or embedded where its
    licence allows. Nothing is scraped, and no model is fed content whose terms forbid it; Khan
    Academy is used by people, as a reference and as linked resources (tutor spec T5.3).

## Words

Use the vocabulary in §3 of the first spec and W3.2 of the second. In particular: **node**, never
"module" (a module is an nf-core process in Labs); **track** is a reviewed woven route; **goal**,
**needs**, **goes deeper**, **related** (*peers* — what a learner might read **instead of** this
node, at most four; never a loose "see also"); **needed by** (derived, never authored);
**resource** (an outside video or reading attached to a node); **skeleton** (draft node stubs and needs links from a public outline — never a track);
**known** (a learner's state for a node, backed by stored evidence); **score** (a judge model's
rating of a drafted block, Studio only); **step back** (a detour to a prerequisite after a wrong
answer); **self-test** (an exam a learner generates from node exam pools, graded automatically,
with results per node — never a grade or a certificate); **level** (a node's content depth:
*First steps · Foundations · Introductory · Intermediate · Advanced* — it describes the node,
never the learner; stages of education such as "AP" are for authors' writing guides only).

## Decided, do not reopen (architecture spec R1)

- **Backend:** Django + Django Ninja. **Web:** React + Vite + TypeScript + TanStack Query +
  Tailwind, with the hybrid identity tokens from `.design/tokens.json`.
- **Infrastructure:** Postgres, Redis, Celery with celery beat, Docker Compose. One LiteLLM
  gateway, arriving at M5.
- **Pure packages** in `packages/` (`code-schema`, `code-weaver`; later `code-figures`,
  `code-problems`) import no Django, no HTTP client and no model library.
- **Content:** drafts are stored in Postgres. Approved content is stored as files in the
  comeni-project/comeni-code-content repository (sibling checkout `../comeni-code-content`), one folder per
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

- **Every defect gets a GitHub issue first**, mechanical ones too. *Mechanical* (the code is wrong
  against what was agreed): fix test-first, close citing the commit. *Protocol* (a rule or a
  promise needs deciding): options to the operator, the choice commented on the issue and labelled
  `decided`, then built. The loop, the labels and the decision comment are in
  [`docs/internals/walking.md`](docs/internals/walking.md). **Unsure means protocol.**
- **The task tree is issues:** a parent issue per phase, each part a sub-issue. The parts list is
  still argued in a journal entry (R5).
- **Decisions go in specs**, with the alternatives rejected. Edit an older spec only to point at
  the newer decision. Finished part specs and plans move to an `archive` folder beside the live ones.
- **Sessions go in the journal**, append-only. **Compact it** when a part or phase closes, or at
  five pending entries, by [`docs/notes/compaction.md`](docs/notes/compaction.md). Never point at
  an entry by name; point at `now.md` and the journal directory.
- **Guards must be watched failing** against the defect they guard before they are trusted.
- **Screens are generated.** Change `.design/build_pages.mjs`, `.design/_identity.mjs` or
  `.design/tokens.json`, then run `node .design/build_pages.mjs`. Never hand-edit a `.dc.html`.
- **Token values live only in `.design/tokens.json`.** After changing one, also run
  `npm run tokens` in `apps/web`; a test fails until the committed `tokens.css` matches.
- **Screens are compared with the published canvas in a browser**, at the page's real width, in
  light at 1440 as well as dark — never with a board regenerated in the same change. The canvas
  is at https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa.
- **Research is cited** in the spec that uses it.
- **Commits** follow the house style: `docs(spec): …`, `design: …`, `feat`/`fix`/… for code. One
  logical change per commit; the body says why.
- **Branch for work** (`feat/…`, `docs/…`, `ci/…`); never commit to `main`. Merges go through
  pull requests. Commit and push only when asked, or when the approved plan says to.
- **`main` takes only pull requests with green checks, in this repository and the content
  repository, for everyone** (rulesets in `.github/rulesets/main.json`, no bypass). Required checks
  are named in the ruleset: renaming a CI job means changing the ruleset in the same change. Wait
  for checks with their exit code (`gh pr checks --watch > log; rc=$?`), never through a pipe.
- **Attribution:** end commits with a `Co-Authored-By:` line naming the Claude model in use
  (`noreply@anthropic.com`), and pull-request descriptions with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Confirm outward-facing actions first:** GitHub settings (rulesets, merge settings and other
  repository settings), creating repositories, publishing.
- **Do not build Labs features here**, and do not build Code inside Labs. **No code is shared
  between the two repositories** — philosophy, layout and identity only.
- **Pure packages stay pure.** `packages/` imports no Django, HTTP client or model library;
  `tests/guards/` enforces it.

## Environment

Linux. `gh` is authenticated for `comeni-project`; Docker, Node and `uv` are installed. Claude in
Chrome is installed, so look at pages in Chrome with the published canvas open in another tab;
`firefox --headless --screenshot` is the fallback.

## Layout

Target shape (R2): `packages/` (pure), `apps/api/` (Django), `apps/web/` (React),
`tests/fixtures/`, `compose.yaml`. Today the following exists:

```
.design/                  design canvas generator and its output
.env.example              local values for every CODE_* variable
.nvmrc                    Node 24 for the web app
.github/                  contributing, security, templates
.github/workflows/ci.yml  the CI job
apps/api/                 the Django project, code_api (config/, accounts/, content/ — the index, rebuild_index, /api/nodes, /api/routes, /api/search, health/, api.py, celery.py, redis.py), openapi.json, tests
apps/web/                 the React app (Vite, React Router, TypeScript 7, Biome, vitest): start/ (L1), route/ (L4, with the map's pure layout), node/ (L5, the body split at its try markers and drawn by react-markdown), health/, identity/, layout/, api/; its Dockerfile builds the nginx image
compose.yaml              the whole stack: postgres, redis, migrate, api, worker, beat, web
Dockerfile.api            the API image: migrate, api (gunicorn), worker and beat
.dockerignore             keeps .env and host builds out of images
ops/                      nginx config for the web image, and stack-check.sh
docs/index.md             documentation map
docs/design/              how screens are made
docs/internals/           how work is run: walking.md (issues, labels, decisions)
docs/notes/now.md         what is true now; read first
docs/notes/journal/       session records, append-only; archive/ holds compacted ones
docs/notes/research/      studies decisions were built on (the Khan Academy report)
docs/superpowers/specs/   design documents; archive/ holds finished part specs
docs/superpowers/plans/   one plan per part; archive/ holds finished ones
packages/code-schema/     pure: the node format (fields, links, resources, questions, markers), its validation messages, the canonical writer
packages/code-weaver/     pure: Graph, weave, find, and the route and find commands (M2, M3 part 2)
tests/guards/             purity guards, their helpers and planted fixtures
tests/repo/               repository checks: links, doc sizes, doc paths, app dependencies
tests/fixtures/salmon/    26 real nodes and providers.yaml, no background to Salmon; the weaver and the API load them
tests/schema/             code-schema's tests; nodes are built in tmp_path or read from fixtures, never from content
tests/weaver/             code-weaver's tests; `fixture_graph` fills a Graph from the Salmon fixtures
```
