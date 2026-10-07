# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-10-07** (M4.8a closed). The old `CLAUDE.md`: `git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done** (#79). **M4, the Studio core, is nine parts**, #119–#127 of #74, back end
  first, screens last; the reasons are in the archived *M4 in parts* entry. (2026-09-29)
- **M4.1–M4.7 are done** (#119–#125): the block document (#139); exam pools (#151); accounts and
  roles (#164); drafts and checks (#177); review (#190); landing (#205); following (#218).
  (2026-09-29 to 2026-10-06)
- **M4.8 (#126) is three slices**, each with its own spec, plan and pull request: M4.8a sign-in and
  the team (#220, done in #236), **M4.8b the workbench (#221) is next**, M4.8c the exam pool
  (#222). (2026-10-07)
- **The master's-class seeds** are the first large graphs, when the operator sends them. (2026-09-19)

## How work is done now

- **Every defect gets an issue first**, `mechanical` or `protocol` (`docs/internals/walking.md`);
  the plan is a sub-issue tree; deferred minors go in one `deferred` issue. (2026-09-29)
- **A phase is split into parts; each is spec → plan → test-first build → journal entry** (R5),
  the operator approving each; a fresh reviewer mid-plan and over the branch. (2026-09-17, 09-29)
- **The agent merges a pull request only after the operator says yes to that one.** (2026-09-29)
- **A quality pass between parts**, when asked: recommend, don't survey; agreed mechanical work is
  built without stopping, still issues and tests first, a fresh reviewer at the end. (2026-10-05)
- **New screens are drawn as boards** with `.design/build_pages.mjs`'s own helpers, regenerated
  (Node 24 under podman) and shown on a Design canvas for approval before any spec. (2026-10-07)
- **The app before the pages**: content and finishing polish wait for the end of the MVP; screens
  still match the original boards as closely as possible. (2026-09-29)

## The content format (`code-schema`)

- A node is a folder: `node.yaml` (fields, links, resources, try questions), a MyST `body.md`
  and an optional `exam.yaml`; the writer round-trips all three byte for byte. (2026-09-18 to 10-05)
- **The body is blocks**: text between top-level fences, `:::{try} <id>` then `:::`, and
  `:::{misconception|caveat|convention} <title>` … `:::`. Fences follow CommonMark; later kinds are
  refused by name until M6; a body its blocks would not write back unchanged is CS0415. (2026-09-29)
- **Every problem has a declared code** in `code_schema/diagnostics.yml` (bands of 100, never
  renumbered), a test naming it, `code-schema explain` and `docs/reference/diagnostics.md`. (09-29)
- **Three link kinds, each with a reason**: *needs*, *goes deeper*, *related* (on both nodes, at
  most four). *helps* and *any-of* are refused until content needs them. (2026-09-18, 2026-09-19)
- **A need is what understanding the claim requires**, never a tool or an implementation detail:
  *de Bruijn graphs* sits below *Salmon*, not on its route. (2026-09-18, 2026-09-19)
- `code-schema validate <root>` checks every node and the graph, exits 0/1/2 (1 only for errors),
  and speaks GitHub annotations with `--format github`. (2026-09-18, 2026-10-05)
- **Edits are pure** (`code_schema.edits`, `Node` in, `Node` out), and `parse_node_files` reads a
  folder or a draft by one path. `minutes` is 1 to 600 (CS0023, #175). (2026-10-05)
- **Registries are content**: `regions.yaml` (six regions) and `providers.yaml` (licences, embeds,
  `players`); a video resource names its video (`video: youtube:<id>`). (2026-09-18, 2026-09-21)
- **A question composes an answer** (`ChoiceAnswer | NumberAnswer`) in a `TryQuestion` (hints) or
  an `ExamQuestion` (no hints, a `misconception` per wrong option); one reader serves both, and
  `code_schema.grading.is_right` grades by the web's rule, a choice by index. (2026-09-20 to 10-06)
- **An exam pool** (`code_schema.exam`, CS08xx): at most 40, ids apart from try questions; under 4
  is a *warning* (left out of self-tests). **Exam answers are not a secret in v1** (M4E.6). (10-05)
- **Warnings never refuse** (M4E.4): `Content.errors` is what `validate` (exit 1), the weaver and
  `rebuild_index` refuse on; `Problem.refuses` reads the registry. (2026-10-05)
- **`code_schema.records`** reads every nested list of mappings; `Node.blocks` is a property over
  the body; `block_json` / `block_from_json` are the one block codec. (2026-10-05)
- `tests/fixtures/salmon/`: 26 real nodes, a 17-stop route to *Salmon*; TPM has the one exam pool.
  Tests never read the real content repository. (2026-09-19, 2026-10-05)

## The index and the API (`apps/api`)

- **The index is rebuilt all or nothing**, one `IndexBuild` row per attempt, each with its commit
  and its source's kind (`github` or `folder`). (2026-09-19, 2026-10-06)
- Everything outside the index names a node by id, never a foreign key. (2026-09-19)
- `GET /api/nodes/{id}` (neighbours, *needed by*, resources, questions, and the body as `blocks`,
  never `body`), `/api/routes`, `/api/search`, `/api/health`; 404 for a miss, 503 before any build;
  error bodies carry a `code`. (2026-09-19 to 2026-09-29)
- **`code_api/content/reads.py` holds every read** (`unbuilt()` 503, `missing()` 404), and
  `code_api/content/schemas.py` every schema. The index stores blocks only; exam pools are their
  own table, and **no endpoint sends them** until the self-test spec decides. (2026-10-05)
- **Index numbers are text** (jsonb drops exponents); `content.snapshot` reads rows back. (10-05)
- **Each request loads the whole index**: fine at 26 nodes; later cached per digest. (2026-09-20)

## Accounts (`code_api.accounts`)

- **django-allauth, headless**, all under `/_allauth/` (Vite and nginx both forward it). Sign-in
  providers are a table, `apps/api/src/code_api/config/providers.py`, read by the settings and
  `Env`'s pair check; GitHub is off until its client is set; no OAuth app exists. (10-05, 10-07)
- **`/api/me` hands out the CSRF cookie**: every page asks it first, so a fresh browser's first
  write has a token (#234). (2026-10-07)
- **A user is keyed by email and a `public_id` UUID** (#101's key; the integer key never leaves
  the database), with one role, author < reviewer < operator, checked by `can_act_as`. (2026-10-05)
- **Sign-up only through an invite** (hashed token, single-use, seven days), by password or
  GitHub, taking its address and role; `manage.py invite_operator` makes the first. (2026-10-05)
- **`studio(min_role)`** gates Studio routes: 401 `CA0101` (before CSRF), 403 `CA0102`; learner
  routes take no auth. The last active operator cannot be demoted or deactivated. (2026-10-05)

## Drafts (`code_api.studio`)

- **A draft is a working copy of one node**, opened from the index or new; any author or above
  edits it while `open`. One live draft (open, submitted, approved) per node. (2026-10-05, 10-06)
- **A save is one edit, one `Revision`** of the three files, or none: it names its base revision
  (stale: 409 `CA0203`); the files must re-read as exactly the edit (CA0208, CA0210). (2026-10-05)
- **Verify** runs the graph rules with the draft in place; **the checklist** wants it clean, a
  level, a resource and four exam questions. (2026-10-05)
- **Review** (`code_api/studio/review.py`): submitting needs the checklist and the latest revision
  and freezes the draft (an edit: 409 CA0211); reject and send back need a reason. Each transition
  takes the row lock; `DraftEvent`, the append-only log, replays to `Draft.state`. (2026-10-06)
- **Approving needs every question of the submission answered** by the reviewer; a wrong answer
  counts, never blocks. Nobody approves their own draft, except an operator with a reason, marked
  `self_approved`. (2026-10-06)

## Landing (`code_api/studio/landing.py`)

- **An operator lands approved drafts as one commit and one pull request**, opened by the GitHub App
  through the Git Data API with **no checkout anywhere**: the batch is checked in place against the
  index, any worker lands it, beat polls it. Provenance: `@login` or a display name, never an
  email; auto-merge on. Off unless `CODE_GITHUB_APP_*` are set. (2026-10-06)
- **A draft is in one live landing** (Postgres); a stale one (its folder's tree changed since its
  starting commit) is dropped, CA0306–CA0308. A failed landing holds its drafts until closed; every
  failure ends it in words; a claim token keeps recovery and a slow worker apart. (2026-10-06)

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
  `main`'s last-seen head (a cache entry the follower writes), `behind`. Health stays up/down.
  (2026-10-06)

## The weaver and search (`code-weaver`, pure)

- `weave` walks *needs* back from the goals, orders by region then first-reached, byte-identical
  for the same input; levels never change a route; known topics end the walk. (2026-09-19, 09-20)
- `find` ranks topics for typed words with no model; unmatched words come back by name. (2026-09-20)

## The web app (`apps/web`)

- React Router: `/` Start (L1), `/route` (L4), `/node/:id` (L5, and its First steps form), `/health`,
  `/identity`, the account pages and `/studio/*`. Page state lives in the URL. (2026-09-21, 10-07)
- **Accounts on the web** (M4.8a): *Sign in* for everyone, one button per provider allauth's config
  lists; `NotYet` answers every way in without an invite; `safeNext` keeps return addresses on the
  site; signing out is a full load of Start (`layout/leave.ts`). (2026-10-07)
- **Studio's shell has one gate**: `STUDIO_PAGES` (`studio/pages.ts`) lists each page and its role;
  the rail draws what a role can open and the gate checks the same entry. Team (S14) is the first
  page. (2026-10-07)
- **`sendJson` is the one write** (CSRF header; only a write's 204 is empty); `auth.ts` wraps
  allauth, `accounts.ts` the accounts API and `canActAs`; `useMe` is the one *who am I*;
  `test-kit.tsx` answers fetch by method and path in tests. (2026-10-07)
- **The Route map is the canvas's metro map**, a pure layout whose gaps widen for climbs and
  crowded labels, so any route shape holds (`shapes.fixture.ts`). (2026-09-21, 2026-09-29)
- **The Node page** lists resources in *Learn it* (embedded where a provider allows), draws the
  body block by block and folds its neighbours into *Around this node*. (2026-09-21, 2026-09-29)
- **A First steps node reads in its own form**: one column, larger type, *Read · Watch*, one large
  question, *Next on your route*. (2026-09-21)
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

- **For M4.9**: register the app; which node lands first; `providers.yaml` must land in
  `comeni-code-content` first, or following its real `main` is refused. Webhooks later. (10-06)
- **For self-tests** (M4E.7): a cap per node in one exam, unseen questions first; whether grading
  runs in the browser; whether exam rows keep an empty `misconception`. (2026-10-05)
- **Deferred**: #131, #134, #176 (an empty edit makes a revision), the minors of PR #139, #189,
  #203, #204, #216, #217, #234 and #235 (M4.8a's account menu and smaller ones); large floats given as answers read back from jsonb as integers
  (#188). (2026-10-06)
- **The fixtures' Khan videos** are linked; a replacement is content, deferred (#89). Their
  *covers* lines were written from the video pages, not by watching. (2026-09-21, 2026-09-29)
- Whether `IndexBuild` rows need pruning (a folder source adds one every round);
  three light chip pairs under 4.5 : 1, kept by the operator; jsdom 29 until Node 24.15 (issue 32).
  (2026-09-17 to 2026-09-20)
- R8 of the architecture spec: search, institutional sign-in, the consent spec. (2026-09-17)

## Known traps

- **Never pipe a check into `tail` or `grep`** and trust the chain: the exit status is the pipe's.
  A red pull request merged this way. (2026-09-17, 2026-09-21)
- **The link check reads tracked files only**: `git add` a new document first. (2026-09-17)
- **Compose rebuilds nothing by itself**: rebuild the index after a fixture change, `--build` after
  a code change, reload the browser before judging. (2026-09-21)
- **An app must declare every workspace package it imports**; the image installs only those.
  (2026-09-20)
- **Stop a server by its PID**, never `pkill -f` a pattern in your own command line. (2026-09-17)
- **`comeni-code-content` holds no nodes yet**; its `code-schema validate` is pinned at M4.2's
  merge, `38d09dc`, and the pin moves only by a pull request there. (2026-09-18, 2026-10-05)
- **Podman, not Docker, on this machine**: `podman start code-dev-postgres code-dev-redis` after a
  reboot, or when tests cannot connect (:5433, :6380); Compose is not set up. (2026-10-05, 10-06)
- **This machine's Node is 22**: web checks run in `node:24-alpine` under podman, with
  `--userns=keep-id` and `:Z` on the volume, one `npm` command per run (`npm ci` first). Two pytest
  runs on one Postgres break each other. The canvas is under another claude.ai account (*Page not found* here); the local boards match it. Merged branches
  are kept: retarget a stacked pull request first. (2026-09-29, 2026-10-05)
- **Run the suite with CI's `env:` before pushing**, and `ruff format --check` on a docs branch:
  ruff formats Python blocks inside Markdown. Watch CI without blocking. (2026-10-05, 10-06)
- **Migration 0007 needs `rebuild_index` after it** (providers' licences, numbers). (2026-10-05)
- **zsh's `echo` turns `\n` in JSON into newlines**: parse a saved file. **ruff re-wraps calls**,
  so a later text replacement can miss: assert each test setup step. (2026-10-05)
- **nginx must pass `Host $http_host`**: `$host` drops the port, and Django's CSRF origin check
  then refuses every write behind it. (2026-10-05)
- **CI may not start when a pull request opens**: close and reopen it. **`Closes #1, #2` closes
  only #1**: one keyword per issue. (2026-10-05, 2026-10-06)
- **GitHub's compare lists at most 300 files**, page 1 only. **Celery acknowledges on delivery**: a
  task lost with its worker is not redelivered. **importlib mode keeps a test's folder off the
  path**: a helper beside the tests needs `pythonpath`. (2026-10-06)
- **This Chrome runs Dark Reader**, which whitens every page: compare colours with headless
  `google-chrome-stable --user-data-dir=<scratch>` (the default profile is held by the open
  browser). **`vite preview` serves 404 after a rebuild**: restart it. (2026-10-07)
- **React Router moves inside a transition**: a query refreshed right after `navigate` can re-render
  the old page first (Studio's gate redirected a sign-out). (2026-10-07)
- **tarfile's `data` filter strips a leading `/` instead of refusing it**: check member names
  yourself. **`transaction.on_commit` is not robust by default**: pass `robust=True` for a nudge
  whose failure must not turn a saved change into a 500. (2026-10-06)
- **A migration test pinning one app** gets the others' models at whatever state: pin `accounts`
  too, or `User` has no `role`. (2026-10-06)
- **`code_schema`'s messages, codes, lines and order are pinned by tests**: editing one is a
  behaviour change. Its purity allowlist has no `functools`; widening it is reviewed. (2026-10-05)
