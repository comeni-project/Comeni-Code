Take two transcripts and cut them into 4-mers:

```text
A  ACGTTGCA   ACGT CGTT GTTG TTGC TGCA
B  ACGTTGAA   ACGT CGTT GTTG TTGA TGAA
```

Make each distinct 4-mer a node, and draw an edge from `ACGT` to `CGTT` because the last three
letters of one are the first three of the other. A and B share the path
`ACGT → CGTT → GTTG`, stored once, and then it branches.

A stretch with no branches can be merged into one piece, a **unitig**: here `ACGTTG`, then `TTGCA`
or `TTGAA`. That is a **compacted** de Bruijn graph. Recording which sequences each unitig came from
makes it **coloured**. Genome assemblers use these graphs to rebuild a genome from reads; the
textbook form for assembly puts (k − 1)-mers on the nodes and k-mers on the edges, which is the
same idea.

## Further reading

- [How to apply de Bruijn graphs to genome assembly](https://doi.org/10.1038/nbt.2023) — Compeau, Pevzner and Tesler, 2011
- [De Bruijn graph](https://en.wikipedia.org/wiki/De_Bruijn_graph) — Wikipedia
