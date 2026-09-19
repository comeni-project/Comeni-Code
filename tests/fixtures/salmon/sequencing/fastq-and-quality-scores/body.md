One read in a FASTQ file:

```text
@read_1
ACGTTGCAAT
+
IIIIHHG#FF
```

The first line names the read, the second holds its letters, the third is a separator, and the
fourth gives one character per letter: how sure the sequencer is of it. Each character encodes a
**Phred score**, Q = −10 log₁₀(p), where p is the chance the letter is wrong. Q30 means one error
in a thousand.

A paired-end run writes two files, usually ending `_1` and `_2`, with the two reads of each
fragment in the same position in both.

## Further reading

- [FASTQ format](https://en.wikipedia.org/wiki/FASTQ_format) — Wikipedia
- [Phred quality score](https://en.wikipedia.org/wiki/Phred_quality_score) — Wikipedia
