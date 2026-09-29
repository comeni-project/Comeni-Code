# M1 part 4 — the Salmon fixtures

**Status: agreed 2026-09-19.** This is part 4 of phase M1 (architecture spec R4). The parts list is
in [`2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md). It builds on parts
[1](2026-09-18-m1-node-folder-and-core-fields-design.md),
[2](2026-09-18-m1-links-in-the-schema-design.md) and
[3](2026-09-18-m1-graph-rules-and-validate-design.md), and on the research note
[*What understanding Salmon depends on*](../../notes/research/2026-09-18-salmon-dependencies.md).
It decides:

- the route a learner with no background walks to *Salmon*, node by node;
- the nodes attached below it, and the one peer;
- where the fixtures live and how much each body holds;
- what the tests prove about them.

The operator made the decisions on 2026-09-19: *"just make a path that someone with 0 knowledge
understands how Salmon mostly works, then add the go deeper nodes attached"*. An agent proposed the
nodes.

---

## M1P4.1 What this part does

A folder of 26 real nodes, `tests/fixtures/salmon/`, which `code-schema validate` accepts, and which
parts 5 and 6 load as their graph. It is a **small test of the format against real content**, not
the first seed: the first large seeds will be built from the operator's bioinformatics master's
classes, later.

**Done when:**

- `uv run code-schema validate tests/fixtures/salmon` prints `26 nodes, no problems` and exits 0,
  and a test proves the same through `main`;
- tests prove the route's shape (M1P4.5): every route node is reached from *Salmon* by *needs*, the
  route starts only at first-steps nodes, no need points to a higher level, and each attached node
  hangs off the route by the link M1P4.3 gives it;
- the weaving spec's W1 no longer says *de Bruijn graphs* is on the route to *Salmon*.

**Out of scope:** the index (part 5) and the API (part 6); full teaching bodies, which wait for the
block vocabulary; copying these nodes into `comeni-code-content`, which is a separate pull request
the operator is asked about first.

## M1P4.2 The route: no background to *Salmon*

*Salmon*'s claim: *Salmon estimates how much of each transcript a sample holds by mapping RNA-seq
reads to the transcriptome and resolving reads that fit several transcripts with a probabilistic
model.*

Every *needs* link below passes the need rule (M1P2.3): **understanding the claim requires it.**
How a tool is run, and how a method is computed, are not needs.

| Id | Title | Region | Level | Needs |
|---|---|---|---|---|
| `dna-and-genes` | DNA and genes | molecular-biology | first-steps | — |
| `gene-expression` | Gene expression | molecular-biology | first-steps | `dna-and-genes` |
| `splicing` | Splicing | molecular-biology | foundations | `gene-expression` |
| `transcripts-and-isoforms` | Transcripts and isoforms | molecular-biology | foundations | `splicing` |
| `short-read-sequencing` | Short-read sequencing | sequencing | first-steps | `dna-and-genes` |
| `fastq-and-quality-scores` | FASTQ and quality scores | sequencing | first-steps | `short-read-sequencing` |
| `rna-seq-libraries` | RNA-seq reads and libraries | sequencing | foundations | `short-read-sequencing`, `fastq-and-quality-scores`, `gene-expression` |
| `k-mers` | k-mers | sequence-analysis | foundations | `dna-and-genes` |
| `sequence-alignment` | Sequence alignment and scores | sequence-analysis | foundations | `dna-and-genes` |
| `read-mapping` | Mapping reads to a reference | sequence-analysis | introductory | `short-read-sequencing`, `k-mers`, `sequence-alignment` |
| `multi-mapping-reads` | Reads that map to several places | sequence-analysis | introductory | `read-mapping`, `transcripts-and-isoforms` |
| `probability` | Probability | statistics | first-steps | — |
| `likelihood` | Likelihood | statistics | foundations | `probability` |
| `mixture-models` | Mixture models | statistics | introductory | `likelihood` |
| `em-algorithm` | The EM algorithm | statistics | intermediate | `mixture-models` |
| `tpm` | What TPM measures | transcriptomics | introductory | `transcripts-and-isoforms`, `rna-seq-libraries` |
| `salmon` | Salmon | transcriptomics | intermediate | `rna-seq-libraries`, `transcripts-and-isoforms`, `tpm`, `read-mapping`, `multi-mapping-reads`, `em-algorithm` |

Seventeen nodes, all six regions, four of the five levels. **Three of the research note's route
nodes are left out**, each by the need rule:

- *Transcription* is part of *Gene expression*, where a first-steps learner meets it.
- *Dynamic programming* is how an alignment is computed, not what its score means. It becomes a
  *goes deeper* from *Sequence alignment and scores*.
- *Ratios and normalisation* is school mathematics; *What TPM measures* explains the ratio it uses.

## M1P4.3 Attached below the route, and beside it

| Id | Title | Region | Level | How it attaches | Its needs |
|---|---|---|---|---|---|
| `pufferfish-index` | The pufferfish index | sequence-analysis | advanced | *goes deeper* from `salmon` | `de-bruijn-graphs`, `read-mapping` |
| `salmon-bias-models` | Salmon's bias models | transcriptomics | advanced | *goes deeper* from `salmon` | `salmon` |
| `decoy-sequences` | Decoy sequences | sequence-analysis | advanced | *goes deeper* from `salmon` | `salmon` |
| `variational-bayes-em` | Variational Bayesian EM | statistics | advanced | *goes deeper* from `salmon` and from `em-algorithm` | `em-algorithm` |
| `abundance-uncertainty` | Uncertainty in abundance | statistics | advanced | *goes deeper* from `salmon` | `salmon` |
| `de-bruijn-graphs` | de Bruijn graphs | algorithms | intermediate | *goes deeper* from `k-mers` | `k-mers`, `graphs` |
| `graphs` | Graphs | algorithms | foundations | none: reached as a need | — |
| `dynamic-programming` | Dynamic programming | algorithms | foundations | *goes deeper* from `sequence-alignment` | — |
| `kallisto` | kallisto | transcriptomics | intermediate | *related* to `salmon`, written on both | `rna-seq-libraries`, `transcripts-and-isoforms`, `tpm`, `k-mers`, `multi-mapping-reads`, `em-algorithm` |

**This is where W1 is corrected.** *de Bruijn graphs* sits under *The pufferfish index*, one
*goes deeper* away from *Salmon*: the index is how Salmon finds candidate transcripts fast, and the
claim can be understood without it. A curious learner reaches it in one click, from *Salmon* or
from *k-mers*; a learner who only wants to quantify RNA-seq never has to learn graph theory first.

Every *goes deeper* points to the same level or higher (M1P3.4), and *Salmon* has five, which
exercises a node with many.

**No *helps* or *any-of*.** The whole route is plain needs, which is the first evidence M1 asked for
(parts list, part 4): those optional paths can stay unwired. The parts list's *both kinds of group*
predates W3.2's final shape and no longer applies.

## M1P4.4 Where the files live, and what a body holds

**`tests/fixtures/salmon/` is a content root**: a `regions.yaml` with the six regions, copied from
`comeni-code-content` (tests never read it, R1), and one folder per region holding its nodes —
`tests/fixtures/salmon/statistics/em-algorithm/node.yaml`. Nesting is free (M1P1.2), so the folders
are for a reader, and the ids do not change.

**Each file is in the writer's canonical form**, so a test can prove the fixtures round-trip, and a
reviewer's diff never shows reformatting.

**A body is a short, true explanation — one to three paragraphs — plus a *Further reading* list of
one to three links.** It is enough to check a claim against, not a finished page: the block
vocabulary is not decided yet, and a long body written now would be rewritten then. Links go to
sources that do not move: the papers the research note cites, the Salmon documentation, and
Wikipedia's article on the concept. External links are not checked by the link check (no network),
so each one is opened by hand once before the pull request.

Titles, claims, reasons and minutes are written in the plan, where the operator can read every
node before it is built.

## M1P4.5 What the tests prove

A new `tests/schema/test_fixtures.py`, reading only `tests/fixtures/salmon/`:

| Test | Proves |
|---|---|
| the folder has no problems and 26 nodes | the validator accepts real content |
| `main([root])` exits 0 and prints `26 nodes, no problems` | the command, not only the function |
| every node round-trips through the writer, byte for byte | the fixtures are canonical |
| the route is exactly the 17 ids of M1P4.2, reached from `salmon` by *needs* | the route has not grown or lost a stop by accident |
| every route node with no needs is first-steps | a learner with no background can start it |
| no *needs* link points to a higher level | a route never climbs down to something harder |
| the attached nodes are reached only through M1P4.3's links | *pufferfish* and *de Bruijn graphs* stay off the route |
| *kallisto* and *salmon* name each other as *related* | the peer is on both nodes |

The level test belongs to the fixtures, not the validator: S2's health view will warn about levels,
and the validator only refuses (M1P3.1).

## M1P4.6 What else changes

- **The weaving spec, W1:** a dated note under the Salmon paragraph says *de Bruijn graphs* is one
  *goes deeper* away from *Salmon*, through *The pufferfish index*.
- **Part 4's journal entry** records that it grew from the parts list's 8–12 nodes to 26, and why:
  *no background* is what makes the route long. The parts list is a journal entry, so it is not
  edited.
- **The research note** is dated and not maintained; this spec supersedes its route.
- **CLAUDE.md's status line** moves to part 4 done when it is.

## M1P4.7 Open questions

- **Whether `sequencing` and `sequence-analysis` stay two regions** once the master's classes are
  seeded. The fixtures fit them; a real curriculum may not.
- **How a body's resources become structured** (T4) — decided with the block vocabulary.
