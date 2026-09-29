# Now: what is true, and what is next

The consolidated state of the project. **Read this first**; then any entry still in
[the journal](journal/), since those are not compacted yet. How this page is kept:
[the compaction rules](compaction.md). Each line cites the entry it came from; the long form of any
line is in [the archive](journal/archive/).

**Compacted through: 2026-09-29.** `CLAUDE.md` before compaction, with its part-by-part status, is
`git show 23da290:CLAUDE.md`.

## Where the work is

- **M0–M3 are done; M4, the Studio core, is next** and is not split into parts yet: sign-in with
  roles, an author drafting a node, checks, a reviewer approving, and the node landing on
  `comeni-code-content` through a pull request (architecture spec R4). (2026-09-21)
- **M4's parts list goes in a journal entry (R5), and each part becomes a sub-issue** of M4's
  parent issue, #74. (2026-09-29)
- **The M3 stack of pull requests is open**: #65 (part 4) ← #66 (part 5) ← #67 (part 6), each based
  on the one before; merge bottom-up. (2026-09-21, 2026-09-29)
- **The master's-class seeds** are the first large graphs, when the operator sends them. (2026-09-19)

## How work is done now

- **Every defect gets an issue first**, as `mechanical` (fix test-first) or `protocol` (the
  operator decides): `docs/internals/walking.md`. (2026-09-29)
- **A phase is split into parts; each part is spec → plan → test-first build → journal entry**,
  the operator approving the parts list and each spec (R5). (2026-09-17)
- **Screens are compared with the published canvas in a browser**, at the page's real width, in
  light at 1440 as well as dark — never with a board regenerated in the same change; styles are
  read from `.design/build_pages.mjs`. A scratchpad Playwright audit (every goal and stop, 360–2560
  px) finds what the canvas cannot show. (2026-09-21)

## The content format (`code-schema`)

- A node is a folder: `node.yaml` (id from the folder, title, claim, region, level, minutes, links,
  resources, try questions) and a Markdown `body.md`; the writer round-trips both byte for byte.
  (2026-09-18, 2026-09-20)
- **Three link kinds, each with a reason**: *needs* (a list), *goes deeper*, *related* (on both
  nodes, at most four, the peer test). *helps* and *any-of* are designed in W3.2 and refused until
  content needs them; the Salmon fixtures needed neither. (2026-09-18, 2026-09-19)
- **A need is what understanding the claim requires**, never a tool or an implementation detail:
  *de Bruijn graphs* sits below *Salmon*, not on its route. (2026-09-18, 2026-09-19)
- `code-schema validate <root>` checks every node and the graph (targets, symmetry, levels, one
  ring per tangle of cycles), exits 0/1/2, and speaks GitHub annotations with `--format github`.
  (2026-09-18)
- **Registries are content**: `regions.yaml` (six regions) and `providers.yaml` (licences, embeds,
  `players`), needed once a resource cites a provider. A video resource names its video
  (`video: youtube:<id>`). (2026-09-18, 2026-09-20, 2026-09-21)
- **Try questions** are choice or number, with hints (never containing the answer) and a rationale,
  placed by `{% try <id> %}` in the body. Their answer reaches the browser; exam answers must not.
  (2026-09-20)
- `tests/fixtures/salmon/`: 26 real nodes — a 17-stop route from no background to *Salmon*, and
  nine nodes below and beside it. Tests never read the real content repository. (2026-09-19)

## The index and the API (`apps/api`)

- `manage.py rebuild_index` fills the index from files, **all or nothing**, one `IndexBuild` row
  per attempt; `--root`, else `CODE_CONTENT_ROOT`, no default. (2026-09-19)
- Everything outside the index names a node by id, never a foreign key. (2026-09-19)
- `GET /api/nodes/{id}` (neighbours as cards with minutes, derived *needed by*, resources,
  questions), `GET /api/routes?goal=&known=`, `GET /api/search?q=`, `GET /api/health`. 404 for a
  miss, 503 before any applied build. (2026-09-19 to 2026-09-21)
- **Each request loads the whole index** — fine at 26 nodes; the answer later is a graph cached per
  digest (M2P4.3). (2026-09-20)

## The weaver and search (`code-weaver`, pure)

- `weave` walks *needs* back from the goals and orders by region, then first-reached; the same
  graph, goals and known set give byte-identical routes, and levels never change a route.
  (2026-09-19)
- Each stop lists the stops on this route that need it, with the stored reasons; a known topic ends
  the walk; the route reports its level span (*First steps → Intermediate* for Salmon).
  (2026-09-20)
- `find` ranks topics for typed words with no model: prefixes, trimmed plurals, a stop list, order
  by words matched; a word nothing matched is returned by name. (2026-09-20)

## The web app (`apps/web`)

- React Router: `/` Start (L1), `/route` (L4), `/node/:id` (L5, and its First steps form), `/health`,
  `/identity`. Page state lives in the URL: `q`, `goal`, `known`, `stop`, `view`. (2026-09-20,
  2026-09-21)
- **The Route map is the canvas's metro map**: the goal's line through the middle, the other lines
  in the order that keeps needs between them shortest, branching at 45°, meeting in a diamond;
  the geometry is a pure function tested against the API's real answer. (2026-09-21)
- **The Node page** plays an embedded video in *Learn it*, asks try questions with hints one at a
  time, and folds its neighbours into an *Around this node* rail. (2026-09-21)
- **A First steps node reads in its own form**, chosen by its level: one column, larger type, the
  video offered behind *Read · Watch*, one large question, *Next on your route*. (2026-09-21)
- **No page invents learner state.** Anything that needs learner records (T7), problems (M6),
  connecting text (W3.4) or review (M4) is absent, not faked. (2026-09-20, 2026-09-21)

## The stack, CI and guardrails

- `docker compose up -d --wait` runs Postgres 18 (:5433), Redis 8 (:6380), migrate, the API
  (gunicorn), the worker, beat and web (nginx) on 127.0.0.1:8090; `ops/stack-check.sh` checks it,
  including the app's deep paths. (2026-09-17, 2026-09-21)
- CI runs `python`, `web` and `stack`; `main` here and in `comeni-code-content` takes only green
  pull requests, with no bypass. (2026-09-17)
- `comeni-code-content` runs `code-schema validate`, pinned to a Comeni-Code commit that moves only
  by a pull request there. (2026-09-18)

## Decided, and not to reopen

- Code complements Khan Academy: it organises existing teaching, pointing outward, and never
  scrapes; skeletons come from open outlines (OpenStax, Galaxy Training, College Board). (2026-09-17)
- **Five content levels** describe nodes, never learners; accounts 13+ until a consent spec; First
  steps is in the MVP. (2026-09-17)
- **Self-tests** from per-node exam pools are v1's mastery system; results per node, never a grade.
  (2026-09-17)
- The body stays Markdown until M4's workbench brings W5.1's block document. (2026-09-20)
- One colour per meaning (W10): teal is your route, blue selected; five regions are not five
  colours. (2026-09-20)
- *Read / Watch* exists on the First steps page only (a recorded deviation from R4). (2026-09-21)

## Open

- **Thin connectors cross other stops' labels** on 7 of 26 goals, and one is steeper than 45°:
  #73, a geometry change, so a spec. (2026-09-21, 2026-09-29)
- **Whether Khan Academy's terms allow embedding** — decided by the first real content that lists
  it; its terms page needs a person to read it (T5.3). (2026-09-17, 2026-09-21)
- **The *covers* lines of both fixture videos** were written from the video pages, not by watching;
  a reviewer checks them before real content copies them. (2026-09-21)
- `providers.yaml` is not in `comeni-code-content` yet. (2026-09-20)
- Whether `IndexBuild` rows need pruning (2026-09-19); three light chip pairs under 4.5 : 1, kept
  by the operator; jsdom 29 until Node 24.15 (issue 32). (2026-09-17)
- R8 of the architecture spec: search, institutional sign-in, the sign-in shared with Labs, the
  consent spec, review of content pull requests not from Studio (decide with M4). (2026-09-17)

## Known traps

- **Never pipe a check into `tail` or `grep`** and trust the chain: the exit status is the pipe's.
  A red pull request merged this way, and two commits claimed checks that had failed.
  (2026-09-17, 2026-09-20, 2026-09-21)
- **The link check reads tracked files only**: `git add` a new document before trusting it.
  (2026-09-17)
- **Compose rebuilds nothing by itself**: rebuild the index by hand after a fixture change, add
  `--build` after a Python change, and reload the browser before judging. (2026-09-20, 2026-09-21)
- **An app must declare every workspace package it imports**; the image installs only those.
  (2026-09-20)
- **Process handling:** start background servers from a script, keep their PID, never `pkill -f` a
  pattern in your own command line, and check the port is free afterwards. (2026-09-17)
