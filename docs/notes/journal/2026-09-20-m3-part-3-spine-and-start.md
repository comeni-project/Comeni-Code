# 2026-09-20 — M3 part 3: the spine, and the Start page

**The project has its first screen.** `/` is the Start page (L1): ask what you want to learn,
confirm a target from what the search proposes, and see the route it would build — stops, time and
level span — before committing to it. The app has a router, a typed fetch client and a top bar
that searches. Part 3 of M3's six ([parts list](2026-09-20-m3-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-20-m3-spine-and-start-design.md) and the
[plan](../../superpowers/plans/2026-09-20-m3-spine-and-start.md) are in the same pull request.

The operator decided the four questions and approved the design section by section; one agent
built it, test first. **The part closes when the operator has looked at it beside the board.**

---

## Where things stand

| Claim | Check |
|---|---|
| `/` is Start, `/health` the health page, `/identity` the specimen, anything else not found | `npm run test -- src/App.test.tsx` |
| Typing words searches, and the words land in the URL | `npm run test -- src/start` (*searches what was typed*) |
| Choosing a target shows 17 stops, about 3 h 4 min, First steps → Intermediate | `npm run test -- src/start` (*shows the route*) |
| A word nothing is about is named, not an empty list | `npm run test -- src/start` (*names a word*) |
| Pending, no index, unreachable and a refused route each say a sentence | `npm run test -- src/start` (*Searching…*, *API's sentence*, *cannot reach*) |
| The bar's field goes to `/?q=…`, and `/` focuses it | `npm run test -- src/layout` |
| The fetch client carries the API's own words out of an error | `npm run test -- src/api/client.test.ts` |
| The stack serves all three pages | `docker compose up -d --wait --build`, then `ops/stack-check.sh` |
| The whole command set passes (509 Python, 52 web) | `uv run ruff check . && uv run mypy && uv run pytest`; `npm run lint && npm run test && npm run typecheck` |

**Seen by hand:** `http://127.0.0.1:8090/` after
`uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon`.

## What changed this session

| Commit | What is now true |
|---|---|
| `6ccaeed` | the spec and the plan |
| `4f8124e` | React Router; Start at `/`, health at `/health`, `/health` in the stack check |
| `f6085f3` | the generated types keep a property called `title` |
| `1b4e070` | `api/client.ts`, `api/search.ts`, `api/routes.ts` |
| `9bc0883` | the top bar searches, and `/` focuses it |
| `1d54430` | the page tests render inside a router |
| `2d4c495` | the Start page asks and offers the candidates |
| `01c1137` | the Start page previews the route |

Plus CLAUDE.md's status and layout, and this entry.

## Decisions made, and why

1. **React Router** (M3P3.2), not the hand-rolled switch `App.tsx` carried since M0. Part 4's page
   lives at a URL with `?goal=` and `?known=`, so back, forward, refresh and a pasted link all
   have to behave; that is the library's problem rather than ours, at the moment the app grows
   from two pages to five. *Rejected:* TanStack Router (heavier, a second TanStack dependency).
2. **`/` is the product** (M3P3.2). The health page moved to `/health`, which the stack check now
   covers. *Rejected:* Start at `/start` (every link would carry the detour forever).
3. **The page's state lives in the URL** — `?q=` for the words, `?goal=` for each target. The back
   button steps through the stages, a refresh keeps them, a half-finished search is a link, and
   part 4 inherits the vocabulary `/api/routes` already speaks. It also gives the bar's search
   somewhere to go, which is L10 without a second page.
4. **All three of the board's stages** (M3P3.1), including the preview. It is the page's whole
   argument: the thing that makes someone commit is seeing what they are committing to.
5. **Four things the board draws are omitted, not faked**: the *not written yet* stop (M7), the
   placement offer (L2), *Explore existing tracks* (L12) and the account menu (M4). The spec's
   table is the record.
6. **The API's words, not ours.** `getJson` carries a 4xx/5xx body's `detail` out to the page, so
   *The index has not been built yet.* is printed exactly once in the codebase — by the API.

**Where the build departed from the plan:**

- **A bug in the type generator, found by needing a title.** `scripts/generate-api-types.ts`
  stripped every key named `title`, because Pydantic puts that keyword on every property — but
  inside `properties` it is the *name of a field*. `NodeOut`, `NeighbourOut`, `StopOut` and
  `ResultOut` have been generated without their titles since M1, and nothing noticed because no
  page had read one. Fixed, with a test that builds a schema holding a property called `title`.
- **Node 24 was not on this machine's PATH.** `/usr/bin/node-24` existed but
  `~/.local/node24/bin` — the directory CLAUDE.md's setup creates — did not, so `npm install`
  refused on the engines field. Created it as documented.
- **Adding search to the bar broke two unrelated test files.** `Link` and `useNavigate` need a
  router, so every page test that draws the bar needs one around it. The health and specimen tests
  now wrap in `MemoryRouter`.
- **A commit message claimed checks I had only grepped.** `npm run test | grep "Tests "` exits on
  grep's status, so a failing suite read as a pass and the chain continued. Ten tests were red at
  that commit; the next one fixed them and says so.
- Candidate buttons needed an explicit `aria-label` (*Choose Salmon*): their text also matched the
  example chip *Salmon*, so the test could not tell them apart — and neither could a screen
  reader.
- **CI's web job was red on the first push, for accessibility rules `biome check --write` does not
  fix**: `role="search"` on a form where `<search>` exists, `aria-hidden` on a focusable `<kbd>`,
  and an export from a test file. The grep-swallowed exit code hid them locally a second time;
  the checks below are now run for their status, not their output.

## What is next

1. **The operator looks** at `http://127.0.0.1:8090/` beside `.design/Start.dc.html`. The part
   does not close before that, and what they say goes in this entry.
2. **M3 part 4, the Route page**: the metro map, the selected-stop panel, the side-doors toggle,
   `known` from the URL — and the Route board redrawn from 13 stops to 17.
3. **`providers.yaml` in `comeni-code-content`** — still waiting on the operator.

## Open questions

- **What the no-match state should offer.** It names the word; whether it also offers *learn this
  as a goal* or a request (M7) is undecided.
- **Whether the preview should show each stop's level**, as the Route page will. The board does
  not, and the list is long enough without it.
- **Whether `/` should remember the last search** across visits. Nothing stores anything today,
  which suits M3's no-learner-state rule.

## Traps

- **Any page test that draws the top bar needs a router around it**, or it fails on `useNavigate`.
- **`title` was missing from the generated types.** If another property name collides with a JSON
  Schema keyword, the same bug shape returns; the generator only special-cases `properties`.
- **The web app needs Node 24** — `~/.local/node24/bin` on `PATH`, as CLAUDE.md sets it up.
  `npm install` refuses under Node 22 while `npm run test` happily runs.
- **`npm run test | grep` hides a failing suite.** Read the run's exit code, not its output.
- **The page prints the API's `detail` sentence.** Changing the wording of a 404 or 503 in
  `apps/api` changes what a learner reads.
