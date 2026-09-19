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
