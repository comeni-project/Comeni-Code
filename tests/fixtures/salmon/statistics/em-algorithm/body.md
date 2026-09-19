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
