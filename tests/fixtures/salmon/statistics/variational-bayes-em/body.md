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
