# M4.8d — The exam pool's builder

**Status: agreed 2026-10-13.** The fourth and last slice of M4.8 (#126), issue #263. Designed with
the operator in conversation on 2026-10-13, section by section, against the S3 *Exam pool* board
(`QuestionBuilder`). The rule from M4.8c holds: **the boards are the truth, not the code.**

M4.8c (archived `2026-10-09-m4-exam-questions-design.md`) gave the format and the API: an exam
question is a title, a claim, a level, a stem of blocks, one of four answers and a rationale, and
the API adds, updates and deletes one (`POST/PUT/DELETE …/exam`) and says whether the live index
holds it unchanged (*approved*) or not (*draft*). The Exam pool tab shows only a count. This part
builds the screen.

It decides:

- the scope, against the board (M4P.1);
- problems that know their question (M4P.2);
- the stem sent as blocks (M4P.3);
- the checks of one question (M4P.4);
- the screen: the list and the editor (M4P.5);
- one answer editor for both pools (M4P.6);
- the preview as in a test (M4P.7);
- tests and *done when* (M4P.8).

---

## M4P.1 Scope

| Part of the board | Here? |
|---|---|
| The question list: Q*n* · kind, title, approved or draft, *+ New*, the note under it | **Yes** |
| The editor: title, *tests the claim*, level, the stem as blocks, the answer (Choice, Number, Sequence, Order), options with misconception or *plain*, *+ Option*, rationale | **Yes** |
| *Preview as in a test* with Desktop, Phone and Dark | **Yes** |
| *Checks* for one question, as ticks | **Yes** |
| Sequence and order try questions edited in the workbench (M4.8c left a note) | **Yes** (M4P.6) |
| A question's score in the list, the *Score* tab, *Draft a question with AI* | M5 |
| Figure, image, math, table and code stem blocks; options holding figures; *Figure interaction*; seeded *Variants* and the 20-seed check | M6 |
| *History* | later, with the workbench's |
| Reordering questions | no: a self-test shuffles them |

The deferred minors (#260, #265) are fixed at the end of the MVP's first loop, not here.

## M4P.2 Problems that know their question

A check of one question needs the problems about that question, and today a problem has only a
file and a line. code-schema's `Problem` gains **`question: str | None`**: the id of the question
a problem was found in, set by the reading of a question entry once its id is read, in both
pools. That includes a stem's block problems, which `_read_stem` appends to the field's list
itself. Problems about the pool as a whole (CS0813, fewer than four) and about a node's fields
carry none, nor do problems found before a question's id is known (CS0805, no id). The API's
`ProblemOut` passes it through; `__str__` and the `validate` output do not change.

**Rejected:** mapping problems to questions by line range in the API (a second reading of where a
question starts, which the reader already knows); showing exam.yaml's problems for the whole pool
(not the board).

## M4P.3 The stem sent as blocks

`ExamQuestionIn.stem` becomes **`list[BlockIn]`**, the block the page's editor already sends. The
API turns them into blocks and writes the MyST with code-schema's own `write_blocks`; the save
then reads the files back as every save does, so:

- a try block or a callout in a stem is refused by its existing code (the stem holds text and
  sequences);
- a stem that does not read back as sent is refused as garbled (#174);
- a line ending in spaces or holding a tab is refused by CS0823.

`StudioExamQuestionOut` keeps `stem` (blocks) and `stem_text`. Nothing else in the API changes.

**Rejected:** a second MyST writer in TypeScript (two writers that can drift); the stem as one
MyST text box (not *blocks, as on a page*, and no *Add to stem*).

## M4P.4 The checks of one question

The checks response (`GET …/checks`, one request, M4K.6) gains **`questions: [{id, items}]`**, an
item for each rule that applies to the question's answer kind. The rules are one table in
`drafts.py`, a row each: what it says, the kinds it applies to, and the diagnostic codes that
break it. A rule fails when a problem carrying the question's id (M4P.2) has one of its codes;
the problem's message is the item's detail. The items are `Item`, as the draft's checklist, so
`CheckItems` draws both.

The rules (the plan fixes each row's codes from `diagnostics.yml`):

| Rule | Kinds |
|---|---|
| A title and a stem | all |
| The stem holds only text and sequences | all |
| Level within one step of the node's | all |
| No hints | all |
| A rationale | all |
| One right option | choice |
| Each wrong option names a misconception or is plain | choice |
| A number, with its unit and tolerance sound | number |
| An answer of letters the sequence allows | sequence |
| Steps that are all different, at least the minimum | order |

A saved question holds only warnings (an error refuses the save, M4E.4), so on a saved question
an item fails only on a warning; errors reach the editor as a refusal (M4P.5).

**Rejected:** only the problems found, with *No problems* otherwise (not the board's ticks).

## M4P.5 The screen: the list and the editor

The Exam pool tab, in the board's three columns (list 230 px, editor, side panel 460 px); below
the workbench's `xl` breakpoint they stack: list, editor, side panel. The board gives this tab
its own side panel, so the tab takes the whole width: a workbench tab may say it brings its own
side panel, and then the page's Preview and Checks are not drawn beside it.

**The list.** Each row: *Q*n* · kind*, the title, and *approved* or *draft*; the selected row as
the board draws it. *+ New* opens a blank choice question in the editor, named by the first free
`<node>-q<n>` across both pools (their ids are shared, CS0811), with the try editor's
`newQuestion`. It is not saved until first left. Under the list, the board's note: *A node needs
at least 4 approved questions to be included in tests. No hints in exam questions.* The header's
count stays.

**The editor** holds one question in local state, inside `LeaveToSave` (M4K.3): when focus leaves
it, the question saves — POST when new, PUT otherwise, nothing when unchanged. Choosing another
question in the list is leaving. A refused save shows `RefusalNotice` and keeps what was typed,
as blocks do. In order:

- the header row: the title, *tests the claim:* and the level (*the node's level* by default);
- **Stem** — *blocks, as on a page*: each block opens in the existing `BlockEditor` (Markdown for
  text, letters for a sequence), with move and delete, all in the question's local state; then
  *Add to stem* with **text** and **sequence**;
- **Answer** — the kind switch (Choice, Number, Sequence, Order) and the kind's editor (M4P.6);
- **Rationale** — *shown only in results*;
- *Delete question*, as a block's delete.

`edits.ts` gains `addExam`, `updateExam` and `deleteExam`, sent by `sendEdit` like every edit.

## M4P.6 One answer editor for both pools

The kind switch and the four kinds' editors move out of `TryEditor` into **`AnswerEditor`**,
which the try editor and the exam editor both use:

- **Choice** — each option a letter, its text and a *right* mark; in the exam pool each wrong
  option has a misconception or a *plain* box; *+ Option*; the board's note that options are
  shuffled per learner;
- **Number** — the value, the unit and the tolerance;
- **Sequence** — the answer, the other accepted answers and *exact*;
- **Order** — the steps in their right order.

A try question's options have no misconception or *plain* (#257). The note on a sequence or order
try question goes: both are edited in the workbench.

## M4P.7 The preview as in a test

The side panel's tabs, as the board's: **Preview as in a test** and **Checks (*n*)**, *n* the
failed items.

**Preview** draws the editor's state, unsaved changes included, in the browser, asking the API
nothing. A new **`TestQuestion`** in `node/` draws a stem with the learner's `Body` and the kind's
control (the try questions' choice buttons and number field, `SequenceAnswer`, `OrderAnswer`)
with **no hints, no feedback and no rationale**; options in written order with *Options are
shuffled per learner*. The self-test (M8) reuses it, so the preview is the test's own question.

- **Desktop** is the panel's width; **Phone** is 390 px, as the workbench's preview.
- **Dark** is desktop width inside a box with `data-theme="dark"`. Today the dark tokens apply
  only to `:root[data-theme="dark"]`; `renderTokens.ts` also writes them for any
  `[data-theme="dark"]` element, and `npm run tokens` regenerates `tokens.css`. No value changes.

**Checks** shows the selected question's items (M4P.4) through `CheckItems`, a failed item as the
board marks it with its detail under it. They are the last save's: with unsaved changes a line
says *As last saved; leave the question to check again*; a question never saved says *Checked
once saved*.

## M4P.8 Tests and *done when*

- **code-schema:** a problem inside an exam or a try question carries its id, a stem's block
  problem included; pool and field problems carry none — each watched failing first.
- **API:** a stem of text and sequence blocks saves and is written as the MyST expected; a try or
  callout in a stem is refused by its code; the checks give each question its items, and a
  planted warning (a level two steps from the node's) fails exactly one item of one question.
  `openapi.json` and `schema.ts` are regenerated.
- **Web (vitest):** `AnswerEditor` for each kind; `TryEditor` edits sequence and order, the note
  gone; the list (rows, state, *+ New*, selecting); leaving the editor sends POST, PUT or nothing,
  and a refusal keeps the text; stem blocks added, moved and deleted; `TestQuestion` shows no
  hints and no feedback; the preview's Desktop, Phone and Dark, Dark scoped to its box; the
  checks' two lines; the tokens test with the scoped dark selector.
- **The walk** (headless Chrome): from a node with an empty pool, four questions added through
  the screen, one of each kind; each one's checks pass, the draft's checklist says *four exam
  questions* passed, and the node verifies clean.

**Done when:**

1. A node gets its exam questions through the screen and still passes its checks (#263).
2. **The screen looks like the board.** It is compared with the published canvas's
   `QuestionBuilder` in a browser at 1680 px, in light and in dark: layout, columns, the list's
   rows, the stem and answer panels, the option rows, the side panel's tabs and checks. Each
   difference is fixed, or named in the journal as one of M4P.1's later parts.

## Notes from the build

Built on `feat/m4-8d-exam-pool-builder` from the plan, inline; each deviation is a ruling, with what
it costs if wrong, in the journal.

- **M4P.2.** A question entry's problems are stamped with its id once read, nested options and
  stem blocks included. CS0806 (an unknown key, read before the id) is stamped too: it is about the
  question.
- **M4P.3.** A stem is written as a body is: adjacent text blocks joined as paragraphs (#258), and
  refused when it would read back as something else (`write_faithfully`, #268).
- **M4P.4.** The rules table is code-schema's (`question_rules.py`), not `drafts.py`'s: each package
  writes only its own diagnostic codes (M4D.6). The API turns its results into the checklist's
  items. The route is `…/checklist`.
- **M4P.5.** The stem uses the page editor's fields (`MarkdownField`, `LettersField`), not
  `BlockEditor`, which saves itself. Choosing another question saves the open one first, blur or
  not (#268). A new question is named from the draft as saved, so it follows one still saving.
- **M4P.6.** Options are lettered, as the board letters them; the letter tile is the right-answer
  control. The kind switch sits in the exam's Answer header.
- **M4P.7.** The checks list under the preview as well as on their tab, as the board draws them. An
  order's steps are dealt by place, so the preview follows edits (#268).
- **Against the board**, at 1680 in light and dark: the header's *Exam pool · n of m approved* tag
  stays a count atop the list (the header is every tab's), and the level is a select, not a tag.
