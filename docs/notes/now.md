# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-11-06** (M4.9a–c, M6.1–M6.6). The old `CLAUDE.md`: `git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done** (#79). **M4, the Studio core** (#74): M4.1–M4.8 are done (#119–#126), and
  M4.9's screens: verdicts per block (#272), Review (#281), Land (#306). (2026-09-29 to 10-15)
- **The order is now M4 → M6 → M5 → the first landing → M7–M9** (R4, revised by the operator): the
  first node lands with every block and AI drafting; M4 stays open until M4.9d (#324). (10-16)
- **M6 (#325) is nine parts, #328–#336**: M6.1–M6.6 are done (linked drafts, math and examples,
  images, figures, the composer, domain figures with answering by the figure: PR #415);
  **M6.7, problems: the ground (#334), is next**. (2026-10-21 to 11-06)

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
  `problem` is refused until M6.7; a body that would not write back is CS0415. (09-29 to 10-21)
- **Images** (CS09xx): files in the folder's images (PNG, JPEG, WebP, ≤ 2 MB, read by their bytes), each
  recorded in `node.yaml` with alt, author, licence (CC0, PD, CC BY, CC BY-SA) and an optional
  source (#360). Adding or removing one is one save of file, record and block. (2026-10-16, 10-21)
- **Figures** (CS10xx): `figures/<stem>.yaml` (component, alt, data, optional source and
  `interact`), checked by the pure `code-figures`: `table`, `chart` (allowlisted Vega-Lite, ≤ 3
  series), `flow`, `sequence-track`, and five de Bruijn kits whose values are **computed** from the
  reads (`derived`; an edge is a step a read takes, #408). **One reading**: a form PyYAML and YAML
  1.2 read apart, a key twice, a raw control character or a tag is CS1023 (`readings.json`). Kept
  as written; refused at save; a figure goes with its last placement (`placements()`). (10-21 to 11-05)
- **Tasks** (M6FA): `interact: {task: trace|pick, …}` makes a figure a question's only (CS1029); its
  kit computes `answer: {accept, wrong}`. `graph-artifacts` has `marks: hidden`. (2026-11-06)
- **Formulas** (`code_schema.math`): `$…$` in text, callouts, examples and stems, found as
  remark-math finds them (`tests/fixtures/math-cases.json`, run by pytest and vitest); refused when
  unbalanced, linking, colouring or defining macros (CS0419–CS0425). (2026-10-16)
- **Every problem has a declared code** in `code_schema/diagnostics.yml` (bands of 100, never
  renumbered), a test naming it, `code-schema explain` and `docs/reference/diagnostics.md`. (09-29)
- **Three link kinds, each with a reason**: *needs*, *goes deeper*, *related* (both ways, at most
  four); *helps* and *any-of* refused until needed. **A need is what understanding the claim
  requires**, never a tool: *de Bruijn graphs* sits below *Salmon*, not on its route. (09-18, 09-19)
- `code-schema validate <root>` exits 0/1/2, `--format github` annotates. **Edits are pure**
  (`code_schema.edits`, `Node` in, `Node` out). (2026-09-18, 2026-10-05)
- **A text block ends its last line** (#173); side by side they are one, a blank line between (#258).
  A try option has no `misconception` (#257). (10-09)
- **Registries are content**: `regions.yaml`, `providers.yaml` (licences, embeds, `players`); a
  video resource names its video (`video: youtube:<id>`). The master's-class seeds come later. (09-18 to 09-21)
- **A question composes an answer** (choice, number, sequence, order, figure) in a `TryQuestion`
  (ask, hints, optional `figure:`) or an `ExamQuestion` (title, claim, a stem of blocks). A figure
  answer is a try's figure or a stem's one figure (CS0338, CS0824), right when the k-mers picked are
  one of `accept`, filled at read (`compare=False`). An option is text or a figure. (09-20 to 11-06)
- **An exam pool** (`code_schema.exam`, CS08xx): at most 40, ids apart from try questions; under 4
  is a *warning* (left out of self-tests). **Exam answers are not a secret in v1** (M4E.6). (10-05)
- **Warnings never refuse** (M4E.4): only `Content.errors` refuse. One block codec
  (`block_json` / `block_from_json`). (2026-10-05)
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

## Decided, and not to reopen

- Code organises existing teaching, pointing outward, and never scrapes; skeletons come from open
  outlines. **Khan Academy is linked, never embedded** (#76). (2026-09-17, 2026-09-29)
- **Five content levels** describe nodes, never learners; accounts 13+ until a consent spec; First
  steps is in the MVP. **Self-tests** from exam pools are v1's mastery system, per node. (09-17)
- **M4**: blocks thin; back end first; invite-only email and GitHub sign-in; Studio lands as a
  GitHub App; a sign-in shared with Labs (#101) kept open; #102 decided (above). (2026-09-29)
- One colour per meaning (W10): teal your route, blue selected; regions spend none. (09-20, 09-21)

## Open

- **The first landing** (#324) comes after M6 and M5. The GitHub App is installed on every
  repository of the organisation: the operator narrows it to `comeni-code-content`. (2026-10-16)
- **Unplaced**: citations (W5.1's `cite`, S3's Sources; no phase owns them), `step_back_to` before
  M8, the Graph screen (S2), a learner's own problem dataset before accounts (M6.8). (2026-10-16)
- **For self-tests** (M4E.7): a cap per node in one exam, unseen questions first; whether grading
  runs in the browser; whether exam rows keep an empty `misconception`. (2026-10-05)
- **Deferred**: #131, #134, #176, #188, #189, #203, #204, #216, #217, #234, #235, PR #139's minors;
  **#260, #265, #269, #279, #299, #322, #339, #347, #351, #370, #394, #407 at the end of the MVP's
  first loop**; the composer's Ask box waits for M5 (#383). (to 11-06)
- **The fixtures' Khan videos** are linked (#89). Pruning `IndexBuild` rows; three light chip pairs
  under 4.5 : 1, kept; R8: search, institutional sign-in, the consent spec. (09-17 to 09-29)

## Known traps

- **Never pipe a check into `tail` or `grep`** and trust the chain: the exit status is the pipe's.
  Run the suite with CI's `env:` before pushing; `ruff format --check` on docs too. **The link
  check reads tracked files only**: `git add` a new document first. (09-17 to 10-21)
- **Compose rebuilds nothing by itself**: rebuild the index after a fixture change, `--build` after
  a code change, reload the browser. Migrations 0007 and 0009 need `rebuild_index`. (09-21, 10-09)
- **An app must declare every workspace package it imports**; the image installs only those. **Stop
  a server by its PID**, never `pkill -f` a pattern in your own command line. (2026-09-17, 09-20)
- **`comeni-code-content` holds no nodes yet**; its `code-schema validate` is pinned at `38d09dc`,
  moved only by a pull request there. (2026-09-18, 2026-10-05)
- **After a reboot**, or when tests cannot connect (:5433, :6380): `docker compose up -d --wait
  postgres redis`. Two pytest runs on one Postgres break each other. Merged branches are kept:
  retarget a stacked pull request first. The canvas is the Design artifact in CLAUDE.md; M6's
  boards: https://claude.ai/artifact/JL1PkAjBQKv6o493XDgCoR, on the operator's other account (a
  session elsewhere sees "not found"); M6.6b's: https://claude.ai/artifact/GPnS518CbkYA3ox29G6Ree. (to 11-06)
- **Node 24 is `/usr/bin/node`** (v24.18). **Ports 8000, 5173 and others are other sessions'**:
  check with `ss -ltnp` before trusting one; a remote-debugging Chrome must take port 0 and read
  `DevToolsActivePort`, or it drives another session's browser. (2026-10-16, 10-21)
- **A walk that must not reach GitHub**: `runserver` with an `.env` leaving the app out, Compose's
  worker and beat stopped. Tests turn the app off unless one sets it (#337). (10-16)
- **zsh's `echo` turns `\n` in JSON into newlines**: parse a saved file. **ruff re-wraps calls**.
  **`Closes #1, #2` closes only #1**. CI may not start on open: close and reopen. **nginx must pass
  `Host $http_host`**, or Django's CSRF check refuses every write. (2026-10-05, 10-06)
- **GitHub's compare lists at most 300 files**. **Celery acknowledges on delivery**. **importlib mode
  keeps a test's folder off the path**. tarfile's `data` filter strips a leading `/`. `on_commit`
  needs `robust=True` for a nudge. **Dark Reader whitens the Chrome**: compare colours headless.
  **`vite preview` serves 404 after a rebuild**. React Router moves inside a transition. (10-06, 10-07)
- **Stubbed web tests never meet code-schema's rules**: walk in headless Chrome over the DevTools
  protocol (Node 24's `WebSocket`), a fresh profile per user, a session from `force_login`; CDP's
  Enter needs `text: "\r"`; accept `beforeunload`. Walk drafts hold several nodes (409 CA0202):
  walk on another. The fixture copy in `api` is root's; `python apps/api/manage.py`. (10-09 to 11-06)
- **`useBlocker` needs the data router**: page tests go through `renderAt`. **`userEvent.type`**
  takes `[`, `{` as keys: double them. zsh never splits an unquoted `$var`. (10-22 to 11-06)
- **A migration test pinning one app** gets the others' models at any state: pin `accounts` too.
  **`code_schema`'s messages, codes, lines and order are pinned by tests**; no `functools`; the
  API's source may not name a `CS` code (ownership guard). (10-05, 10-16)
- **Tailwind 4's utilities sit in a layer**: an unlayered third-party sheet beats them; import it
  `layer(base)`. Biome leaves the generated `schema.ts` and `figures/schemas.ts` alone. **Ninja
  matches routes in order**: a fixed path goes before a `{param}` one. (2026-10-16, 10-21)
