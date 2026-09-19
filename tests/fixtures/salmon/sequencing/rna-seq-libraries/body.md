Sequencers read DNA, so RNA is first copied into complementary DNA (cDNA), broken into fragments
and fitted with adapters. The result is a **library**. Usually only messenger RNA is kept, by
catching its poly-A tail or by removing ribosomal RNA.

Two properties of a library matter later. **Paired-end** reads give both ends of a fragment, which
pins down where it came from. A **stranded** library records which DNA strand the RNA was copied
from. A quantifier such as Salmon must be told, or must infer, which kind of library it is reading.

The key idea: more copies of an RNA in the sample means more fragments from it, and so more reads.
Counting reads is measuring expression — with corrections that later stops explain.

## Further reading

- [RNA-Seq](https://en.wikipedia.org/wiki/RNA-Seq) — Wikipedia
- [Fragment library types](https://salmon.readthedocs.io/en/latest/library_type.html) — Salmon's documentation
