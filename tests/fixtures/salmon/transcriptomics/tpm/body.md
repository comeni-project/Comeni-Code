A long transcript gives more fragments than a short one present in the same number of copies, so
raw read counts overstate long transcripts. TPM corrects for that. Divide each transcript's reads
by its **effective length** — the number of places a fragment could start on it — then scale so all
transcripts add up to 1,000,000.

Transcript A is 1,000 bases long with 100 reads; B is 2,000 bases with 100 reads. Their rates are
0.1 and 0.05 reads per base, so A has 666,667 TPM and B has 333,333: A had twice as many
molecules.

TPM compares transcripts within a sample. Comparing samples is the job of methods built on counts,
such as DESeq2.

## Further reading

- [Measurement of mRNA abundance using RNA-seq data: RPKM measure is inconsistent among samples](https://doi.org/10.1007/s12064-012-0162-3) — Wagner, Kin and Lynch, 2012
