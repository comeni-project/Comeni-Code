# M4.8c — Exam questions as the board draws them

**Status: agreed 2026-10-09.** The third slice of M4.8 (#126),
issue #222. Designed with the operator in conversation on 2026-10-09, section by section, against
the S3 *Exam pool* board
(`QuestionBuilder`). The operator's rule for it: **the boards are the truth, not the code** — so
the format grows to hold what the board draws, and the builder screen follows in a part of its
own.

M4.8 had three slices (M4.8a sign-in and the team, M4.8b the workbench, M4.8c the exam pool). The
exam pool is now two: **M4.8c, this part, the format** (code-schema, the API, the index, and the
learner's try controls the format makes necessary), and **M4.8d, the builder screen** against the
board. Each has its own spec, plan and pull request (R5).

It decides:

- the scope, against the board and the roadmap (M4Q.1);
- the shape of an exam question (M4Q.2);
- the answers, and partial credit (M4Q.3);
- what code-schema checks (M4Q.4);
- the API, the index and a question's derived state (M4Q.5);
- the learner's try controls (M4Q.6);
- tests and *done when* (M4Q.7).

The pool's place and its existing rules are the M4.2 spec's (archived
`2026-10-05-m4-exam-pools-design.md`, M4E.1–M4E.8); this spec changes M4E.1's question shape and
adds to M4E.3's rules. The tutor spec's T7.1 is the statement of what a question is.

---

## M4Q.1 Scope

The board draws a question as a block document with a typed answer, its claim, its level, a
misconception per distractor, a rationale, a state per question, a preview as in a test, checks,
variants, a score, history and *Draft a question with AI*. The roadmap (architecture spec R4)
already divides it:

| Part of the board | Phase |
|---|---|
| Stem as blocks (text; a sequence block), choice, number, sequence and order answers, claim, level, misconceptions or *plain*, rationale, approved or draft | **M4 — this part (format) and M4.8d (screen)** |
| Preview as in a test (Desktop, Phone, Dark), the question list, the per-question checks | **M4.8d** |
| Figures and images in stems and options, figure-interaction answers, seeded variants checked across 20 seeds, math blocks | M6 |
| Score, *Draft a question with AI* | M5 |
| History | later, with the workbench's |

**Not in this part:** any screen in Studio beyond a count line; self-tests (M8); problems, which
are the node page's `problem` block, never an exam question (#262, M6).

## M4Q.2 The shape of an exam question

```yaml
exam:
  - id: mid-read-error
    title: Which mark does a mid-read error leave?
    claim: spots a bubble left by a mid-read error
    level: intermediate
    stem: |
      This graph was built from reads with k = 3. One read has a single wrong base in its
      middle. Which kind of mark did that read leave?
    kind: choice
    options:
      - text: A bubble
        right: true
      - text: A tip
        misconception: Errors only show at the ends
      - text: Nothing
        plain: true
    rationale: A wrong base mid-read makes k new k-mers that leave the path and rejoin it.
```

- **`title`** (required, one line): how Studio's list and a learner's results name the question.
- **`stem`** (required): what the learner reads, a MyST text read by the body's own block reader,
  so pages and stems gain figures, images and math together in M6. A stem refuses `try` blocks and
  callouts.
- **`claim`** (optional, free text): what part of the node's claim the question tests, in the
  author's words. Nothing checks it against the node's claim.
- **`level`**, **`rationale`**, and the answer fields (M4Q.3) as now.
- **`ask` is gone from exam questions**: `title` and `stem` replace it. The one fixture pool (TPM)
  is rewritten, each `ask` becoming its title and a one-paragraph stem; the content repository
  holds no nodes, so nothing else migrates.
- **A new `sequence` block**, `:::{sequence}` then letters then `:::`, for DNA, RNA or protein,
  drawn monospaced in groups of ten. Pages get it too.
- **Try questions keep `ask`**: they sit in the page's prose, where one line fits. They share the
  answer kinds below.

*Rejected:* a Markdown file per question beside `exam.yaml` (a question split across two files, and
a node folder of many); stems as a YAML list of blocks (a second way to write blocks beside the
body's MyST); a claim that must quote the node's claim (too mechanical: paraphrases, a question
testing two parts and any edit to the claim would all be refused); a list of abilities on the node
for questions to pick from (a new field on every node; it can still be added on top of free text).

## M4Q.3 Answers

One answer reader serves both pools, as now (M4E.2).

| Kind | Written as | Graded |
|---|---|---|
| `choice` | `options`: 3–5 in an exam, 2–5 in a try; exactly one right; texts distinct | 0 or 1 |
| `number` | `answer`, `unit`, `tolerance`, as now | 0 or 1 |
| `sequence` | `answer`, optional `accept` (other right forms), optional `exact: true` | 0 or 1: case and spaces ignored unless `exact`; any accepted form is right |
| `order` | `steps`: 3–8, written in the right order, shown shuffled; texts distinct | **partial**: the share of step pairs in the right relative order |
| `figure` | — | M6 |

- **Wrong options are written, never generated at random**: by an author now, drafted by a model
  and reviewed in M5, and in M6 a seeded question's wrong option comes from a rule that is itself a
  misconception (`L − k` for `L − k + 1`). Each wrong option names a misconception callout or says
  **`plain: true`** on purpose; one with neither is a warning (M4Q.4), so a forgotten one shows while
  a deliberate one is quiet.
- **An exam choice needs three options**: with two, a learner who knows nothing scores half.
- **Grading is a score from 0 to 1** (`code_schema.grading`); the web grades a try by the same rule.
  Order counts pairs: for A B C D, *A B D C* scores 5/6, *B C D A* 3/6, *D C B A* 0. Self-tests (M8)
  will take a node's result as the mean of its questions' scores.
- **`sequence` is any text**, not only bases: `FASTQ` with `accept: [fq]` is one.

*Rejected:* exact matching by default, with rules to opt into (more for every author to set, for
the common case); `sequence` and `string` as two kinds; order graded all or nothing (operator's
choice: partial credit); order credit by steps in place (one early slip scores 0, though the rest
of the order is known).

## M4Q.4 What code-schema checks

New codes take the next free numbers in their bands (shared questions CS03xx, blocks CS04xx, exam
pools CS08xx), each declared in `diagnostics.yml` with a test that watches it fail, `explain` and
the reference page.

| Rule | Severity |
|---|---|
| an exam question with no `title`, or a title over one line | refuses |
| an exam question with no `stem`, or an empty one | refuses |
| a stem holding a `try` block or a callout | refuses |
| `ask` in an exam question | refuses (CS0806, the unknown key) |
| an exam choice with fewer than three options | refuses |
| two options, or two steps, with the same text | refuses (both pools) |
| a wrong option with both `misconception` and `plain` | refuses |
| `plain` on the right option | refuses |
| a wrong option with neither `misconception` nor `plain` | **warning** (`refuses: false`) |
| a `sequence` answer empty, or an `accept` entry not text | refuses |
| an `order` question with fewer than 3 or more than 8 steps | refuses |
| a `sequence` block holding anything but letters, spaces and line breaks | refuses |

The rules of M4E.3 stand: one right option, no hints in an exam, a misconception names a callout
title, at most 40 questions, the warning under four.

## M4Q.5 The API, the index and a question's state

- **Edits.** `POST`, `PUT` and `DELETE …/exam` take the new shape: `title`, `claim`, `stem` (MyST
  text, as the file holds it) and the answer fields of the five kinds. One answer schema serves try
  and exam.
- **A draft sends** each exam question with its stem **as blocks** (the page's block JSON) and a
  **`state`, `approved` or `draft`**: identical to the question with that id in the live index is
  *approved*; new or changed is *draft*. Nothing is stored and review stays whole-draft.
- **The index's exam table** gains `title`, `claim`, `stem` (blocks), `accept`, `exact`, `steps` and
  `plain` on options, by one migration. Learner endpoints still send no exam pool (M4E.5). The
  learner's node endpoint sends try questions of the new kinds.
- **Web types** are regenerated. The workbench's Exam pool tab keeps its count until M4.8d, adding
  how many are approved.

*Rejected:* approval per question in review (a change to M4.5 for what the live version already
says); a `state` field in `exam.yaml` (landed content is approved by construction).

## M4Q.6 The learner's try controls

Because try questions share the answer reader, a page may now ask a sequence or an order. The Node
page's try card gains a **text field** for sequence and a **list with *Move up* and *Move down***
for order (keyboard first, no drag needed), graded by the shared rule; an order's feedback says how
many pairs were in order. Nothing else on the learner side changes.

## M4Q.7 Tests and *done when*

- **code-schema (pytest):** every new code watched failing against a planted file; the writer
  round-trips each kind and the `sequence` block byte for byte; grading pinned by the A B C D
  table.
- **Fixtures:** TPM's pool rewritten to the new shape, gaining a sequence and an order question, so
  the index, the weaver and `validate` read every kind.
- **API (pytest):** an exam question of each kind saved into a draft and read back with its stem's
  blocks and its `state`; stale and refused saves keep their words.
- **Web (vitest):** the sequence and order try controls and their grading.

**Done when:** through the API, a draft saves an exam question whose stem holds a `sequence` block,
a sequence-answer question and an order question; Verify and the checklist pass; the draft shows
each question's approved or draft state; `code-schema validate` passes the fixtures; on the Node
page a learner answers a sequence try and an order try.

## Notes from the build

Built on `feat/m4-8c-exam-questions` from the plan, inline; each deviation is a ruling, with what it
costs if wrong.

- **Answers.** One reader serves both pools with a table of which fields answer each kind; M3's
  pinned refusals (CS0308, CS0310, CS0313, CS0314) keep their words and any other field of another
  kind is CS0337. Order pairs are counted without `itertools`, which code-schema's purity allowlist
  does not hold. An order is given as the step texts in the learner's order, never as indexes.
- **Stems.** A stem's block problems are reported at their lines in `exam.yaml`, counted from the
  key's own line for a one-line stem and from the next for a literal one. A stem line that ends in
  spaces or holds a tab is refused (CS0823, #264): YAML cannot write it as `stem: |`, so it would
  land rewritten as an escaped string.
- **Codes.** CS0416–CS0418 sit in the CS04xx band, whose concern is `body`. Every new code is
  named by a test and in `docs/reference/diagnostics.md`.
- **Fixtures.** TPM's pool holds six questions of every kind; the de Bruijn node gains a sequence
  block and a sequence and an order try, so the learner's page meets each. Tests pinning their old
  counts and positions follow them; the rules under test are unchanged.
- **The workbench.** A try's own kind is kept (`questionIn` had folded every kind but number into
  choice); a sequence or order try shows a note and no editor until M4.8d. A sequence block is
  edited as *Letters*.
- **Review.** An order's steps show sorted by their text, and once answered the written order
  (`right_steps`, #264). A sequence's key shows once answered, as a number's does.
- **The learner's order control** keeps focus on the moved step, even at an end, and a status line
  says where it stands (#264).
- **Walked** in headless Chrome against `runserver` and the production build: a stem with a
  sequence block, a sequence and an order question added through the API; the untouched questions
  *approved*, the new ones *draft*; Verify clean; the checklist passes once TPM has a resource
  (its fixture has none); both new tries answered on the de Bruijn page.
- **Deferred** (#265): stem styles other than `|` report a line off; `accept` skips the length
  check; the web lowercases where Python casefolds; the try note's wording; a test for a changed
  id; `rebuild_index` after migration 0009.
