# M4.8d — The exam pool's builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The workbench's Exam pool tab becomes the QuestionBuilder board: a question list, one
question's editor with its stem as blocks, a preview as in a test and each question's checks.

**Architecture:** code-schema's problems learn the question they are about; the API takes a stem
as blocks (one MyST writer, code-schema's) and returns each question's checks with the checklist.
The web extracts one `AnswerEditor` for both pools, adds a learner-side `TestQuestion` the preview
draws, and builds the tab in the board's three columns, saving a question when you leave it through
the workbench's one edit path.

**Tech Stack:** Python 3.14, code-schema (pure), Django + Django Ninja, pytest; React, TypeScript 7,
TanStack Query, Tailwind, vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-10-13-m4-exam-pool-builder-design.md` (M4P.1–M4P.8).

## Global Constraints

- Branch `feat/m4-8d-exam-pool-builder` (the spec branch `docs/m4-8d-spec`, renamed, so the spec
  and the build land in one pull request); never commit to `main`.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; style `feat(…)`,
  `fix: …`, `docs: …`; one logical change per commit, the body says why.
- `packages/code-schema` stays pure: no new imports beyond its allowlist (no `itertools`,
  `functools`).
- After any API change: `uv run python apps/api/manage.py export_openapi_schema --api code_api.api.api --sorted --indent 2 --output apps/api/openapi.json`, then `npm run api-types` in `apps/web`.
- Web commands run on Node 24 through the scratchpad's `web.sh` (podman `node:24-alpine`) when the
  host's `node --version` is not 24; recreate it if the scratchpad was cleared:
  `podman run --rm -v "$PWD":/w -w /w/apps/web docker.io/library/node:24-alpine sh -c "$*"`.
- Python checks run with CI's environment before any push:
  `CODE_SECRET_KEY=ci-only-insecure-key-for-github-actions-0000000000000000 CODE_DATABASE_URL=postgresql://code:code@localhost:5433/code CODE_DEBUG=false CODE_ALLOWED_HOSTS=localhost CODE_REDIS_URL=redis://localhost:6380/0`.
- Never read a check through `tail`/`grep` alone: keep the exit code (`cmd > log; rc=$?`).
- The checks route is `GET /api/studio/drafts/{id}/checklist` (the spec says `…/checks`; it is the
  route `useDraftChecks` already asks).
- Copy on screen is the board's: *Questions*, *+ New*, *Stem*, *blocks, as on a page*, *Add to
  stem*, *Answer*, *+ Option*, *Rationale · shown only in results*, *Preview as in a test*,
  *Checks*, *Desktop*, *Phone*, *Dark*, *no hints in a test*, *A node needs at least 4 approved
  questions to be included in tests. No hints in exam questions.*
- Out of scope (M4P.1): scores, *Score*, *Draft a question with AI*, *Variants*, figure/image/math/
  table/code stem blocks, *Figure interaction*, *History*, reordering questions, #260 and #265.

## Review Focus

1. **A stem line typed with a trailing space** (a Markdown habit) is refused by CS0823; the editor
   strips spaces at the ends of a text block's lines before sending, so the author never sees that
   refusal for it (Task 9, `stemIn` test).
2. **Choosing another question while the current one's save is refused**: the selection must not
   move, and the editor keeps the typed text and shows the refusal (Task 9, "a refused save keeps
   the question selected").
3. **A new question left untouched** (pressed *+ New*, then clicked another row) sends nothing and
   disappears from the list (Task 9, "an untouched new question is dropped").
4. **Switching the answer kind and back** must not leave stale fields that the API refuses with
   CS0337 (a field of another kind): each kind switch clears the other kinds' fields (Task 5,
   "switching kind clears the other kinds' fields").
5. **Problems from a refused save carry the question id too**, and a question id appearing in both
   pools (CS0811) is about the exam question; a problem before an id is read carries none (Task 1,
   "a problem before the id carries no question").

---

## File Structure

**code-schema**
- Modify `packages/code-schema/src/code_schema/problems.py` — `Problem.question`.
- Modify `packages/code-schema/src/code_schema/records.py` — `Entry.name`; `Field.entries` stamps
  each entry's problems with it.
- Modify `packages/code-schema/src/code_schema/questions.py` — `read_head` sets `entry.name`.
- Test `tests/schema/test_records.py`, `tests/schema/test_exam.py`, `tests/schema/test_questions.py`.

**API**
- Modify `apps/api/src/code_api/studio/schemas.py` — `ProblemOut.question`, `QuestionChecksOut`,
  `ChecklistOut.questions`.
- Modify `apps/api/src/code_api/studio/api.py` — `ExamQuestionIn.stem: list[BlockIn]`; the
  checklist route returns `questions`.
- Modify `apps/api/src/code_api/studio/drafts.py` — `Rule`, `QUESTION_RULES`, `question_checks`,
  `checks` returns them.
- Test `apps/api/tests/test_draft_edits.py`, `test_draft_checks.py`, `test_review_api.py`.

**Web**
- Modify `apps/web/src/styles/renderTokens.ts` (+ regenerated `tokens.css`, `tokens.test.ts`).
- Create `apps/web/src/studio/workbench/AnswerEditor.tsx` (+ `AnswerEditor.test.tsx`) — the kind
  switch and four kinds' editors, moved out of `TryEditor.tsx`.
- Modify `TryEditor.tsx`, `BlockEditor.tsx` (the M4.8d note goes; `ended` exported), `TryEditor.test.tsx`.
- Modify `apps/web/src/node/OrderAnswer.tsx` — `onCheck` optional.
- Create `apps/web/src/node/TestQuestion.tsx` (+ test) — a question as a test asks it.
- Modify `edits.ts` (+ test) — `addExam`, `updateExam`, `deleteExam`.
- Create `apps/web/src/studio/workbench/exam.ts` (+ `exam.test.ts`) — `examIn`, `newExamQuestion`,
  `stemIn`, `testAskOf`.
- Modify `WorkbenchPage.tsx` — a tab may bring its own side panel.
- Rewrite `ExamPoolTab.tsx` (+ test) — the three columns and the list.
- Create `ExamEditor.tsx` (+ test) — one question's editor.
- Create `ExamSidePanel.tsx` (+ test) — preview and checks.
- Modify `fixtures.ts` — `examQuestion` gains kinds.

---

### Task 1: Problems know their question (code-schema)

**Files:**
- Modify: `packages/code-schema/src/code_schema/problems.py:15-35`
- Modify: `packages/code-schema/src/code_schema/records.py:44-75`
- Modify: `packages/code-schema/src/code_schema/questions.py:409-428`
- Test: `tests/schema/test_exam.py`, `tests/schema/test_questions.py`

**Interfaces:**
- Produces: `Problem.question: str | None = None` (last field, keyword default); `Entry.name:
  str | None` set by `read_head`; every problem appended to a field while one of its entries is
  read carries that entry's `name` once known.

- [ ] **Step 1: Write the failing tests** (append to `tests/schema/test_exam.py`)

```python
def problems_of(tmp_path: Path, exam: str | None, *, try_field: str = "") -> list[Problem]:
    folder = make(tmp_path, exam, try_field=try_field)
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    return problems


def test_a_problem_inside_an_exam_question_names_it(tmp_path: Path) -> None:
    pool = POOL.replace("    plain: true\n", "")  # CS0821: a wrong option names nothing
    (warning,) = problems_of(tmp_path, pool, try_field=TRY)
    assert (warning.code, warning.question) == ("CS0821", "tpm-or-count")


def test_a_stem_problem_names_its_question(tmp_path: Path) -> None:
    stem = "    stem: What does a transcript's TPM tell you?\n"
    pool = POOL.replace(stem, "    stem: |\n      :::{try} tpm-units\n      :::\n", 1)
    codes = {(p.code, p.question) for p in problems_of(tmp_path, pool, try_field=TRY)}
    assert ("CS0817", "tpm-or-count") in codes


def test_pool_problems_name_no_question(tmp_path: Path) -> None:
    small = "exam:\n" + number("only-one")
    (few,) = problems_of(tmp_path, small, try_field=TRY)
    assert (few.code, few.question) == ("CS0813", None)


def test_a_problem_before_the_id_carries_no_question(tmp_path: Path) -> None:
    pool = POOL.replace("  - id: reads-at-rate\n", "  - kind: number\n", 1).replace(
        "    kind: number\n    title: How many reads", "    title: How many reads", 1
    )
    found = [p for p in problems_of(tmp_path, pool, try_field=TRY) if p.code == "CS0304"]
    assert [p.question for p in found] == [None]
```

and to `tests/schema/test_questions.py`:

```python
def test_a_try_question_problem_names_it() -> None:
    _, problems = parse(CHOICE + "    answer: 2\n")
    assert [(p.code, p.question) for p in problems] == [("CS0308", "node-or-edge")]
```

Add `from code_schema.problems import Problem` to `test_exam.py`'s imports.

- [ ] **Step 2: Run them to see them fail**

Run: `uv run pytest tests/schema/test_exam.py tests/schema/test_questions.py -q`
Expected: FAIL — `AttributeError: 'Problem' object has no attribute 'question'`.

- [ ] **Step 3: Implement**

`problems.py` — add the field after `line`:

```python
    field: str | None = None
    line: int | None = None
    # The question a problem was found in, once its id was read (M4.8d spec, M4P.2).
    question: str | None = None
```

`records.py` — `Entry.__init__` gains `self.name: str | None = None` (comment: "the id
`read_head` read; the entry's problems carry it, M4P.2"), and `Field.entries` stamps:

```python
        for item in value:
            if isinstance(item, dict):
                start = len(self.problems)
                entry = Entry(item, self)
                yield entry
                if entry.name is not None:
                    self.problems[start:] = [
                        replace(problem, question=entry.name)
                        for problem in self.problems[start:]
                    ]
            else:
                self.problem(code, says(item))
```

with `from dataclasses import replace` at the top. Update the module docstring's last paragraph:
"A question entry's problems carry its id once `read_head` reads it (M4P.2)."

`questions.py` `read_head` — after `name = str(written["id"])` add `entry.name = name`.

- [ ] **Step 4: Run them to see them pass, then the whole schema suite**

Run: `uv run pytest tests/schema -q > /tmp/schema.log; echo rc=$?`
Expected: rc=0. If tests that compare whole `Problem` values now fail because the value carries a
question, update those expectations to include `question=` (that is the change, not a regression);
list each in the commit body.

- [ ] **Step 5: Commit**

```bash
git add packages/code-schema tests/schema
git commit -m "feat(schema): a problem names the question it was found in — M4.8d.1" -m "The builder's checks are per question (M4P.2); the reader already knows which entry a problem comes from, so it says so instead of the API re-reading lines." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The API takes a stem as blocks and passes problems' question

**Files:**
- Modify: `apps/api/src/code_api/studio/api.py:325-332, 435-445`
- Modify: `apps/api/src/code_api/studio/schemas.py:154-173`
- Test: `apps/api/tests/test_draft_edits.py`, `test_draft_checks.py`, `test_review_api.py`
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`

**Interfaces:**
- Consumes: `Problem.question` (Task 1); `code_schema.blocks.write_blocks`.
- Produces: `ExamQuestionIn.stem: list[BlockIn]`; `ProblemOut.question: str | None`; TS
  `ExamQuestionIn["stem"]: BlockIn[]`, `ProblemOut["question"]?: string | null`.

- [ ] **Step 1: Write the failing tests** (in `test_draft_edits.py`)

Change `EXAM_QUESTION["stem"]`, `ORDER["stem"]`, `SEQUENCE["stem"]` and the `two` question's stem
to block lists, e.g. `"stem": [{"kind": "text", "markdown": "If one transcript … TPM?\n"}]`, and
the assertion in `test_an_exam_question_of_a_new_kind_is_saved` to compare `stem_text` with the
block's markdown. Do the same in `test_draft_checks.py`'s `exam_question` and in
`test_review_api.py` (every `"stem":` in `apps/api/tests`). Then add:

```python
def test_a_stem_of_blocks_is_written_as_myst(client: Client) -> None:
    draft = opened(client, "tpm")
    question = EXAM_QUESTION | {
        "stem": [
            {"kind": "text", "markdown": "Spell this path:\n"},
            {"kind": "sequence", "letters": "ACGTT\n"},
        ]
    }
    saved = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": question}
    )
    assert saved.status_code == 200, saved.content
    sent = saved.json()["draft"]["node"]["exam"][-1]
    assert sent["stem_text"] == "Spell this path:\n:::{sequence}\nACGTT\n:::\n"
    assert [block["kind"] for block in sent["stem"]] == ["text", "sequence"]


def test_a_try_in_a_stem_is_refused_by_its_code(client: Client) -> None:
    draft = opened(client, "tpm")
    question = EXAM_QUESTION | {"stem": [{"kind": "try", "question": "tpm-units"}]}
    refused = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": question}
    )
    assert refused.status_code == 422
    problems = refused.json()["problems"]
    assert {(p["code"], p["question"]) for p in problems} >= {("CS0817", "tpm-share")}
```

(If the fixture TPM has no try question `tpm-units`, use the id of one of its try questions —
`uv run code-schema validate tests/fixtures/salmon` shows none; read `tests/fixtures/salmon/**/tpm/node.yaml`.)

- [ ] **Step 2: Run them to see them fail**

Run: `uv run pytest apps/api/tests/test_draft_edits.py -q -k "stem or exam" > /tmp/api.log; echo rc=$?`
Expected: rc=1; 422 "Input should be a valid string" on the block-list stems.

- [ ] **Step 3: Implement**

`api.py`:

```python
class ExamQuestionIn(AnswerIn):
    id: str
    title: str
    claim: str = ""
    stem: list[BlockIn]  # blocks, as on a page; written as MyST by code-schema (M4P.3)
    level: Level | None = None
    rationale: str
```

`BlockIn` is declared below `ExamQuestionIn`; move the `BlockIn` class above `AnswerIn` so the
annotation resolves. Then:

```python
def _exam_question(given: ExamQuestionIn) -> ExamQuestion:
    return ExamQuestion(
        id=given.id,
        title=given.title,
        claim=given.claim,
        stem=write_blocks([_block(block) for block in given.stem]),
        answer=_answer(given),
        level=given.level,
        rationale=given.rationale,
    )
```

with `from code_schema.blocks import write_blocks` beside the other code-schema imports (`_block`
is defined below `_exam_question`; Python resolves it at call time).

`schemas.py` `ProblemOut`: add `question: str | None = None` and `question=problem.question` in
`of`.

- [ ] **Step 4: Run the API suite, regenerate the types, check the web compiles**

Run: `CI env… uv run pytest apps/api -q > /tmp/api.log; echo rc=$?` → rc=0.
Run the export command (Global Constraints), then `web.sh "npm run api-types && npm run typecheck && npm test"`.
Expected: rc=0 everywhere (no web code sends an exam stem yet).

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web/src/api/schema.ts
git commit -m "feat(api): an exam question's stem arrives as blocks — M4.8d.2" -m "One MyST writer, code-schema's (M4P.3); the builder edits a stem as blocks and the save's read-back still refuses what would not write back. Problems carry their question to the web." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Each question's checks

**Files:**
- Modify: `apps/api/src/code_api/studio/drafts.py:295-330`
- Modify: `apps/api/src/code_api/studio/schemas.py` (`QuestionChecksOut`, `ChecklistOut`)
- Modify: `apps/api/src/code_api/studio/api.py` (the `checklist` route)
- Test: `apps/api/tests/test_draft_checks.py`

**Interfaces:**
- Consumes: `Problem.question` (Task 1).
- Produces: `drafts.question_checks(question: ExamQuestion, problems: Sequence[Problem]) ->
  list[Item]`; `drafts.checks(draft) -> tuple[list[Item], list[Problem], dict[str, list[Item]]]`
  (the third keyed by question id, in pool order); API `ChecklistOut.questions:
  list[QuestionChecksOut]` with `QuestionChecksOut(id: str, items: list[ItemOut])`; TS
  `ChecklistOut["questions"]`.

- [ ] **Step 1: Write the failing tests** (`test_draft_checks.py`)

```python
def test_each_exam_question_has_its_checks(client: Client) -> None:
    draft = opened(client, {"node_id": "tpm"})
    body = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    pool = call(client, "get", f"/api/studio/drafts/{draft}").json()["node"]["exam"]
    assert [q["id"] for q in body["questions"]] == [q["id"] for q in pool]
    choice = next(q for q in pool if q["kind"] == "choice")
    rules = [item["rule"] for item in _checks_of(body, choice["id"])]
    assert "One right option of three to five" in rules
    number = next(q for q in pool if q["kind"] == "number")
    assert "One right option of three to five" not in [
        item["rule"] for item in _checks_of(body, number["id"])
    ]


def test_a_warning_fails_one_item_of_one_question(client: Client) -> None:
    draft = opened(client, {"node_id": "tpm"})
    far = exam_question(1) | {"level": "advanced"}  # TPM is introductory: two steps (CS0814)
    added = call(
        client, "post", f"/api/studio/drafts/{draft}/exam", {"revision": 1, "question": far}
    )
    assert added.status_code == 200, added.content
    body = call(client, "get", f"/api/studio/drafts/{draft}/checklist").json()
    failed = [
        (question["id"], item["rule"])
        for question in body["questions"]
        for item in question["items"]
        if not item["passed"]
    ]
    assert failed == [(far["id"], "Level within one step of the node's")]
    (item,) = [i for i in _checks_of(body, far["id"]) if not i["passed"]]
    assert "advanced" in item["detail"]


def _checks_of(body: dict[str, Any], question_id: str) -> list[dict[str, Any]]:
    return next(q["items"] for q in body["questions"] if q["id"] == question_id)
```

TPM's fixture level is `introductory`, two steps from `advanced`. If the fixture pool already
carries a warning (CS0821) the first assertion of the second test shows it; then plant the far
level on a fresh node instead and record the ruling.

- [ ] **Step 2: Run them to see them fail**

Run: `uv run pytest apps/api/tests/test_draft_checks.py -q > /tmp/c.log; echo rc=$?`
Expected: rc=1, `KeyError: 'questions'`.

- [ ] **Step 3: Implement** (`drafts.py`, beside `Item`)

```python
@dataclass(frozen=True)
class Rule:
    """One of the format's rules a question is checked by (M4P.4): broken by any of `codes`."""

    says: str
    kinds: frozenset[str]  # empty: every kind
    codes: frozenset[str]


_EVERY: frozenset[str] = frozenset()

QUESTION_RULES = (
    Rule("A title and a stem", _EVERY, frozenset({"CS0815", "CS0816", "CS0823"})),
    Rule(
        "The stem holds only text and sequences",
        _EVERY,
        frozenset({"CS0817", "CS0416", "CS0417", "CS0418"}),
    ),
    Rule("Level within one step of the node's", _EVERY, frozenset({"CS0814"})),
    Rule("No hints", _EVERY, frozenset({"CS0807"})),
    Rule("A rationale", _EVERY, frozenset({"CS0320"})),
    Rule(
        "One right option of three to five",
        frozenset({"choice"}),
        frozenset({"CS0309", "CS0327", "CS0328", "CS0329", "CS0335", "CS0818"}),
    ),
    Rule(
        "Each wrong option names a misconception or is plain",
        frozenset({"choice"}),
        frozenset({"CS0809", "CS0810", "CS0819", "CS0820", "CS0821"}),
    ),
    Rule(
        "A number, with a sound tolerance",
        frozenset({"number"}),
        frozenset({"CS0311", "CS0312", "CS0315"}),
    ),
    Rule(
        "An answer, and accepted answers as text",
        frozenset({"sequence"}),
        frozenset({"CS0330", "CS0331", "CS0332"}),
    ),
    Rule(
        "Three to eight different steps",
        frozenset({"order"}),
        frozenset({"CS0333", "CS0334", "CS0336"}),
    ),
)


def question_checks(question: ExamQuestion, problems: Sequence[Problem]) -> list[Item]:
    """The rules for the question's kind, each failed by a problem found in it (M4P.4)."""
    own = [problem for problem in problems if problem.question == question.id]
    items = []
    for rule in QUESTION_RULES:
        if rule.kinds and question.kind not in rule.kinds:
            continue
        broken = [problem for problem in own if problem.code in rule.codes]
        items.append(Item(rule.says, not broken, "; ".join(p.message for p in broken)))
    return items
```

and `checks` returns a third value:

```python
    by_question = {} if node is None else {
        question.id: question_checks(question, problems) for question in node.exam
    }
    return items, problems, by_question
```

Its docstring adds "and each exam question's own (M4P.4)". `checklist(draft)` becomes
`return checks(draft)[0]`, unchanged in meaning. Every other caller of `checks` (grep
`drafts.checks(`) unpacks three.

`schemas.py`:

```python
class QuestionChecksOut(Schema):
    """One exam question's checks (M4P.4)."""

    id: str
    items: list[ItemOut]
```

and `ChecklistOut` gains `questions: list[QuestionChecksOut] = []`. The `checklist` route:

```python
    items, problems, by_question = drafts.checks(draft)
    out = lambda item: ItemOut(rule=item.rule, passed=item.passed, detail=item.detail)  # noqa: E731
```

— write `out` as a small module-level function `_item_out(item: drafts.Item) -> ItemOut` instead
of a lambda, and use it for both lists:
`questions=[QuestionChecksOut(id=i, items=[_item_out(x) for x in got]) for i, got in by_question.items()]`.

Imports: `Sequence` from `collections.abc`, `ExamQuestion` from `code_schema.exam` in `drafts.py`
if absent.

- [ ] **Step 4: Run, regenerate, check**

Run the API suite with CI env (rc=0), the export command, `web.sh "npm run api-types && npm run typecheck"` (rc=0).

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web/src/api/schema.ts
git commit -m "feat(api): each exam question's checks, with the checklist — M4.8d.3" -m "The board ticks a question's rules (M4P.4). One table names each rule's kinds and codes; a problem found in the question with one of them fails it. Still one request." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dark tokens for one box

**Files:**
- Modify: `apps/web/src/styles/renderTokens.ts:104`
- Regenerate: `apps/web/src/styles/tokens.css`
- Test: `apps/web/src/styles/tokens.test.ts`

**Interfaces:**
- Produces: any element with `data-theme="dark"` takes the dark token set (and `dark:` variants
  already match `[data-theme="dark"] *`).

- [ ] **Step 1: Write the failing test** (in `tokens.test.ts`)

```ts
it("gives a box marked dark the dark tokens, for the builder's preview (M4P.7)", () => {
  const css = renderTokens(TOKENS);
  expect(css).toContain(':root[data-theme="dark"],\n[data-theme="dark"] {');
});
```

(Use the file's existing names for the renderer and the parsed tokens.)

- [ ] **Step 2: Run it to see it fail** — `web.sh "npx vitest run src/styles"` → FAIL.

- [ ] **Step 3: Implement** — in `renderTokens.ts` change the selector line to
`:root[data-theme="dark"],\n[data-theme="dark"] {` and its comment to "Dark when someone chose
it, whatever the system says — the page, or one box (M4P.7)." Then `web.sh "npm run tokens"`.

- [ ] **Step 4: Run** — `web.sh "npx vitest run src/styles"` → PASS (the committed-css test too).

- [ ] **Step 5: Commit** — `git add apps/web/src/styles && git commit -m "feat(web): a box marked dark takes the dark tokens — M4.8d.4" -m "The builder's preview draws Dark inside a light Studio (M4P.7); no token value changes." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 5: One answer editor for both pools

**Files:**
- Create: `apps/web/src/studio/workbench/AnswerEditor.tsx`, `AnswerEditor.test.tsx`
- Modify: `TryEditor.tsx` (keeps ask, hints, rationale; uses `AnswerEditor`), `BlockEditor.tsx`
  (`LATER` and its note go), `TryEditor.test.tsx`
- Unchanged: `question.ts`'s `blankOptions` (a try option has no plain, #257); the exam's three
  blank options are `blankExamOptions` in `AnswerEditor.tsx`.

**Interfaces:**
- Produces:

```ts
export type AnswerKind = "choice" | "number" | "sequence" | "order";
/** The answer fields both pools' inputs share (AnswerIn in the API). */
export interface AnswerFields {
  kind: AnswerKind;
  options?: OptionIn[] | null;
  answer?: number | string | null;
  unit?: string;
  tolerance?: number | null;
  accept?: string[];
  exact?: boolean;
  steps?: string[] | null;
}
export function AnswerEditor<T extends AnswerFields>(props: {
  value: T;
  onChange: (value: T) => void;
  exam?: boolean; // misconception or plain on wrong options; three options to start
}): JSX.Element;
export function switchedKind<T extends AnswerFields>(value: T, kind: AnswerKind, exam: boolean): T;
```

- [ ] **Step 1: Write the failing tests** (`AnswerEditor.test.tsx`)

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { type AnswerFields, AnswerEditor, switchedKind } from "./AnswerEditor";

function Harness({ start, exam = false, seen }: { start: AnswerFields; exam?: boolean; seen: AnswerFields[] }) {
  const [value, setValue] = useState(start);
  return (
    <AnswerEditor
      value={value}
      exam={exam}
      onChange={(next) => {
        seen.push(next);
        setValue(next);
      }}
    />
  );
}

const CHOICE: AnswerFields = {
  kind: "choice",
  options: [
    { text: "A", right: true, misconception: "" },
    { text: "B", right: false, misconception: "" },
  ],
};

describe("AnswerEditor", () => {
  it("offers the four kinds", () => {
    render(<Harness start={CHOICE} seen={[]} />);
    for (const name of ["Choice", "Number", "Sequence", "Order"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  it("switching kind clears the other kinds' fields (CS0337)", () => {
    const back = switchedKind(switchedKind({ ...CHOICE }, "number", false), "choice", false);
    expect(back.answer ?? null).toBeNull();
    expect(switchedKind(CHOICE, "order", false)).toMatchObject({ options: null, answer: null, steps: ["", "", ""] });
    expect(switchedKind(CHOICE, "sequence", false)).toMatchObject({ options: null, answer: "", accept: [], exact: false });
  });

  it("edits a sequence's answer, accepted answers and exact", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={switchedKind(CHOICE, "sequence", false)} seen={seen} />);
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "ACGTT" } });
    fireEvent.change(screen.getByLabelText("Also accepted"), { target: { value: "acgtt\nAC GTT" } });
    fireEvent.click(screen.getByLabelText("Exact: letter for letter"));
    expect(seen.at(-1)).toMatchObject({ answer: "ACGTT", accept: ["acgtt", "AC GTT"], exact: true });
  });

  it("edits an order's steps, in their right order", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={switchedKind(CHOICE, "order", false)} seen={seen} />);
    fireEvent.change(screen.getByLabelText("Step 1"), { target: { value: "Cut reads into k-mers" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Step" }));
    expect(seen.at(-1)?.steps).toEqual(["Cut reads into k-mers", "", "", ""]);
  });

  it("in the exam pool, a wrong option names a misconception or is plain", () => {
    const seen: AnswerFields[] = [];
    render(<Harness start={CHOICE} exam seen={seen} />);
    fireEvent.change(screen.getByLabelText("Misconception of option B"), { target: { value: "reads a repeat as an error" } });
    expect(seen.at(-1)?.options?.[1]).toMatchObject({ misconception: "reads a repeat as an error", plain: false });
    fireEvent.click(screen.getByLabelText("Option B is plain on purpose"));
    expect(seen.at(-1)?.options?.[1]).toMatchObject({ misconception: "", plain: true });
    expect(screen.queryByLabelText("Misconception of option A")).toBeNull(); // the right one has none
  });

  it("a try question's options have no misconception (#257)", () => {
    render(<Harness start={CHOICE} seen={[]} />);
    expect(screen.queryByLabelText(/Misconception of option/)).toBeNull();
  });
});
```

and in `TryEditor.test.tsx` replace the test that expects the M4.8d note with:

```tsx
it("edits a sequence try question in the workbench (M4P.6)", async () => {
  // render the workbench on a draft whose try question is a sequence (see the file's helpers);
  // open its block; expect the "Answer" field with the question's answer, and no "(M4.8d)" text.
});
```

written out with the file's own render helper and a `questions: [{ …kind: "sequence", answer: "ACG", accept: [], exact: false, … }]` node.

- [ ] **Step 2: Run them to see them fail** — `web.sh "npx vitest run src/studio/workbench/AnswerEditor src/studio/workbench/TryEditor"` → FAIL (no module).

- [ ] **Step 3: Implement** `AnswerEditor.tsx`

Move from `TryEditor.tsx`: the kind switch fieldset (four kinds, labels `Choice`, `Number`,
`Sequence`, `Order`), `Options`, `NumberField`. Add:

```tsx
export function switchedKind<T extends AnswerFields>(value: T, kind: AnswerKind, exam: boolean): T {
  const none = { options: null, answer: null, unit: "", tolerance: null, accept: [], exact: false, steps: null };
  switch (kind) {
    case "choice":
      return { ...value, ...none, kind, options: exam ? blankExamOptions() : blankOptions() };
    case "number":
      return { ...value, ...none, kind };
    case "sequence":
      return { ...value, ...none, kind, answer: "" };
    case "order":
      return { ...value, ...none, kind, steps: ["", "", ""] };
  }
}
```

`blankExamOptions()` lives in `AnswerEditor.tsx`: three options, the first right,
`{ text: "", right: i === 0, misconception: "", plain: false }`.

The kinds' editors:

- **Choice** — `Options` as today, each option's row a letter (`A`…), the right radio
  (`Option A is the right answer`), the text (`Option A`), *Remove* (disabled at the minimum: 2,
  or 3 when `exam`). When `exam` and the option is not right: a field `Misconception of option A`
  (placeholder `the misconception this answer reveals`) and a checkbox `Option A is plain on
  purpose`; typing a misconception sets `plain: false`; ticking plain clears the misconception.
  Marking an option right clears its misconception and plain. Under the list: *Options are
  shuffled per learner.* (exam only) and *+ Option* (new options carry `plain: false` when exam).
  Labels use the letter, so tests and screen readers say "option B".
- **Number** — as today (Answer, Unit, Tolerance).
- **Sequence** — `Answer` (mono input), `Also accepted` (textarea, one per line, empty lines
  dropped on change… keep them while typing: store `split("\n")`, the sender filters), checkbox
  `Exact: letter for letter`.
- **Order** — `Step 1`…`Step n` inputs in order, each with *Remove* (disabled at 3), then
  *+ Step* (disabled at 8); a note *Write the steps in their right order; a learner gets them
  shuffled.*

`TryEditor.tsx` keeps the `Question` textarea, then `<AnswerEditor value={question} onChange={onChange} />`,
then Hints and Rationale. `BOX`, `LABEL` stay exported from `TryEditor.tsx` (BlockEditor imports
them) — or move them to `bench.ts` and update imports; pick one and keep it in one place.
`BlockEditor.tsx`: delete `LATER` and the note branch; the try branch is
`block.kind === "try" && asked !== undefined && <TryEditor …/>`. `cleaned` also drops empty
`accept` lines and keeps `steps` as typed.

- [ ] **Step 4: Run** — `web.sh "npx vitest run src/studio/workbench && npm run typecheck && npm run lint"` → PASS.

- [ ] **Step 5: Commit** — `feat(web): one answer editor for both pools; sequence and order try questions edit in the workbench — M4.8d.5`, body: "M4P.6: the kind switch and the four kinds' editors move out of TryEditor, so the exam builder and try blocks share them, and the M4.8c note goes."

---

### Task 6: Exam edits and the question as the editor holds it

**Files:**
- Modify: `apps/web/src/studio/workbench/edits.ts`, `edits.test.tsx`
- Create: `apps/web/src/studio/workbench/exam.ts`, `exam.test.ts`
- Modify: `fixtures.ts` (`examQuestion` takes an optional kind)

**Interfaces:**
- Consumes: TS `ExamQuestionIn` (stem `BlockIn[]`), `StudioExamQuestionOut`, `newQuestion` in
  `question.ts`, `blankExamOptions` (Task 5).
- Produces:

```ts
// edits.ts
export const addExam = (question: ExamQuestionIn): Edit =>
  ({ method: "POST", path: "exam", body: { question } });
export const updateExam = (id: string, question: ExamQuestionIn): Edit =>
  ({ method: "PUT", path: `exam/${encodeURIComponent(id)}`, body: { question } });
export const deleteExam = (id: string): Edit =>
  ({ method: "DELETE", path: `exam/${encodeURIComponent(id)}` });

// exam.ts
export function examIn(out: StudioExamQuestionOut): ExamQuestionIn;
export function newExamQuestion(nodeId: string, node: DraftNodeOut): ExamQuestionIn;
export function stemIn(stem: BlockIn[]): BlockIn[]; // what is sent: ended, trailing spaces gone
export function sent(question: ExamQuestionIn): ExamQuestionIn; // stemIn + cleaned lists
```

- [ ] **Step 1: Write the failing tests**

`edits.test.tsx`:

```ts
it("names an exam question in the path", () => {
  const q = { id: "k-mers-q1" } as ExamQuestionIn;
  expect(addExam(q)).toEqual({ method: "POST", path: "exam", body: { question: q } });
  expect(updateExam("k-mers-q1", q).path).toBe("exam/k-mers-q1");
  expect(deleteExam("k-mers-q1")).toEqual({ method: "DELETE", path: "exam/k-mers-q1" });
});
```

`exam.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { examQuestion, NODE } from "./fixtures";
import { examIn, newExamQuestion, sent, stemIn } from "./exam";

describe("exam questions as the editor holds them", () => {
  it("names a new one by the first id free in both pools (CS0811)", () => {
    const node = { ...NODE, questions: [{ id: "k-mers-q1" }] as never, exam: [examQuestion("k-mers-q2", "draft")] };
    const q = newExamQuestion("k-mers", node);
    expect(q.id).toBe("k-mers-q3");
    expect(q).toMatchObject({ kind: "choice", title: "", stem: [{ kind: "text", markdown: "" }], level: null });
    expect(q.options).toHaveLength(3);
  });

  it("turns a draft's question back into what the API takes", () => {
    const back = examIn(examQuestion("a", "approved"));
    expect(back.stem).toEqual([{ kind: "text", markdown: "What is a?\n" }]);
    expect(back).not.toHaveProperty("state");
    expect(back).not.toHaveProperty("stem_text");
  });

  it("ends each stem block's last line and strips spaces at line ends (CS0823)", () => {
    expect(stemIn([{ kind: "text", markdown: "One  \ntwo " }, { kind: "sequence", letters: "ACG" }])).toEqual([
      { kind: "text", markdown: "One\ntwo\n" },
      { kind: "sequence", letters: "ACG\n" },
    ]);
  });

  it("drops empty lines from accepted answers and empty blocks from the stem", () => {
    const q = { ...examIn(examQuestion("a", "draft")), accept: ["x", ""], stem: [{ kind: "text", markdown: "" }, { kind: "text", markdown: "Hi" }] } as never;
    expect(sent(q)).toMatchObject({ accept: ["x"], stem: [{ kind: "text", markdown: "Hi\n" }] });
  });
});
```

- [ ] **Step 2: Run them to see them fail** — `web.sh "npx vitest run src/studio/workbench/exam src/studio/workbench/edits"` → FAIL.

- [ ] **Step 3: Implement**

`exam.ts`:

```ts
// An exam question as the builder holds and sends it (M4.8d spec, M4P.5): a new one named in both
// pools, a draft's own turned back into what the API takes, and the stem as it is sent.
import type { BlockIn, DraftNodeOut, ExamQuestionIn, StudioExamQuestionOut } from "../../api/schema";
import { blankExamOptions } from "./AnswerEditor";
import { newQuestion } from "./question";

export function newExamQuestion(nodeId: string, node: DraftNodeOut): ExamQuestionIn {
  const { id } = newQuestion(nodeId, [...node.questions, ...node.exam]);
  return {
    id,
    kind: "choice",
    title: "",
    claim: "",
    stem: [{ kind: "text", markdown: "" }],
    level: null,
    options: blankExamOptions(),
    answer: null,
    unit: "",
    tolerance: null,
    accept: [],
    exact: false,
    steps: null,
    rationale: "",
  };
}

export function examIn(out: StudioExamQuestionOut): ExamQuestionIn {
  const { state: _state, stem_text: _text, stem, options, level, ...rest } = out;
  return {
    ...rest,
    kind: out.kind as ExamQuestionIn["kind"],
    level: (level ?? null) as ExamQuestionIn["level"],
    stem: stem.map((block) => ({ ...block }) as BlockIn),
    options: options?.map(({ text, right, misconception, plain }) => ({ text, right, misconception, plain })) ?? null,
  };
}

const trimmed = (text: string) => text.split("\n").map((line) => line.replace(/ +$/, "")).join("\n");
const endedText = (text: string) => (text.endsWith("\n") ? text : `${text}\n`);

export function stemIn(stem: BlockIn[]): BlockIn[] {
  return stem.flatMap((block) => {
    if (block.kind === "sequence") {
      return (block.letters ?? "").trim() === "" ? [] : [{ ...block, letters: endedText(block.letters ?? "") }];
    }
    const markdown = trimmed(block.markdown ?? "");
    return markdown.trim() === "" ? [] : [{ ...block, markdown: endedText(markdown) }];
  });
}

export function sent(question: ExamQuestionIn): ExamQuestionIn {
  return {
    ...question,
    stem: stemIn(question.stem),
    accept: (question.accept ?? []).filter((a) => a.trim() !== ""),
  };
}
```

(`StudioOptionOut` carries `text`, `right`, `misconception` and `plain`.)

`fixtures.ts`: `examQuestion(id, state, kind: "number" | "choice" = "number")` — a choice variant
with three options (`right`, a misconception, `plain`).

- [ ] **Step 4: Run** — vitest for the two files, typecheck, lint → PASS.

- [ ] **Step 5: Commit** — `feat(web): exam edits, and a question as the builder holds it — M4.8d.6`.

---

### Task 7: A question as a test asks it

**Files:**
- Create: `apps/web/src/node/TestQuestion.tsx`, `TestQuestion.test.tsx`
- Modify: `apps/web/src/node/OrderAnswer.tsx` (`onCheck` optional)

**Interfaces:**
- Produces:

```ts
export interface TestAsk {
  stem: Block[];
  kind: "choice" | "number" | "sequence" | "order";
  options: string[];
  unit: string;
  steps: string[];
}
export function TestQuestion(props: {
  ask: TestAsk;
  number: number;
  of: number;
  phone?: boolean;
  shuffle?: (steps: string[]) => string[];
}): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TestQuestion, type TestAsk } from "./TestQuestion";

const choice: TestAsk = {
  stem: [{ kind: "text", markdown: "Which mark does a mid-read error leave?\n" }],
  kind: "choice",
  options: ["A bubble", "A tip", "A clean path"],
  unit: "",
  steps: [],
};

describe("TestQuestion", () => {
  it("asks as a test does: its place, no hints, no feedback", () => {
    render(<TestQuestion ask={choice} number={2} of={6} />);
    expect(screen.getByText("Question 2 of 6 · no hints in a test")).toBeInTheDocument();
    expect(screen.getByText("Which mark does a mid-read error leave?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /A tip/ }));
    expect(screen.getByRole("button", { name: /A tip/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/hint/i, { selector: "button" })).toBeNull();
    expect(screen.queryByText(/Not quite|Right/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("letters each option, as the board does", () => {
    render(<TestQuestion ask={choice} number={1} of={1} />);
    expect(screen.getByRole("button", { name: "B A tip" })).toBeInTheDocument();
  });

  it("takes a number with its unit, and a sequence as text", () => {
    const { rerender } = render(<TestQuestion ask={{ ...choice, kind: "number", options: [], unit: "reads" }} number={1} of={1} />);
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
    expect(screen.getByText("reads")).toBeInTheDocument();
    rerender(<TestQuestion ask={{ ...choice, kind: "sequence", options: [] }} number={1} of={1} />);
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument();
  });

  it("deals an order's steps without a Check button", () => {
    render(<TestQuestion ask={{ ...choice, kind: "order", options: [], steps: ["a", "b", "c"] }} number={1} of={1} shuffle={(s) => [...s].reverse()} />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent?.charAt(0))).toEqual(["c", "b", "a"]);
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail** — `web.sh "npx vitest run src/node/TestQuestion"` → FAIL.

- [ ] **Step 3: Implement**

`OrderAnswer.tsx`: `onCheck?: (order: string[]) => void`; draw the Check button only when it is
given (comment: "a test checks nothing until the end, M4P.7").

`TestQuestion.tsx`:

```tsx
// A question as a self-test asks it (M4.8d spec, M4P.7): its place, the stem as the page draws
// blocks, and the kind's control — no hints, no feedback, no rationale. The builder previews it;
// the self-test (M8) asks it.
import { useId, useState } from "react";
import { Body } from "./Body";
import type { Block } from "./body";
import { OrderAnswer, shuffled } from "./OrderAnswer";

export interface TestAsk { /* as Interfaces */ }

const LETTERS = "ABCDE";
const FIELD =
  "rounded-control border-[1.5px] border-border-2 bg-surface px-3 py-2 font-mono text-[14px] focus:border-sel focus:outline-none";

export function TestQuestion({ ask, number, of, phone = false, shuffle = shuffled }: {…}) {
  const field = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const [given, setGiven] = useState("");
  const [steps] = useState(() => shuffle(ask.steps));
  return (
    <section className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-bg p-3.5 text-ink">
      <span className="text-[11px] text-ink-3">Question {number} of {of} · no hints in a test</span>
      <div className="text-[15px] leading-[1.35] font-semibold">
        <Body blocks={ask.stem} questions={[]} />
      </div>
      {ask.kind === "choice" ? (
        <div className={`grid gap-1.5 ${phone ? "" : "grid-cols-2"}`}>
          {ask.options.map((text, at) => (
            <button
              key={`${at}:${text}`}
              type="button"
              aria-pressed={picked === at}
              onClick={() => setPicked(at)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[13px] ${
                picked === at ? "border-sel bg-sel-soft" : "border-border-2 bg-surface"
              }`}
            >
              <span className="font-mono text-[11px] text-ink-3">{LETTERS[at]}</span> {text}
            </button>
          ))}
        </div>
      ) : ask.kind === "order" ? (
        <OrderAnswer steps={steps} disabled={false} />
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor={field} className="sr-only">Your answer</label>
          <input
            id={field}
            value={given}
            inputMode={ask.kind === "number" ? "decimal" : undefined}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setGiven(event.target.value)}
            className={`${FIELD} ${ask.kind === "number" ? "w-36" : "min-w-0 flex-1"}`}
          />
          {ask.kind === "number" && ask.unit ? <span className="text-[14px] text-ink-2">{ask.unit}</span> : null}
        </div>
      )}
    </section>
  );
}
```

The stem's text weight: the board draws the stem as the question's 15 px semibold line; if
`Body`'s prose sets its own size, wrap it so the board's look holds (check in the walk).

- [ ] **Step 4: Run** — vitest `src/node`, typecheck, lint → PASS.

- [ ] **Step 5: Commit** — `feat(web): a question as a test asks it — M4.8d.7`, body "M4P.7: the preview draws the test's own question, and M8's self-test reuses it."

---

### Task 8: The tab brings its own side panel; the list

**Files:**
- Modify: `apps/web/src/studio/workbench/WorkbenchPage.tsx`
- Rewrite: `apps/web/src/studio/workbench/ExamPoolTab.tsx`, `ExamPoolTab.test.tsx`

**Interfaces:**
- Consumes: `examQuestion` fixtures (Task 6), `editable(draft)`.
- Produces: `Tab.aside?: false` — when `false`, the tab's body spans the width and `SidePanel`
  is not drawn. `ExamPoolTab({ draftId, nodeId, node, editable })`; a `selected` state
  `{ id: string } | { fresh: ExamQuestionIn } | null` inside it; `ExamEditor` and
  `ExamSidePanel` are mounted by it (Tasks 9–10; in this task, placeholders are *not* written —
  the tab draws the list and, for the selected question, its title only, and Tasks 9–10 replace
  that line).

- [ ] **Step 1: Write the failing tests** (`ExamPoolTab.test.tsx`, replacing the count test)

```tsx
function renderPool(exam: StudioExamQuestionOut[], extra: Record<string, Answer> = {}) {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: { ...NODE, exam } } },
    ...extra,
  });
  renderAt("/studio/drafts/d-1?tab=exam", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
}

it("lists each question with its kind and state, as the board does", async () => {
  renderPool([examQuestion("a", "approved"), examQuestion("b", "draft", "choice")]);
  expect(await screen.findByText("Q1 · number")).toBeInTheDocument();
  expect(screen.getByText("Q2 · choice")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Question a.*approved/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Question b.*draft/ })).toBeInTheDocument();
  expect(screen.getByText(/A node needs at least 4 approved questions/)).toBeInTheDocument();
  expect(screen.getByText("2 of 4 · 1 approved")).toBeInTheDocument();
});

it("draws its own side panel, not the page's", async () => {
  renderPool([examQuestion("a", "approved")]);
  await screen.findByText("Q1 · number");
  expect(screen.queryByRole("tablist", { name: "Side panel" })).toBeNull();
});

it("selects the first question, and another on a click", async () => {
  renderPool([examQuestion("a", "approved"), examQuestion("b", "draft")]);
  const first = await screen.findByRole("button", { name: /Question a/ });
  expect(first).toHaveAttribute("aria-current", "true");
  fireEvent.click(screen.getByRole("button", { name: /Question b/ }));
  expect(await screen.findByRole("button", { name: /Question b/ })).toHaveAttribute("aria-current", "true");
});

it("an empty pool says so and offers + New", async () => {
  renderPool([]);
  expect(await screen.findByText("No exam questions yet.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "+ New" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to see them fail** — `web.sh "npx vitest run src/studio/workbench/ExamPoolTab"` → FAIL.

- [ ] **Step 3: Implement**

`WorkbenchPage.tsx`: `interface Tab { …; aside?: false }`; the exam tab entry becomes
`{ key: "exam", label: "Exam pool", aside: false, body: (draft, node) => <ExamPoolTab draftId={draft.public_id} nodeId={draft.node_id} node={node} editable={editable(draft)} /> }`;
the grid draws `<SidePanel>` and the two-column class only when `tab.aside !== false`.

`ExamPoolTab.tsx`:

```tsx
// S3 · Exam pool (M4.8d spec, M4P.5): the board's three columns — the questions, one question's
// editor, and its preview and checks. The tab brings its own side panel.
import { useState } from "react";
import type { DraftNodeOut, ExamQuestionIn } from "../../api/schema";
import { useAfterSaves } from "./useDraftEdit";

export type Selected = { id: string } | { fresh: ExamQuestionIn } | null;

const KIND: Record<string, string> = { choice: "choice", number: "number", sequence: "sequence", order: "order" };

export function ExamPoolTab({ draftId, nodeId, node, editable }: {…}) {
  const after = useAfterSaves(draftId);
  const [selected, setSelected] = useState<Selected>(() => (node.exam[0] ? { id: node.exam[0].id } : null));
  const approved = node.exam.filter((q) => q.state === "approved").length;
  const current = selected !== null && "id" in selected ? node.exam.find((q) => q.id === selected.id) : undefined;
  // after(...) so a choice waits for the editor's save to land, and stays put if it is refused (#255).
  const choose = (next: Selected) => after(() => setSelected(next));
  return (
    <div className="grid gap-[18px] xl:grid-cols-[230px_minmax(0,1fr)_460px]">
      <aside className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">Questions</h2>
          {editable && (
            <button type="button" onClick={() => choose({ fresh: newExamQuestion(nodeId, node) })} className="text-[12px] text-sel">
              + New
            </button>
          )}
        </div>
        <p className="text-[12px] tabular-nums text-ink-3">{node.exam.length} of 4 · {approved} approved</p>
        {node.exam.length === 0 && <p className="text-[12.5px] text-ink-2">No exam questions yet.</p>}
        {node.exam.map((q, at) => {
          const on = current?.id === q.id;
          return (
            <button
              key={q.id}
              type="button"
              aria-current={on}
              aria-label={`Question ${q.title || q.id}, ${q.kind}, ${q.state}`}
              onClick={() => choose({ id: q.id })}
              className={`flex flex-col gap-[3px] rounded-[9px] px-2.5 py-[9px] text-left ${
                on ? "bg-sel-soft shadow-[inset_3px_0_0_var(--sel)]" : "border border-border bg-surface"
              }`}
            >
              <span className="font-mono text-[11px] text-ink-3">Q{at + 1} · {KIND[q.kind] ?? q.kind}</span>
              <span className={`text-[12.5px] leading-[1.35] ${on ? "font-semibold" : "font-medium"}`}>{q.title || q.id}</span>
              <span className={`text-[11px] ${q.state === "approved" ? "text-ink-3" : "text-sel"}`}>{q.state}</span>
            </button>
          );
        })}
        <p className="pt-1 text-[11.5px] leading-[1.45] text-ink-3">
          A node needs at least 4 approved questions to be included in tests. No hints in exam questions.
        </p>
      </aside>
      {/* Task 9 mounts ExamEditor here; Task 10 mounts ExamSidePanel beside it. */}
    </div>
  );
}
```

The aria-label wording must match the test (`Question a, number, approved` matches
`/Question a.*approved/` because the fixture's title is `Question a` — adjust the label to
`${q.title}` with the state, and keep the regexes in the tests honest to it). The comment line
in the JSX is replaced in Task 9, not left behind.

- [ ] **Step 4: Run** — vitest `src/studio/workbench`, typecheck, lint → PASS.

- [ ] **Step 5: Commit** — `feat(web): the Exam pool's question list, and a tab with its own side panel — M4.8d.8`.

---

### Task 9: One question's editor

**Files:**
- Create: `apps/web/src/studio/workbench/ExamEditor.tsx`, `ExamEditor.test.tsx`
- Modify: `ExamPoolTab.tsx` (mount it), `BlockEditor.tsx` (export the letters field as
  `LettersField`, used by both)

**Interfaces:**
- Consumes: `addExam`, `updateExam`, `deleteExam` (Task 6), `examIn`, `sent` (Task 6),
  `AnswerEditor` (Task 5), `useDraftEdit`, `LeaveToSave`, `RefusalNotice`, `refusalOf`,
  `MarkdownField`, `LEVELS`.
- Produces: `ExamEditor({ draftId, initial, fresh, number, nodeLevel, onSaved, onDeleted, onChange })`
  where `initial: ExamQuestionIn`, `fresh: boolean`, `onSaved(id: string)`, `onDeleted()`,
  `onChange(question: ExamQuestionIn, changed: boolean)` (the side panel previews it). Mounted
  with `key={id}` (or `"fresh"`).

- [ ] **Step 1: Write the failing tests** (`ExamEditor.test.tsx`, through `WorkbenchPage` as
  `ExamPoolTab.test.tsx` does; `holding` from `test-kit` for in-flight saves)

```tsx
it("leaving a changed question saves it with PUT", async () => {
  const fake = renderPool([examQuestion("a", "draft")], {
    "PUT /api/studio/drafts/d-1/exam/a": { body: { draft: DRAFT, warnings: [] } },
  });
  const title = await screen.findByLabelText("Title");
  fireEvent.change(title, { target: { value: "Count the edges" } });
  fireEvent.blur(title, { relatedTarget: document.body });
  await waitFor(() => expect(sentTo(fake, "PUT")).toMatchObject({ revision: 3, question: { id: "a", title: "Count the edges" } }));
});

it("leaving an unchanged question sends nothing", async () => { /* blur without change → no PUT */ });

it("a new question is sent with POST, then selected by its id", async () => {
  // + New → type Title and a stem line and option texts → blur → POST body has id "k-mers-q1",
  // stem [{kind:"text", markdown:"…\n"}]; the answer draft holds the question; its row is current.
});

it("an untouched new question is dropped", async () => {
  // + New, then click the first row → no POST; no "fresh" row remains; the first row is current.
});

it("a refused save keeps the question selected and the text typed", async () => {
  // PUT answers 422 with problems [{code:"CS0818", question:"a", text:"…", …}]; change the title,
  // click the second row → the first stays aria-current, Title keeps the typed text, the refusal shows.
});

it("edits the stem as blocks: add text and sequence, move, delete", async () => {
  // Add to stem: text / sequence buttons; "Move stem block 2 up"; "Delete stem block 1";
  // the PUT's stem follows: [{kind:"sequence", letters:"ACG\n"}, …].
});

it("delete question sends DELETE and selects the first remaining", async () => { /* confirm in place, as blocks */ });

it("a draft not open shows the question and edits nothing", async () => {
  // DRAFT with state "submitted": no + New, fields read-only (disabled), no Delete.
});
```

Write each test body fully in the file's style (`fireEvent`, `findBy…`, `answering`), with the
helper:

```ts
const sentTo = (fake: ReturnType<typeof answering>, method: string) => {
  const call = fake.mock.calls.find(([, init]) => init?.method === method);
  return call ? JSON.parse(String(call[1]?.body)) : undefined;
};
```

- [ ] **Step 2: Run them to see them fail** — vitest `ExamEditor` → FAIL.

- [ ] **Step 3: Implement `ExamEditor.tsx`**

```tsx
// One exam question, open (M4.8d spec, M4P.5): its title, claim and level, the stem as blocks, the
// answer and the rationale, held here and saved when you leave the editor — POST when new, PUT
// otherwise, nothing when unchanged. Refused, it stays with what you typed and why.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { BlockIn, ExamQuestionIn, Level } from "../../api/schema";
import { LEVELS } from "../drafts/NewNodeForm";
import { AnswerEditor } from "./AnswerEditor";
import { CARD } from "./bench";
import { LettersField } from "./BlockEditor";
import { addExam, deleteExam, updateExam } from "./edits";
import { sent } from "./exam";
import { LeaveToSave } from "./LeaveToSave";
import { MarkdownField } from "./MarkdownField";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { BOX, LABEL } from "./TryEditor";
import { reloadDraft, useDraftEdit } from "./useDraftEdit";
import { useLeaveWarning } from "./useLeaveWarning";

export function ExamEditor({ draftId, initial, fresh, number, editable, onSaved, onDeleted, onChange }: {…}) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [question, setQuestion] = useState(initial);
  const [base, setBase] = useState(fresh ? null : initial); // what the draft holds; null: not yet
  const changed = base === null ? !untouched(question, initial) : JSON.stringify(sent(question)) !== JSON.stringify(sent(base));
  useLeaveWarning(changed);
  useEffect(() => onChange(question, changed), [question, changed, onChange]);
  const set = (patch: Partial<ExamQuestionIn>) => setQuestion((now) => ({ ...now, ...patch }));
  const commit = () => {
    if (edit.isPending || !changed || !editable) return;
    const out = sent(question);
    edit.mutate(base === null ? addExam(out) : updateExam(base.id, out), {
      onSuccess: () => {
        setBase(question);
        onSaved(question.id);
      },
    });
  };
  …
}

/** A new question still as + New made it: leaving it sends nothing (Review Focus 3). */
const untouched = (q: ExamQuestionIn, blank: ExamQuestionIn) => JSON.stringify(q) === JSON.stringify(blank);
```

The layout, top to bottom, inside `<LeaveToSave onLeave={commit} className="flex min-w-0 flex-col gap-2.5">`:

1. Header row: `Q{number} ·` + `Title` input (15 px semibold, borderless until focus, `aria-label="Title"`);
   right side: `tests the claim:` + `Claim` input (12 px, ink-3) and a `Level` select
   (`the node's level` → `null`, then `LEVELS`).
2. **Stem** card (`CARD` minus padding, as the board's panel): header *Stem* + *blocks, as on a
   page*; each block a row with its kind chip (`text`/`sequence`, mono 11 px), the field
   (`MarkdownField` for text, `LettersField` for sequence), and `Move stem block n up`/`down`,
   `Delete stem block n` buttons; then the dashed *Add to stem* row with `text` and `sequence`
   buttons appending `{kind:"text", markdown:""}` / `{kind:"sequence", letters:""}`.
3. **Answer** card: header *Answer*, `<AnswerEditor value={question} exam onChange={setQuestion} />`
   (its kind switch sits in the header's right as the board's segmented control — give
   `AnswerEditor` a `switchSlot` render prop or render the switch first and lay it out with CSS;
   choose the simpler that matches the board, and note it in the ledger).
4. **Rationale · shown only in results** card with a textarea (`aria-label="Rationale"`).
5. Refusal (`RefusalNotice` with reload, as `BlockEditor`).
6. Footer: `Delete question` → in-place confirm *Delete this question?* `Delete` / `Keep`
   (as `BlockList`'s), sending `deleteExam(base.id)` then `onDeleted()`; for a fresh question
   *Discard* drops it (`onDeleted()`), sending nothing.

When `editable` is false every input is `disabled` and the footer is not drawn.

`BlockEditor.tsx`: extract its sequence `<label>Letters…</label>` into exported `LettersField({ value, onChange })` and use it there too.

`ExamPoolTab.tsx`: replace the Task 8 comment with

```tsx
<div className="min-w-0">
  {selected === null ? (
    <p className="text-[13.5px] text-ink-2">Choose a question, or + New.</p>
  ) : (
    <ExamEditor
      key={"id" in selected ? selected.id : `fresh:${selected.fresh.id}`}
      draftId={draftId}
      initial={"id" in selected ? examIn(current as StudioExamQuestionOut) : selected.fresh}
      fresh={!("id" in selected)}
      number={…}
      editable={editable}
      onSaved={(id) => setSelected({ id })}
      onDeleted={() => setSelected(node.exam[0] ? { id: node.exam[0].id } : null)}
      onChange={setShown}
    />
  )}
</div>
```

where `setShown` keeps `{ question, changed }` for the side panel (Task 10), wrapped in
`useCallback`. A fresh question shows in the list as a last row `Q{n} · choice`, *new*, current.
Clicking another row while fresh and untouched drops it (the editor's leave sends nothing, then
`choose` selects). After `onDeleted`, `node.exam` is the saved draft's (the edit wrote it to the
cache), so pick from the fresh `node` via the parent's render.

- [ ] **Step 4: Run** — vitest `src/studio/workbench`, typecheck, lint → PASS.

- [ ] **Step 5: Commit** — `feat(web): one exam question's editor, saved when you leave it — M4.8d.9`.

---

### Task 10: Preview as in a test, and Checks

**Files:**
- Create: `apps/web/src/studio/workbench/ExamSidePanel.tsx`, `ExamSidePanel.test.tsx`
- Modify: `ExamPoolTab.tsx` (mount it)

**Interfaces:**
- Consumes: `TestQuestion`, `TestAsk` (Task 7), `useDraftChecks` + `ChecklistOut.questions`
  (Task 3), `CheckItems`, `stemIn` (Task 6).
- Produces: `ExamSidePanel({ draftId, question, changed, saved, number, of })`;
  `testAskOf(question: ExamQuestionIn): TestAsk` (in `exam.ts`).

- [ ] **Step 1: Write the failing tests**

```tsx
it("previews the editor's question as a test, unsaved changes included", async () => {
  // render the tab; type a new stem line → the preview shows it before any save; no "hint" text.
});

it("Phone narrows the preview and Dark marks its box dark", async () => {
  // click "Phone" → the preview box has max-w-[390px]; click "Dark" → an element with data-theme="dark" wraps it.
});

it("Checks lists the selected question's items with the failed count", async () => {
  // GET /checklist answers questions: [{id:"a", items:[{rule:"No hints", passed:true, detail:""},
  // {rule:"Level within one step of the node's", passed:false, detail:"…advanced…"}]}];
  // the tab reads "Checks 1"; opening it lists both items and the detail.
});

it("says checks are the last save's while the question has unsaved changes", async () => {
  // change the title → open Checks → "As last saved; leave the question to check again."
});

it("a question never saved is checked once saved", async () => {
  // + New → Checks → "Checked once saved."
});
```

Written out fully with `answering`, `findByRole("tab", { name: /Checks/ })` etc. Also, in
`exam.test.ts`:

```ts
it("asks a question in a test from what the editor holds", () => {
  const q = { ...examIn(examQuestion("a", "draft", "choice")), stem: [{ kind: "text", markdown: "Hi  " }] } as ExamQuestionIn;
  expect(testAskOf(q)).toMatchObject({ kind: "choice", stem: [{ kind: "text", markdown: "Hi\n" }], options: ["…the fixture's option texts…"] });
});
```

- [ ] **Step 2: Run them to see them fail** → FAIL.

- [ ] **Step 3: Implement**

`exam.ts`:

```ts
export function testAskOf(question: ExamQuestionIn): TestAsk {
  return {
    stem: stemIn(question.stem).map((b) =>
      b.kind === "sequence" ? { kind: "sequence", letters: b.letters ?? "" } : { kind: "text", markdown: b.markdown ?? "" },
    ) as Block[],
    kind: question.kind,
    options: (question.options ?? []).map((o) => o.text),
    unit: question.unit ?? "",
    steps: (question.steps ?? []).filter((s) => s.trim() !== ""),
  };
}
```

`ExamSidePanel.tsx`:

```tsx
// The Exam pool's side panel (M4.8d spec, M4P.7): the question as a test asks it, from what the
// editor holds — Desktop, Phone or Dark — and its checks as last saved, from the one checklist GET.
export function ExamSidePanel({ draftId, question, changed, saved, number, of }: {…}) {
  const [tab, setTab] = useState<"preview" | "checks">("preview");
  const [look, setLook] = useState<"Desktop" | "Phone" | "Dark">("Desktop");
  const checks = useDraftChecks(draftId, true);
  const items = checks.data?.questions?.find((q) => q.id === question.id)?.items ?? [];
  const failed = items.filter((i) => !i.passed).length;
  …
}
```

- The tab list (`role="tablist" aria-label="Question side panel"`): *Preview as in a test*,
  *Checks* with a count badge (`bg-open-soft text-open`, 11 px pill) when `failed > 0`.
- Preview: the Desktop/Phone/Dark segmented control (as `PreviewPanel`'s buttons, `aria-pressed`),
  then `<div data-theme={look === "Dark" ? "dark" : undefined} className={`mx-auto w-full ${look === "Phone" ? "max-w-[390px]" : ""} bg-bg text-ink`}>`
  holding `<TestQuestion key={look} ask={testAskOf(question)} number={number} of={of} phone={look === "Phone"} />`.
- Checks: `saved` false → *Checked once saved.*; `changed` → *As last saved; leave the question
  to check again.* above the items; pending → *Checking…*; error → `ErrorNotice`;
  `<CheckItems items={items} />`.

Mount in `ExamPoolTab` as the third column, fed by the editor's `onChange` (`shown`) or, before
the editor reports, the selected question.

- [ ] **Step 4: Run** — vitest `src/studio/workbench src/node`, typecheck, lint, build → PASS.

- [ ] **Step 5: Commit** — `feat(web): the exam pool's preview as in a test, and each question's checks — M4.8d.10`.

---

### Task 11: The walk, the board, the docs

**Files:**
- Create: `scratchpad/walk/exam-builder.mjs` (not committed)
- Modify: `CLAUDE.md` (the `apps/web` layout line: the workbench's exam builder; `node/` gains
  `TestQuestion`), `docs/notes/now.md` (M4.8d's line), a journal entry
  `docs/notes/journal/2026-10-13-m4-8d-build.md`

- [ ] **Step 1: Full suites with CI env** —
`uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest > /tmp/py.log; echo rc=$?` → rc=0;
`web.sh "npm run lint && npm run typecheck && npm test && npm run build"` → rc=0.

- [ ] **Step 2: The walk** — run the API (`runserver`), worker not needed, `npm run dev`; sign in
as an operator in headless Chrome (puppeteer-core on port 9222); open a new node's draft (Drafts
→ new node), its Exam pool tab; add four questions through the screen, one per kind (choice with
three options — one right, one misconception naming a callout you add on Content, one plain;
number; sequence with a sequence block in the stem; order with four steps); after each, open
Checks and read every item as passed; then the page's Checks (on another tab) says *four exam
questions* passed and Verify is clean. Screenshot each step into the scratchpad.

- [ ] **Step 3: Compare with the board** — open the published canvas
(https://claude.ai/artifact/1NUmoDUfo1x2oZ7ywhvCxx), `QuestionBuilder`, beside the screen at
1680 px, in light and in dark: the three columns and their widths, the list's rows (selected
inset bar), the stem panel and its *Add to stem* row, the answer panel's segmented kinds and the
option rows (letter tile, right option's green border and *Correct answer*, misconception line),
the rationale card, the side panel's tabs and checks. Fix each difference test-first where it is
behaviour, directly where it is a class; list the rest in the journal as M4P.1's later parts.

- [ ] **Step 4: Docs** — `now.md`: M4.8d built (the line for M4.8, the Exam pool tab, `Problem.question`,
`TestQuestion`); `CLAUDE.md`'s layout line; the journal entry (what was built, rulings, the walk,
the board comparison, deferred minors). `uv run pytest tests/repo` → pass.

- [ ] **Step 5: Commit** — `docs: M4.8d — the walk, the board and the journal`.
