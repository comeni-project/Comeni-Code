Take two transcripts and cut them into 4-mers:

```text
A  ACGTTGCA   ACGT CGTT GTTG TTGC TGCA
B  ACGTTGAA   ACGT CGTT GTTG TTGA TGAA
```

:::{sequence}
ACGTTGCA
:::

:::{try} kmers-per-read
:::

Make each distinct 4-mer a node, and draw an edge from `ACGT` to `CGTT` because the last three
letters of one are the first three of the other. A and B share the path
`ACGT → CGTT → GTTG`, stored once, and then it branches.

A stretch with no branches can be merged into one piece, a **unitig**: here `ACGTTG`, then `TTGCA`
or `TTGAA`. That is a **compacted** de Bruijn graph. Recording which sequences each unitig came from
makes it **coloured**. Genome assemblers use these graphs to rebuild a genome from reads; the
textbook form for assembly puts (k − 1)-mers on the nodes and k-mers on the edges, which is the
same idea.

:::{try} shared-unitig
:::

Reading a path back is how an assembler spells a sequence: each edge adds one letter.

:::{try} spell-the-path
:::

:::{try} assembly-order
:::

Formally, for reads $R$ and an integer $k$:

:::{math}
G_k(R) = (V, E), \quad V = \{\,(k-1)\text{-mers of } R\,\}, \quad E = \{\,k\text{-mers of } R\,\}
:::

:::{example} Three reads into one sequence
Cut each read into 3-mers, keep the distinct ones, and walk them in order:

```text
reads     ACGTT        CGTTA        GTTAG
3-mers    ACG CGT GTT  CGT GTT TTA  GTT TTA TAG
distinct  ACG CGT GTT TTA TAG
path      ACG → CGT → GTT → TTA → TAG
spells    ACGTTAG
```

Each step along the path adds one letter, so five 3-mers spell $5 + 3 - 1 = 7$ letters.
:::

:::{image} kmers-in-a-row.png
Three k-mers along one path: each shares all but one letter with the next.
:::

Choosing k trades branching against how many k-mers each read yields:

:::{figure} kmer-counts
Distinct k-mers and branching nodes for one 6,400-base genome.
:::

:::{figure} kmers-by-k
Distinct k-mers as k grows, for two genomes of the same length.
:::

:::{figure} salmon-steps
Where k is used in Salmon: once, when the index is built.
:::

:::{figure} primer-on-exon
A 62-base stretch with two exons and a forward primer.
:::

## Further reading

- [How to apply de Bruijn graphs to genome assembly](https://doi.org/10.1038/nbt.2023) — Compeau, Pevzner and Tesler, 2011
- [De Bruijn graph](https://en.wikipedia.org/wiki/De_Bruijn_graph) — Wikipedia
