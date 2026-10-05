# M4.2 — Exam pools in the format

**Status: agreed 2026-10-05.** The second part of M4 (#74), issue #120. Designed with the operator in
conversation on 2026-10-05, section by section; the operator approved the design and asked for this
spec and its plan in one go. It builds on M4.1.3's question union and record reader
(`docs/superpowers/specs/archive/2026-10-05-m4-refactor-before-exams-design.md`).

It decides:

- where a node's exam pool lives, and what a question in it carries (M4E.1);
- how a question is modelled, now that there are two pools (M4E.2);
- what the validator refuses, and that it can now warn (M4E.3, M4E.4);
- how the index stores a pool, and what the API sends (M4E.5);
- that exam answers are not a secret in v1 (M4E.6);
- what the exam builder will owe large pools (M4E.7);
- the fixture, the content repository's pin, and *done when* (M4E.8).

It changes two things the parts list (#120) said: the pool is a file of its own, not an `exam:` field
in `node.yaml` (M4E.1), and "no exam answer leaves the API" is no longer a rule (M4E.6).

---

## M4E.1 The pool is `exam.yaml`, beside `node.yaml`

A node folder may hold an **`exam.yaml`**. It is optional: a node without one is valid. The file has
one key, `exam:`, a list of questions:

```yaml
exam:
  - id: tpm-sums-to
    kind: number
    ask: Across all transcripts in one sample, what do the TPM values add up to?
    answer: 1000000
    rationale: TPM is each transcript's share of the sample, scaled so the shares add up to a million.
  - id: tpm-or-count
    kind: choice
    ask: What does a transcript's TPM tell you?
    level: foundations
    options:
      - text: Its share of the transcripts in the sample, corrected for length
        right: true
      - text: How many reads mapped to it
        misconception: TPM is not a count of reads
      - text: How long the transcript is
    rationale: TPM divides reads by length first, then scales, so it is a proportion.
```

An exam question has the try question's fields **except `hints`** (a self-test gives none, T7.1),
and adds:

- **`level`**, optional: the question's level when it differs from the node's (T10.1). Absent means
  the node's level.
- **`misconception`** on a wrong option, optional: the title of a `misconception` callout in the
  node's `body.md`. Step backs (T6.1) will follow it from a wrong answer.

*Why a file of its own.* Everything in `exam.yaml` stays off the node's page, so "this is not page
content" is one rule about one file, easier to see in review and to keep apart in code. It is one of
the "YAML data files" a node folder may hold (R1), and a pool can be drafted and reviewed apart from
the page in M4.4. *Rejected:* `exam:` in `node.yaml`, as #120 first worded it. It is one file fewer,
but it puts some 50–70 lines of questions the page never shows beside the ones it does.

*Rejected:* a difficulty estimate per question (nothing reads it until exams are built, and a number
written now would be a guess) and the claim a question checks (a node has one claim, so it would
always be the same).

## M4E.2 A question is an answer composed into a pool

A question varies along two independent axes: how it is answered (choice, number; T7.1 names more:
sequence or string, order, figure interaction) and which pool it is in (try, exam). A class tree
holds one axis and multiplies the other. So the answer is a **sum type composed into each pool's
question**, the way `Block` is a union:

```python
@dataclass(frozen=True)
class ChoiceAnswer:
    options: tuple[Option, ...]


@dataclass(frozen=True)
class NumberAnswer:
    value: float | int
    unit: str = ""
    tolerance: float | int | None = None


Answer = ChoiceAnswer | NumberAnswer


@dataclass(frozen=True)
class TryQuestion:
    id: str
    ask: str
    answer: Answer
    hints: tuple[str, ...]
    rationale: str


@dataclass(frozen=True)
class ExamQuestion:
    id: str
    ask: str
    answer: Answer
    level: Level | None
    rationale: str


@dataclass(frozen=True)
class Option:
    text: str
    right: bool = False
    misconception: str = ""
```

- A new answer kind is one class and one branch in the shared reader, and both pools get it. A new
  pool is one class.
- Grading, when it comes, is written once over `Answer` and never asks which pool a question is from.
- `TryQuestion` and `ExamQuestion` share no class, so a `match` on one never takes the other.
- Each question keeps a `kind` property (`"choice"` or `"number"`, read from its answer), so the
  index row and the writer keep their shape.
- The YAML does not change shape: `kind`, `options` and `answer` stay flat in the file.

`ChoiceQuestion | NumberQuestion` (M4R.2) becomes `TryQuestion`, and `Node.questions` holds
`TryQuestion`s. This is a refactor of M4.1.3's types; the try questions' messages, the index row
and the API's `QuestionOut` do not change.

*Rejected:* a superclass per answer kind with a leaf per pool (`Choice` → `ChoiceQuestion`,
`ExamChoice`). It was the first design. It takes two classes per new answer kind, and its parents
declare the number fields for both pools. *Rejected:* one question class with optional `hints`,
`level` and `misconception` and a pool flag: an exam question with hints becomes representable, and
only a runtime check refuses it. *Rejected:* a separate exam parser copied from `questions.py`: it
brings back the copied option rules M4.1.3 removed.

## M4E.3 What the validator refuses

**Shared rules keep their codes and messages.** `id`, `kind`, `ask`, options (2 to 5, exactly one
right), a number answer with its unit and tolerance, the rationale and a repeated id are read by the
same functions for both pools (`code_schema.questions`), so an exam question with three right options
gets CS0329 as a try question does, at its line in `exam.yaml`. `level` is checked by the field
check the node's own `level` uses. The try reader refuses `level` and `misconception` through its
unknown-key codes, unchanged.

**A new band, CS0800–CS0899, *exam pools***, read by `code_schema.exam`:

| Code | Rule |
|---|---|
| CS0801 | `exam.yaml` has a key other than `exam` |
| CS0802 | `exam:` is missing |
| CS0803 | `exam:` is not a list |
| CS0804 | `exam:` is empty — delete the file instead |
| CS0805 | an entry is not a question |
| CS0806 | an unknown key in an exam question |
| CS0807 | **an exam question has `hints`** — a self-test gives none (T7.1) |
| CS0808 | an unknown key in an exam option |
| CS0809 | `misconception` names no `misconception` callout in `body.md` |
| CS0810 | `misconception` on the right option |
| CS0811 | an id a try question in the same node already uses: evidence names a question by node and id |
| CS0812 | more than **40** questions |
| CS0813 | *warning*: 1 to 3 questions — the node is left out of self-tests until it has 4 |
| CS0814 | *warning*: a question's `level` two or more levels from the node's (T10.1) |

**CS0706**, in the *discovery* band: a file in a node folder that is close to `exam.yaml`
(`exam.yml`, `exams.yaml`) and is not read, as CS0703 does for `node.yaml`. A pool that is quietly
not read is the mistake an author would not notice.

A file that is not YAML, is empty or is not a mapping gets the shared CS0001–CS0003, as `node.yaml`
does. The checks that need the node (CS0809, CS0811, CS0814) run only when `node.yaml` and `body.md`
parsed; the pool's own rules always run. *(The table was renumbered on 2026-10-05 during the build,
to match `diagnostics.yml`, once the shared CS0003 turned out to cover a file that is not a
mapping.)*

**40** is a bound, not a target. It is high enough that a well-written node never meets it, and it
catches a draft or a generator that ran away. The pool's size is otherwise the exam builder's
business (M4E.7).

## M4E.4 The validator can warn

Until now every code refuses: any problem drops the node, fails `validate` and refuses the index
build. CS0813 and CS0814 are the first codes with `refuses: false`, so M4.2 makes warnings work:

- **`Problem.refuses`**, read from the code's registry entry. Nothing is stored twice.
- **`Content.errors`** (the problems that refuse) beside `Content.problems` (all of them, sorted as
  now). A node whose only problems are warnings is read and kept.
- **`code-schema validate`** prints every problem as now; it exits **1 only for errors**. Its
  summary counts errors and warnings apart. `--format github` writes `::warning` for a warning.
- **`rebuild_index`** refuses only on errors. An applied build's `problems` stays empty: warnings
  are the author's, shown by `validate` and the content repository's CI, not the index's.
- **`code-weaver`**'s commands refuse only on errors.

The all-or-nothing rule is unchanged for errors, and the existing tests that pin it pass unedited.

*Rejected:* deferring the warnings to M4.4's pre-submit checklist. The operator preferred not to leave
rules to be remembered later, and the mechanism does not depend on what M4.4 or #102 decide: they
decide which rules warn, not how a warning works. M4.4's checklist can reuse it.

## M4E.5 The index stores the pool; the API sends none of it

- A new **`ExamQuestion`** model beside the try `Question`, by migration `0006`: `node`, `position`,
  `question_id`, `kind`, `ask`, `options` (JSON: `text`, `right`, `misconception`), `answer`, `unit`,
  `tolerance`, `level` (null for the node's) and `rationale`. Its own table because its fields differ,
  and because a listing of a node's try questions should not need a filter to stay a listing of try
  questions.
- The try `Question` model keeps its name; renaming the table buys only a migration.
- **`rebuild_index` writes exam rows in the same transaction**, so a refused build writes none. The
  digest already covers every file in a node folder (M1P5.5), so an `exam.yaml` edit changes it with
  no new code.
- **No endpoint changes.** `openapi.json` is unchanged and the web app is untouched. Nothing in M4
  reads a pool from the API; the self-test spec decides what it sends.

## M4E.6 Exam answers are not a secret in v1

The parts list said no exam answer may leave the API, and that a test would prove it. **That rule is
dropped.** Approved content lives in a public repository, so every answer is readable on GitHub, and
an API that hides it protects nothing. T7.1 already says self-tests are unsupervised and certify
nothing; Code teaches, it does not examine. So:

- **Not showing answers during a test is a matter of the learner experience** (no feedback until the
  end, T7.1), decided with the self-test screen, including whether grading runs in the browser.
- *Later:* an institutional, supervised mode would reopen this, with a private pool and server-side
  grading. It is a decision with its own spec, not v1.

`now.md`'s trap line ("exam answers must never reach the browser") is corrected when this part's
journal is compacted.

## M4E.7 What the exam builder owes a large pool

Not built in M4.2; recorded so the self-test part starts from it. T7.1 already says questions are
sampled across the nodes in scope, weighted toward nodes tested least recently and marked *shaky*,
at least 2 per node when length allows, and that assembly is deterministic given a seed. Added on
2026-10-05:

- **A cap of questions per node in one exam**, so an exam stays spread across its topics.
- **Within a node, questions the learner has not seen recently come first**, so a large pool means
  fewer repeats.
- T7.1's "about 4–6 questions" becomes **at least 4; more is better**, up to the bound of 40.

## M4E.8 Fixtures, the content repository, and done when

**Fixture.** `tests/fixtures/salmon/transcriptomics/tpm/exam.yaml`, four questions: TPM is the one
fixture node with a `misconception` callout, so a wrong option can name it. Choice and number are
both there, and one question carries its own `level`. Every refused case and both warnings are built
in `tmp_path`, as the schema tests do. `validate tests/fixtures/salmon` stays clean.

**Writer.** `write_node_folder` writes `exam.yaml` in a fixed field order when the node has a pool,
and removes a stale one when it has none. The fixture round-trips byte for byte.

**The content repository's pin** moves at the end of the part, in one pull request in
`comeni-code-content`: its `{% try %}` markers become `:::{try}` fences and its pinned validator
moves to M4.2's merge commit. No new content and no `exam.yaml` there yet. The operator sees the diff
before it is opened and says yes before it merges.

**Documents.** The tutor spec's T7.1 gets one line pointing here (pool size, answers not secret);
`CLAUDE.md`'s layout names `exam.yaml`; #120's *done when* is rewritten to match.

**M4.2 is done when:**

1. Try questions are `TryQuestion` over `Answer`, with every pinned schema test and the API's tests
   passing unedited.
2. The TPM fixture carries 4 exam questions and `validate` passes them.
3. A hint on an exam question is refused, as are a misconception naming no callout, an id a try
   question uses, and a 41st question.
4. A pool of 3 warns and does not refuse: `validate` exits 0, the index applies, GitHub gets
   `::warning`.
5. `rebuild_index` stores the pool; `openapi.json` is unchanged.
6. The new codes are in `diagnostics.yml`, `explain` and the generated reference, each named by a test.
7. The content repository validates on the new pin.

## Not in this part

Exam building, sampling, grading and results; the self-test endpoint and screens; figures, seeds and
the other answer kinds; drafts and M4.4's checklist; a pool's review state (approved content is
reviewed by being in the content repository).
