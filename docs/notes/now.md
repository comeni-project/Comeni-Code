# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-11-15** (M5.1 review and acceptance). M5.2 and M5.3 implementation status is in the current journals. Old `CLAUDE.md`: `git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done** (#79). **M4, the Studio core** (#74): M4.1–M4.8 are done (#119–#126), and
  M4.9's screens: verdicts per block (#272), Review (#281), Land (#306). (2026-09-29 to 10-15)
- **The order is now M7 → M8 → operator walkthrough and fixes → M4.9d real landing → M9** (operator, 11-16). DNA is the first content candidate. M7's real request-to-landed acceptance waits for M4.9d; local authoring and approval come first.
- **M6 is done** (#325); seeded variants moved to M8. **M5's parts are approved** (#446–#450). (11-15)
- **M5.1 PR #465 remains open**; live sign-in waived. **M5.2 PR #476 is merged into #465's head branch**, not `main`. **M5.3 PR #477 is open against #465's head branch; all three CI jobs pass. M5.4 PR #478 is open against #477 and all three CI jobs pass. M5.5 PR #479 is open against #478; all three CI jobs pass.** M5 has five parts, with no part after M5.5. The end-of-M5 suites pass: Python 1,973, web 973. (11-16)

## How work is done now

- **Every defect gets an issue first**, `mechanical` or `protocol` (`docs/internals/walking.md`);
  the plan is a sub-issue tree; deferred minors go in one `deferred` issue. (2026-09-29)
- **A phase is split into parts; each is spec → plan → test-first build → journal entry** (R5),
  the operator approving each; a fresh reviewer mid-plan and over the branch. (2026-09-17, 09-29)
- **The agent merges a pull request only after the operator says yes to that one.** (2026-09-29)
- **A quality pass between parts**, when asked: recommend, don't survey; agreed mechanical work is
  built without stopping, issues and tests first. **New screens are drawn as boards** and shown on
  a Design canvas before any spec. (2026-10-05, 10-07)
- **The app before the pages**: content and polish wait for the MVP's end; screens still match their
  boards. **Only what the operator wrote or checked goes to `comeni-code-content`**: nothing
  seeded from fixtures or a model; Salmon is not the first route. (2026-09-29, 10-16)

## The content format (`code-schema`)

- A node is a folder: `node.yaml` (fields, links, resources, try questions), a MyST `body.md`
  and an optional `exam.yaml`; the writer round-trips all three byte for byte. (2026-09-18 to 10-05)
- **The body is blocks** between top-level fences: text, `:::{try} <id>`, callouts, `sequence`,
  `math` (TeX), `example <title>` (Markdown, never run), `image <file>` and `figure <stem>`;
  and one `problem`; a body that would not write back is CS0415. (09-29 to 11-07)
- **Images** (CS09xx): byte-sniffed PNG/JPEG/WebP ≤ 2 MB; `node.yaml` records alt, author, licence
  (CC0, PD, CC BY, CC BY-SA), optional source. File, record and block save together (#360). (10-21)
- **Figures** (CS10xx): `figures/<stem>.yaml` holds component, alt, data, optional source/interact.
  Pure `code-figures`: table, chart (allowlisted Vega-Lite, ≤ 3 series), flow, sequence-track,
  five de Bruijn kits computed from reads (`derived`; an edge is one read's step, #408).
  Ambiguous YAML, duplicate keys, controls/tags: CS1023 (`readings.json`). Files stay as written;
  invalid saves refuse; files follow their last placement (`placements()`). (10-21 to 11-05)
- **Tasks**: `interact: {task: trace|pick}` makes a figure a question's (CS1029); computed answers. (11-06)
- **Problems** (CS11xx): `problem.yaml` names a **kit** of the pure `code-problems` (a Strategy:
  generate, solve, check, its mistakes; splitmix64), params and a sample from a seed (≤ 2,000 B); a
  20-seed self-test at validation; each problem names its `field`. Kits are Python (#425). (11-07 to 11-13)
- **Formulas** (`code_schema.math`): `$…$` in text, callouts, examples and stems, found as
  remark-math finds them (`tests/fixtures/math-cases.json`, run by pytest and vitest); refused when
  unbalanced, linking, colouring or defining macros (CS0419–CS0425). (2026-10-16)
- **Every problem has a declared code** in `code_schema/diagnostics.yml` (bands of 100, never
  renumbered), a test naming it, `code-schema explain` and `docs/reference/diagnostics.md`. (09-29)
- **Three link kinds, each with a reason**: *needs*, *goes deeper*, *related* (both ways, at most
  four); *helps* and *any-of* refused until needed. **A need is what understanding the claim
  requires**, never a tool: *de Bruijn graphs* sits below *Salmon*, not on its route. (09-18, 09-19)
- `code-schema validate` exits 0/1/2; **edits are pure** (`code_schema.edits`). (09-18, 10-05)
- **A text block ends its last line** (#173); two side by side are one (#258). (10-09)
- **Registries are content**: `regions.yaml`, `providers.yaml`; a video names `youtube:<id>`. (09-21)
- **A question composes an answer** (choice, number, sequence, order, figure) in a `TryQuestion`
  (ask, hints, optional `figure:`) or an `ExamQuestion` (title, claim, a stem of blocks). A figure
  answer is a try's figure or a stem's one figure (CS0338, CS0824), right when the k-mers picked are
  one of `accept`, filled at read (`compare=False`). An option is text or a figure. (09-20 to 11-06)
- **An exam pool** (`code_schema.exam`, CS08xx): at most 40, ids apart from try questions; under 4
  is a *warning* (left out of self-tests). **Exam answers are not a secret in v1** (M4E.6). (10-05)
- **Warnings never refuse** (M4E.4); one block codec (`block_json` / `block_from_json`). (10-05)
- `tests/fixtures/salmon/`: 26 real nodes, a 17-stop route to *Salmon*; TPM and de Bruijn hold pools.
  Tests never read the real content repository. (2026-09-19, 2026-10-05)

## The index and the API (`apps/api`)

- **The index is rebuilt all or nothing**, one `IndexBuild` row per attempt (its commit, its source's
  kind); outside it a node is named by id, never a foreign key. (2026-09-19, 2026-10-06)
- `GET /api/nodes/{id}` (neighbours, *needed by*, resources, questions, and the body as `blocks`,
  never `body`), `/api/routes`, `/api/search`, `/api/health`; 404 for a miss, 503 before any build;
  error bodies carry a `code`. (2026-09-19 to 2026-09-29)
- **`code_api/content/reads.py` holds every read, `code_api/content/schemas.py` every schema.**
  Exam pools are their own table; **no endpoint sends them** until the self-test spec. (2026-10-05)
- **Index numbers are text** (jsonb drops exponents); `content.snapshot` reads rows back. Images
  and figures (`NodeFigure`: data, derived, interact) are served; a learner gets only the figures its
  page draws (#411); Studio alone sends a file's text; Review holds a key until answered (#414).
  **Each request loads the whole index**: fine at 26 nodes; later cached per digest. (09-20 to 10-21)
- **The learner's problem** (`code_api/content/problems.py`): `NodeOut.problem` with a `version`; `…/problem/
  dataset` and `…/problem/answer` run the kit, keep nothing, never send the answer (CA0009–12). (11-09)

## Accounts (`code_api.accounts`)

- **django-allauth, headless** (`/_allauth/`, providers a table; GitHub off until set); `/api/me`
  hands out the CSRF cookie (#234). A user: email, a `public_id` UUID, one role, author < reviewer
  < operator (`can_act_as`); the integer key never leaves the database. (2026-10-05, 10-07)
- **Sign-up only through an invite** (hashed, single-use, seven days); `invite_operator` makes the
  first. **`studio(min_role)`** gates Studio: 401 `CA0101` (before CSRF), 403 `CA0102`; learner
  routes take no auth; the last active operator stays one. (2026-10-05)

## Drafts (`code_api.studio`)

- **A draft is a working copy of one node**, opened from the index or new; one live draft (open,
  submitted, approved) per node. **A save is one edit, one `Revision`**, or none: stale is 409
  CA0203; the files must re-read as exactly the edit (CA0208, CA0210). (2026-10-05, 10-06)
- **Verify** runs the graph rules with every live draft that reads in place over the index; a link
  to a draft of a new node is CA0224, a warning. A draft is shown the problems in its folder and
  those gone without it (two graph runs, compared without wording, #340). **The checklist** wants it
  clean, a level, a resource and four exam questions, with each question's checks. (10-05 to 10-16)
- **Review** (`review.py`): submitting needs the checklist and the latest revision and freezes the
  draft (409 CA0211). A reviewer gives a **verdict per key** (`keys.py`: the node, each block, try,
  resource and exam question; `Verdict` rows), approves the draft once every key is approved, or
  **sends it back** with requests per block or a reason; reject is gone. Each transition takes the
  row lock; `DraftEvent`, the append-only log, replays to `Draft.state`. (2026-10-06, 10-14)
- **Approving needs every question answered** (wrong counts, never blocks); nobody approves their own,
  but an operator with a reason (`self_approved`). (10-06)

## Landing (`code_api/studio/landing.py`)

- **An operator lands approved drafts as one commit and one pull request**, opened by the GitHub App
  through the Git Data API with **no checkout anywhere**: the batch is checked in place against the
  index, any worker lands it, beat polls it. Provenance: `@login` or a display name, never an
  email; auto-merge on. Off unless `CODE_GITHUB_APP_*` are set. Images land as blobs, figures as
  their files. (2026-10-06 to 10-21)
- **A draft is in one live landing**; a stale one is dropped (CA0306–CA0308); a failed landing
  holds its drafts until closed, ended in words; a claim token parts recovery and a slow worker. (10-06)
- **A batch carries every draft its links need**, else CA0312, *tick it too*; Ready rows name what
  they `needs`. **The GitHub App is `comeni-code-studio`**, its settings in the local `.env` only;
  the content repository holds `providers.yaml` and the app's login (*studio-app*). (2026-10-16)

## Following `main` (`code_api/studio/follow.py`)

- **One reconciler, `follow(source)`**: if `main`'s head differs from the live build, build from its
  tarball (no checkout); merged landings in the live build mark their drafts **`landed`**. One
  try-lock. Sources: `GitHubSource` and `FolderSource` (`configured_source()`); beat (5 minutes),
  the landing poller and `rebuild_index` (`--root`: a folder) all call it. (2026-10-06)
- **`main` wins**: a stray folder build is put back next round; a refused head falls back to
  `main`'s last good build; the command exits 2 (CA0007) when its source cannot be read. (10-06)
- **`GET /api/studio/index`**: the live build, the latest attempt, `main`'s head, `behind`; `/nodes`
  lists nodes and live drafts for links. (2026-10-16)

## AI (`code_api.ai`, M5.1)

- **One in-process LiteLLM door**, pinned 1.105.1; only this app imports it. Declared sites,
  per-site models/caps/settings, encrypted connection keys, operator Models/Usage page. (11-15)
- `.env` locks the default. Keyless hosted calls refuse; other non-plan calls send `none` so
  LiteLLM cannot borrow a host key. Learner records discard identity; no prompt/reply logs. (11-15)
- **ChatGPT tokens belong to Code**: shared folder, atomic writes, Redis refresh/poll locks;
  the page polls once at a time. Tests pin private library methods and prohibit model calls. (11-15)
- **#461 stays deferred; live sign-in unverified, not a gate.** Stub/Chrome walk and CI passed:
  1,883 Python / 962 web tests. (11-15)

## The weaver and search (`code-weaver`, pure)

- `weave` walks *needs* back from the goals, by region then first-reached, byte-identical; levels
  never change a route; known topics end it. `find` ranks topics with no model. (09-19, 09-20)

## The web app (`apps/web`)

- React Router: `/` Start (L1), `/route` (L4), `/node/:id` (L5, and its First steps form), `/health`,
  `/identity`, the account pages and `/studio/*`. Page state lives in the URL. (2026-09-21, 10-07)
- **Accounts on the web**: a button per provider; `NotYet` answers without an invite; `safeNext`
  keeps return addresses on the site. **Studio has one gate**: `STUDIO_PAGES` lists each page and
  its role: Drafts (S19), Review (S6), Land (S10), Team (S14). (10-07 to 10-15)
- **The workbench (S3)**: each edit is an `edits.ts` command sent by `useDraftEdit` (one GET to open,
  one write per save); editors save when left; a click during a save waits for it (#255); Checks
  asked only while shown; Math and Example editors; the Links tab suggests nodes and drafts. (10-09 to 10-16)
- **Review (S6)**: the queue, the open block as read or changed (a colourless word diff), a verdict
  per key, bulk approval; requests show in the workbench. **Land (S10)**: Ready to land, the
  landings (a moving one asked every 15 s), a failed one's Close, main and the index. (10-14 to 10-16)
- **Problems on the web**: `node/Problem.tsx` (a seed per browser, one answer); the **Problem tab**
  (S5): a form over `problem.yaml` (`yaml/document.ts`), an explicit Save, a tab hold; Review draws
  the problem key. (11-09 to 11-13)
- **Formulas** (`node/Formula.tsx`): KaTeX 0.19.0 strict in a `try`, untrusted commands throwing,
  bounded; unreadable shows as source, marked only in Studio; its CSS in the base layer. (10-16)
- **The exam pool's builder**: the list, `ExamEditor`, `ExamSidePanel` (as `TestQuestion` asks it,
  and its checks); `AnswerEditor` serves both pools; `data-theme="dark"` boxes go dark. (10-13)
- **`sendJson` is the one write** (`sendForm` to upload); `useMe` the one *who am I*; `test-kit.tsx`
  answers fetch by method and path in tests. (2026-10-07, 10-16)
- **The Route map** is a pure metro layout (`shapes.fixture.ts`). **The Node page**: *Learn it*
  resources, the body block by block, *Around this node*; First steps its own (Read · Watch). (09-21, 09-29)
- **Figures on the page** (`apps/web/src/figures/`): one *Figure N* sequence with images; every server
  check and computed value twinned (`kits.ts`, `read.ts`) on `tests/fixtures/figures/cases.json`;
  a failing one shows its alt. The chart: Vega lazily, vega-interpreter, no loader, SVG (#371).
  **`FigureAnswer`** draws a question's figure: each k-mer a button, picks along arrows only, a live
  line, four states, nothing given away while asked. (10-16 to 11-06)
- **The composer (S4)**, `/studio/drafts/:id/figures/:stem` (`?for=` a question): Choose, Data
  (sheets, a form from the schema, Edit as YAML), Interaction for a kit with tasks, Describe; the
  file a `yaml` Document edited by ops, every untouched line kept (#385); Save waits on checks. (11-06)
- **`api/queries.ts` alone makes query keys and hooks**; `url.ts` holds route params; `ErrorNotice`
  is the one error sentence. **No page invents learner state**: absent, not faked. (09-21, 10-05)

## The stack, CI and guardrails

- `docker compose up -d --wait` runs Postgres 18 (:5433), Redis 8 (:6380), migrate, the API, the
  worker, beat and web on 127.0.0.1:8090; `ops/stack-check.sh` checks it. A Content Security
  Policy on the app's pages, not `/api/`; no `form-action` (GitHub sign-in). (2026-09-21, 10-21)
- CI runs `python`, `web` and `stack`; `main` here and in `comeni-code-content` takes only green
  pull requests, with no bypass. There, `review` passes Studio's app and `MAINTAINERS`; anyone
  else needs a maintainer's approval (#102). (2026-09-17, 2026-10-06)
- **Test names stop at 300 characters** (root `conftest.py`); a 1 MB name hung CI (#435). (11-13)

## Decided, and not to reopen

- **#451: same judge model, fresh conversation**; record settings/agreement. M5.3 updates T8.2/invariant 5. (11-13)
- Code organises existing teaching, pointing outward, and never scrapes; skeletons come from open
  outlines. **Khan Academy is linked, never embedded** (#76). (2026-09-17, 2026-09-29)
- **Five content levels** describe nodes, never learners; accounts 13+ until a consent spec; First
  steps is in the MVP. **Self-tests** from exam pools are v1's mastery system, per node. (09-17)
- **M4**: blocks thin; back end first; invite-only email and GitHub sign-in; Studio lands as a
  GitHub App; a sign-in shared with Labs (#101) kept open; #102 decided (above). (2026-09-29)
- One colour per meaning (W10): teal your route, blue selected; regions spend none. (09-20, 09-21)

## Open

- **M7 starts** with request records and human triage; parts are in `docs/notes/journal/2026-11-16-m7-parts.md`. First landing (#324) follows M7, M8 and the operator walkthrough; operator narrows the app to `comeni-code-content`. (11-16)
- **Unplaced**: citations (W5.1's `cite`, S3's Sources; no phase owns them), `step_back_to` before
  M8, the Graph screen (S2). A rate limit on the problem routes before the site is public. (to 11-13)
- **For self-tests** (M4E.7): a cap per node in one exam, unseen questions first; whether grading
  runs in the browser; whether exam rows keep an empty `misconception`. (2026-10-05)
- **Deferred**: #131, #134, #176, #188, #189, #203, #204, #216, #217, #234, #235, PR #139's minors;
  **#260 … #407, #421, #426, #433, #442 at the end of the MVP's first loop**; the composer's Ask
  box waits for M5 (#383). (to 11-13)
- Pruning `IndexBuild` rows; three light chip pairs under 4.5 : 1; R8's open questions. (09-29)

## Known traps

- **Trust a check's exit code**, not a pipe's; use CI's env. Link checks read tracked files only:
  stage new documents first. (09-17 to 10-21)
- **Compose rebuilds nothing by itself**: rebuild the index after a fixture change, `--build` after
  a code change, reload the browser. Migrations 0007 and 0009 need `rebuild_index`. (09-21, 10-09)
- **An app must declare every workspace package it imports**; the image installs only those. **Stop
  a server by its PID**, never `pkill -f` a pattern in your own command line. (2026-09-17, 09-20)
- **`comeni-code-content` holds no nodes yet**; its `code-schema validate` is pinned at `38d09dc`,
  moved only by a pull request there. (2026-09-18, 2026-10-05)
- Restart Postgres/Redis after reboot; concurrent pytest runs collide. Retarget stacked PRs before
  merging. Canvas links are account-bound; M6.8: https://claude.ai/artifact/XBAFuB5b2X7WKG8SdAgx3i. (11-13)
- **Node 24**: `/usr/bin/node` v24.18. Check occupied ports with `ss -ltnp`; CDP uses port 0
  and `DevToolsActivePort` to avoid controlling another browser. (10-16, 10-21)
- **A walk that must not reach GitHub**: `runserver` with an `.env` leaving the app out, Compose's
  worker and beat stopped. Tests turn the app off unless one sets it (#337). (10-16)
- zsh `echo` interprets `\n`: parse saved JSON. Ruff re-wraps calls. `Closes #1, #2` closes only #1.
  CI may need PR reopen; nginx must forward `Host $http_host` for CSRF. (10-05, 10-06)
- GitHub compares ≤ 300 files; Celery acknowledges delivery; importlib mode omits test folders.
  tarfile `data` drops leading `/`; `on_commit` needs `robust=True`. Dark Reader alters colours;
  screenshot headless. Rebuild breaks `vite preview`; React Router moves in a transition. (10-06, 10-07)
- **Browser walks**: CDP + Node 24 `WebSocket`; `force_login` (container `SERVER_NAME="localhost"`).
  Enter is `text: "\r"`; use multi-node drafts (CA0202). Stubbed web tests miss schema errors. (11-13)
- **`useBlocker` needs the data router**: page tests go through `renderAt`. **`userEvent.type`**
  takes `[`, `{` as keys: double them. zsh never splits an unquoted `$var`. (10-22 to 11-06)
- Pin `accounts` in migration tests. Schema codes/messages/lines/order are pinned; no `functools`.
  API source may not name CS codes (ownership guard). (10-05, 10-16)
- Tailwind 4: third-party CSS goes in `layer(base)`. Biome ignores generated API/figure schemas.
  Ninja fixed routes precede `{param}` routes. (10-16, 10-21)
