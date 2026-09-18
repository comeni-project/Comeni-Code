# What understanding Salmon depends on

**2026-09-18.** A study of what a learner must understand for *Salmon*'s claim to make sense, done
before the region registry was written and before M1 part 4's Salmon fixtures. It sorts every
concept Salmon's method uses into the three kinds of link (W3.2), using the rule the operator set
for *needs*: **a need is what understanding the claim requires, never how to operate a tool**
(M1P2.3). Dated and not maintained; part 4's fixtures are where it becomes content.

## What Salmon does, from its sources

- **Maps reads to a transcriptome by selective alignment**, the default since Salmon 1.0: seeds from
  a k-mer index, chains them with minimap2's chaining algorithm, and scores candidate alignments
  with ksw2's dynamic programming, discarding spurious ones. *(Salmon documentation.)*
- **Guards against false mappings with decoys**: a *decoy-aware* index adds the genome (or regions
  of it similar to the transcriptome), so a read from an unannotated locus is not forced onto a
  transcript. *(Salmon documentation; Srivastava et al. 2020.)*
- **Indexes with pufferfish**, a compacted, coloured de Bruijn graph over the transcriptome's k-mers,
  default *k* = 31. *(Salmon documentation; Almodaresi et al. 2018.)*
- **Estimates abundance with a generative model and two phases of inference**: an online phase
  (stochastic collapsed variational Bayes over mini-batches) that also learns the bias models and
  builds *rich equivalence classes* — fragments grouped by the set of transcripts they are
  compatible with — and an offline phase over those classes, **variational Bayesian EM by default**,
  plain EM with `--useEM`. *(Patro et al. 2017; documentation.)*
- **Models what makes counts misleading**: the fragment length distribution (and so each
  transcript's **effective length**), sequence-specific bias at fragment ends, fragment GC bias,
  and positional bias. *(Patro et al. 2017.)*
- **Reports** `TPM`, `NumReads` and `EffectiveLength` in `quant.sf`, and can express its
  uncertainty with bootstraps or Gibbs samples. *(Documentation.)*
- **Needs to know the library**: paired or single end, stranded or not, and which strand — the
  library type string (`IU`, `SF`, …). *(Documentation.)* Reference-based RNA-seq courses (the
  Galaxy Training Network's) teach FASTQ, quality control, paired-end reads, the reference and its
  annotation, and strandedness before any quantification.

## Sorted into links

*Salmon*'s claim, as a node would state it: *Salmon estimates how much of each transcript a sample
holds by mapping RNA-seq reads to the transcriptome and resolving reads that fit several
transcripts with a probabilistic model.*

**needs** — each one is required to understand that sentence:

| Need | Why *Salmon* needs it (the reason a node would carry) |
|---|---|
| *RNA-seq reads and libraries* | Salmon's input is fragments from an RNA-seq library, paired or not, stranded or not. |
| *Transcripts and isoforms* | Isoforms share exons, which is why a read can fit several transcripts. |
| *What TPM measures* | Salmon reports abundance in TPM, built on effective length. |
| *Mapping reads to a reference* | Salmon first finds which transcripts each read could have come from. |
| *Reads that map to several places* | Most of Salmon's work is deciding where ambiguous reads belong. |
| *The EM algorithm* | Salmon resolves ambiguous reads by expectation–maximisation over equivalence classes. |

**Their needs, one level down** — the route's lower stops:

| Node | Needs |
|---|---|
| *RNA-seq reads and libraries* | *Short-read sequencing*, *FASTQ and quality scores* |
| *Transcripts and isoforms* | *Transcription*, *Splicing* |
| *Transcription*, *Splicing* | *DNA and genes*, *Gene expression* |
| *What TPM measures* | *Transcripts and isoforms*, *Ratios and normalisation* |
| *Mapping reads to a reference* | *k-mers*, *Sequence alignment and scores* |
| *Sequence alignment and scores* | *Dynamic programming* |
| *The EM algorithm* | *Likelihood*, *Mixture models* |
| *Likelihood*, *Mixture models* | *Probability* |

**goes deeper** from *Salmon* — true, interesting, and not required for the claim:

- *The pufferfish index* (needs *de Bruijn graphs*, which needs *k-mers* and *Graphs*);
- *Salmon's bias models* — sequence, GC and positional;
- *Decoy sequences* — why a transcriptome index needs part of the genome;
- *Variational Bayesian EM and priors* — the default offline phase;
- *Uncertainty in abundance* — bootstraps and Gibbs samples.

**related** — what a learner might read *instead of* Salmon:

- *kallisto* — pseudoalignment, no bias correction;
- *RSEM* — EM over full alignments;
- *STAR + featureCounts* — spliced alignment to the genome, then counting per gene.

**needed by** — derived, for reference: *tximport* (transcript to gene), *Differential expression
with DESeq2*.

**Not needs** — tool operation, which the rule excludes: *command-line basics*, *Galaxy*, building an
index with `salmon index`. These are resources in the body (T4).

## What it changes

1. **A tension with W1.** W1 says *de Bruijn graphs* "genuinely belongs on the route to *Salmon*"
   because pufferfish is built on one. Under the need rule it belongs **below** *Salmon*, as a
   *goes deeper* through *The pufferfish index*: the claim can be understood without the index's
   data structure. The route to *Salmon* still reaches *k-mers*, through mapping. **Decided in part
   4**, when the fixtures are written — if the operator wants the index on the route, *Salmon*'s
   claim should say so.
2. **Six regions, not four.** The concepts fall into six fields a learner would recognise:

| Region | Holds |
|---|---|
| `molecular-biology` | DNA and genes, gene expression, transcription, splicing, transcripts and isoforms |
| `sequencing` | short-read sequencing, libraries, paired-end reads, strandedness, FASTQ and quality scores |
| `sequence-analysis` | references, k-mers, alignment and scores, mapping, multi-mapping reads |
| `algorithms` | graphs, hashing, dynamic programming, de Bruijn graphs |
| `statistics` | probability, likelihood, mixture models, EM, variational inference, bootstraps |
| `transcriptomics` | TPM, Salmon, kallisto, RSEM, tximport, differential expression |

   `algorithms` is separate from `sequence-analysis` because graphs, hashing and dynamic
   programming are general computer science that assembly and search reuse, and the region is how
   a computer-science learner recognises what they already hold. `transcriptomics` is the field a
   learner names when they say "quantify my RNA-seq", so *Salmon* and its peers live there.

## Sources

- Patro R, Duggal G, Love MI, Irizarry RA, Kingsford C. *Salmon provides fast and bias-aware
  quantification of transcript expression.* Nature Methods 14, 417–419 (2017).
  [doi:10.1038/nmeth.4197](https://doi.org/10.1038/nmeth.4197) ·
  [PMC5600148](https://pmc.ncbi.nlm.nih.gov/articles/PMC5600148/)
- Srivastava A, Malik L, Sarkar H, et al. *Alignment and mapping methodology influence transcript
  abundance estimation.* Genome Biology 21, 239 (2020).
  [doi:10.1186/s13059-020-02151-8](https://doi.org/10.1186/s13059-020-02151-8)
- Almodaresi F, Sarkar H, Srivastava A, Patro R. *A space and time-efficient index for the compacted
  colored de Bruijn graph.* Bioinformatics 34(13), i169–i177 (2018).
  [doi:10.1093/bioinformatics/bty292](https://doi.org/10.1093/bioinformatics/bty292)
- [Salmon documentation](https://salmon.readthedocs.io/en/latest/salmon.html) — selective
  alignment, decoys, library types, VBEM default, bias flags, `quant.sf`.
- Galaxy Training Network, [*Reference-based RNA-Seq data analysis*](https://training.galaxyproject.org/training-material/topics/transcriptomics/tutorials/ref-based/tutorial.html)
  — the order a course teaches FASTQ, QC, paired ends, references, strandedness and counting.
