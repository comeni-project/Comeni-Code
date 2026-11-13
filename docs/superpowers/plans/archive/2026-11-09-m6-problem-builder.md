# M6.8b — The problem builder: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an author builds a node's problem in the workbench's Problem tab and a reviewer sees it in
Review.

**Architecture:** the server gains problems that name their field, kits that describe themselves
(served by `GET /api/studio/problem-kits`) and a fuller `NodeProblemOut`. The web gains a general
YAML document module, a problem form over it (`studio/problem/`), a tab-switch guard, and Review's
problem panel. Save is one `PUT /problem` with the document written back.

**Tech Stack:** Django Ninja, pytest; React 19, TypeScript 7, TanStack Query, the `yaml` package,
vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-11-09-m6-problem-builder-design.md` (M6PB.1–M6PB.7). Issue #424.

## Global Constraints

- `problem.yaml` is never regenerated: every edit goes through the YAML document's ops; untouched
  lines stay byte for byte.
- A block scalar (`|`, `>`) stays a block scalar when its text is edited.
- Only the server runs the self-test and a kit's `rules`; the browser checks schema, counts, empties,
  callouts.
- Tab key `problem`, between `links` and `settings`; label *Problem*.
- The kits endpoint: `GET /api/studio/problem-kits`, `studio(Role.AUTHOR)`, fetched with
  `staleTime: Infinity`.
- Copy fixed by the spec: *Save problem*, *Checking with 20 seeds…*, *Start from this kit*, *Remove the
  problem and its block? This can't be undone in the draft.*, *Save the problem first?* (Save ·
  Discard · Stay), *the checker's sentence only*, *Add a misconception callout in Content*,
  *What the learner doesn't see until they answer*, *Self-test · passed*.
- No new learner-visible field: `LearnerProblemOut` is unchanged.

## Review Focus

1. **A problem file written by hand** (comments, odd key order, `statement: >`): the form opens it and
   a one-field edit changes one line (Task 3 and Task 5 tests).
2. **A callout renamed in Content while the problem maps the old title**: a browser finding under
   `mistakes.<name>` before Save (Task 4 test).
3. **Switching kit with mappings and params set**: the confirm, then params, sample and mistakes are
   the new kit's example and nothing of the old kit remains (Task 5 test).
4. **Save refused with problems on keys the form shows and on ones it doesn't** (`kit`, a seed): each
   lands under its field or above the form; the text is kept (Task 5 test).
5. **Clicking another tab, then Save in the confirm, and the save is refused**: the tab stays, the
   problems show (Task 6 test).

---

### Task 1: Problems that name their field (`code-schema`, `code-problems`, API)

**Files:**
- Modify: `packages/code-schema/src/code_schema/problem_file.py` (`wrong`, the self-test loop, CS1110,
  CS1111), `packages/code-problems/src/code_problems/self_test.py` (CS1104 once per mistake),
  `apps/api/src/code_api/studio/api.py:592-596` (the refusal's sentence)
- Test: `tests/schema/test_problem_file.py` (or the file pinning CS11xx today), `tests/problems/test_self_test.py`,
  `apps/api/tests/test_problem_api.py`

**Interfaces:** Produces `Problem.field` for every problem from `problem.yaml`: CS1107 its key; CS1106
`kit`; CS1110 `mistakes.<name>`; CS1111 `hints[i]`; self-test findings their `path` (`params.k`,
`sample.params`, `mistakes.<name>`, `kit`, `params`). Messages unchanged.

- [ ] **Step 1: Failing tests**: `test_each_problem_names_its_field` parametrised over a file per code
  (CS1101 `params.k`, CS1102 `sample.params`, CS1104 `mistakes.duplicates`, CS1106 `kit`, CS1107
  `rung`, CS1110 `mistakes.duplicates`, CS1111 `hints[0]`); `test_cs1104_once_per_mistake` (a kit whose
  mistake maker returns the answer: exactly one CS1104 finding, naming seed 0 or the sample);
  API: a refused `PUT /problem` answers `detail == "The problem would not validate."` and a problem
  with `field == "params.k"`.
- [ ] **Step 2: Run** `uv run pytest tests/schema tests/problems apps/api/tests/test_problem_api.py -q` → FAIL.
- [ ] **Step 3: Implement** `wrong(code, message, key=None, field=None)` (field defaults to `key`); the
  self-test loop passes `field=found.path`; `self_test` keeps the first CS1104 per mistake name; the
  refusal sentence says *problem* for `ProblemRefused`, *figure* for `FigureRefused`.
- [ ] **Step 4: Run** the same → PASS; the whole `tests/schema` (messages and order pinned).
- [ ] **Step 5: Commit** `feat(schema): a problem's problems name their field; CS1104 once per mistake (#424)`.

### Task 2: Kits describe themselves; the endpoint; a fuller `NodeProblemOut`

**Files:**
- Modify: `packages/code-problems/src/code_problems/kit.py`, `de_bruijn_edges.py`, `count_kmers.py`
- Create: `apps/api/src/code_api/studio/kits_api.py`; modify `apps/api/src/code_api/api.py`
  (mount `/studio/problem-kits`), `studio/schemas.py` (`ProblemKitOut`, `NodeProblemOut`)
- Test: `tests/problems/test_kits.py`, `apps/api/tests/test_problem_kits.py` (new),
  `apps/api/tests/test_problem_api.py`

**Interfaces:**
- `Kit` gains `about: str`, `says: Mapping[str, str]` (one line per mistake), `example: Mapping[str, object]`
  (`{"params": …, "sample": {"seed": 1, "params": …}}`).
- `ProblemKitOut(name, rung, about, schema: dict, mistakes: list[KitMistakeOut(name, says)], example: dict, sample_dataset: str, sample_output: str)`.
- `NodeProblemOut` gains `rationale: str` and `mistakes: list[MappedMistakeOut(name, callout)]`.

- [ ] **Step 1: Failing tests**: each kit's `says` has exactly its `mistakes`' names; each example
  passes `self_test` with no findings and its sample costs ≤ 2,000; `GET /api/studio/problem-kits` as
  an author lists both kits in registry order with a computed sample, 401 signed out; a draft's
  `node.problem` carries `rationale` and `mistakes == [{"name": "duplicates", "callout": "Every edge appears once"}]`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; de-bruijn-edges' example: the fixture's params and sample; count-kmers':
  `{k: 8, genome: [300, 400], read: 30, coverage: 8, errors: 0}`, sample seed 1 at a small range.
- [ ] **Step 4: Run** → PASS; `export_openapi_schema`, `npm run api-types`, `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(api): the problem kits described, and a draft's problem in full (#424)`.

### Task 3: A general YAML document that keeps block scalars

**Files:**
- Move: `apps/web/src/figures/document.ts` → `apps/web/src/yaml/document.ts` (and its test); update the
  composer's and figures' imports
- Test: `apps/web/src/yaml/document.test.ts`

**Interfaces:** `YamlDocument` (was `FigureDocument`), `openFile`, `apply`, `setAt`, `insertAt`,
`removeAt`, `moveAt`, `lineOf`, `linesKept`, `pathText`, `pathParts`, `writeFile`, `Path`, `Value`, `Op`.

- [ ] **Step 1: Failing tests**: `setAt(openFile("statement: |\n  one\n  two\n"), ["statement"], "one\nthree\n")`
  writes `statement: |\n  one\n  three\n`; the same for `>`; a plain one-line value stays plain; every
  composer test still passes (the move is checked by the whole suite).
- [ ] **Step 2: Run** `npm test -- yaml` → FAIL.
- [ ] **Step 3: Implement**: `git mv`; rename the type; in `scalarFor`, a string written with newlines
  whose old node was `BLOCK_LITERAL` or `BLOCK_FOLDED` keeps that type.
- [ ] **Step 4: Run** the whole web suite, `typecheck`, `lint` → PASS.
- [ ] **Step 5: Commit** `refactor(web): the YAML document is general, and keeps block scalars (#424)`.

### Task 4: The problem as a form: what it can hold, its findings, its params

**Files:**
- Create: `apps/web/src/studio/problem/formable.ts`, `findings.ts`, `ParamsForm.tsx`, their tests;
  `apps/web/src/api/kits.ts` (`fetchKits`); `queries.ts` (`queryKeys.problemKits`, `useProblemKits`)

**Interfaces:**
- `problemFormable(doc: YamlDocument, kits: ProblemKitOut[]): { ok: true } | { ok: false; why: string }`
  (the composer's general checks, then the shapes of M6PB.2).
- `problemFindings(doc: YamlDocument, kit: ProblemKitOut, callouts: string[]): Finding[]`, each
  `{ path: string; message: string }` with `path` as the server's `field` (`params.k`, `hints`,
  `mistakes.duplicates`, `title`).
- `ParamsForm({ schema, root, doc, onChange, findings })`: one labelled input per property; `root`
  is `["params"]` or `["sample", "params"]`; a two-number array as two inputs; hint = the bounds.
- `useProblemKits()` with `staleTime: Infinity`.

- [ ] **Step 1: Failing tests**: formable refuses (with its sentence) an unknown kit, a stray key,
  `hints: text`, a tag; takes the fixture file. Findings: `k: 2` → `params.k` (from `validate`), an
  empty title, four hints, a mapping to a title the callouts lack (the Review Focus 2 case), a mistake
  the kit doesn't declare. ParamsForm: count-kmers' `genome` as two inputs; typing `9` writes one op
  on `params.k`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; lint, typecheck.
- [ ] **Step 5: Commit** `feat(web): the problem file as a form, checked in the browser (#424)`.

### Task 5: The Problem tab

**Files:**
- Create: `apps/web/src/studio/problem/ProblemTab.tsx`, `KitCards.tsx`, `ProblemForm.tsx`, their tests;
  `edits.ts` gains `setProblem(text)` and `removeProblem()`
- Modify: `studio/workbench/WorkbenchPage.tsx` (the tab), `studio/workbench/BlockList.tsx` or
  wherever the problem row is (its *Open in the Problem tab* link to `?tab=problem`)

**Interfaces:** `setProblem = (text: string): Edit` (`PUT problem`, `{text}`); `removeProblem = (): Edit`
(`DELETE problem`). `ProblemTab({ draftId, node, editable })`.

Drawn as `WorkbenchProblem` and `WorkbenchProblemNew`. The tab holds the working text in state, opened
from `node.problem.text` (or from *Start from this kit*: a file of `title`, `rung`, `statement`,
`given`, `return` empty, `kit`, the example's `params` and `sample`, one empty hint, `rationale`
empty). The form's fields write ops (M6PB.3); a kit change asks first in the page. Save: one
`useDraftEdit` mutation with `setProblem(written)`; while pending the button reads *Checking with 20
seeds…*; CA0208 problems by `field` under their fields, the rest above; CA0203 the tab's sentence.
Remove: the inline confirm, then `removeProblem()`. Read-only when not editable.

- [ ] **Step 1: Failing tests**: the kit cards from the endpoint; start, fill the words, map
  `duplicates`, Save sends one PUT whose text keeps the untouched lines; a param out of bounds disables
  Save and shows under its field; a refusal with `field: "mistakes.duplicates"` and one with
  `field: "kit"`; Edit as YAML and back; a file that cannot be a form stays in YAML with its reason;
  switching kit asks and replaces params, sample, mistakes; Remove asks then sends DELETE; a
  submitted draft shows no Save; Content's problem row links to the tab.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole web suite, lint, typecheck, build → PASS.
- [ ] **Step 5: Commit** `feat(web): the Problem tab, built as a form over problem.yaml (#424)`.

### Task 6: Unsaved problem edits guarded

**Files:**
- Create: `apps/web/src/studio/workbench/tabHold.tsx` (`TabHoldProvider`, `useHoldTab`,
  `LeaveTabConfirm`), test
- Modify: `WorkbenchPage.tsx` (the tab bar asks a held tab before switching),
  `studio/composer/useLeaveGuard.ts` (`useLeaveGuard(unsaved, sentence = LEAVE)`), `ProblemTab.tsx`

**Interfaces:** `useHoldTab(hold: { save: () => Promise<boolean> } | null)`: a tab with unsaved work
registers how to save it; the tab bar, on a click while held, shows `LeaveTabConfirm` (*Save the
problem first?* Save · Discard · Stay): Save runs `save()` and switches only if it returns true.
`ProblemTab` uses `useLeaveGuard(unsaved, "Leave the problem? What you changed here is not saved.")`.

- [ ] **Step 1: Failing tests**: unsaved, click Settings → the confirm; Stay stays; Discard switches and
  drops the text; Save with a refused save stays and shows the problems (Review Focus 5); saved → no
  confirm; leaving the draft asks with the problem's sentence; the composer's sentence unchanged.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole web suite → PASS.
- [ ] **Step 5: Commit** `feat(web): unsaved problem edits held when you switch tab or leave (#424)`.

### Task 7: Review's problem key

**Files:**
- Modify: `apps/web/src/studio/review/BlockPanel.tsx` (`Content` draws `content.problem`; `Changes`
  diffs its text by line)
- Test: `apps/web/src/studio/review/BlockPanel.test.tsx` (or the review page test)

Drawn as `ReviewProblem`: `Problem` with no live part; *What the learner doesn't see until they
answer*: Rationale, Mistakes named (each `name → the callout <title>`, the kit's other mistakes →
*the checker's sentence only*, from the kits endpoint), Dataset (`kit · params`), Self-test (*passed
on the sample and seeds 0–19*); `problem.yaml` in an open `<details>`. Changes: the before's and
after's text by line.

- [ ] **Step 1: Failing tests**: a problem key draws the title, the rationale, `duplicates →` its
  callout, the file; Changes marks a changed line.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(web): Review draws a problem key (#424)`.

### Task 8: Walk, check, journal

- [ ] **Step 1:** CI's commands with CI's `env:`, `pytest -v` as CI runs it (no name over 300), the
  whole web suite, build.
- [ ] **Step 2:** Compose `--build`, worker and beat stopped; walk M6PB.7 in headless Chrome at 1680
  light and dark: a new problem from a kit to saved; a param out of bounds; a refused save; YAML and
  back; a kit change; Remove; switching tab unsaved; a reviewer's problem key. Compare with the three
  boards.
- [ ] **Step 3:** A journal entry. **Step 4: Commit** `docs(journal): M6.8b (#424)`.
