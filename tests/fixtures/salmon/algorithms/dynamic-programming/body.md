There are astronomically many ways to align two sequences, too many to try. But the best alignment
of the first i letters of one sequence with the first j of the other can only end in three ways: a
match or mismatch, a gap in one, or a gap in the other. Each extends a smaller alignment whose best
score is already known.

So fill a table, one cell per (i, j), each cell computed from three neighbours. The last cell holds
the best score, and tracing back through the table gives the alignment — about n × m steps for
sequences of length n and m. Global alignment done this way is Needleman–Wunsch; local alignment is
Smith–Waterman.

## Further reading

- [Dynamic programming](https://en.wikipedia.org/wiki/Dynamic_programming) — Wikipedia
- [Needleman–Wunsch algorithm](https://en.wikipedia.org/wiki/Needleman%E2%80%93Wunsch_algorithm) — Wikipedia
