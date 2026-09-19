The 4-mers of `ACGTTG` are `ACGT`, `CGTT` and `GTTG`. A sequence of length n has n − k + 1 k-mers.
With k = 31 there are 4³¹ possible k-mers, so a 31-mer taken from a read usually occurs in only a
few places in a transcriptome.

That makes k-mers good keys. Build a table from every k-mer in a reference to where it occurs, and
a read's k-mers point straight at the places it may have come from. Assemblers, read mappers and
quantifiers such as Salmon and kallisto all start this way.

## Further reading

- [k-mer](https://en.wikipedia.org/wiki/K-mer) — Wikipedia
