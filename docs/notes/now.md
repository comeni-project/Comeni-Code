# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-09-29** (M4.1 closed). `CLAUDE.md` before the first compaction, with its
part-by-part status, is `git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done** (#79). **M4, the Studio core, is nine parts**, sub-issues #119–#127 of #74,
  back end first, screens last; the list and its reasons are in the archived *M4 in parts* entry.
  (2026-09-29)
- **M4.1 is done** (diagnostic codes, the block document). **M4.2, exam pools, is next but waits
  for the operator's word.** (2026-09-29)
- **The master's-class seeds** are the first large graphs, when the operator sends them. (2026-09-19)

## How work is done now

- **Every defect gets an issue first**, `mechanical` or `protocol` (`docs/internals/walking.md`).
  The plan is a sub-issue tree (`M4.1.2 — …`); a part's deferred minors go in one `deferred` issue
  (#131, #134). (2026-09-29)
- **A phase is split into parts; each is spec → plan → test-first build → journal entry**, the
  operator approving the parts list and each spec (R5). A part is built natively with a
  fresh-reviewer checkpoint mid-plan and one over the branch. (2026-09-17, 2026-09-29)
- **The agent merges a pull request only after the operator says yes to that one.** (2026-09-29)
- **The app before the pages**: content and finishing polish wait for the end of the MVP; screens
  still match the original boards as closely as possible. (2026-09-29)
- **Screens are compared with the published canvas in a browser**, at the page's real width, in
  light at 1440 and in dark, never with a board regenerated in the same change; styles are read
  from `.design/build_pages.mjs`. (2026-09-21)

## The content format (`code-schema`)

- A node is a folder: `node.yaml` (id from the folder, title, claim, region, level, minutes, links,
  resources, try questions) and a MyST `body.md`; the writer round-trips both byte for byte.
  (2026-09-18, 2026-09-29)
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
- `code-schema validate <root>` checks every node and the graph, exits 0/1/2, and speaks GitHub
  annotations with `--format github`. (2026-09-18)
- **Registries are content**: `regions.yaml` (six regions) and `providers.yaml` (licences, embeds,
  `players`); a video resource names its video (`video: youtube:<id>`). (2026-09-18, 2026-09-21)
- **Try questions** are choice or number, with hints (never the answer) and a rationale. Their
  answer reaches the browser; exam answers must not. (2026-09-20)
- `tests/fixtures/salmon/`: 26 real nodes, a 17-stop route from no background to *Salmon* and nine
  nodes beside it. Tests never read the real content repository. (2026-09-19)

## The index and the API (`apps/api`)

- `manage.py rebuild_index` fills the index from files, **all or nothing**, one `IndexBuild` row
  per attempt; `--root`, else `CODE_CONTENT_ROOT`, no default. (2026-09-19)
- Everything outside the index names a node by id, never a foreign key. (2026-09-19)
- `GET /api/nodes/{id}` (neighbours, *needed by*, resources, questions, and the body as `blocks`,
  never `body`), `/api/routes`, `/api/search`, `/api/health`; 404 for a miss, 503 before any build;
  error bodies carry a `code`. (2026-09-19 to 2026-09-29)
- **Each request loads the whole index**: fine at 26 nodes; later a graph cached per digest.
  (2026-09-20)

## The weaver and search (`code-weaver`, pure)

- `weave` walks *needs* back from the goals and orders by region, then first-reached; the same
  graph, goals and known set give byte-identical routes; levels never change a route. (2026-09-19)
- Each stop lists the stops that need it, with reasons; a known topic ends the walk; the route
  reports its level span. (2026-09-20)
- `find` ranks topics for typed words with no model; a word nothing matched is returned by name.
  (2026-09-20)

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
- **No page invents learner state**: what needs learner records, problems, connecting text or
  review is absent, not faked. (2026-09-21)

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

- **M4's spec questions**: whether a draft locks its node and how it relates to the index (M4.4);
  webhook or polling (M4.7); which real node lands first (M4.9). (2026-09-29)
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
- **The link check reads tracked files only**: `git add` a new document before trusting it.
  (2026-09-17)
- **Compose rebuilds nothing by itself**: rebuild the index after a fixture change, `--build` after
  a code change, reload the browser before judging. (2026-09-21)
- **An app must declare every workspace package it imports**; the image installs only those.
  (2026-09-20)
- **Stop a server by its PID**; never `pkill -f` a pattern in your own command line. (2026-09-17)
- **The content repository still writes `{% try %}`** on an older validator; its pin moves in M4.2,
  before the first landing. (2026-09-29)
- **An audit stack** (Compose project `code-audit`: Postgres 5434, Redis 6381, web 8091) is kept up
  for debugging; reach it with `CODE_DATABASE_URL` and `CODE_REDIS_URL`. (2026-09-29)
- **This machine's Node is 22**: web checks run in the `node:24` image. The published canvas shows
  *Page not found* on this account. Merged branches are kept: retarget a stacked pull request to
  `main` before merging. (2026-09-29)
