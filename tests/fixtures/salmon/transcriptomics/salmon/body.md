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
