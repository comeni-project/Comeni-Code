kallisto looks a read's k-mers up in an index of the transcriptome and intersects the sets of
transcripts they occur in. The result — the transcripts the read is compatible with — is a
**pseudoalignment**: no letter-by-letter alignment is ever computed, which makes it very fast.
Then, like Salmon, it groups reads into equivalence classes and runs EM.

On most data kallisto and Salmon give similar answers. Salmon adds alignment scores, decoys and
richer bias models; kallisto is simpler and was first to show that quantification could take
minutes.

## Further reading

- [Near-optimal probabilistic RNA-seq quantification](https://doi.org/10.1038/nbt.3519) — Bray, Pimentel, Melsted and Pachter, 2016
