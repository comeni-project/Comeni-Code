# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-10-16** (M4.9a–c, M6.1, M6.2). The old `CLAUDE.md`: `git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done** (#79). **M4, the Studio core** (#74): M4.1–M4.8 are done (#119–#126), and
  M4.9's screens: verdicts per block (#272), Review (#281), Land (#306). (2026-09-29 to 10-15)
- **The order is now M4 → M6 → M5 → the first landing → M7–M9** (R4, revised by the operator): the
  first node lands with every block and AI drafting; M4 stays open until M4.9d (#324). (10-16)
- **M6 (#325) is nine parts, #328–#336**: M6.1 linked drafts and M6.2 math and examples are done;
  **M6.3 images (#330) is next**. (2026-10-16)
- **The master's-class seeds** are the first large graphs, when the operator sends them. (2026-09-19)

## How work is done now

- **Every defect gets an issue first**, `mechanical` or `protocol` (`docs/internals/walking.md`);
  the plan is a sub-issue tree; deferred minors go in one `deferred` issue. (2026-09-29)
- **A phase is split into parts; each is spec → plan → test-first build → journal entry** (R5),
  the operator approving each; a fresh reviewer mid-plan and over the branch. (2026-09-17, 09-29)
- **The agent merges a pull request only after the operator says yes to that one.** (2026-09-29)
- **A quality pass between parts**, when asked: recommend, don't survey; agreed mechanical work is
  built without stopping, issues and tests first. **New screens are drawn as boards** and shown on
  a Design canvas before any spec. (2026-10-05, 10-07)
- **The app before the pages**: content and polish wait for the end of the MVP; screens still match
  their boards as closely as possible. (2026-09-29)
- **Only what the operator wrote or checked goes to `comeni-code-content`**: nothing is seeded from
  fixtures or a model, and Salmon is not the first route. (2026-10-16)

## The content format (`code-schema`)

- A node is a folder: `node.yaml` (fields, links, resources, try questions), a MyST `body.md`
  and an optional `exam.yaml`; the writer round-trips all three byte for byte. (2026-09-18 to 10-05)
- **The body is blocks** between top-level fences: text, `:::{try} <id>`, callouts, `sequence`,
  `math` (TeX) and `example <title>` (Markdown, never run); `figure`, `image` and `problem` are
  refused until their M6 parts; a body that would not write back is CS0415. (2026-09-29, 10-16)
- **Formulas** (`code_schema.math`): `$…$` in text, callouts, examples and stems, found by
  remark-math's rule and block structure (`tests/fixtures/math-cases.json`, generated from
  remark-math, is checked by pytest and vitest); refused when unbalanced, linking, colouring or
  defining macros (CS0419–CS0425). (2026-10-16)
- **Every problem has a declared code** in `code_schema/diagnostics.yml` (bands of 100, never
  renumbered), a test naming it, `code-schema explain` and `docs/reference/diagnostics.md`. (09-29)
- **Three link kinds, each with a reason**: *needs*, *goes deeper*, *related* (on both nodes, at
  most four). *helps* and *any-of* are refused until content needs them. (2026-09-18, 2026-09-19)
- **A need is what understanding the claim requires**, never a tool or an implementation detail:
  *de Bruijn graphs* sits below *Salmon*, not on its route. (2026-09-18, 2026-09-19)
- `code-schema validate <root>` exits 0/1/2 (1 only for errors), `--format github` annotates.
  **Edits are pure** (`code_schema.edits`, `Node` in, `Node` out). (2026-09-18, 2026-10-05)
- **A text block ends its last line** (#173); text blocks side by side are one block, joined with
  a blank line so they stay paragraphs (#258). A try option has no `misconception` (#257). (10-09)
- **Registries are content**: `regions.yaml` (six regions) and `providers.yaml` (licences, embeds,
  `players`); a video resource names its video (`video: youtube:<id>`). (2026-09-18, 2026-09-21)
- **A question composes an answer** (choice, number, sequence, order) in a `TryQuestion` (ask,
  hints) or an `ExamQuestion` (title, claim, a stem of text, sequence and math blocks). (09-20 to 10-16)
- **An exam pool** (`code_schema.exam`, CS08xx): at most 40, ids apart from try questions; under 4
  is a *warning* (left out of self-tests). **Exam answers are not a secret in v1** (M4E.6). (10-05)
- **Warnings never refuse** (M4E.4): `Content.errors` is what `validate`, the weaver and
  `rebuild_index` refuse on. `block_json` / `block_from_json` are the one block codec. (2026-10-05)
- `tests/fixtures/salmon/`: 26 real nodes, a 17-stop route to *Salmon*; TPM has the one exam pool.
  Tests never read the real content repository. (2026-09-19, 2026-10-05)

## The index and the API (`apps/api`)

- **The index is rebuilt all or nothing**, one `IndexBuild` row per attempt, each with its commit
  and its source's kind (`github` or `folder`). (2026-09-19, 2026-10-06)
- Everything outside the index names a node by id, never a foreign key. (2026-09-19)
- `GET /api/nodes/{id}` (neighbours, *needed by*, resources, questions, and the body as `blocks`,
  never `body`), `/api/routes`, `/api/search`, `/api/health`; 404 for a miss, 503 before any build;
  error bodies carry a `code`. (2026-09-19 to 2026-09-29)
- **`code_api/content/reads.py` holds every read; `code_api/content/schemas.py` every schema.**
  Exam pools are their own table; **no endpoint sends them** until the self-test spec. (2026-10-05)
- **Index numbers are text** (jsonb drops exponents); `content.snapshot` reads rows back. (10-05)
- **Each request loads the whole index**: fine at 26 nodes; later cached per digest. (2026-09-20)

## Accounts (`code_api.accounts`)

- **django-allauth, headless**, under `/_allauth/`; sign-in providers are a table
  (`apps/api/src/code_api/config/providers.py`); GitHub sign-in is off until its client is set. (10-07)
- **`/api/me` hands out the CSRF cookie**, asked first, so a first write has a token (#234). (10-07)
- **A user is keyed by email and a `public_id` UUID** (#101's key; the integer key never leaves
  the database), with one role, author < reviewer < operator, checked by `can_act_as`. (2026-10-05)
- **Sign-up only through an invite** (hashed token, single-use, seven days), by password or
  GitHub, taking its address and role; `manage.py invite_operator` makes the first. (2026-10-05)
- **`studio(min_role)`** gates Studio routes: 401 `CA0101` (before CSRF), 403 `CA0102`; learner
  routes take no auth. The last active operator cannot be demoted or deactivated. (2026-10-05)

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
- **Approving needs every question of the submission answered**; a wrong answer counts, never
  blocks. Nobody approves their own draft, except an operator with a reason, `self_approved`. (10-06)

## Landing (`code_api/studio/landing.py`)

- **An operator lands approved drafts as one commit and one pull request**, opened by the GitHub App
  through the Git Data API with **no checkout anywhere**: the batch is checked in place against the
  index, any worker lands it, beat polls it. Provenance: `@login` or a display name, never an
  email; auto-merge on. Off unless `CODE_GITHUB_APP_*` are set. (2026-10-06)
- **A draft is in one live landing** (Postgres); a stale one (its folder's tree changed since its
  starting commit) is dropped, CA0306–CA0308. A failed landing holds its drafts until closed; every
  failure ends it in words; a claim token keeps recovery and a slow worker apart. (2026-10-06)
- **A batch carries every draft its links need**: one linking to a live draft of a new node it
  leaves out is refused, CA0312, *tick it too* (nothing is added); the in-place check stays index
  plus batch. Ready rows name what they `needs`. (2026-10-16)
- **The GitHub App is `comeni-code-studio`**, its settings in the local `.env` only; the content
  repository has its `providers.yaml`, and the app's login in its *studio-app* file. (2026-10-16)

## Following `main` (`code_api/studio/follow.py`)

- **One reconciler, `follow(source)`**: `main`'s head against the live build; if they differ, build
  from the head's tarball (no checkout); then merged landings whose merge commit the live build
  contains have their drafts marked **`landed`** (final; frees the node). One try-lock. (10-06)
- **One `Source` interface, two sources, one factory**: `GitHubSource` (the app's client) and
  `FolderSource`, picked by `configured_source()`. Beat (every 5 minutes), the landing poller (on a
  merge) and `manage.py rebuild_index` all call `follow`; `--root` is a folder source. (2026-10-06)
- **`main` wins**: a stray folder build is put back next round; a refused head falls back to
  `main`'s own last good build, never a folder build, never a commit refused since; the command
  exits 2 (CA0007) when its source cannot be read. (2026-10-06)
- **`GET /api/studio/index`** (any member): the live build, the latest attempt and its problems,
  `main`'s last-seen head, `behind`; `/nodes` lists landed nodes and live drafts for links. (10-16)
- **With the app set, the local stack follows the real content repository**, which has no nodes:
  its index is empty until the first landing. (2026-10-16)

## The weaver and search (`code-weaver`, pure)

- `weave` walks *needs* back from the goals, orders by region then first-reached, byte-identical
  for the same input; levels never change a route; known topics end the walk. (2026-09-19, 09-20)
- `find` ranks topics for typed words with no model; unmatched words come back by name. (2026-09-20)

## The web app (`apps/web`)

- React Router: `/` Start (L1), `/route` (L4), `/node/:id` (L5, and its First steps form), `/health`,
  `/identity`, the account pages and `/studio/*`. Page state lives in the URL. (2026-09-21, 10-07)
- **Accounts on the web**: one button per provider; `NotYet` answers every way in without an
  invite; `safeNext` keeps return addresses on the site; signing out reloads Start. (2026-10-07)
- **Studio's shell has one gate**: `STUDIO_PAGES` (`studio/pages.ts`) lists each page and its role;
  the rail draws what a role can open: Drafts (S19), Review (S6), Land (S10), Team (S14). (10-07 to 10-15)
- **The workbench (S3)**: each edit is an `edits.ts` command sent by `useDraftEdit` (one GET to open,
  one write per save); editors save when left; a click during a save waits for it (#255); Checks
  asked only while shown; Math and Example editors; the Links tab suggests nodes and drafts. (10-09 to 10-16)
- **Review (S6, M4.9b)**: the queue, the open block as read or changed (`align`; a colourless word
  diff), a verdict per key, bulk approval; a send back's requests show in the workbench. (2026-10-14)
- **Land (S10, M4.9c)**: Ready to land (a table, with *needs*), the landings (a moving one asked
  every 15 s), a failed landing's Close, main and the index. (2026-10-15, 10-16)
- **Formulas** (`node/Formula.tsx`): KaTeX 0.19.0 in strict mode inside a `try`, untrusted commands
  throwing, own empty macros, bounded size; unreadable shows as plain source, marked only inside
  Studio (`InStudio`); KaTeX's CSS in the base layer; `remark-math` in prose. (2026-10-16)
- **The exam pool's builder**: the list, `ExamEditor`, `ExamSidePanel` (as `TestQuestion` asks it,
  and its checks); `AnswerEditor` serves both pools; `data-theme="dark"` boxes go dark. (10-13)
- **`sendJson` is the one write** (CSRF header; only a write's 204 is empty); `auth.ts` wraps
  allauth, `accounts.ts` the accounts API and `canActAs`; `useMe` is the one *who am I*;
  `test-kit.tsx` answers fetch by method and path in tests. (2026-10-07)
- **The Route map is the canvas's metro map**, a pure layout whose gaps widen for climbs and
  crowded labels, so any route shape holds (`shapes.fixture.ts`). (2026-09-21, 2026-09-29)
- **The Node page** lists resources in *Learn it* (embedded where a provider allows), draws the
  body block by block and folds its neighbours into *Around this node*. (2026-09-21, 2026-09-29)
- **A First steps node reads in its own form**: one column, larger type, *Read · Watch*. (2026-09-21)
- **`api/queries.ts` alone makes query keys and hooks**; `url.ts` reads and writes route params;
  `ErrorNotice` is the one error sentence (an answer not JSON: `HTTP 502`). (2026-10-05)
- **No page invents learner state**: what needs records or review is absent, not faked. (2026-09-21)

## The stack, CI and guardrails

- `docker compose up -d --wait` runs Postgres 18 (:5433), Redis 8 (:6380), migrate, the API, the
  worker, beat and web on 127.0.0.1:8090; `ops/stack-check.sh` checks it. (2026-09-21)
- CI runs `python`, `web` and `stack`; `main` here and in `comeni-code-content` takes only green
  pull requests, with no bypass. There, `review` passes Studio's app and `MAINTAINERS`; anyone
  else needs a maintainer's approval (#102). (2026-09-17, 2026-10-06)

## Decided, and not to reopen

- Code organises existing teaching, pointing outward, and never scrapes; skeletons come from open
  outlines. **Khan Academy is linked, never embedded** (#76). (2026-09-17, 2026-09-29)
- **Five content levels** describe nodes, never learners; accounts 13+ until a consent spec; First
  steps is in the MVP. (2026-09-17)
- **Self-tests** from exam pools are v1's mastery system, scored per node, never graded. (2026-09-17)
- **M4**: blocks thin; back end first; invite-only email and GitHub sign-in; Studio lands as a
  GitHub App; a sign-in shared with Labs (#101) kept open; #102 decided (above). (2026-09-29)
- One colour per meaning (W10): teal is your route, blue selected; five regions are not five
  colours. *Read / Watch* is on First steps only. (2026-09-20, 2026-09-21)

## Open

- **The first landing** (#324) comes after M6 and M5. The GitHub App is installed on every
  repository of the organisation: the operator narrows it to `comeni-code-content`. (2026-10-16)
- **Unplaced**: citations (W5.1's `cite`, S3's Sources; no phase owns them), `step_back_to` before
  M8, the Graph screen (S2), a learner's own problem dataset before accounts (M6.8). (2026-10-16)
- **For self-tests** (M4E.7): a cap per node in one exam, unseen questions first; whether grading
  runs in the browser; whether exam rows keep an empty `misconception`. (2026-10-05)
- **Deferred**: #131, #134, #176, #188, #189, #203, #204, #216, #217, #234, #235, PR #139's minors;
  **#260, #265, #269, #279, #299, #322, #339, #347 at the end of the MVP's first loop**. (to 10-16)
- **The fixtures' Khan videos** are linked; a replacement is content (#89); their *covers* lines
  were written from the video pages. Pruning `IndexBuild` rows; three light chip pairs under
  4.5 : 1, kept by the operator; jsdom 29 until Node 24.15 (issue 32). (2026-09-17 to 09-29)
- R8 of the architecture spec: search, institutional sign-in, the consent spec. (2026-09-17)

## Known traps

- **Never pipe a check into `tail` or `grep`** and trust the chain: the exit status is the pipe's.
  Run the suite with CI's `env:` before pushing; `ruff format --check` on docs too. (09-17 to 10-06)
- **The link check reads tracked files only**: `git add` a new document first. (2026-09-17)
- **Compose rebuilds nothing by itself**: rebuild the index after a fixture change, `--build` after
  a code change, reload the browser. Migrations 0007 and 0009 need `rebuild_index`. (09-21, 10-09)
- **An app must declare every workspace package it imports**; the image installs only those. **Stop
  a server by its PID**, never `pkill -f` a pattern in your own command line. (2026-09-17, 09-20)
- **`comeni-code-content` holds no nodes yet**; its `code-schema validate` is pinned at `38d09dc`,
  moved only by a pull request there. (2026-09-18, 2026-10-05)
- **After a reboot**, or when tests cannot connect (:5433, :6380): `docker compose up -d --wait
  postgres redis`. Two pytest runs on one Postgres break each other. Merged branches are kept:
  retarget a stacked pull request first. The canvas is the Design artifact in CLAUDE.md. (to 10-14)
- **No Node 24 on this machine now** (Node 26 system, miniconda's 22 first on `PATH`): web commands
  run in `node:24-alpine` (`node_modules` carries the musl binding); scratch tools with
  `PATH=/usr/bin:$PATH`. **Ports 8000 and 5173 are Labs'**: walk on 8001 and 5174. (2026-10-16)
- **A walk that must not reach GitHub** runs `runserver` from a folder whose `.env` leaves the app
  out, with Compose's worker and beat stopped. Tests turn the app off unless one sets it (#337). (10-16)
- **zsh's `echo` turns `\n` in JSON into newlines**: parse a saved file. **ruff re-wraps calls**, so
  a later text replacement can miss. **`Closes #1, #2` closes only #1**. CI may not start when a
  pull request opens: wait, or close and reopen it. (2026-10-05, 10-06)
- **nginx must pass `Host $http_host`**: `$host` drops the port, and Django's CSRF check refuses
  every write behind it. (2026-10-05)
- **GitHub's compare lists at most 300 files**. **Celery acknowledges on delivery**. **importlib mode
  keeps a test's folder off the path**. tarfile's `data` filter strips a leading `/`: check names.
  `transaction.on_commit` needs `robust=True` for a nudge. (2026-10-06)
- **Dark Reader whitens the Chrome**: compare colours headless. **`vite preview` serves 404 after a
  rebuild**. React Router moves inside a transition. (2026-10-07)
- **Stubbed web tests never meet code-schema's rules**: walk against the API with `puppeteer-core`
  over headless Chrome when Claude in Chrome is away; a fresh context per user; a refused block's
  editor warns on leaving, so accept the dialog. (10-09 to 10-16)
- **A migration test pinning one app** gets the others' models at whatever state: pin `accounts`
  too. (2026-10-06)
- **`code_schema`'s messages, codes, lines and order are pinned by tests**; its purity allowlist
  has no `functools`. The API's source may not name a `CS` code (ownership guard). (10-05, 10-16)
- **Tailwind 4's utilities sit in a layer**: an unlayered third-party sheet beats them; import it
  `layer(base)`. Biome leaves the generated `schema.ts` alone (#343). (2026-10-16)
