A transcriptome is only the annotated part of the genome. A read from an intron, from between
genes, or from an unannotated gene may still look enough like some transcript to map to it, and
make that transcript look more abundant than it is.

A **decoy-aware** index adds the genome, or the parts of it that resemble transcripts, as decoys.
When a read fits a decoy better than any transcript, Salmon sets it aside instead of counting it.
Srivastava and colleagues showed that choices like this measurably change abundance estimates.

## Further reading

- [Alignment and mapping methodology influence transcript abundance estimation](https://doi.org/10.1186/s13059-020-02151-8) — Srivastava et al., 2020
- [Preparing transcriptome indices](https://salmon.readthedocs.io/en/latest/salmon.html) — Salmon's documentation
