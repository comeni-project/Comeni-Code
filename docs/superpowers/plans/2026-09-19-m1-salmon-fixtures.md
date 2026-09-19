# M1 part 4: the Salmon fixtures — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 26 real nodes in `tests/fixtures/salmon/` — a route from no background to *Salmon*, and
the nodes attached below and beside it — which `code-schema validate` accepts, with tests that pin
the route's shape.

**Architecture:** no library code changes. The fixtures are a content root (a `regions.yaml` and
one folder per region), every `node.yaml` in the writer's canonical form. One new test module reads
them with `read_content` and checks the shape the spec fixes. The weaving spec's W1 is corrected.

**Tech Stack:** Python 3.14, pytest 9.1, mypy 2.3 strict, ruff 0.16, uv 0.11; the fixtures are YAML
and MyST.

**Spec:** [`docs/superpowers/specs/2026-09-19-m1-salmon-fixtures-design.md`](../specs/2026-09-19-m1-salmon-fixtures-design.md)
(agreed 2026-09-19).

## Global Constraints

- **No change to `packages/code-schema/`.** If a fixture is refused, the fixture is wrong, unless
  the refusal contradicts a spec — then stop and ask.
- **Every `node.yaml` is written exactly as below** (canonical: fixed field order, lists indented
  under their key, no quotes). A value that PyYAML would quote (a `: ` or ` #` inside, a leading
  `*`, `&`, `!`, `[`, `{`) is reworded, never quoted.
- **Every body is true.** Every external link is opened once before the pull request (Task 4); one
  that does not resolve is replaced, not left.
- **Tests never read `../comeni-code-content`** (R1). `regions.yaml` is a copy.
- **No node about Galaxy**; a Galaxy Training tutorial may be a resource.
- Same command set, commit and PR rules as parts 1–3; merge only on a captured `exit=0`.

## File structure

```
tests/fixtures/salmon/
├── regions.yaml
├── molecular-biology/   dna-and-genes, gene-expression, splicing, transcripts-and-isoforms
├── sequencing/          short-read-sequencing, fastq-and-quality-scores, rna-seq-libraries
├── sequence-analysis/   k-mers, sequence-alignment, read-mapping, multi-mapping-reads,
│                        pufferfish-index, decoy-sequences
├── algorithms/          graphs, de-bruijn-graphs, dynamic-programming
├── statistics/          probability, likelihood, mixture-models, em-algorithm,
│                        variational-bayes-em, abundance-uncertainty
└── transcriptomics/     tpm, salmon, salmon-bias-models, kallisto
tests/schema/test_fixtures.py
```

Each node folder holds `node.yaml` and `body.md`.

---

### Task 1: the tests and the region registry

**Files:**
- Create: `tests/schema/test_fixtures.py`
- Create: `tests/fixtures/salmon/regions.yaml`

**Interfaces:**
- Consumes: `read_content(root) -> Content` (`nodes: dict[str, Node]`, `folders: dict[str, str]`
  relative to the root, `problems`), `main(argv) -> int`, `write_node_yaml(node) -> str`, `Level`.
- Produces: `ROOT`, the fixture root, for parts 5 and 6.

- [ ] **Step 1: Write the region registry**

`tests/fixtures/salmon/regions.yaml`, copied from `comeni-code-content`:

```yaml
# A copy of comeni-code-content's regions.yaml: tests never read that repository (R1).
regions:
  - id: molecular-biology
    name: Molecular biology
  - id: sequencing
    name: Sequencing
  - id: sequence-analysis
    name: Sequence analysis
  - id: algorithms
    name: Algorithms
  - id: statistics
    name: Statistics
  - id: transcriptomics
    name: Transcriptomics
```

- [ ] **Step 2: Write the failing tests**

`tests/schema/test_fixtures.py`:

```python
"""The Salmon fixtures (spec M1P4): real content the validator accepts, and the route's shape.

Parts 5 and 6 load the same folder as their graph.
"""

from pathlib import Path

import pytest

from code_schema.cli import main
from code_schema.content import Content, read_content
from code_schema.node import Level
from code_schema.writer import write_node_yaml

ROOT = Path(__file__).resolve().parents[1] / "fixtures" / "salmon"

ROUTE = {
    "dna-and-genes",
    "gene-expression",
    "splicing",
    "transcripts-and-isoforms",
    "short-read-sequencing",
    "fastq-and-quality-scores",
    "rna-seq-libraries",
    "k-mers",
    "sequence-alignment",
    "read-mapping",
    "multi-mapping-reads",
    "probability",
    "likelihood",
    "mixture-models",
    "em-algorithm",
    "tpm",
    "salmon",
}

# Each attached node, and every link that points at it: (kind, from).
ATTACHED = {
    "pufferfish-index": {("goes-deeper", "salmon")},
    "salmon-bias-models": {("goes-deeper", "salmon")},
    "decoy-sequences": {("goes-deeper", "salmon")},
    "variational-bayes-em": {("goes-deeper", "salmon"), ("goes-deeper", "em-algorithm")},
    "abundance-uncertainty": {("goes-deeper", "salmon")},
    "de-bruijn-graphs": {("goes-deeper", "k-mers"), ("needs", "pufferfish-index")},
    "graphs": {("needs", "de-bruijn-graphs")},
    "dynamic-programming": {("goes-deeper", "sequence-alignment")},
    "kallisto": {("related", "salmon")},
}

LEVELS = list(Level)


@pytest.fixture(scope="module")
def content() -> Content:
    return read_content(ROOT)


def needs_closure(content: Content, start: str) -> set[str]:
    """Every node a learner walks through to reach `start`, and `start` itself."""
    seen: set[str] = set()
    stack = [start]
    while stack:
        node_id = stack.pop()
        if node_id not in seen:
            seen.add(node_id)
            stack.extend(link.node for link in content.nodes[node_id].needs)
    return seen


def incoming(content: Content, target: str) -> set[tuple[str, str]]:
    links: set[tuple[str, str]] = set()
    for node in content.nodes.values():
        for kind, group in (
            ("needs", node.needs),
            ("goes-deeper", node.goes_deeper),
            ("related", node.related),
        ):
            links |= {(kind, node.id) for link in group if link.node == target}
    return links


def test_the_fixtures_have_no_problems(content: Content) -> None:
    assert [str(problem) for problem in content.problems] == []
    assert len(content.nodes) == 26


def test_the_command_accepts_them(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["validate", str(ROOT)]) == 0
    assert capsys.readouterr().out == "26 nodes, no problems\n"


def test_every_node_yaml_is_canonical(content: Content) -> None:
    for node_id, folder in content.folders.items():
        written = (ROOT / folder / "node.yaml").read_text(encoding="utf-8")
        assert written == write_node_yaml(content.nodes[node_id]), node_id


def test_the_route_to_salmon_is_the_seventeen_nodes(content: Content) -> None:
    assert needs_closure(content, "salmon") == ROUTE


def test_the_route_starts_only_at_first_steps(content: Content) -> None:
    starts = {node_id for node_id in ROUTE if not content.nodes[node_id].needs}
    assert starts == {"dna-and-genes", "probability"}
    assert {content.nodes[node_id].level for node_id in starts} == {Level.FIRST_STEPS}


def test_no_need_points_to_a_harder_level(content: Content) -> None:
    climbs = [
        (node.id, link.node)
        for node in content.nodes.values()
        for link in node.needs
        if LEVELS.index(content.nodes[link.node].level) > LEVELS.index(node.level)
    ]
    assert climbs == []


def test_each_attached_node_hangs_off_by_its_links(content: Content) -> None:
    assert set(content.nodes) == ROUTE | set(ATTACHED)
    for node_id, links in ATTACHED.items():
        assert incoming(content, node_id) == links, node_id


def test_kallisto_and_salmon_are_peers(content: Content) -> None:
    assert [link.node for link in content.nodes["salmon"].related] == ["kallisto"]
    assert [link.node for link in content.nodes["kallisto"].related] == ["salmon"]
```

- [ ] **Step 3: Run them and see them fail**

Run: `uv run pytest tests/schema/test_fixtures.py -q`
Expected: FAIL — `0 nodes` where 26 are expected; `KeyError: 'salmon'` in the route tests.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/salmon/regions.yaml tests/schema/test_fixtures.py
git commit  # test: the Salmon fixtures' tests and region registry
```

---

### Task 2: the route, 17 nodes

**Files:** create the 17 folders below, each with `node.yaml` and `body.md`, exactly as written.

- [ ] **Step 1: Write the molecular-biology nodes**

#### `tests/fixtures/salmon/molecular-biology/dna-and-genes/node.yaml`

```yaml
schema: 1
title: DNA and genes
claim: DNA is a long molecule written in four letters, and a gene is a stretch of it that a cell reads to make something.
region: molecular-biology
level: first-steps
minutes: 10
```

#### `tests/fixtures/salmon/molecular-biology/dna-and-genes/body.md`

````markdown
DNA is two strands of nucleotides, each carrying one of four bases — A, C, G and T. The strands
pair A with T and C with G, so either strand says what the other must be. What matters is the
order of the letters: it is information, the way the order of letters in a sentence is.

A gene is a region of DNA whose sequence a cell uses as instructions, most often to make a
protein. The human genome has about three billion letters and around 20,000 protein-coding genes.

Because DNA is text, much of bioinformatics is reading and comparing long strings of four letters.
Every later stop on the way to Salmon treats sequences that way.

## Further reading

- [DNA](https://en.wikipedia.org/wiki/DNA) — Wikipedia
- [Gene](https://en.wikipedia.org/wiki/Gene) — Wikipedia
````

#### `tests/fixtures/salmon/molecular-biology/gene-expression/node.yaml`

```yaml
schema: 1
title: Gene expression
claim: A gene is expressed when a cell copies it into RNA, and cells differ in which genes they express and how much.
region: molecular-biology
level: first-steps
minutes: 10
needs:
  - node: dna-and-genes
    reason: Expression is a gene being read, so it starts from what a gene is.
```

#### `tests/fixtures/salmon/molecular-biology/gene-expression/body.md`

````markdown
To use a gene, a cell first copies its DNA into RNA, a single-stranded molecule with U in place of
T. This copying is called transcription. A messenger RNA (mRNA) is then read by ribosomes to build
a protein.

Nearly every cell in your body carries the same DNA. A liver cell and a neuron differ in which
genes they transcribe, and in how many copies of each RNA they make. Measuring those amounts of RNA
is how biologists see what a cell is doing — and it is what RNA-seq, and Salmon, set out to do.

## Further reading

- [Gene expression](https://en.wikipedia.org/wiki/Gene_expression) — Wikipedia
- [Transcription](https://en.wikipedia.org/wiki/Transcription_%28biology%29) — Wikipedia
````

#### `tests/fixtures/salmon/molecular-biology/splicing/node.yaml`

```yaml
schema: 1
title: Splicing
claim: Splicing cuts the introns out of a new RNA and joins its exons, and different choices of exons give different RNAs from one gene.
region: molecular-biology
level: foundations
minutes: 10
needs:
  - node: gene-expression
    reason: Splicing happens to the RNA a gene is copied into.
```

#### `tests/fixtures/salmon/molecular-biology/splicing/body.md`

````markdown
In plants and animals, a gene's first RNA copy holds **exons**, which are kept, and **introns**,
which are removed. The spliceosome cuts the introns out and joins the exons end to end.

Splicing is not always the same. By including or skipping exons — *alternative splicing* — one
gene can produce several different RNAs. Most human genes with more than one exon are
alternatively spliced.

## Further reading

- [RNA splicing](https://en.wikipedia.org/wiki/RNA_splicing) — Wikipedia
- [Alternative splicing](https://en.wikipedia.org/wiki/Alternative_splicing) — Wikipedia
````

#### `tests/fixtures/salmon/molecular-biology/transcripts-and-isoforms/node.yaml`

```yaml
schema: 1
title: Transcripts and isoforms
claim: A transcript is one RNA a gene can produce, and a gene's isoforms are its different transcripts, which often share most of their exons.
region: molecular-biology
level: foundations
minutes: 10
needs:
  - node: splicing
    reason: Isoforms exist because splicing can join a gene's exons in different ways.
```

#### `tests/fixtures/salmon/molecular-biology/transcripts-and-isoforms/body.md`

````markdown
A transcript is one particular RNA made from a gene: one set of exons, joined in order. A gene
with alternative splicing has several transcripts, called its **isoforms**. Annotations such as
GENCODE list the known transcripts of every gene; the human annotation lists over 200,000.

Isoforms of one gene share long stretches of sequence, and that is what makes them hard to tell
apart: a short piece of RNA from a shared exon could have come from any of them. The
**transcriptome** is the set of all transcripts, and Salmon measures how much of each one a sample
holds.

## Further reading

- [Transcriptome](https://en.wikipedia.org/wiki/Transcriptome) — Wikipedia
- [GENCODE](https://www.gencodegenes.org/) — the reference annotation of human and mouse genes
````

- [ ] **Step 2: Write the sequencing nodes**

#### `tests/fixtures/salmon/sequencing/short-read-sequencing/node.yaml`

```yaml
schema: 1
title: Short-read sequencing
claim: A short-read sequencer reads millions of short fragments of DNA at once and reports each one as a string of letters.
region: sequencing
level: first-steps
minutes: 10
needs:
  - node: dna-and-genes
    reason: A sequencer reads DNA's letters, so it starts from what DNA is.
```

#### `tests/fixtures/salmon/sequencing/short-read-sequencing/body.md`

````markdown
Sequencing turns molecules into text. Short-read machines, such as Illumina's, break DNA into
fragments, copy each fragment into a cluster, and read a few hundred letters of it by imaging one
base at a time. One run gives tens to hundreds of millions of these **reads**.

A read is short compared with a gene, and it comes with no label saying where it came from.
Working out where each read belongs is the job of later steps. A fragment can be read from one end
or from both, giving **single-end** or **paired-end** reads.

## Further reading

- [Illumina dye sequencing](https://en.wikipedia.org/wiki/Illumina_dye_sequencing) — Wikipedia
- [Massive parallel sequencing](https://en.wikipedia.org/wiki/Massive_parallel_sequencing) — Wikipedia
````

#### `tests/fixtures/salmon/sequencing/fastq-and-quality-scores/node.yaml`

```yaml
schema: 1
title: FASTQ and quality scores
claim: A FASTQ file stores each read in four lines, a name, the letters, a separator and a quality score for each letter.
region: sequencing
level: first-steps
minutes: 8
needs:
  - node: short-read-sequencing
    reason: FASTQ is how a sequencer's reads are written down.
```

#### `tests/fixtures/salmon/sequencing/fastq-and-quality-scores/body.md`

````markdown
One read in a FASTQ file:

```text
@read_1
ACGTTGCAAT
+
IIIIHHG#FF
```

The first line names the read, the second holds its letters, the third is a separator, and the
fourth gives one character per letter: how sure the sequencer is of it. Each character encodes a
**Phred score**, Q = −10 log₁₀(p), where p is the chance the letter is wrong. Q30 means one error
in a thousand.

A paired-end run writes two files, usually ending `_1` and `_2`, with the two reads of each
fragment in the same position in both.

## Further reading

- [FASTQ format](https://en.wikipedia.org/wiki/FASTQ_format) — Wikipedia
- [Phred quality score](https://en.wikipedia.org/wiki/Phred_quality_score) — Wikipedia
````

#### `tests/fixtures/salmon/sequencing/rna-seq-libraries/node.yaml`

```yaml
schema: 1
title: RNA-seq reads and libraries
claim: RNA-seq turns a sample's RNA into a library of DNA fragments and sequences them, so the reads are a sample of the RNA it held.
region: sequencing
level: foundations
minutes: 12
needs:
  - node: short-read-sequencing
    reason: RNA-seq reads are short reads from a sequencer.
  - node: fastq-and-quality-scores
    reason: RNA-seq reads arrive as FASTQ files.
  - node: gene-expression
    reason: RNA-seq measures expression, so the RNA it reads comes from genes being expressed.
```

#### `tests/fixtures/salmon/sequencing/rna-seq-libraries/body.md`

````markdown
Sequencers read DNA, so RNA is first copied into complementary DNA (cDNA), broken into fragments
and fitted with adapters. The result is a **library**. Usually only messenger RNA is kept, by
catching its poly-A tail or by removing ribosomal RNA.

Two properties of a library matter later. **Paired-end** reads give both ends of a fragment, which
pins down where it came from. A **stranded** library records which DNA strand the RNA was copied
from. A quantifier such as Salmon must be told, or must infer, which kind of library it is reading.

The key idea: more copies of an RNA in the sample means more fragments from it, and so more reads.
Counting reads is measuring expression — with corrections that later stops explain.

## Further reading

- [RNA-Seq](https://en.wikipedia.org/wiki/RNA-Seq) — Wikipedia
- [Fragment library types](https://salmon.readthedocs.io/en/latest/library_type.html) — Salmon's documentation
````

- [ ] **Step 3: Write the sequence-analysis nodes on the route**

#### `tests/fixtures/salmon/sequence-analysis/k-mers/node.yaml`

```yaml
schema: 1
title: k-mers
claim: The k-mers of a sequence are all its substrings of length k, and they let a computer find shared sequence by looking words up.
region: sequence-analysis
level: foundations
minutes: 8
needs:
  - node: dna-and-genes
    reason: k-mers are words cut from DNA sequences.
goes-deeper:
  - node: de-bruijn-graphs
    reason: A de Bruijn graph joins overlapping k-mers, which is how Salmon's index stores a transcriptome.
```

#### `tests/fixtures/salmon/sequence-analysis/k-mers/body.md`

````markdown
The 4-mers of `ACGTTG` are `ACGT`, `CGTT` and `GTTG`. A sequence of length n has n − k + 1 k-mers.
With k = 31 there are 4³¹ possible k-mers, so a 31-mer taken from a read usually occurs in only a
few places in a transcriptome.

That makes k-mers good keys. Build a table from every k-mer in a reference to where it occurs, and
a read's k-mers point straight at the places it may have come from. Assemblers, read mappers and
quantifiers such as Salmon and kallisto all start this way.

## Further reading

- [k-mer](https://en.wikipedia.org/wiki/K-mer) — Wikipedia
````

#### `tests/fixtures/salmon/sequence-analysis/sequence-alignment/node.yaml`

```yaml
schema: 1
title: Sequence alignment and scores
claim: An alignment lines two sequences up, allowing gaps, and its score says how good the match is.
region: sequence-analysis
level: foundations
minutes: 12
needs:
  - node: dna-and-genes
    reason: Alignment compares DNA sequences letter by letter.
goes-deeper:
  - node: dynamic-programming
    reason: Dynamic programming is how the best alignment is found without trying every one.
```

#### `tests/fixtures/salmon/sequence-analysis/sequence-alignment/body.md`

````markdown
Two sequences, `ACGTTGCA` and `ACGTATGA`, lined up with a gap (`-`) in each:

```text
ACGT-TGCA
ACGTATG-A
```

A scoring scheme rewards matches and penalises mismatches and gaps — for example +1, −1 and −2.
The best alignment is the one with the highest score.

A score is evidence. When a read aligns to a place in a reference with a high score, it probably
came from there; a low score says it probably did not. Mappers, and Salmon, use scores this way.

## Further reading

- [Sequence alignment](https://en.wikipedia.org/wiki/Sequence_alignment) — Wikipedia
- [Smith–Waterman algorithm](https://en.wikipedia.org/wiki/Smith%E2%80%93Waterman_algorithm) — Wikipedia
````

#### `tests/fixtures/salmon/sequence-analysis/read-mapping/node.yaml`

```yaml
schema: 1
title: Mapping reads to a reference
claim: Mapping finds where in a reference each read could have come from, by looking up its k-mers and checking the candidate places with an alignment.
region: sequence-analysis
level: introductory
minutes: 12
needs:
  - node: short-read-sequencing
    reason: Mapping places the short reads a sequencer produces.
  - node: k-mers
    reason: Mappers find candidate places by looking up a read's k-mers.
  - node: sequence-alignment
    reason: Mappers check each candidate place with an alignment score.
```

#### `tests/fixtures/salmon/sequence-analysis/read-mapping/body.md`

````markdown
A **reference** is a known sequence to compare against: a genome, or a transcriptome of all known
transcripts. Aligning each of millions of reads against the whole reference would take far too
long, so mappers work in two steps. First they look the read's k-mers up in an **index** of the
reference, to find a few candidate places. Then they align the read at those places and keep the
ones that score well.

Salmon maps to the transcriptome, not the genome, and calls this *selective alignment*. It does not
need one best place for a read: it keeps every transcript the read fits well, and the next stop
explains why.

## Further reading

- [A survey of sequence alignment algorithms for next-generation sequencing](https://doi.org/10.1093/bib/bbq015) — Li and Homer, 2010
- [Selective alignment](https://salmon.readthedocs.io/en/latest/salmon.html) — Salmon's documentation
````

#### `tests/fixtures/salmon/sequence-analysis/multi-mapping-reads/node.yaml`

```yaml
schema: 1
title: Reads that map to several places
claim: Many RNA-seq reads fit several transcripts equally well, so counting reads per transcript means deciding how to share them out.
region: sequence-analysis
level: introductory
minutes: 10
needs:
  - node: read-mapping
    reason: A read maps to several places when mapping finds more than one good match.
  - node: transcripts-and-isoforms
    reason: Isoforms share exons, so a read from a shared exon fits all of them.
```

#### `tests/fixtures/salmon/sequence-analysis/multi-mapping-reads/body.md`

````markdown
A read from an exon that isoforms A and B share aligns equally well to both. When reads are mapped
to a transcriptome, a large share of them are like this. Throwing them away loses data and counts
against genes with many isoforms; giving each transcript a full count counts the same read twice.

The way out is to share each read by how likely it is to have come from each transcript. But those
chances depend on how abundant the transcripts are — which is what we are trying to find. That
circle is exactly what the EM algorithm breaks.

## Further reading

- [RSEM: accurate transcript quantification from RNA-Seq data with or without a reference genome](https://doi.org/10.1186/1471-2105-12-323) — Li and Dewey, 2011
````

- [ ] **Step 4: Write the statistics nodes on the route**

#### `tests/fixtures/salmon/statistics/probability/node.yaml`

```yaml
schema: 1
title: Probability
claim: A probability is a number from 0 to 1 that says how likely something is, and the probabilities of all the possible outcomes add up to 1.
region: statistics
level: first-steps
minutes: 10
```

#### `tests/fixtures/salmon/statistics/probability/body.md`

````markdown
A fair coin lands heads with probability 1/2; a fair die shows a six with probability 1/6. The
chance of one outcome *or* another that cannot both happen is the sum of their probabilities. The
chance of two independent things *both* happening is the product: two sixes in a row is
1/6 × 1/6 = 1/36.

A **conditional** probability, P(A | B), is the chance of A once you know B happened. Nearly every
model later on this route is built from these three rules.

## Further reading

- [Probability](https://en.wikipedia.org/wiki/Probability) — Wikipedia
- [Probability](https://www.khanacademy.org/math/statistics-probability/probability-library) — Khan Academy
````

#### `tests/fixtures/salmon/statistics/likelihood/node.yaml`

```yaml
schema: 1
title: Likelihood
claim: The likelihood of a model is how probable it makes the data you actually saw, and the best-fitting model is the one with the highest likelihood.
region: statistics
level: foundations
minutes: 10
needs:
  - node: probability
    reason: Likelihood is the probability of the data under a model.
```

#### `tests/fixtures/salmon/statistics/likelihood/body.md`

````markdown
You flip a coin ten times and get seven heads. If the coin were fair (p = 0.5), the chance of
exactly that result is 120 × 0.5¹⁰ ≈ 0.12. If p = 0.7, it is 120 × 0.7⁷ × 0.3³ ≈ 0.27. The second
model makes the data more probable: it has the higher **likelihood**.

The data stay fixed and the model varies. The value of p with the highest likelihood — here
0.7 — is the **maximum-likelihood estimate**. Salmon's answer is one of these: the abundances that
make the reads it saw most probable.

## Further reading

- [Likelihood function](https://en.wikipedia.org/wiki/Likelihood_function) — Wikipedia
````

#### `tests/fixtures/salmon/statistics/mixture-models/node.yaml`

```yaml
schema: 1
title: Mixture models
claim: A mixture model says each observation came from one of several sources in unknown proportions, and fitting it estimates those proportions.
region: statistics
level: introductory
minutes: 12
needs:
  - node: likelihood
    reason: A mixture model is fitted by finding the proportions with the highest likelihood.
```

#### `tests/fixtures/salmon/statistics/mixture-models/body.md`

````markdown
Suppose you measure the heights of people from two groups without writing down who is in which.
Each height came from one of two sources, each with its own typical value, mixed in some unknown
proportion. A **mixture model** describes exactly that, and fitting it finds the proportions.

RNA-seq is a mixture too. Each transcript is a source, each read is an observation, and the
proportions are the transcripts' relative abundances. If we knew which transcript every read came
from, we would just count. We do not, for the reads that fit several.

## Further reading

- [Mixture model](https://en.wikipedia.org/wiki/Mixture_model) — Wikipedia
````

#### `tests/fixtures/salmon/statistics/em-algorithm/node.yaml`

```yaml
schema: 1
title: The EM algorithm
claim: The EM algorithm fits a mixture model by alternating two steps, sharing each observation among the sources by the current estimate and then re-estimating the proportions from those shares.
region: statistics
level: intermediate
minutes: 15
needs:
  - node: mixture-models
    reason: EM is the standard way to fit a mixture model when the source of each observation is hidden.
goes-deeper:
  - node: variational-bayes-em
    reason: Variational Bayesian EM adds a prior to EM, and it is what Salmon runs by default.
```

#### `tests/fixtures/salmon/statistics/em-algorithm/body.md`

````markdown
Two transcripts, A and B, of equal length. Of 100 reads, 30 fit only A, 10 fit only B, and 60 fit
both. Start by guessing half and half.

1. **Expectation:** share the 60 ambiguous reads by the current guess, 30 to A and 30 to B.
2. **Maximisation:** re-estimate. A has 60 of 100 reads, B has 40, so the guess becomes 0.6 and 0.4.

Repeat. The shares become 36 and 24, and the guess 0.66 and 0.34; then 0.696 and 0.304; and so
on, settling at **A = 0.75, B = 0.25** — the only split where sharing the reads by the guess gives
the guess back. Each round never lowers the likelihood, and EM stops when the guess stops changing.

## Further reading

- [What is the expectation maximization algorithm?](https://doi.org/10.1038/nbt1406) — Do and Batzoglou, 2008
- [Expectation–maximization algorithm](https://en.wikipedia.org/wiki/Expectation%E2%80%93maximization_algorithm) — Wikipedia
````

- [ ] **Step 5: Write the transcriptomics nodes on the route**

#### `tests/fixtures/salmon/transcriptomics/tpm/node.yaml`

```yaml
schema: 1
title: What TPM measures
claim: TPM, transcripts per million, is each transcript's share of the transcript molecules in a sample, scaled so the shares add up to a million.
region: transcriptomics
level: introductory
minutes: 10
needs:
  - node: transcripts-and-isoforms
    reason: TPM is measured per transcript.
  - node: rna-seq-libraries
    reason: TPM is estimated from the reads a library produces.
```

#### `tests/fixtures/salmon/transcriptomics/tpm/body.md`

````markdown
A long transcript gives more fragments than a short one present in the same number of copies, so
raw read counts overstate long transcripts. TPM corrects for that. Divide each transcript's reads
by its **effective length** — the number of places a fragment could start on it — then scale so all
transcripts add up to 1,000,000.

Transcript A is 1,000 bases long with 100 reads; B is 2,000 bases with 100 reads. Their rates are
0.1 and 0.05 reads per base, so A has 666,667 TPM and B has 333,333: A had twice as many
molecules.

TPM compares transcripts within a sample. Comparing samples is the job of methods built on counts,
such as DESeq2.

## Further reading

- [Measurement of mRNA abundance using RNA-seq data: RPKM measure is inconsistent among samples](https://doi.org/10.1007/s12064-012-0162-3) — Wagner, Kin and Lynch, 2012
````

#### `tests/fixtures/salmon/transcriptomics/salmon/node.yaml`

```yaml
schema: 1
title: Salmon
claim: Salmon estimates how much of each transcript a sample holds by mapping RNA-seq reads to the transcriptome and resolving reads that fit several transcripts with a probabilistic model.
region: transcriptomics
level: intermediate
minutes: 15
needs:
  - node: rna-seq-libraries
    reason: Salmon's input is the reads of an RNA-seq library, and it must know the library's type.
  - node: transcripts-and-isoforms
    reason: Salmon estimates abundance per transcript, and isoforms are why that is hard.
  - node: tpm
    reason: Salmon reports each transcript's abundance in TPM.
  - node: read-mapping
    reason: Salmon first finds which transcripts each read could have come from.
  - node: multi-mapping-reads
    reason: Most of Salmon's work is deciding where reads that fit several transcripts belong.
  - node: em-algorithm
    reason: Salmon shares ambiguous reads among transcripts with EM.
goes-deeper:
  - node: pufferfish-index
    reason: The pufferfish index is how Salmon finds a read's candidate transcripts quickly.
  - node: salmon-bias-models
    reason: Salmon corrects its estimates for biases in which fragments get sequenced.
  - node: decoy-sequences
    reason: Decoys stop Salmon forcing reads from outside the transcriptome onto a transcript.
  - node: variational-bayes-em
    reason: Salmon's default is variational Bayesian EM, not plain EM.
  - node: abundance-uncertainty
    reason: Salmon can say how sure it is of each estimate.
related:
  - node: kallisto
    reason: kallisto quantifies transcripts from the same reads, by pseudoalignment instead of alignment.
```

#### `tests/fixtures/salmon/transcriptomics/salmon/body.md`

````markdown
Salmon takes a sample's RNA-seq reads and a transcriptome. It maps each read by selective
alignment and keeps every transcript the read fits well. Reads that fit the same set of transcripts
are grouped into **equivalence classes**, so the rest of the work is over thousands of classes, not
millions of reads.

Its model says a read comes from a transcript in proportion to that transcript's abundance and
effective length. EM — by default its variational Bayesian variant — finds the abundances that best
explain the reads, sharing each ambiguous read out along the way. Salmon also learns the fragment
length distribution and, when asked, corrects for sequence, GC and positional biases.

The result, `quant.sf`, gives each transcript's `Length`, `EffectiveLength`, `TPM` and `NumReads`.
A sample takes minutes on a laptop, and gene-level numbers come from summing transcripts, as
tximport does.

## Further reading

- [Salmon provides fast and bias-aware quantification of transcript expression](https://doi.org/10.1038/nmeth.4197) — Patro et al., 2017
- [Salmon's documentation](https://salmon.readthedocs.io/en/latest/salmon.html)
- [Reference-based RNA-Seq data analysis](https://training.galaxyproject.org/training-material/topics/transcriptomics/tutorials/ref-based/tutorial.html) — Galaxy Training Network, a course that runs a quantification end to end
````

- [ ] **Step 6: Run the route tests**

Run: `uv run pytest tests/schema/test_fixtures.py -q`
Expected: 4 passed (canonical, route, first steps, no harder level), 4 failed (no problems, the
command, attached, peers): *salmon* and *k-mers* link to nodes Task 3 writes, so the validator
reports missing targets.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/salmon
git commit  # test: the route to Salmon, 17 fixture nodes
```

---

### Task 3: attached below and beside, 9 nodes

- [ ] **Step 1: Write the algorithms nodes**

#### `tests/fixtures/salmon/algorithms/graphs/node.yaml`

```yaml
schema: 1
title: Graphs
claim: A graph is a set of nodes joined by edges, and many problems become questions about paths through one.
region: algorithms
level: foundations
minutes: 10
```

#### `tests/fixtures/salmon/algorithms/graphs/body.md`

````markdown
A metro map is a graph: stations are **nodes**, and the lines between them are **edges**. When an
edge has a direction — a one-way street, or "this topic needs that one" — the graph is
**directed**. A **path** is a walk along edges from one node to another.

Much of computing is rephrasing a problem as a graph and asking about its paths: the shortest
route, whether one exists, or a walk that uses every edge once. The route you are following to
Salmon is a path through a graph of topics.

## Further reading

- [Graph theory](https://en.wikipedia.org/wiki/Graph_theory) — Wikipedia
````

#### `tests/fixtures/salmon/algorithms/de-bruijn-graphs/node.yaml`

```yaml
schema: 1
title: de Bruijn graphs
claim: A de Bruijn graph has a node for each k-mer and an edge wherever one k-mer overlaps the next by all but one letter, so shared sequence is stored once.
region: algorithms
level: intermediate
minutes: 15
needs:
  - node: k-mers
    reason: A de Bruijn graph is built from k-mers.
  - node: graphs
    reason: A de Bruijn graph is a graph, with k-mers as its nodes.
```

#### `tests/fixtures/salmon/algorithms/de-bruijn-graphs/body.md`

````markdown
Take two transcripts and cut them into 4-mers:

```text
A  ACGTTGCA   ACGT CGTT GTTG TTGC TGCA
B  ACGTTGAA   ACGT CGTT GTTG TTGA TGAA
```

Make each distinct 4-mer a node, and draw an edge from `ACGT` to `CGTT` because the last three
letters of one are the first three of the other. A and B share the path
`ACGT → CGTT → GTTG`, stored once, and then it branches.

A stretch with no branches can be merged into one piece, a **unitig**: here `ACGTTG`, then `TTGCA`
or `TTGAA`. That is a **compacted** de Bruijn graph. Recording which sequences each unitig came from
makes it **coloured**. Genome assemblers use these graphs to rebuild a genome from reads; the
textbook form for assembly puts (k − 1)-mers on the nodes and k-mers on the edges, which is the
same idea.

## Further reading

- [How to apply de Bruijn graphs to genome assembly](https://doi.org/10.1038/nbt.2023) — Compeau, Pevzner and Tesler, 2011
- [De Bruijn graph](https://en.wikipedia.org/wiki/De_Bruijn_graph) — Wikipedia
````

#### `tests/fixtures/salmon/algorithms/dynamic-programming/node.yaml`

```yaml
schema: 1
title: Dynamic programming
claim: Dynamic programming solves a problem by solving each of its smaller overlapping subproblems once and building the answer from a table of their results.
region: algorithms
level: foundations
minutes: 12
```

#### `tests/fixtures/salmon/algorithms/dynamic-programming/body.md`

````markdown
There are astronomically many ways to align two sequences, too many to try. But the best alignment
of the first i letters of one sequence with the first j of the other can only end in three ways: a
match or mismatch, a gap in one, or a gap in the other. Each extends a smaller alignment whose best
score is already known.

So fill a table, one cell per (i, j), each cell computed from three neighbours. The last cell holds
the best score, and tracing back through the table gives the alignment — about n × m steps for
sequences of length n and m. Global alignment done this way is Needleman–Wunsch; local alignment is
Smith–Waterman.

## Further reading

- [Dynamic programming](https://en.wikipedia.org/wiki/Dynamic_programming) — Wikipedia
- [Needleman–Wunsch algorithm](https://en.wikipedia.org/wiki/Needleman%E2%80%93Wunsch_algorithm) — Wikipedia
````

- [ ] **Step 2: Write the sequence-analysis nodes below Salmon**

#### `tests/fixtures/salmon/sequence-analysis/pufferfish-index/node.yaml`

```yaml
schema: 1
title: The pufferfish index
claim: Pufferfish is the index Salmon builds from a transcriptome, a compacted coloured de Bruijn graph that finds where a read's k-mers occur using little memory.
region: sequence-analysis
level: advanced
minutes: 15
needs:
  - node: de-bruijn-graphs
    reason: Pufferfish stores the transcriptome as a compacted, coloured de Bruijn graph.
  - node: read-mapping
    reason: Pufferfish is the index a mapper looks a read's k-mers up in.
```

#### `tests/fixtures/salmon/sequence-analysis/pufferfish-index/body.md`

````markdown
Since version 1.0, `salmon index` builds a pufferfish index. Every distinct k-mer of the
transcriptome (k = 31 by default) is stored once, in a compacted de Bruijn graph. Each unitig
records which transcripts contain it and where — its colours.

To map a read, Salmon looks up the read's k-mers, lands on unitigs, and reads off candidate
transcripts and positions, which selective alignment then scores. Exons that isoforms share are
stored once, which is why the index of a whole transcriptome fits in a few gigabytes of memory.

## Further reading

- [A space and time-efficient index for the compacted colored de Bruijn graph](https://doi.org/10.1093/bioinformatics/bty292) — Almodaresi et al., 2018
- [Salmon's documentation](https://salmon.readthedocs.io/en/latest/salmon.html)
````

#### `tests/fixtures/salmon/sequence-analysis/decoy-sequences/node.yaml`

```yaml
schema: 1
title: Decoy sequences
claim: A decoy-aware index adds genome sequence to Salmon's transcriptome index, so reads from outside annotated transcripts are recognised instead of forced onto a transcript.
region: sequence-analysis
level: advanced
minutes: 10
needs:
  - node: salmon
    reason: Decoys change which reads Salmon counts.
```

#### `tests/fixtures/salmon/sequence-analysis/decoy-sequences/body.md`

````markdown
A transcriptome is only the annotated part of the genome. A read from an intron, from between
genes, or from an unannotated gene may still look enough like some transcript to map to it, and
make that transcript look more abundant than it is.

A **decoy-aware** index adds the genome, or the parts of it that resemble transcripts, as decoys.
When a read fits a decoy better than any transcript, Salmon sets it aside instead of counting it.
Srivastava and colleagues showed that choices like this measurably change abundance estimates.

## Further reading

- [Alignment and mapping methodology influence transcript abundance estimation](https://doi.org/10.1186/s13059-020-02151-8) — Srivastava et al., 2020
- [Preparing transcriptome indices](https://salmon.readthedocs.io/en/latest/salmon.html) — Salmon's documentation
````

- [ ] **Step 3: Write the statistics nodes below Salmon**

#### `tests/fixtures/salmon/statistics/variational-bayes-em/node.yaml`

```yaml
schema: 1
title: Variational Bayesian EM
claim: Variational Bayesian EM estimates a distribution over abundances with a prior, instead of one best value, which steadies the estimates for poorly supported transcripts.
region: statistics
level: advanced
minutes: 15
needs:
  - node: em-algorithm
    reason: Variational Bayesian EM is EM with a prior, and a distribution in place of a single estimate.
```

#### `tests/fixtures/salmon/statistics/variational-bayes-em/body.md`

````markdown
Plain EM finds the single most likely set of abundances. For transcripts with few reads of their
own, many different splits explain the data almost equally well, and EM's answer can swing between
them.

The variational Bayesian version puts a **prior** on the abundances — a small amount of belief
spread over every transcript — and estimates an approximate distribution over abundances rather
than one point. The effect in practice is steadier estimates for transcripts the data barely
support. Salmon runs it by default in its final phase; `--useEM` switches to plain EM.

## Further reading

- [Variational Bayesian methods](https://en.wikipedia.org/wiki/Variational_Bayesian_methods) — Wikipedia
- [Salmon provides fast and bias-aware quantification of transcript expression](https://doi.org/10.1038/nmeth.4197) — Patro et al., 2017
````

#### `tests/fixtures/salmon/statistics/abundance-uncertainty/node.yaml`

```yaml
schema: 1
title: Uncertainty in abundance
claim: Salmon can repeat its inference on resampled data to show how much each abundance estimate could vary.
region: statistics
level: advanced
minutes: 10
needs:
  - node: salmon
    reason: The uncertainty is around Salmon's own estimates.
```

#### `tests/fixtures/salmon/statistics/abundance-uncertainty/body.md`

````markdown
One number per transcript hides how sure Salmon is of it. A transcript with many reads of its own
is pinned down; one whose reads are all shared with a sibling isoform could plausibly be much
higher or lower.

With `--numBootstraps` or `--numGibbsSamples`, Salmon repeats its estimate many times — on
resampled data, or by sampling from its model — and writes every repetition out. Their spread is
the uncertainty. Downstream methods, such as fishpond's swish, use these repetitions so that an
uncertain transcript does not look like a confident change.

## Further reading

- [Bootstrapping (statistics)](https://en.wikipedia.org/wiki/Bootstrapping_%28statistics%29) — Wikipedia
- [Salmon's documentation](https://salmon.readthedocs.io/en/latest/salmon.html)
````

- [ ] **Step 4: Write the transcriptomics nodes beside and below Salmon**

#### `tests/fixtures/salmon/transcriptomics/salmon-bias-models/node.yaml`

```yaml
schema: 1
title: Salmon's bias models
claim: Salmon learns how sequence, GC content and position change which fragments get sequenced, and corrects each transcript's effective length for it.
region: transcriptomics
level: advanced
minutes: 12
needs:
  - node: salmon
    reason: The bias models refine the estimates Salmon makes.
```

#### `tests/fixtures/salmon/transcriptomics/salmon-bias-models/body.md`

````markdown
Library preparation does not sample fragments evenly. Some sequences at fragment ends are primed
more readily (**sequence-specific bias**), fragments with very high or low GC content are
under-represented (**GC bias**), and coverage can drift along a transcript (**positional bias**).
Ignored, these make a transcript whose sequence happens to be favoured look more abundant.

Salmon learns each bias from the data while it maps — `--seqBias`, `--gcBias` and `--posBias` —
and folds it into every transcript's effective length. Patro and colleagues showed that correcting
GC bias removes many false positives in differential transcript expression.

## Further reading

- [Salmon provides fast and bias-aware quantification of transcript expression](https://doi.org/10.1038/nmeth.4197) — Patro et al., 2017
- [Modeling of RNA-seq fragment sequence bias reduces systematic errors in transcript abundance estimation](https://doi.org/10.1038/nbt.3682) — Love, Hogenesch and Irizarry, 2016
````

#### `tests/fixtures/salmon/transcriptomics/kallisto/node.yaml`

```yaml
schema: 1
title: kallisto
claim: kallisto estimates transcript abundance from RNA-seq reads by pseudoalignment, finding which transcripts a read fits without aligning it, and then running EM.
region: transcriptomics
level: intermediate
minutes: 12
needs:
  - node: rna-seq-libraries
    reason: kallisto's input is the reads of an RNA-seq library.
  - node: transcripts-and-isoforms
    reason: kallisto estimates abundance per transcript.
  - node: tpm
    reason: kallisto reports each transcript's abundance in TPM.
  - node: k-mers
    reason: Pseudoalignment matches a read's k-mers against the transcriptome's.
  - node: multi-mapping-reads
    reason: kallisto has to share reads that fit several transcripts.
  - node: em-algorithm
    reason: kallisto shares those reads among transcripts with EM.
related:
  - node: salmon
    reason: Salmon quantifies transcripts from the same reads, with selective alignment and richer bias models.
```

#### `tests/fixtures/salmon/transcriptomics/kallisto/body.md`

````markdown
kallisto looks a read's k-mers up in an index of the transcriptome and intersects the sets of
transcripts they occur in. The result — the transcripts the read is compatible with — is a
**pseudoalignment**: no letter-by-letter alignment is ever computed, which makes it very fast.
Then, like Salmon, it groups reads into equivalence classes and runs EM.

On most data kallisto and Salmon give similar answers. Salmon adds alignment scores, decoys and
richer bias models; kallisto is simpler and was first to show that quantification could take
minutes.

## Further reading

- [Near-optimal probabilistic RNA-seq quantification](https://doi.org/10.1038/nbt.3519) — Bray, Pimentel, Melsted and Pachter, 2016
````

- [ ] **Step 5: Run the fixture tests and the validator**

Run: `uv run pytest tests/schema/test_fixtures.py -q && uv run code-schema validate tests/fixtures/salmon`
Expected: 8 passed; `26 nodes, no problems`.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/salmon
git commit  # test: nine fixture nodes below and beside Salmon
```

---

### Task 4: links opened, W1 corrected, the record

**Files:**
- Modify: `docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md` (W1)
- Modify: `CLAUDE.md` (status line)
- Create: `docs/notes/journal/2026-09-19-m1-part-4-salmon-fixtures.md`
- Modify: `docs/notes/journal/README.md` (the box and the table)

- [ ] **Step 1: Open every external link once**

```bash
grep -rhoE '\]\(https?://[^)]+\)' tests/fixtures/salmon | sed -E 's/^\]\((.*)\)$/\1/' | sort -u
```

Open each (a `curl -sSIL -o /dev/null -w '%{http_code}'` is enough where the site answers bots;
`doi.org` must redirect). A link that does not resolve is replaced with one that does, and the
tests rerun.

- [ ] **Step 2: Correct W1**

After W1's paragraph beginning *The Salmon example is a real one*, add a dated note in the
file's own convention for revisions:

```markdown
*Revised 2026-09-19 ([M1 part 4](2026-09-19-m1-salmon-fixtures-design.md)): under the need rule,
de Bruijn graphs is not on the route to Salmon but one goes-deeper link away, through The
pufferfish index. Salmon's claim can be understood without knowing how its index is built.*
```

- [ ] **Step 3: Status line, journal entry, README box**

CLAUDE.md's status: parts 1–4 of 6 built; part 4 is 26 fixture nodes in `tests/fixtures/salmon/`.
The journal entry follows the README's six headings, records that part 4 grew from the parts list's
8–12 nodes to 26 (the parts list is an append-only journal entry, so the growth is recorded here)
and why, the links replaced in Step 1 if any, and that the first large seeds come from the
operator's master's classes.

- [ ] **Step 4: The whole command set**

Run: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest`
Expected: all pass (235 tests; Compose's Postgres and Redis running).

- [ ] **Step 5: Commit, pull request, merge on green**

```bash
git add -A && git commit  # docs: M1 part 4 done — W1 corrected, journal
git push -u origin docs/m1-part-4-salmon-fixtures
gh pr create ...
gh pr checks <n> --watch > /tmp/checks.log 2>&1; echo "exit=$?" > /tmp/checks.exit
```

Merge only when the captured exit is 0.
