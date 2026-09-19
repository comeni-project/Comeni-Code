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
