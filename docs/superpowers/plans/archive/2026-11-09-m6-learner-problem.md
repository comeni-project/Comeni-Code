# M6.8a — The learner's problem: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a node's problem drawn on its page, with a dataset of the learner's own and one answer
checked by the server, and drawn without either in Studio's preview.

**Architecture:** one API module, `code_api/content/problems.py`, turns a stored problem into what
a page shows, its `version`, a seed's dataset and a verdict, over `code_problems`' kits. Two
learner routes beside `GET /api/nodes/{id}`. On the web, `node/Problem.tsx` draws the problem from
a prop, and its live part (Download, the answer) only when the node page passes `{node, version}`.

**Tech Stack:** Django Ninja, pytest (Postgres from Compose), React 19 + TypeScript 7, vitest,
Biome.

**Spec:** `docs/superpowers/specs/2026-11-09-m6-learner-problem-design.md` (M6LP.1–M6LP.8).
Issue #423.

## Global Constraints

- The seed: decimal digits, `^[0-9]{1,20}$`, below 2⁶⁴, sent as a string; `localStorage` key
  `comeni.problem-seed`.
- `version`: the first 12 hex digits of SHA-256 over the problem's text and the kit's seed-0
  dataset and answer.
- An answer: at most 1,000,000 bytes (UTF-8), in the browser and on the server.
- A sample's cost: at most 2,000 bytes (CS1102, path `sample.params`).
- Codes: CA0009 no problem (404) · CA0010 version changed (409) · CA0011 bad seed (422) · CA0012
  answer over 1 MB (422).
- Never sent: the answer, `params`, mistakes' names, the file's text (learner), the rationale
  unless right.
- Rung words: 1 `read it off the file` · 2 `one command` · 3 `a few lines of code` · 4 `it has to
  be efficient`.
- Pure packages stay pure: `hashlib` lives in the API only.
- After an API change: `export_openapi_schema … --output apps/api/openapi.json`, then `npm run
  api-types` in `apps/web`.

## Review Focus

1. **An answer with CRLF, a trailing newline, a BOM or blank lines**, pasted from Windows: accepted
   as the kit reads it (Task 3 test with `\r\n` and `﻿`).
2. **A garbage answer** (binary, one huge line, `²`): a sentence, never a 500 (Task 3, both kits).
3. **Storage blocked**: the page still draws a dataset and takes an answer (Task 4 test with
   `localStorage` throwing).
4. **Two clicks on Submit**: one request in flight, the button disabled (Task 5 test).
5. **A node with no problem**: no panel, no request (Task 5 test), and `problem: null` (Task 2).

---

### Task 1: The sample's size limit

**Files:**
- Modify: `packages/code-problems/src/code_problems/self_test.py` (the cost loop)
- Test: `tests/problems/test_self_test.py`

**Interfaces:** Produces `SAMPLE_BYTES = 2_000` in `self_test.py`.

- [ ] **Step 1: Failing test** `test_a_sample_over_two_thousand_bytes_is_cs1102`: de-bruijn-edges,
  sample params `{k: 3, genome: 400, read: 40, coverage: 10, errors: 0}` (cost > 2,000, under
  `max_bytes`); assert one finding `("CS1102", "sample.params")`, its message naming `2,000`.
  And `test_the_fixtures_sample_fits`: the de Bruijn fixture's sample costs ≤ 2,000.
- [ ] **Step 2: Run** `uv run pytest tests/problems/test_self_test.py -q` → the first FAILS.
- [ ] **Step 3: Implement**: in the cost loop, the sample's limit is `min(kit.max_bytes,
  SAMPLE_BYTES)`; the message *asks for {n:,} bytes; a sample is drawn on the page, so at most
  2,000*.
- [ ] **Step 4: Run** the file and `uv run pytest tests/schema -q -k problem` → PASS.
- [ ] **Step 5: Commit** `feat(problems): a sample is at most 2,000 bytes (#423)`.

### Task 2: The problem in the node's API, and in Studio's draft

**Files:**
- Create: `apps/api/src/code_api/content/problems.py`
- Modify: `apps/api/src/code_api/content/schemas.py`, `content/reads.py` (`node()`, `_block`),
  `studio/schemas.py` (`NodeProblemOut`, `problem_out`)
- Test: `apps/api/tests/test_learner_problem.py` (new), `apps/api/tests/test_nodes_api.py`
  (the query count stays 7), `apps/api/tests/test_problem_api.py`

**Interfaces:**
- Produces in `content/schemas.py`:
  `ProblemShownOut(title: str, rung: int, statement: str, given: str, returns: str, sample_dataset: str, sample_output: str, hints: list[str], callouts: list[str], kit: str, size: int)`;
  `LearnerProblemOut(ProblemShownOut)` adds `version: str`; `NodeOut.problem: LearnerProblemOut | None = None`.
- Produces in `studio/schemas.py`: `NodeProblemOut(ProblemShownOut)` adds `text: str`.
- Produces in `content/problems.py`:
  `shown(problem: ProblemFile) -> dict[str, object]` (the `ProblemShownOut` fields; `callouts`
  = the file's mapped titles in the order of `kit.mistakes`, each once; `size` = `kit.cost(params)`),
  `version(problem: ProblemFile) -> str` (memoised per text in a module dict),
  `stored(row: NodeProblem) -> ProblemFile` (`stored_problem(row.text, row.sample_dataset, row.sample_output)`).

- [ ] **Step 1: Failing tests** in `test_learner_problem.py` (index rebuilt from the fixtures):
  `test_the_de_bruijn_page_sends_its_problem`: `problem.title == "Construct a de Bruijn graph"`,
  `rung == 3`, `hints` the file's two, `callouts == ["Every edge appears once"]`, `size == 2482`,
  `len(version) == 12` and hex; no key `text`, `params`, `mistakes`, `rationale`, `answer`.
  `test_the_block_is_in_its_place`: `{"kind": "problem"}` at the index the fixture's body has it.
  `test_a_node_without_a_problem_sends_null`. `test_version_follows_the_kit`: monkeypatch the
  kit's `generate` in `code_problems.registry.KITS` (a kit with another seed-0 dataset), clear the
  memo, and the version differs. In `test_problem_api.py`: a draft's `node.problem` has the shown
  fields and `text`, no `version`.
- [ ] **Step 2: Run** `uv run pytest apps/api/tests/test_learner_problem.py -q` → FAIL.
- [ ] **Step 3: Implement**: the schemas; `problems.py` (SHA-256 of `text + "\0" + dataset0.text + "\0" + answer0`, seed 0, the problem's params); `reads.node` selects `problem` with `region` (still 7 queries) and stops filtering the block; `_block` returns `ProblemBlockOut(kind="problem")`; `problem_out` from `shown()`.
- [ ] **Step 4: Run** the three test files → PASS; then `export_openapi_schema` (Global Constraints) and `cd apps/web && npm run api-types && npm run typecheck`.
- [ ] **Step 5: Commit** `feat(api): the node's problem sent to its page, and shown in a draft (#423)`.

### Task 3: The dataset and the answer

**Files:**
- Modify: `apps/api/src/code_api/content/problems.py`, `content/api.py`, `content/schemas.py`,
  `packages/code-schema/src/code_schema/diagnostics.yml`, `docs/reference/diagnostics.md`
  (regenerated)
- Test: `apps/api/tests/test_learner_problem.py`

**Interfaces:**
- Produces in `problems.py`: `seed_of(text: str) -> int | None` (None unless the global regex and
  < 2⁶⁴); `dataset(problem: ProblemFile, seed: int) -> Dataset`;
  `verdict(problem: ProblemFile, seed: int, given: str) -> AnswerOut`.
- Produces in `schemas.py`: `AnswerIn(seed: str, version: str, answer: str)`,
  `AnswerOut(right: bool, said: str, callouts: list[str], rationale: str | None)`.
- Routes (before `/{node_id}/images/{file}` is irrelevant: distinct paths):
  `GET /{node_id}/problem/dataset?seed=&version=` → `HttpResponse` text/plain;
  `POST /{node_id}/problem/answer` → `AnswerOut`. Checks in this order: CA0001/CA0002, CA0009,
  CA0011, CA0012 (answer only), CA0010.

- [ ] **Step 1: Failing tests**:
  `test_one_seed_one_file` (two GETs, same bytes; `Content-Disposition` names
  `de-bruijn-edges-42.txt`; `Cache-Control: private, max-age=86400`);
  `test_two_seeds_two_files`;
  `test_the_solvers_answer_is_right` (solve the downloaded file with `KITS[...].solve`; `right`,
  `rationale` the file's, `callouts == []`), also with `\r\n` line ends and a leading `﻿`;
  `test_a_duplicated_edge_names_its_callout` (`callouts == ["Every edge appears once"]`,
  `rationale is None`, the answer's text in no response body);
  `test_a_missing_edge_gives_the_sentence_alone`;
  `test_garbage_is_a_sentence` (for both kits: `b"\x00\xff"` decoded, `"12²"`, one 900 KB line →
  200, `right` false);
  `test_errors` parametrised: no node CA0002, no problem CA0009, seed `"-1"`, `"1e3"`,
  `str(2**64)` CA0011, answer of 1,000,001 bytes CA0012, `version="000000000000"` CA0010 on both
  routes; a POST with no CSRF token is not 403.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the routes over `problems.py`; the four codes in `diagnostics.yml`
  (`emitted_by: api`, `concern: index`, `refuses: true`, each with `fix` and `explanation` citing
  M6LP); `uv run code-schema diagnostics --write docs/reference/diagnostics.md`. `verdict` drops
  one leading `\ufeff` before the kit's `check` (`str.strip` keeps it). A kit raising in
  `verdict` is not caught (500, logged by Django).
- [ ] **Step 4: Run** the file, `tests/schema -k diagnostic`, and `ruff`, `mypy` → PASS; regenerate
  `openapi.json` and `schema.ts`.
- [ ] **Step 5: Commit** `feat(api): a learner's dataset and answer, checked by the kit (#423)`.

### Task 4: The seed and the two calls, on the web

**Files:**
- Create: `apps/web/src/api/problem.ts`, `apps/web/src/api/problem.test.ts`
- Modify: `apps/web/src/api/client.ts` (`getText`)

**Interfaces:**
- `getText(url: string): Promise<string>` in `client.ts`: the body as text; a status outside 2xx
  rejects as `getJson` does (the API's sentence, its status).
- In `problem.ts`: `browserSeed(): string` (the stored seed, or a new one from
  `crypto.getRandomValues(new BigUint64Array(1))` written back; storage throwing → one seed per
  page load, kept in a module variable); `datasetUrl(node: string, seed: string, version: string): string`;
  `fetchDataset(node, seed, version): Promise<string>`;
  `sendAnswer(node: string, body: AnswerIn): Promise<AnswerOut>` (`sendJson("POST", …)`);
  `ANSWER_BYTES = 1_000_000`; `tooLong(text: string): boolean` (UTF-8 bytes, `TextEncoder`).

- [ ] **Step 1: Failing tests**: the seed is kept and reused; matches `^[0-9]{1,20}$`; with
  `localStorage.getItem` and `setItem` throwing, two calls give one seed; `datasetUrl` encodes its
  query; `fetchDataset` rejects with the API's `detail` on 409; `tooLong("é".repeat(500_001))` is
  true.
- [ ] **Step 2: Run** `npm test -- problem` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; `npm run lint && npm run typecheck`.
- [ ] **Step 5: Commit** `feat(web): a seed per browser and the problem's two calls (#423)`.

### Task 5: The problem on the page

**Files:**
- Create: `apps/web/src/node/Problem.tsx`, `apps/web/src/node/Problem.test.tsx`
- Modify: `apps/web/src/node/Body.tsx`, `node/NodePage.tsx`, `studio/workbench/PreviewPanel.tsx`,
  `node/body.ts` (its comment lists the kinds)

**Interfaces:**
- `Problem({ problem, live }: { problem: ProblemShownOut; live?: { node: string; version: string } })`.
- `Body` gains `problem?: { shown: ProblemShownOut; live?: { node: string; version: string } }`;
  the `problem` block draws `<Problem>` when given, else nothing. `NodePage` passes
  `{shown: node.problem, live: {node: node.id, version: node.problem.version}}`; `PreviewPanel`
  passes `{shown: node.problem}` (no `live`).

Drawn as the `NodeProblem` board (M6LP.5): `role="region"` named by the title; *Proves this node*;
the rung tag; the statement through `Prose` (formulas as text blocks); Given and Return as text;
the sample's two `<pre>` boxes (`overflow-x-auto`); hints one at a time (*Show a hint (n)*, *Show
the next hint*); *Your dataset*: the file name `<kit>-<seed>.txt`, *about {size} KB* (one
decimal, `toLocaleString("en")`), *made for this browser, so its answer is yours alone*, Download
(fetch, `URL.createObjectURL`, an `<a download>` clicked, revoked); *Your answer*: a labelled
`<textarea>`, *Choose a file* (`<input type="file">` read by `file.text()`), *Only your answer is
sent. Your code stays on your computer.*, Submit (disabled while sending). The verdict
`aria-live="polite"`: *Not yet* + `said` + each callout found among the page's blocks by title
(kind tag, title, Markdown) with *Read it in the page ↑* scrolling to it, + *Your dataset stays
the same: fix your answer and send it again.*; *Right* + *Why:* rationale. A 409 (Download or
Submit): the CA0010 sentence of M6LP.5, and `queryClient.invalidateQueries({ queryKey:
queryKeys.node(id) })`. Without `live`: the dashed note *Each learner downloads their own here:
about {size} KB at these params. Studio shows the sample only.* and no answer area.

- [ ] **Step 1: Failing tests** (`renderAt` / `test-kit.tsx` answering by method and path):
  the four states from the board (ready; wrong with the fixture's callout quoted and its link;
  wrong with the sentence alone; right with the rationale); rung 1 and 4 words; a file chosen is
  read into the area; a 1,000,001-byte answer is refused with no request; Submit twice → one POST;
  a 409 on Submit and on Download shows the sentence and refetches the node; without `live` no
  Download and no textarea; a node with `problem: null` and no block → no panel, no request; the
  answer area's text never appears in a verdict.
- [ ] **Step 2: Run** `npm test -- Problem` → FAIL.
- [ ] **Step 3: Implement**, Tailwind tokens only (no colour of its own beyond the try's wrong and
  right tones), a stacked layout under `sm:`.
- [ ] **Step 4: Run** the whole web suite, `lint`, `typecheck`, `build` → PASS.
- [ ] **Step 5: Commit** `feat(web): the problem on the node page, and in Studio's preview (#423)`.

### Task 6: Walk, check, journal

- [ ] **Step 1:** CI's commands with CI's `env:` (CLAUDE.md), the whole Python and web suites.
- [ ] **Step 2:** Compose `--build`, the index rebuilt from a fixture copy; walk M6LP.8 in headless
  Chrome at 1440 light and dark and 390: the four states (a right answer made by solving the
  downloaded file with the kit), the 409 after editing the copy's problem and rebuilding, a
  draft's preview. Compare with the `NodeProblem` board.
- [ ] **Step 3:** A journal entry: what was walked, the calls made, what is next (M6.8b).
- [ ] **Step 4: Commit** `docs(journal): M6.8a (#423)`.
