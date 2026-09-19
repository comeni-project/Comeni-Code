A read from an exon that isoforms A and B share aligns equally well to both. When reads are mapped
to a transcriptome, a large share of them are like this. Throwing them away loses data and counts
against genes with many isoforms; giving each transcript a full count counts the same read twice.

The way out is to share each read by how likely it is to have come from each transcript. But those
chances depend on how abundant the transcripts are — which is what we are trying to find. That
circle is exactly what the EM algorithm breaks.

## Further reading

- [RSEM: accurate transcript quantification from RNA-Seq data with or without a reference genome](https://doi.org/10.1186/1471-2105-12-323) — Li and Dewey, 2011
