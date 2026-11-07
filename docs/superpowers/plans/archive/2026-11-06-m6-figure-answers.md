# M6.6b Answering by the figure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A question answered by working a figure (trace a path in `kmer-graph`, pick a k-mer of a
tip or bubble in `graph-artifacts`), its right answer computed by the component; figures as choice
options; the composer's Interaction step.

**Architecture:** A figure file's `interact` names a task the kit declares (a Strategy per task:
schema, `check`, `answer`); `derived(component, data, interact)` adds `answer: {accept, wrong}`.
`code_schema` reads `interact`, adds the `figure` answer kind, fills each `FigureAnswer.accept` when
the folder is read, and grades by one rule: a selection (an ordered list of k-mers) is right iff it is
one of `accept`. The web twins the tasks in `kits.ts`, draws the question with one `FigureAnswer`
component over the kits' layout, and the composer gains Interaction between Data and Describe.

**Tech Stack:** Python 3.14 (pure `code-figures`, `code-schema`), Django + Ninja; React, TypeScript 7,
vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-11-06-m6-figure-answers-design.md` (M6FA.1–M6FA.9), #333.
Boards: https://claude.ai/artifact/GPnS518CbkYA3ox29G6Ree (generator: `nodeTrace`, `examPick`,
`examOptions`, `figureComposer('interaction')`, `benchExamFigure` in `.design/build_pages.mjs`).

## Global Constraints

- New codes exactly: CS1028 (no such task / fields off its schema), CS1029 (a task figure placed
  anywhere but as a figure question's figure), CS1030 (`trace`: a k-mer of `spells` not in the
  graph, a step no read holds, `spells` shorter than k + 1, or a k-mer twice), CS1031 (`trace` with
  `highlight: path`), CS1032 (`pick`: no run of that kind), CS0338 (a try `kind: figure` without a
  figure, or its figure has no task), CS0339 (a try option with both or neither of `text`, `figure`),
  CS0824 (an exam `kind: figure` without exactly one figure block in its stem, or that figure has no
  task), CS0825 (an exam option with both or neither). CS0306 retired, never reused. Each in
  `diagnostics.yml` with `explain`, a test naming it, then
  `uv run code-schema diagnostics --write docs/reference/diagnostics.md`.
- A selection is `list[str]` of k-mers, in order; `accept: list[list[str]]`; `wrong: list[str]`.
- `graph-artifacts` `marks: shown | hidden`, default `shown`; every existing file reads the same.
- `code-figures` imports stay within its allowlist; nothing new in `tests/guards/purity.py`.
- Colour (W10): a selection in progress is blue (`--sel`), a wrong checked one red (`--open`), the
  right answer teal (`--line`); every state is also in words (the `aria-live` line).
- Each k-mer a real `<button>`, tap area ≥ 44 px; asked, a figure shows no highlight, no spelling,
  no marks.
- Fixtures are test data; nothing goes to `comeni-code-content`.
- After an API change: `export_openapi_schema … --output apps/api/openapi.json`, then
  `npm run api-types`; after a schema change `npm run figure-types`; Node 24.

## Review Focus

1. **A trace in a graph with a cycle** (reads `ACGACGT`, k = 3, `spells: ACGACGT` visits ACG twice):
   CS1030 *holds ACG twice*, never a hang — `test_interact.py::test_trace_through_a_repeat_is_refused`
   and its `interact` case.
2. **A figure whose data changes under its task** (the author removes the read GTC belongs to after
   setting `pick: bubble`): the task's findings come back (CS1032) and Save waits, the preview keeps
   the last good drawing — `Interaction.test.tsx` "a task the data no longer fits blocks Save".
3. **Keyboard only**: Tab reaches every k-mer in reading order, Enter picks, a pick off the arrows
   is not taken and the live line says what can follow — `FigureAnswer.test.tsx` "trace by keyboard".
4. **A reviewer's answer to a figure question** reaches `review.py` as a list of strings; anything
   else (a string, a list of numbers, an unknown k-mer) is `NotAnAnswer`, 422, never a 500 —
   `test_review_figure.py::test_a_figure_answer_that_is_not_a_selection`.
5. **A figure placed twice** (as a try's figure and as a body block): CS1029 once, at the body
   block, and the try still reads — `test_figure_answers.py::test_task_figure_on_the_page`.

---

### Task 1: Tasks in `code-figures`

**Files:**
- Create: `packages/code-figures/src/code_figures/tasks.py`, `schemas/tasks/kmer-graph.trace.json`,
  `schemas/tasks/graph-artifacts.pick.json`; `tests/figures/test_interact.py`
- Modify: `kmer_graph.py`, `graph_artifacts.py` (+ `schemas/graph-artifacts.json`: `marks`),
  `registry.py`, `tests/figures/test_cases.py`, `tests/fixtures/figures/cases.json`,
  `packages/code-schema/src/code_schema/diagnostics.yml`

**Interfaces:**
- Produces: `tasks.Task(name, schema, check: (data, derived, fields) -> list[Finding], answer: (data,
  derived, fields) -> tuple[list[list[str]], list[str]])`; each kit module's `TASKS: Mapping[str,
  Task]`; `registry.figure_findings(component, data, interact=None) -> list[Finding]` (task findings
  at path `interact…`, only once data has none); `registry.derived(component, data, interact=None)`
  — with `interact`, the result gains `"answer": {"accept": [...], "wrong": [...]}`;
  `registry.tasks_of(component) -> Mapping[str, Task]`. Codes `NO_TASK = "CS1028"`, `NOT_A_TRACE =
  "CS1030"`, `SHOWS_ANSWER = "CS1031"`, `NO_ARTIFACT = "CS1032"` in `CODES`.

- [ ] **Step 1: Write the failing tests** in `test_interact.py`:
  `test_trace_accepts_the_spelled_path` (STARTER reads, `highlight: none`, `{task: trace, spells:
  ACGTTAG}` → `accept == [["ACG","CGT","GTT","TTA","TAG"]]`, `wrong == ["ACG","CGT","GTC"]`);
  `test_trace_with_no_branch_drops_the_last_kmer` (reads ACGTT only, spells ACGTT → wrong
  `["ACG","CGT"]`); `test_trace_off_the_graph` (spells ACGTCAG → CS1030 at `interact.spells`,
  message names `TCA`); `test_trace_shorter_than_k_plus_one` (spells ACG → CS1030);
  `test_trace_through_a_repeat_is_refused` (Review Focus 1); `test_trace_on_a_highlighted_path`
  (STARTER as is → CS1031); `test_pick_accepts_each_kmer_of_the_bubble` (graph-artifacts STARTER,
  `{task: pick, artifact: bubble}` → `accept == [["GTC"],["TCA"],["CAG"]]`, `wrong == ["ACG"]`);
  `test_pick_with_no_tip` (reads ACGTTAGC ×2, ACGTCAGC → CS1032); `test_no_such_task` (`{task: walk}`
  → CS1028 at `interact.task`); `test_fields_off_the_schema` (`{task: trace}` → CS1028);
  `test_marks_default_shown` (graph-artifacts STARTER with and without `marks: shown` derive the
  same); every code in `CODES`.
- [ ] **Step 2: Run** `uv run pytest tests/figures/test_interact.py -q` — FAIL (no `tasks`).
- [ ] **Step 3: Implement.** `kmer_graph.TASKS = {"trace": …}`: fields `spells` (letters, `^[ACGT]+$`,
  ≤ 20). `accept` is `kmers_of(spells, k)`; check, in order: length < k + 1, a k-mer twice, a k-mer
  not in `derived["kmers"]`, `missing_step` over `derived["edges"]`. `wrong`: walk `accept[0]` to the
  first k-mer with an out-edge not on the path, append that edge's target; none → `accept[0][:-1]`.
  `graph_artifacts.TASKS = {"pick": …}`: fields `artifact: tip|bubble`; `accept` one selection per
  k-mer of every artifact of that kind, in `derived` order; `wrong` `[first solid k-mer]`. Task
  schemas live in `schemas/tasks/` so `readSchemas` (web) and `_component` never read them as kits.
- [ ] **Step 4: Add `interact` cases to `cases.json`** (a new top-level list: `{name, component,
  data, interact, codes, answer?}`) for every test above; `test_cases.py` runs them through
  `figure_findings` and `derived`.
- [ ] **Step 5: Declare the codes** in `diagnostics.yml` (CS1028, CS1030–CS1032); run `uv run pytest
  tests/figures tests/schema/test_diagnostics.py -q` — PASS.
- [ ] **Step 6: Commit** `feat(figures): a kit's tasks and the answers they compute (#333)`.

### Task 2: The format — `interact`, the figure kind, figure options

**Files:**
- Modify: `packages/code-schema/src/code_schema/figures.py`, `questions.py`, `exam.py`, `writer.py`,
  `diagnostics.yml`
- Test: `tests/schema/test_figure_answers.py`

**Interfaces:**
- Consumes: Task 1's `figure_findings(component, data, interact)`.
- Produces: `FigureFile.interact: Mapping[str, object] | None`; `FigureAnswer(kind="figure",
  figure: str, accept: tuple[tuple[str, ...], ...] = ())` in the `Answer` union; `Option.text: str`
  and `Option.figure: str | None` (exactly one non-empty); `KINDS` gains `"figure"`.

- [ ] **Step 1: Write the failing tests:** a figure file with `interact` reads (no CS1025) and its
  task findings come back at the file (`interact.spells: …`, CS1030); a try `kind: figure` with
  `figure: trace-path` parses to `FigureAnswer("trace-path")`; a try `kind: figure` with no `figure:`
  is CS0338; with `options:` is CS0337; a try option `{figure: options-tip}` parses, `{text: A,
  figure: b}` and `{right: true}` are CS0339; the exam's `kind: figure` with one figure block in its
  stem parses to `FigureAnswer(<that stem>)`, with none or two is CS0824; an exam option with both
  is CS0825; `kind: figure` no longer says CS0306; the writer round-trips each byte for byte.
- [ ] **Step 2: Run** `uv run pytest tests/schema/test_figure_answers.py -q` — FAIL.
- [ ] **Step 3: Implement.** `_KEYS` in `figures.py` gains `interact`; `_FIELDS["figure"] = ("figure",)`
  for a try (the key it already reads); remove `_LATER_KINDS`; the option parser takes `figure`
  (a `STEM`) in both `OptionRules` (`keys` gain `"figure"`); duplicate-text checks compare an
  option's text or `figure:<stem>`. CS0306 stays in `diagnostics.yml` marked retired.
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` — PASS (the writer tests included).
- [ ] **Step 5: Commit** `feat(schema): the figure answer kind and figure options (#333)`.

### Task 3: The folder — placement, `accept`, grading

**Files:**
- Modify: `packages/code-schema/src/code_schema/node.py` (`parse_node_files`), `grading.py`,
  `diagnostics.yml`
- Test: `tests/schema/test_figure_answers.py`, `tests/schema/test_grading.py`

**Interfaces:**
- Consumes: Task 2's `FigureAnswer`, `FigureFile.interact`; Task 1's `derived`.
- Produces: a read `Node` whose every `FigureAnswer` has `accept` filled; `score(answer, given)`
  unchanged in signature: for `FigureAnswer`, `given` must be a `list[str]` (else `NotAnAnswer`), 1.0
  iff `tuple(given) in answer.accept`; an empty `accept` is `NotAnAnswer`.

- [ ] **Step 1: Write the failing tests:** `test_task_figure_on_the_page` (Review Focus 5); a task
  figure above a choice try is CS1029; as an option is CS1029; a try `kind: figure` whose figure has
  no `interact` is CS0338, an exam one CS0824; a read folder's try `FigureAnswer.accept` is the five
  k-mers; `score` gives 1.0 for that list, 0.0 for `["ACG","CGT","GTC"]`, `NotAnAnswer` for
  `"ACG"`, `[1, 2]` and for an answer with no `accept`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** in `parse_node_files`, after `parse_figures`: a function
  `_figure_answers(node, exam, figures, *, where) -> tuple[Node, tuple[ExamQuestion, ...],
  list[Problem]]` that checks placements (a figure with `interact` may be named only by a
  `FigureAnswer`) and replaces each `FigureAnswer` with its `accept` from
  `derived(component, data, interact)["answer"]["accept"]`. A placement counts toward CS1021 as
  today; an option's figure is a placement too.
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` — PASS; `uv run code-schema validate
  tests/fixtures/salmon` — no problems.
- [ ] **Step 5: Commit** `feat(schema): a figure answer's right selections, read with its folder (#333)`.

### Task 4: The API

**Files:**
- Modify: `apps/api/src/code_api/content/models.py` (+ migration), `index.py`, `reads.py`,
  `schemas.py`; `studio/schemas.py` (questions in and out, options, `derived`), `studio/review.py`;
  `apps/api/openapi.json`; `apps/web/src/api/schema.ts`
- Test: `apps/api/tests/test_figure_answers_api.py`, `apps/api/tests/test_review_figure.py`

**Interfaces:**
- Produces: `NodeFigure.interact` (JSON, null); `FigureOut.interact: dict | None` and
  `derived.answer`; `OptionOut.figure: str | None` (`text` `""` for a figure option); `QuestionOut`
  and the Studio question schemas take `kind: "figure"`; the edit path saves both.

- [ ] **Step 1: Write the failing tests:** `GET /api/nodes/de-bruijn-graphs` on a fixture copy with
  `trace-path` sends `interact` and `derived.answer.accept`; a draft saves a try `kind: figure` and a
  figure option through the content API and reads them back; a reviewer answers the figure try with
  the five k-mers and it is right, with `["ACG","CGT","GTC"]` wrong; Review Focus 4.
- [ ] **Step 2: Run** `uv run pytest apps/api/tests/test_figure_answers_api.py
  apps/api/tests/test_review_figure.py -q` — FAIL.
- [ ] **Step 3: Implement**; `derived(...)` calls in `index.py` and `studio/schemas.py` pass
  `figure.interact`. `review.py` needs no change beyond accepting a list for `given`.
- [ ] **Step 4: Run** `makemigrations --check`, the export, `npm run api-types`, `uv run pytest -q`
  with CI's `env:` — PASS.
- [ ] **Step 5: Commit** `feat(api): figure answers and figure options in the index and Studio (#333)`.

### Task 5: The web twins and grading

**Files:**
- Modify: `apps/web/src/figures/kits.ts`, `figures/domain/kmerGraph.ts`, `graphArtifacts.ts`,
  `figures/read.ts` (`interact` key), `scripts/generate-figure-types.ts` (task schemas →
  `TASK_SCHEMAS`), `figures/schemas.ts` (generated), `figures/cases.test.ts`, `node/grading.ts`
- Test: `figures/cases.test.ts`, `node/grading.test.ts`

**Interfaces:**
- Produces: `figureFindings(component, data, interact?)`, `derive(component, data, interact?)`
  (adds `answer`), `TASKS: Partial<Record<Component, Record<string, string>>>` (task → label:
  `"Trace a path"`, `"Pick a k-mer"`); `score(question, given)` with `given: string | string[]`: a
  figure question is right iff `given` equals one of `figure.derived.answer.accept`
  (`score(question, given, figure?: FigureOut)`); a choice compares `option.text || option.figure`.

- [ ] **Step 1:** `cases.test.ts` runs the `interact` cases; `grading.test.ts`: the trace and pick
  examples of Task 3, and a figure option right by its stem — FAIL.
- [ ] **Step 2: Implement**, same codes, paths and messages as Task 1.
- [ ] **Step 3: Run** `npm test -- figures node/grading`, `npm run typecheck` — PASS.
- [ ] **Step 4: Commit** `feat(web): the tasks twinned, and a figure answer graded (#333)`.

### Task 6: `FigureAnswer`, the learner's component

**Files:**
- Create: `apps/web/src/figures/answer/selection.ts`, `FigureAnswer.tsx`, `FigureAnswer.test.tsx`,
  `selection.test.ts`
- Modify: `figures/domain/KmerGraphFigure.tsx`, `GraphArtifactsFigure.tsx`, `parts.tsx` (a `SELECTED`
  and `WRONG` tone), `figures/registry.ts` (`KitProps` gains optional `view: FigureView`)

**Interfaces:**
- Produces: `type FigureView = { asked: boolean; selection: string[]; tone: "sel" | "open" | "line";
  next: string[] }`; `selection.ts`: `follows(edges, selection, kmer) -> boolean`, `nextOf(edges,
  selection) -> string[]`, `pick(task, edges, selection, kmer) -> string[] | null` (null: not taken),
  `said(task, selection, derived) -> string` (the live line); `FigureAnswer({ record, state,
  onChange, onCheck? })` with `state: "start" | "midway" | "wrong" | "answered"` derived from the
  selection and its check; the kits draw `view` (asked: no highlight, no spelling, marks hidden) and
  the selection's tones and order badges (pick: no badges).

- [ ] **Step 1: Write the failing tests:** `selection.test.ts` — `pick` refuses a k-mer with no
  arrow from the last, takes the first k-mer anywhere, `nextOf` after GTT is `["TTA"]`; a pick
  replaces the one selection. `FigureAnswer.test.tsx` — "trace by keyboard" (Review Focus 3); every
  k-mer is a `button` with an accessible name and `aria-pressed`; the asked figure has no
  "path spells" text and no `data-artifact` mark; answered draws the accepted path; at 390 px each
  button's box is at least 44 px (from its style).
- [ ] **Step 2: Run** `npm test -- figures/answer` — FAIL.
- [ ] **Step 3: Implement.** Buttons are absolutely positioned over the SVG from `layoutKmers`'s
  boxes, scaled with the drawing; the SVG gets `aria-hidden`. Undo, Clear (and Check when
  `onCheck`) as on the L5 board.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(web): answering by the figure, by pointer and keyboard (#333)`.

### Task 7: The try, the test question and Review

**Files:**
- Modify: `apps/web/src/node/TryQuestion.tsx`, `TestQuestion.tsx`, `node/body.ts` (an option's
  figure), the review block view that draws questions (`studio/review/`)
- Test: `node/TryQuestion.test.tsx`, `node/TestQuestion.test.tsx`, `node/debruijn.fixture.ts`

**Interfaces:**
- Consumes: Task 6's `FigureAnswer`; Task 5's `score`.
- Produces: `kind: "figure"` in `TryQuestion` (states and hints as the other kinds; a wrong check
  keeps the selection) and `TestQuestion` (the stem's other blocks, then `FigureAnswer`; no
  feedback); figure options as a 2 × 2 grid (one column under 640 px), each drawn by `Figure` and
  named by its alt text.

- [ ] **Step 1:** tests — a try through its four states with the trace fixture; a test question
  with figure options picks B by its alt text; the reviewer's answer to a figure question is sent as
  the selection — FAIL.
- [ ] **Step 2: Implement; Step 3: run `npm test` — PASS; Step 4: commit**
  `feat(web): figure questions and figure options on the page and in Review (#333)`.

### Task 8: The composer's Interaction step

**Files:**
- Create: `apps/web/src/studio/composer/Interaction.tsx`, `StateStrip.tsx`, `Interaction.test.tsx`
- Modify: `ComposerPage.tsx` (`Steps`: Interaction only when `TASKS[component]`), `ChecksList.tsx`,
  `useWorkingCopy.ts` (`interact` into `derive`), `Choose.tsx` (`onlyTasks` filter for *New figure*
  from a figure answer)

**Interfaces:**
- Consumes: Task 5's `TASKS`, `figureFindings`, `derive`; Task 6's `FigureAnswer`; `setAt` /
  `removeAt` from `figures/document.ts`.
- Produces: `StateStrip({ record })` — four `FigureAnswer`s in `start`, `midway` (trace: first
  `ceil(n/2)` of `accept[0]`; pick: `accept[0]`, unchecked), `wrong`, `answered`, each in an error
  boundary that reports whether it drew; checks *One right answer* (`n` selections), *A wrong answer
  exists* (names `wrong`), *Every state draws* (`4 of 4`).

- [ ] **Step 1:** tests — choosing *Trace a path* writes `interact: {task: trace, spells: …}` and
  keeps every other line as written; *Nothing* removes it; ACGTCAG shows CS1030 with *Go to*; Review
  Focus 2; a state that throws fails *Every state draws* and blocks Save — FAIL.
- [ ] **Step 2: Implement; Step 3: run `npm test` — PASS; Step 4: commit**
  `feat(web): the composer's Interaction step (#333)`.

### Task 9: The workbench — Figure answers and figure options

**Files:**
- Modify: `apps/web/src/studio/workbench/AnswerEditor.tsx` (`AnswerKind` gains `"figure"`,
  `switchedKind`, `KindSwitch`), `ExamEditor.tsx`, the try editor in Content, `edits.ts`
- Test: `AnswerEditor.test.tsx`, `ExamEditor.test.tsx`

**Interfaces:**
- Produces: the Figure kind — a select of the node's figures with a task, *New figure* (opens the
  composer at Choose with `onlyTasks`), the computed answer beneath, *Open in the composer*
  (Interaction); an option editor with *text or figure* (figures without a task). In an exam
  question the chosen figure is written as the stem's figure block.

- [ ] **Step 1:** tests — switching to Figure clears the other kinds' fields; a figure option saves
  as `{figure: …}`; the select lists only figures with a task — FAIL.
- [ ] **Step 2: Implement; Step 3: run `npm test` — PASS; Step 4: commit**
  `feat(web): figure answers and figure options in the workbench (#333)`.

### Task 10: The fixture, the walk, the journal

**Files:**
- Create: `tests/fixtures/salmon/algorithms/de-bruijn-graphs/figures/{trace-path,error-bubble,
  options-tip,options-bubble,options-clean,options-loop}.yaml`, `…/exam.yaml`
- Modify: `…/node.yaml` (the try `trace-the-path` after `green-path`), `…/body.md`, the counting
  tests (find blocks by their content), `apps/web/src/node/debruijn.fixture.ts`,
  `docs/notes/journal/`

- [ ] **Step 1:** write the files as M6FA.8 says, the option figures with the reads the L13 board
  draws (tip: ACGTTAG ×2, ACGTTC; bubble: ACGTTAG ×2, ACGATAG; clean: ACGTTAG ×2; loop: TACGACGT ×2),
  `marks: hidden`; `uv run code-schema validate tests/fixtures/salmon` — no problems.
- [ ] **Step 2:** the whole suites with CI's `env:`, lint, typecheck, build — PASS.
- [ ] **Step 3: Walk M6FA.9's done-when 1–5** on the Compose stack (`--build`, the index rebuilt),
  compared with the boards at 1440 light and dark and at 390; every defect an issue first.
- [ ] **Step 4:** a journal entry (what changed, decisions, traps, what is next); commit
  `test(fixtures): the de Bruijn page's figure answers (#333)` and `docs(journal): …`.
