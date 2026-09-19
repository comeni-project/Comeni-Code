Two sequences, `ACGTTGCA` and `ACGTATGA`, lined up with a gap (`-`) in each:

```text
ACGT-TGCA
ACGTATG-A
```

A scoring scheme rewards matches and penalises mismatches and gaps — for example +1, −1 and −2.
The best alignment is the one with the highest score.

A score is evidence. When a read aligns to a place in a reference with a high score, it probably
came from there; a low score says it probably did not. Mappers, and Salmon, use scores this way.

## Further reading

- [Sequence alignment](https://en.wikipedia.org/wiki/Sequence_alignment) — Wikipedia
- [Smith–Waterman algorithm](https://en.wikipedia.org/wiki/Smith%E2%80%93Waterman_algorithm) — Wikipedia
