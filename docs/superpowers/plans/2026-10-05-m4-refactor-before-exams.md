# M4.1.3 — Refactor before exam pools: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the copied mechanics out of the schema parsers, the content views and the web
pages, so that M4.2's exam pools and M4.4's drafts build on one shape each. Fix #137 and three
#134 minors on the way.

**Architecture:** A record reader in `code_schema.records`. A question union. A node's blocks
derived from its body, and a block codec in `code_schema.blocks`. A read module and a schemas
module for the content views. Query hooks, URL helpers and one error sentence in the web app.

**Tech stack:** Python 3.14, Django + Ninja, pytest, mypy strict. React 19, TanStack Query, vitest
and Biome on Node 24 (through `web.sh` in the scratchpad: this machine's Node is 22).

**Spec:** `docs/superpowers/specs/2026-10-05-m4-refactor-before-exams-design.md`, issue #138.

## Global constraints

- Messages, codes, lines and the order of problems from `code-schema` do not change. The schema
  tests pin them and must pass unedited, except where M4R.2 changes the type they read.
- The API's responses do not change, except `CalloutBlockOut.callout`, which narrows to a `Literal`.
  `openapi.json` and `schema.ts` are regenerated.
- Pages read exactly as before. The web tests that pin sentences pass unedited.
- Pure packages import no Django (the purity guards).
- Test runs need `CODE_DATABASE_URL=postgresql://code:code@localhost:5434/code` and
  `CODE_REDIS_URL=redis://localhost:6381/0` (the audit stack).

## Review focus

1. A parser that reorders its problems: two problems on one line keep their old order.
2. An index built before 0005 that is read after it: the `body` column is gone and nothing reads it.
3. A stored block kind the API does not know: it raises, it is not drawn as a callout.
4. Start → Route with the same goals: the preview is reused only when nothing is known (#137).
5. Health behind nginx while the API is down: a 502 with an HTML body still says `HTTP 502`.

---

### Task 1: The record reader, and the three parsers on it (M4R.1)

**Files:**
- Create: `packages/code-schema/src/code_schema/records.py`, `tests/schema/test_records.py`.
- Modify: `links.py`, `resources.py` and `questions.py` in `packages/code-schema/src/code_schema/`.

**Interfaces:**
- Produces:
  - `entries(value, *, problem, not_a_list: tuple[str, str], not_a_mapping: tuple[str, Callable[[object], str]]) -> Iterator[dict]`. `problem` is the field's reporter.
  - `class Entry(mapping, *, lines, report, fallback_line)` with:
    - `.line` (the first key's line, else the fallback);
    - `.at(key)`;
    - `.sound`;
    - `.problem(code, message, *, key=None, line=None)`;
    - `.unknown(allowed, code, says)`;
    - `.require(key, code, message) -> bool`;
    - `.check(key, check, says="{}") -> bool`.
  - `Reporter = Callable[[str, str, int | None], None]` (code, message, line).

- [ ] **Step 1: Write the failing tests.** In `test_records.py`, test:
  - `entries` reports a value that is not a list, the empty list (CS0019) and an entry that is not
    a mapping, and yields the mappings;
  - `Entry.unknown` reports each key not allowed, at that key's line, in the entry's order;
  - `Entry.require` reports a missing key at the entry's first line;
  - `Entry.check` words a check's message through `says` and reports it at the key's line;
  - each of these marks the entry unsound.
- [ ] **Step 2: Run** `uv run pytest tests/schema/test_records.py`. Expected: fails, no module
  `code_schema.records`.
- [ ] **Step 3: Write `records.py`** to pass.
- [ ] **Step 4: Port the three parsers** to `entries` and `Entry`. Keep each rule's order and
  wording, and delete `_Problem` and the per-file closures.
- [ ] **Step 5: Run** `uv run pytest tests/schema` and `uv run mypy`. Expected: all pass, with the
  parser tests unedited.
- [ ] **Step 6: Commit** `refactor(schema): one record reader for nested entries — M4.1.3`.

### Task 2: A question is a choice or a number; a node's blocks come from its body (M4R.2, M4R.3)

**Files:**
- Modify: `questions.py`, `node.py`, `writer.py` and `__init__.py` in `code_schema`;
  `apps/api/src/code_api/content/index.py`.
- Tests: `tests/schema/test_questions.py`, `test_node.py` and `test_writer.py`.

**Interfaces:**
- Produces:
  - `ChoiceQuestion(id, ask, hints, rationale, options)` and `NumberQuestion(id, ask, hints,
    rationale, answer, unit="", tolerance=None)`, each with `kind: ClassVar[str]`;
  - `Question = ChoiceQuestion | NumberQuestion`;
  - `Node.blocks`, a `cached_property` over `parse_blocks(self.body)`.

- [ ] **Step 1: Write the failing tests.**
  - The parsed number question `isinstance(..., NumberQuestion)` with `.kind == "number"`. The
    choice one is a `ChoiceQuestion`.
  - `Node(..., body=":::{try} a\n:::\n")` built by hand has `blocks == (Try("a"),)`.
- [ ] **Step 2: Run them.** Expected: they fail, on the import and on `()`.
- [ ] **Step 3: Implement.**
  - Split the class, and build the right one in `parse_questions`.
  - Use `match` in the writer and the index.
  - Drop the `blocks` field and the `blocks=` argument in `parse_node`.
  - Turn the asserts in the old tests that read `.options` on a number, or `.answer` on a choice,
    into `isinstance` checks.
- [ ] **Step 4: Run** `uv run pytest tests/schema apps/api/tests/test_content_index.py` and
  `uv run mypy`. Expected: pass.
- [ ] **Step 5: Commit** `refactor(schema): a question is a choice or a number; blocks come from the body — M4.1.3`.

### Task 3: The content views read through one module (M4R.4)

**Files:**
- Create:
  - `apps/api/src/code_api/content/schemas.py` and `reads.py`;
  - migration `0005_remove_node_body.py`;
  - `tests/schema/test_blocks.py` gains the codec tests.
- Modify:
  - `api.py`, `routes.py`, `search.py`, `index.py` and `models.py` in `content`;
  - `code_schema/blocks.py`;
  - `apps/api/openapi.json` and `apps/web/src/api/schema.ts` (regenerated).
- Tests:
  - `apps/api/tests/test_nodes_api.py` (callout literal, unknown stored kind);
  - `test_migrations.py` (0005 drops `body`).

**Interfaces:**
- Produces:
  - `block_json(block) -> dict[str, str]` and `block_from_json(dict) -> Block`, the latter raising
    `ValueError` on an unknown kind;
  - `reads.node_out(id) -> NodeOut | None`, `reads.index() -> (nodes, regions, Graph)` and
    `reads.search_rows() -> dict[str, Node]`;
  - `reads.unbuilt() -> Status[Message] | None` and `reads.missing(detail) -> Status[Message]`.

- [ ] **Step 1: Write the failing tests.**
  - `block_from_json(block_json(b)) == b` for each kind, and an unknown kind raises.
  - A node row whose blocks hold `{"kind": "figure"}` makes the node endpoint raise, not answer
    200.
  - The schema's `CalloutBlockOut.callout` has the enum of the three kinds.
  - After migrating to 0005, `content_node` has no `body` column.
- [ ] **Step 2: Run them.** Expected: they fail.
- [ ] **Step 3: Implement.**
  - Move the schemas to `schemas.py` and the queries and assembly to `reads.py`.
  - Have the views call them.
  - Write the codec, and use it in the index and the API.
  - Narrow `CalloutBlockOut.callout` to the `Literal`.
  - Remove the `Node.body` field and run `makemigrations`.
  - Regenerate `openapi.json` and `schema.ts`.
- [ ] **Step 4: Run** `uv run pytest`, `uv run mypy`, `uv run ruff check .` and `ruff format --check`,
  plus `manage.py makemigrations --check --dry-run`. Expected: all pass.
- [ ] **Step 5: Commit** `refactor(api): content views read through one module; drop Node.body — M4.1.3`.

### Task 4: The web app asks the API in one way (M4R.5, #137)

**Files:**
- Create: `apps/web/src/api/queries.ts` (+ test), `apps/web/src/url.ts` (+ test, which takes
  over `withRoute`'s cases from `embed.test.ts`), and `apps/web/src/layout/ErrorNotice.tsx`.
- Modify:
  - `api/client.ts` (+ test) and `api/health.ts`;
  - `health/HealthPage.tsx`;
  - `start/StartPage.tsx`, `route/RoutePage.tsx` and `node/NodePage.tsx`;
  - `node/Body.tsx` (+ test), `node/embed.ts`, `node/Aside.tsx`, `node/FirstSteps.tsx` and
    `route/StopPanel.tsx`.

**Interfaces:**
- Produces:
  - `queryKeys.route(goals, known)` → `["route", {goals, known}]`, plus `.node(id)`,
    `.search(words)` and `.health`;
  - the hooks `useNode(id)`, `useRoute(goals, known)` and `useSearch(words)`;
  - `useRouteParams() -> {goals, known}`;
  - `withRoute(path, goals, known)`;
  - `sentenceOf(error)` and `<ErrorNotice error={…} />`;
  - `getJson(url, signal?, accept?: number[])`.

- [ ] **Step 1: Write the failing tests.**
  - `queryKeys.route(["salmon", "kallisto"], [])` differs from
    `queryKeys.route(["salmon"], ["kallisto"])`. This is #137.
  - A rendered Start page with goals *salmon* and *kallisto* does not leave its preview where the
    Route page for goal *salmon* with *kallisto* known would read it.
  - `getJson` with `accept: [503]` returns a 503's body, and an error status with an HTML body
    rejects with `HTTP <status>`.
  - `Body` with blocks text, text, text and try `2` (question id `2`) renders without React's
    duplicate-key warning.
- [ ] **Step 2: Run** `web.sh npm test`. Expected: those fail.
- [ ] **Step 3: Implement.**
  - Write `queries.ts`, `url.ts` and `ErrorNotice`.
  - Move the pages onto them.
  - Move health onto `getJson` with `ApiUnreachable`.
  - Give `Body` its prefixed keys.
- [ ] **Step 4: Run** `web.sh npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
  Expected: all pass, with the pages' sentence tests unedited.
- [ ] **Step 5: Commit** `refactor(web): one way to ask the API; fix the route cache key — M4.1.3`
  with `Fixes #137`.

### Task 5: The record

- [ ] Journal entry `docs/notes/journal/2026-10-05-m4-1-3-refactor.md`.
- [ ] `CLAUDE.md` layout line for `content/` (`reads.py` and `schemas.py`).
- [ ] Tick the three #134 boxes this part closes.
- [ ] Commit `docs: M4.1.3's journal entry`.
- [ ] Final review by a fresh reviewer over the branch, then one fix pass and the pull request.
