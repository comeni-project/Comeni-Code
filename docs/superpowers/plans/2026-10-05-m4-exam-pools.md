# M4.2 — Exam pools in the format: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task by task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A node may carry an exam pool in `exam.yaml`. It is validated with the rules try questions
already follow (plus its own), it can warn as well as refuse, it is written back byte for byte, and
the index stores it. Then the content repository's pinned validator moves to this format.

**Architecture:** An `Answer` sum type composed into `TryQuestion` and `ExamQuestion`, with one
shared reader in `code_schema.questions`. A new `code_schema.exam` for the pool's own rules. Severity
read from the diagnostic registry, so `Content.errors` is what refuses. A new `ExamQuestion` model,
filled by `rebuild_index`.

**Tech stack:** Python 3.14, Django + Ninja, pytest, mypy strict, ruff. The web app is untouched.

**Spec:** `docs/superpowers/specs/2026-10-05-m4-exam-pools-design.md` (M4E.1–M4E.8), issue #120.

## Global constraints

- **Try questions' messages, codes, lines and order do not change.** The schema tests pin them and
  pass unedited, except where Task 1 changes the type they read (`.options` becomes
  `.answer.options`); say so in the commit when a test is edited.
- **Errors still refuse everything** they refused before. Only codes with `refuses: false` warn.
- **The API does not change**: `openapi.json` is byte for byte the same.
- Pure packages import no Django (the purity guards). No new import in `code_schema` without a
  purity allowlist change, which is a reviewed decision: none is expected.
- Tests use `tests/fixtures/` or `tmp_path`, never the real content repository.
- Test runs need the audit stack:
  `CODE_DATABASE_URL=postgresql://code:code@localhost:5434/code CODE_REDIS_URL=redis://localhost:6381/0`.
  After a reboot, `docker start code-audit-postgres-1 code-audit-redis-1`.
- Every new code goes in `diagnostics.yml` with a test naming it, and the reference is regenerated:
  `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.
- Never pipe a check into `tail` or `grep` and trust its exit status.

## Review focus

- Task 1 is a pure refactor: the diff should touch types and call sites, never a message.
- Task 3 changes what "a problem" means to five callers. Each must look at errors, and each
  must have a test that a warning alone does not refuse.
- The fresh-reviewer checkpoint is after Task 3; the final review is over the whole branch.

## Before Task 1

- [x] Branch `feat/m4-2-exam-pools` from `main` (after #140 and this spec's pull request merge).
- [x] Sub-issues of #120, one per task: `M4.2.1 — answers composed into questions`,
  `M4.2.2 — the exam pool and its errors`, `M4.2.3 — warnings`, `M4.2.4 — the writer and the
  fixture`, `M4.2.5 — the index`, `M4.2.6 — docs and close`, `M4.2.7 — the content repository's pin`.
- [x] Rewrite #120's body: its *done when* becomes the spec's M4E.8 list, and it links the spec.

---

### Task 1: An answer composed into a try question (M4E.2)

**Files:**
- Modify: `code_schema/questions.py`, `node.py`, `writer.py`, `__init__.py`;
  `apps/api/src/code_api/content/index.py`.
- Tests: `tests/schema/test_questions.py`, `test_writer.py`, `test_fixtures.py`,
  `test_public_api.py`.

**Interfaces:**
- Produces:
  - `ChoiceAnswer(options)`, `NumberAnswer(value, unit="", tolerance=None)`,
    `Answer = ChoiceAnswer | NumberAnswer`;
  - `TryQuestion(id, ask, answer, hints, rationale)` with a `kind` property read from `answer`;
  - `Option(text, right=False, misconception="")`;
  - `Node.questions: tuple[TryQuestion, ...]`.
- Removes: `ChoiceQuestion`, `NumberQuestion`, `Question` from `code_schema` and its `__all__`.

- [x] **Step 1: Write the failing tests.**
  - A parsed choice question is a `TryQuestion` whose `answer` is a `ChoiceAnswer`, and
    `.kind == "choice"`; a number one has a `NumberAnswer` with `value`, `unit` and `tolerance`.
  - `code_schema.__all__` exports `Answer`, `ChoiceAnswer`, `NumberAnswer`, `TryQuestion`, and no
    longer the three old names.
- [x] **Step 2: Run** `uv run pytest tests/schema/test_questions.py tests/schema/test_public_api.py`.
  Expected: fails on the imports.
- [x] **Step 3: Implement.**
  - Split the reading of an answer out of `parse_questions` into `read_answer(entry, name, kind,
    field) -> Answer | None`, keeping every rule, code and message in its current order.
  - `_gives_the_answer` matches on the answer.
  - The writer and the index `match` on `question.answer`.
  - Old asserts that read `.options`, `.unit` or `.tolerance` on a question read them on `.answer`.
- [x] **Step 4: Run** `uv run pytest tests/schema apps/api/tests` and `uv run mypy`. Expected: all
  pass; the message-pinning tests unedited.
- [x] **Step 5: Commit** `refactor(schema): an answer composed into a try question — M4.2.1`.

### Task 2: The exam pool and its errors (M4E.1, M4E.3)

**Files:**
- Create: `code_schema/exam.py`; `tests/schema/test_exam.py`.
- Modify: `questions.py` (the shared reader takes the pool's keys and option keys), `node.py`
  (`Node.exam`, `read_node` reads `exam.yaml`), `content.py` (CS0706), `__init__.py`,
  `diagnostics.yml` (band `CS0800–CS0899 · exam`, codes CS0801–CS0812, CS0706),
  `docs/reference/diagnostics.md` (regenerated).

**Interfaces:**
- Produces:
  - `EXAM_FILE = "exam.yaml"`, `MAX_EXAM = 40`;
  - `ExamQuestion(id, ask, answer, level, rationale)` with `kind`;
  - `parse_exam(text, *, file, node: Node | None) -> tuple[tuple[ExamQuestion, ...], list[Problem]]`:
    the pool's own rules always; CS0809 and CS0811 only when `node` is given;
  - `Node.exam: tuple[ExamQuestion, ...] = ()`, filled by `read_node` with `dataclasses.replace`.
- Consumes: `read_answer`, the shared id/ask/rationale checks, `Entry`, `Field`.

- [x] **Step 1: Write the failing tests**, one per code, each building `exam.yaml` (and when needed
  `node.yaml`/`body.md`) in `tmp_path` and asserting the exact line `str(problem)` gives:
  - a sound pool of 4 (choice with a `misconception`, number, one with `level`) parses to four
    `ExamQuestion`s in order, `level` `None` where absent;
  - CS0801 a list at the top; CS0802 a key `pool:`; CS0803 `exam: 3`; CS0804 `exam: []`;
    CS0805 an entry `- 3`; CS0806 a key `hint:`; **CS0807 `hints: [...]`**; CS0808 an option key
    `why:`; CS0809 a misconception naming no callout; CS0810 a misconception on the right option;
    CS0811 an id a try question uses; CS0812 41 questions;
  - shared rules reach exam questions: three right options gives CS0329 at its line in `exam.yaml`;
  - the try reader refuses `level` and `misconception` with its existing unknown-key codes;
  - CS0706: `exam.yml` beside `node.yaml` is reported "is not read — did you mean exam.yaml?";
  - a node with no `exam.yaml` has `exam == ()` and no problem.
- [x] **Step 2: Run** `uv run pytest tests/schema/test_exam.py`. Expected: fails, no module
  `code_schema.exam`.
- [x] **Step 3: Write the codes** in `diagnostics.yml` (says, refuses: true, fix, explanation), then
  `exam.py` and the changes to `questions.py`, `node.py` and `content.py`.
- [x] **Step 4: Run** `uv run pytest tests/schema`, `uv run mypy`, `uv run ruff check .`, and
  regenerate the reference. Expected: all pass; `test_diagnostics` sees every new code named by a
  test.
- [x] **Step 5: Commit** `feat(schema): exam pools in exam.yaml, and what they refuse — M4.2.2`.

### Task 3: Warnings (M4E.4)

**Files:**
- Modify: `code_schema/problems.py` (`refuses`), `content.py` (`Content.errors`), `node.py`
  (`parse_node` and `read_node` keep a node whose problems are all warnings), `cli.py` (exit code,
  summary, `::warning`), `exam.py` (CS0813, CS0814), `diagnostics.yml`;
  `packages/code-weaver/src/code_weaver/cli.py`; `apps/api/src/code_api/content/index.py`.
- Tests: `tests/schema/test_exam.py`, `test_cli.py`, `test_content.py`;
  `tests/weaver/` (the CLI test file); `apps/api/tests/test_content_index.py`.

**Interfaces:**
- Produces: `Problem.refuses: bool` (property, from `diagnostic(code).refuses`);
  `Content.errors: tuple[Problem, ...]`.

- [x] **Step 1: Write the failing tests.**
  - CS0813: a pool of 3 gives one problem with `refuses is False`; the node is in `content.nodes`.
  - CS0814: an `advanced` question on an `introductory` node warns; `intermediate` does not.
  - `validate` on a root whose only problem is CS0813 prints it and exits 0; its summary counts it as
    a warning; `--format github` prints `::warning file=…,line=…,title=CS0813::…`.
  - `rebuild_index` on that root applies, with `problems == []`, and stores the node.
  - `code-weaver route` on that root does not refuse.
  - An error beside the warning still refuses all three, as before.
- [x] **Step 2: Run them.** Expected: they fail. **Watch each refusal test fail against the old
  "any problem" check** before trusting it (house rule for guards).
- [x] **Step 3: Implement**, changing every `if problems` / `if content.problems` that means
  "refuse" to errors only. Leave the cascade checks inside `parse_node` that compare one parser's
  own problems alone unless a warning can reach them (only exam problems can).
- [x] **Step 4: Run** `uv run pytest`, `uv run mypy`, `uv run ruff check .`, regenerate the
  reference. Expected: all pass; the existing refusal tests unedited.
- [x] **Step 5: Commit** `feat(schema): warnings that never refuse; a small pool warns — M4.2.3`.
- [x] **Checkpoint:** a fresh reviewer over Tasks 1–3 against the spec. Fix what it finds
  (mechanical ones get an issue first) before Task 4.

### Task 4: The writer and the fixture (M4E.8)

**Files:**
- Create: `tests/fixtures/salmon/transcriptomics/tpm/exam.yaml`.
- Modify: `code_schema/writer.py` (`write_exam_yaml`, `write_node_folder`).
- Tests: `tests/schema/test_writer.py`, `test_fixtures.py`.

**Interfaces:**
- Produces: `write_exam_yaml(node) -> str` (field order `id, kind, ask, level, options | answer,
  unit, tolerance, rationale`; an option `text, right, misconception`; nothing empty written).

- [x] **Step 1: Write the failing tests.**
  - Every fixture node folder round-trips byte for byte, `exam.yaml` included.
  - `write_node_folder` writes `exam.yaml` for a node with a pool, and removes a stale one for a node
    without.
  - The TPM fixture has 4 exam questions, one naming `TPM is not a count of reads`, one with
    `level: foundations`; `read_content(tests/fixtures/salmon).problems == ()`.
- [x] **Step 2: Run them.** Expected: they fail (no fixture, no writer).
- [x] **Step 3: Write the fixture** in the writer's canonical form, from the TPM node's own claim
  and body (the spec's M4E.1 example is two of the four), then the writer.
- [x] **Step 4: Run** `uv run pytest tests/schema tests/weaver` and
  `uv run code-schema validate tests/fixtures/salmon`. Expected: pass, exit 0, no warnings.
- [x] **Step 5: Commit** `feat(schema): write exam.yaml back; TPM's exam pool — M4.2.4`.

### Task 5: The index (M4E.5)

**Files:**
- Create: migration `0006_exam_question.py`.
- Modify: `apps/api/src/code_api/content/models.py`, `index.py`.
- Tests: `apps/api/tests/test_content_index.py`, `test_migrations.py`,
  `test_openapi_and_docs.py` (unchanged; it proves the schema did not move).

- [x] **Step 1: Write the failing tests.**
  - After a rebuild from the fixtures, TPM has 4 `ExamQuestion` rows in order, equal field by field
    to what `code_schema` parsed, `level` null where absent, `misconception` in `options`.
  - A refused build leaves the previous exam rows standing and writes none.
  - Editing the fixture copy's `exam.yaml` in `tmp_path` changes the digest.
- [x] **Step 2: Run them.** Expected: fail, no model.
- [x] **Step 3: Implement** the model, `makemigrations content`, and `_exam_rows` in the rebuild's
  transaction (deleted and created beside `Question`).
- [x] **Step 4: Run** `uv run pytest apps/api/tests`, `manage.py makemigrations --check --dry-run`,
  and `export_openapi_schema … --output apps/api/openapi.json` then `git diff --exit-code
  apps/api/openapi.json`. Expected: pass; no diff.
- [x] **Step 5: Commit** `feat(api): the index stores exam pools — M4.2.5`.

### Task 6: Docs, checks and the pull request

- [x] The tutor spec's T7.1 gets one line pointing at this part's spec (pool size, answers not
  secret). `CLAUDE.md`'s layout names `exam.yaml` beside `node.yaml` and `body.md`.
- [x] Rebuild the audit index from the fixtures and run `ops/stack-check.sh`-style reads by hand:
  `/api/nodes/tpm` is unchanged.
- [x] Every CI command in `CLAUDE.md` passes locally (Python; the web checks only to show they are
  untouched).
- [x] A fresh reviewer over the whole branch; deferred minors go in one `deferred` issue.
- [x] The journal entry for M4.2 (what changed, decisions, what is next), the plan ticked.
- [ ] Push, open the pull request (closing #120's sub-issues 1–6), wait for checks with
  `gh pr checks --watch > log; rc=$?`. Merge only on the operator's yes.

### Task 7: The content repository's pin (M4E.8)

Runs after Task 6's pull request merges, since the pin is that merge commit.

- [ ] Clone `comeni-project/comeni-code-content` into the scratchpad; branch `ci/pin-m4-2`.
- [ ] Rewrite each `{% try <id> %}` marker to `:::{try} <id>` then `:::`, by a scratchpad script
  (not committed), and move the SHA in `.github/workflows/validate.yml` to M4.2's merge commit.
- [ ] Run `uv run code-schema validate <clone>` from this repository at that commit. Expected: exit 0.
- [ ] **Show the operator the diff before opening the pull request.** Then open it, wait for its
  checks, and merge only on the operator's yes.
- [ ] Close the M4.2.7 sub-issue and #120 citing both pull requests.
