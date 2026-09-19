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
