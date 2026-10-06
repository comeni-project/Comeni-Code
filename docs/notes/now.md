# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-10-05** (M4.4 closed). The old `CLAUDE.md`: `git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done** (#79). **M4, the Studio core, is nine parts**, sub-issues #119–#127 of #74,
  back end first, screens last; the list and its reasons are in the archived *M4 in parts* entry.
  (2026-09-29)
- **M4.1–M4.4 are done** (#119–#122): diagnostic codes and the block document (PR #139); exam
  pools (#151, comeni-code-content#6); accounts, invites, roles (#164); drafts, the content API and
  checks (#177). **M4.5, review (#123), is next**: nobody approves a draft they contributed to, and
  the checklist gates submitting. (2026-09-29, 2026-10-05)
- **The master's-class seeds** are the first large graphs, when the operator sends them. (2026-09-19)

## How work is done now

- **Every defect gets an issue first**, `mechanical` or `protocol` (`docs/internals/walking.md`);
  the plan is a sub-issue tree; deferred minors go in one `deferred` issue. (2026-09-29)
- **A phase is split into parts; each is spec → plan → test-first build → journal entry**, the
  operator approving the parts list and each spec (R5). A part is built natively with a
  fresh-reviewer checkpoint mid-plan and one over the branch. (2026-09-17, 2026-09-29)
- **The agent merges a pull request only after the operator says yes to that one.** (2026-09-29)
- **A quality pass between parts**, when asked: recommend, don't survey; agreed mechanical work is
  built without stopping, still issues and tests first, a fresh reviewer at the end. (2026-10-05)
- **The app before the pages**: content and finishing polish wait for the end of the MVP; screens
  still match the original boards as closely as possible. (2026-09-29)

## The content format (`code-schema`)

- A node is a folder: `node.yaml` (fields, links, resources, try questions), a MyST `body.md`
  and an optional `exam.yaml`; the writer round-trips all three byte for byte. (2026-09-18 to 10-05)
- **The body is blocks**: text between top-level fences, `:::{try} <id>` then `:::`, and
  `:::{misconception|caveat|convention} <title>` … `:::`. Fences follow CommonMark; later kinds are
  refused by name until M6; a body its blocks would not write back unchanged is CS0415. (2026-09-29)
- **Every problem has a declared code** in `code_schema/diagnostics.yml` (`CS`, `CW`, `CA`, bands
  of 100, never renumbered), a test naming it, `code-schema explain`, and a generated
  `docs/reference/diagnostics.md`. (2026-09-29)
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
- **A question composes an answer**: `Answer = ChoiceAnswer | NumberAnswer`, inside `TryQuestion`
  (hints, never the answer) or `ExamQuestion` (no hints, an optional `level`, a `misconception`
  per wrong option naming a callout). One reader in `code_schema.questions` serves both pools.
  (2026-09-20, 2026-10-05)
- **An exam pool** (`code_schema.exam`, CS08xx): at most 40 questions, ids not shared with try
  questions. Under 4 is a *warning*: the node is left out of self-tests. **Exam answers are not a
  secret in v1**: the content repository is public and self-tests certify nothing (spec M4E.6).
  (2026-10-05)
- **Warnings never refuse** (M4E.4): `Problem.refuses` reads the registry; `Content.errors` is what
  `validate` (exit 1, `::error` vs `::warning`), the weaver and `rebuild_index` refuse on.
  (2026-10-05)
- **`code_schema.records`** reads every nested list of mappings; `Node.blocks` is a property over
  the body; `block_json` / `block_from_json` are the one block codec. (2026-10-05)
- `tests/fixtures/salmon/`: 26 real nodes, a 17-stop route from no background to *Salmon* and nine
  nodes beside it; TPM carries the one exam pool, of four. Tests never read the real content
  repository. (2026-09-19, 2026-10-05)

## The index and the API (`apps/api`)

- `manage.py rebuild_index` fills the index from files, **all or nothing**, one `IndexBuild` row
  per attempt; `--root`, else `CODE_CONTENT_ROOT`, no default. (2026-09-19)
- Everything outside the index names a node by id, never a foreign key. (2026-09-19)
- `GET /api/nodes/{id}` (neighbours, *needed by*, resources, questions, and the body as `blocks`,
  never `body`), `/api/routes`, `/api/search`, `/api/health`; 404 for a miss, 503 before any build;
  error bodies carry a `code`. (2026-09-19 to 2026-09-29)
- **`code_api/content/reads.py` holds every read** (with `unbuilt()` for 503, `missing()` for 404)
  and `code_api/content/schemas.py` every response schema. The index stores blocks only:
  migration 0005 dropped `Node.body`. Exam pools are their own `ExamQuestion` table (0006); **no
  endpoint sends them** until the self-test spec decides. (2026-10-05)
- **Index numbers are text** (jsonb drops exponents); `content.snapshot` reads rows back as nodes.
  (2026-10-05)
- **Each request loads the whole index**: fine at 26 nodes; later cached per digest. (2026-09-20)

## Accounts (`code_api.accounts`)

- **django-allauth, headless**, all under `/_allauth/` (Vite and nginx both forward it); GitHub is
  off until its client id and secret are set, and no OAuth app is registered. (2026-10-05)
- **A user is keyed by email and a `public_id` UUID** (#101's key; the integer key never leaves
  the database), with one role, author < reviewer < operator, checked by `can_act_as`. (2026-10-05)
- **Sign-up only through an invite** (hashed token, single-use, seven days), by password or
  GitHub, taking its address and role; `manage.py invite_operator` makes the first. (2026-10-05)
- **`studio(min_role)`** gates Studio routes: 401 `CA0101` (before CSRF), 403 `CA0102`; learner
  routes take no auth. The last active operator cannot be demoted or deactivated. (2026-10-05)

## Drafts (`code_api.studio`)

- **A draft is a working copy of one node**, one open per node (a partial unique constraint),
  opened from the index or new; any author or above edits it. (2026-10-05)
- **A save is one edit, one `Revision`** of the three files, or none: it names its base revision
  (stale: 409 `CA0203`); the files must re-read as exactly the edit (CA0208, CA0210). (2026-10-05)
- **Verify** runs the graph rules with the draft in place; **the checklist** wants it clean, a
  level, a resource and four exam questions. (2026-10-05)

## The weaver and search (`code-weaver`, pure)

- `weave` walks *needs* back from the goals, orders by region then first-reached, byte-identical
  for the same input; levels never change a route; known topics end the walk. (2026-09-19, 09-20)
- `find` ranks topics for typed words with no model; unmatched words come back by name. (2026-09-20)

## The web app (`apps/web`)

- React Router: `/` Start (L1), `/route` (L4), `/node/:id` (L5, and its First steps form), `/health`,
  `/identity`. Page state lives in the URL: `q`, `goal`, `known`, `stop`, `view`. (2026-09-21)
- **The Route map is the canvas's metro map**, a pure layout whose gaps widen to fit climbs and
  crowded labels, so it holds for any route shape (`shapes.fixture.ts`), not only Salmon's.
  (2026-09-21, 2026-09-29)
- **The Node page** lists resources in *Learn it* (embedded only where a provider allows), draws
  the body block by block, try questions and callouts included, and folds its neighbours into an
  *Around this node* rail. (2026-09-21, 2026-09-29)
- **A First steps node reads in its own form**: one column, larger type, *Read · Watch*, one large
  question, *Next on your route*. (2026-09-21)
- **`api/queries.ts` is the only place query keys and hooks are made**; `url.ts` reads and writes
  route params; `ErrorNotice` is the one error sentence, and an answer that is not JSON reports its
  status (`HTTP 502`). (2026-10-05)
- **No page invents learner state**: what needs records or review is absent, not faked. (2026-09-21)

## The stack, CI and guardrails

- `docker compose up -d --wait` runs Postgres 18 (:5433), Redis 8 (:6380), migrate, the API, the
  worker, beat and web on 127.0.0.1:8090; `ops/stack-check.sh` checks it. (2026-09-21)
- CI runs `python`, `web` and `stack`; `main` here and in `comeni-code-content` takes only green
  pull requests, with no bypass. (2026-09-17)
- `comeni-code-content` runs `code-schema validate` pinned to a Comeni-Code commit; the pin moves
  only by a pull request there. (2026-09-18)

## Decided, and not to reopen

- Code organises existing teaching, pointing outward, and never scrapes; skeletons come from open
  outlines. **Khan Academy is linked, never embedded** (#76). (2026-09-17, 2026-09-29)
- **Five content levels** describe nodes, never learners; accounts 13+ until a consent spec; First
  steps is in the MVP. (2026-09-17)
- **Self-tests** from per-node exam pools are v1's mastery system; results per node, never a grade.
  (2026-09-17)
- **M4**: blocks thin (text, try, callout); back end first; email and GitHub sign-in, invite-only;
  Studio lands as a GitHub App; a sign-in shared with Labs (#101) kept open; #102 in M4.6's spec.
  (2026-09-29)
- One colour per meaning (W10): teal is your route, blue selected; five regions are not five
  colours. *Read / Watch* is on First steps only. (2026-09-20, 2026-09-21)

## Open

- **M4's spec questions**: webhook or polling (M4.7); which real node lands first (M4.9).
  (2026-09-29)
- **For landing (M4.6)**: a *related* link needs both drafts landed together; whether a region
  change moves the folder; a base that changed is refused. #176: an empty edit still makes a
  revision. (2026-10-05)
- **For the self-test part** (M4E.7): a cap of questions per node in one exam, unseen questions
  first; whether grading runs in the browser; whether exam rows keep an empty `misconception`.
  (2026-10-05)
- **Deferred minors**: #131, #134, and M4.1.3's four review minors, listed in PR #139. (2026-10-05)
- **The fixtures' Khan videos** are linked; a replacement is content, deferred (#89). Their
  *covers* lines were written from the video pages, not by watching. (2026-09-21, 2026-09-29)
- `providers.yaml` is not in `comeni-code-content` yet. (2026-09-20)
- Whether `IndexBuild` rows need pruning; three light chip pairs under 4.5 : 1, kept by the
  operator; jsdom 29 until Node 24.15 (issue 32). (2026-09-17, 2026-09-19)
- R8 of the architecture spec: search, institutional sign-in, the consent spec, review of content
  pull requests not from Studio (#102). (2026-09-17)

## Known traps

- **Never pipe a check into `tail` or `grep`** and trust the chain: the exit status is the pipe's.
  A red pull request merged this way. (2026-09-17, 2026-09-21)
- **The link check reads tracked files only**: `git add` a new document first. (2026-09-17)
- **Compose rebuilds nothing by itself**: rebuild the index after a fixture change, `--build` after
  a code change, reload the browser before judging. (2026-09-21)
- **An app must declare every workspace package it imports**; the image installs only those.
  (2026-09-20)
- **Stop a server by its PID**, never `pkill -f` a pattern in your own command line. (2026-09-17)
- **`comeni-code-content` holds no nodes yet**; its validator is pinned at M4.2's merge, `38d09dc`.
  (2026-10-05)
- **Podman, not Docker, on this machine**: `podman start code-dev-postgres code-dev-redis` after a
  reboot (:5433, :6380); Compose is not set up again. (2026-10-05)
- **Two pytest runs on one Postgres break each other**: not while a reviewer runs. (2026-10-05)
- **This machine's Node is 22**: web checks run in `node:24-alpine` under podman, with
  `--userns=keep-id` and `:Z` on the volume, one `npm` command per run (`npm ci` first). The
  published canvas shows *Page not found* here. Merged branches are kept: retarget a stacked pull
  request first. (2026-09-29, 2026-10-05)
- **Run the suite with CI's `env:` before pushing**: the local `.env` allows more. Watch CI without
  blocking; GitHub's runner queue can stall 10–15 minutes. (2026-10-05)
- **Migration 0007 needs `rebuild_index` after it** (providers' licences, numbers). (2026-10-05)
- **zsh's `echo` turns `\n` in JSON into newlines**: parse a saved file. **ruff re-wraps calls**,
  so a later text replacement can miss: assert each test setup step. (2026-10-05)
- **nginx must pass `Host $http_host`**: `$host` drops the port, and Django's CSRF origin check
  then refuses every write behind it. (2026-10-05)
- **CI may not start when a pull request opens**: close and reopen it. (2026-10-05)
- **`code_schema`'s messages, codes, lines and order are pinned by tests**: editing one is a
  behaviour change. Its purity allowlist has no `functools`; widening it is reviewed. (2026-10-05)
