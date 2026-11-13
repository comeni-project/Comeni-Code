# M6.7 — Problems, the ground

**Status: draft 2026-11-07.** Part of M6 (#325), issue #334. Designed with the operator on
2026-11-07. No screens: the problem builder (S5) and the learner's problem (L6) are M6.8 (#335),
boards first. Builds on the first spec's §5.1.1 (`problem` is not `check`), the tutor spec's T6.2
(hints, rationale) and T7 (a problem marks a node solid), and the M6.4 and M6.6 figure kits, whose
shape it copies.

## What it does

A node may hold one **problem**, Rosalind-shaped: a statement, Given and Return, a sample dataset
and its output, a rung, and, for each learner, **a dataset of their own** whose answer is computed
and checked on the server. M6.7 builds the ground: the pure engine that generates, solves and
checks; the file format and its validation, including the 20-seed self-test; and the plumbing
through the index, drafts, review and landing. Nobody can build or answer a problem in a screen
until M6.8.

**In:** `packages/code-problems` (pure); `problem.yaml` and the `:::{problem}` block; two kits
(`de-bruijn-edges`, `count-kmers`); the 20-seed self-test inside `code-schema validate`; CS11xx;
the index row; a draft's `problem.yaml` (a whole-file edit), its review key, its landing.

**Out, and where it goes:** S5 and L6, a learner's seed, the download and submit endpoints, the
step back (M6.8); seeded variants of exam questions and figures, and the de Bruijn page's problem
end to end (M6.9, operator 2026-11-07); *% solved* and solutions (learner records, M8); more kits
(added when content needs one, each a reviewed change).

## M6PR.1 The engine: problem kits (`code-problems`, pure)

A **kit** is a Strategy, one module in `code_problems/` registered in `registry.py`, as the figure
kits are:

| Part | Signature | |
|---|---|---|
| `schema` | `schemas/<kit>.json` | the kit's `params`, checked by `code_figures.schema.validate` (pure to pure, as `code-schema` already imports `code-figures`) |
| `cost` | `(params) -> int` | the dataset's size in bytes, worked out from the params **before** anything runs |
| `generate` | `(params, rng) -> Dataset` | the learner's file: `text`, `name` (`<kit>-<seed>.txt`), `size` (lines) |
| `solve` | `(case) -> str` | the answer, as the Return section says it is written |
| `check` | `(case, given) -> Verdict` | `right: bool`, `mistakes: tuple[str, ...]` (names the kit declares), `said: str` (one sentence, counts not answers) |
| `MISTAKES` | `Mapping[str, Callable[[Case], str]]` | each mistake the checker can name, and how to **make** it from the case, for the self-test |
| `MAX_BYTES` | `int` | the largest dataset a kit's params may ask for |

A `Case` is `(params, dataset, answer)`: the checker and the mistake makers see the dataset, not only
the right answer, since a count's mistakes (every k-mer, not distinct) need the reads. *My call,
after the builder check.*

A problem file names a kit and fills its parameters; there is never per-problem code (#334).
`code-problems` imports the standard library's allowlist and `code_figures.schema` only
(`tests/guards/purity.py` gains it, watched failing first), never `code-schema` or Django;
`code-schema` imports `code-problems`, as it imports `code-figures`.

**`rng.py`: our own PRNG** (splitmix64 over 64-bit integers, with `below(n)`, `choice(seq)`,
`letters(n, alphabet)`). Python promises `random.random()` reproduces from a seed, not
`randrange` or `choice`; a learner's dataset must read the same in a later Python. Its first
outputs for seeds 0, 1 and 2³² are pinned by a test.

**Seeds** are integers 0 ≤ seed < 2⁶⁴. How a learner's seed is chosen is M6.8's.

## M6PR.2 The two kits

| Kit | Rung | `params` (bounds in the schema) | Dataset | Answer | Mistakes |
|---|---|---|---|---|---|
| `de-bruijn-edges` | 3 | `k` 3–12; `genome` length 7–5,000; `read` length (k+1)–150; `coverage` 1–30; `errors` 0–0.02 | `k` on the first line, then one read per line | every edge `A -> B` of the de Bruijn graph with k-mers as nodes (an edge where two k-mers follow each other in a read, as M6DC.1's edges), sorted, unique, one per line | `duplicates`, `missing`, `extra`, `unsorted`, `reversed` (`B -> A`) |
| `count-kmers` | 1 | `k` 2–12; `genome` a range `[min, max]` the length is drawn from; the rest as above | as above | the number of distinct k-mers | `counted-all` (every read's k-mers summed, not distinct), `off-by-one` (that sum less one per read: L − k, not L − k + 1); checked in that order |

A scalar answer varies only if the dataset's size does, hence `count-kmers`' length range. Both draw
their reads from one helper, `reads.py`: a random genome, reads at random positions to
the coverage, each base wrong with probability `errors`. The checker compares lines (edges) or an
integer (count), ignoring surrounding whitespace and a trailing newline; `said` names counts
("Your list has 1,946 lines; the answer has 1,803.").

## M6PR.3 The file and the block

A node folder may hold **`problem.yaml`**, at most one, placed by **one** `:::{problem}` block in
`body.md` (the block holds nothing; the file holds the problem). The block is no longer refused.

```yaml
title: Construct a de Bruijn graph
rung: 3
statement: |
  Given a set of reads and an integer k, return the edges of the de Bruijn graph that uses
  k-mers as nodes …
given: k on the first line, then up to 1,000 reads of up to 100 bases
return: edges as "A -> B", one per line, sorted, no duplicates
kit: de-bruijn-edges
params: {k: 3, genome: 400, read: 40, coverage: 10, errors: 0}
sample: {seed: 1, params: {k: 3, genome: 7, read: 5, coverage: 2, errors: 0}}
hints:
  - The same k-mer can come from many reads.
mistakes:
  duplicates: Every edge appears once
rationale: Each read adds the edges between its consecutive k-mers; the graph keeps each once.
```

- **The sample is computed, never typed**: its dataset and output come from the kit run at
  `sample.seed` with `sample.params` (smaller, so it reads on the page). Both are stored in the
  index and shown as they will be drawn.
- **`mistakes`** maps a mistake the kit declares to the **title of a misconception callout** in
  the body (CS1110 if none has it): a wrong answer with that mistake shows that callout, which
  is where M8's step back starts. A mistake left out gets the checker's `said` alone.
- `statement` is Markdown with formulas, as a text block; `given` and `return` one line each;
  `hints` 1–3, none holding the sample's answer (as a try's, CS0319's rule); `rationale` required.
- The reader is `code_schema/problem_file.py` (`ProblemFile`); the block is `ProblemBlock` in
  `blocks.py` (`code_schema.problems` already names the validator's problems). The canonical writer
  writes `problem.yaml` back in this key order.

## M6PR.4 The 20-seed self-test

`code-schema validate` (and so a draft's save and the index's build) runs, for the sample (its
seed, its params) and for seeds 0–19 (the problem's params):

1. the params fit the kit's schema (CS1101; `code_figures`' findings re-coded, their paths kept),
   the sample's params too, under the same schema;
2. the params' `cost` is within the kit's `MAX_BYTES` (CS1102), checked **before** generating:
   deterministic, so CI, a save and a build agree, and nothing runs that could run away;
3. the checker accepts the solver's answer (CS1103);
4. each mistake the file maps, **made** from the case, is caught as that mistake and not accepted
   (CS1104);
5. the 20 answers take at least 18 distinct values (CS1105): an answer must be worth nothing to
   anyone else, and a count drawn from a range may meet another by chance. The sample is not
   counted.

A failure names its seed. The run is deterministic, so it runs once per file text within a process
(a dict keyed by the text: no `hashlib`, no `time` in `code-schema`'s allowlist). It runs wherever
the file is read: `validate`, a draft's save, the index build. A test pins the fixture's run under
1 s. *My calls, after the builder check.*

## M6PR.5 Codes (CS11xx, new band)

CS1101 params do not fit the kit's schema; CS1102 a seed over the kit's limits; CS1103 the solver's
answer refused; CS1104 a mapped mistake not caught; CS1105 two seeds' answers alike; CS1106 an
unknown kit; CS1107 a problem file not as written (unknown key, missing field, rung outside 1–4);
CS1108 `problem.yaml` without its block, or a block without the file; CS1109 two problem blocks;
CS1110 a mistake mapped to no misconception callout, or a mistake the kit does not declare;
CS1111 a hint holding the sample's answer. Each in `diagnostics.yml` with `explain` and a test.

## M6PR.6 Index, drafts, review, landing

- **Index**: `NodeProblem` (one per node): the file's text, its fields, and the sample computed
  (`sample_dataset`, `sample_output`). No learner endpoint sends it yet (M6.8); `content.snapshot`
  reads it back so a node from the index equals its folder.
- **Drafts**: `Revision.problem_yaml` (empty: none), as `exam_yaml`. One edit, `PUT
  /api/studio/drafts/{id}/problem {revision, text}` (and `DELETE` with `revision`): the whole file,
  refused unless it validates (CA0208, its CS11xx problems listed), its block added at the body's
  end when missing and removed with the file. `DraftOut.node` carries `problem` (text and the
  computed sample) for M6.8's builder.
- **Review**: one key, `problem`, holding the file; a changed file is a changed key. The block gets
  no `block/{at}` key of its own.
- **Blocks**: `BlockIn` gains no `problem` variant (the block comes with `PUT /problem`); deleting it
  through `/blocks` is refused (CA0205, *remove the problem instead*); moving it is allowed.
- **Before M6.8**: the learner's node API leaves the block out (as #411 left exam-only figures);
  Studio's draft sends it as `{kind: "problem"}`, which the workbench lists as a row with no editor
  (*the problem is built in M6.8*). *My calls, after the builder check.*
- **Landing**: `problem.yaml` lands with the node's other files and is removed when the draft
  removed it, as `exam.yaml`.

## M6PR.7 Done when

1. `code-problems`' kits pass their own tests, and the purity guard, watched failing on a planted
   import, passes.
2. A fixture node with a problem (the de Bruijn fixture gains `problem.yaml`, its block, and a
   misconception callout, *Every edge appears once*, its `duplicates` mapped to it) validates; its 20-seed self-test runs in under
   2 s; each of CS1101–CS1111 is produced by a test.
3. A draft saves, re-reads and lands `problem.yaml` byte for byte; the index stores it and its
   computed sample; review lists its key.
4. The same seed gives the same dataset across two processes (a test spawns one).

## Decisions, and the alternatives rejected

- **Kits as one Strategy** (generate, solve, check, mistakes), as figure kits are. Rejected:
  separate generator, solver and checker components wired in the file — more parts to keep in
  step for no gain yet.
- **Our own PRNG.** Rejected: `random.Random`, whose methods other than `random()` may change.
- **One problem per node** (operator, 2026-11-07): a problem is a node's proof. A schema that
  only widens can take more later.
- **Named mistakes mapped to misconception callouts**, made on purpose by the kit for the
  self-test. Rejected: free-text wrong answers matched by pattern (not reviewable), and a model
  reading the submission (§5.1.1).
- **Grading on the server; no TypeScript twin.** Rejected: twinning in the browser, which would
  send every learner's answer to their page.
- **The sample computed from a seed.** Rejected: a typed sample, which can disagree with the kit.
- **Seeded questions and figures in M6.9** (operator, 2026-11-07), not here.
