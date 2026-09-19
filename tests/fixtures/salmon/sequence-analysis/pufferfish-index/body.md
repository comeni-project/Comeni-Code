Since version 1.0, `salmon index` builds a pufferfish index. Every distinct k-mer of the
transcriptome (k = 31 by default) is stored once, in a compacted de Bruijn graph. Each unitig
records which transcripts contain it and where — its colours.

To map a read, Salmon looks up the read's k-mers, lands on unitigs, and reads off candidate
transcripts and positions, which selective alignment then scores. Exons that isoforms share are
stored once, which is why the index of a whole transcriptome fits in a few gigabytes of memory.

## Further reading

- [A space and time-efficient index for the compacted colored de Bruijn graph](https://doi.org/10.1093/bioinformatics/bty292) — Almodaresi et al., 2018
- [Salmon's documentation](https://salmon.readthedocs.io/en/latest/salmon.html)
