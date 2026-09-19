Suppose you measure the heights of people from two groups without writing down who is in which.
Each height came from one of two sources, each with its own typical value, mixed in some unknown
proportion. A **mixture model** describes exactly that, and fitting it finds the proportions.

RNA-seq is a mixture too. Each transcript is a source, each read is an observation, and the
proportions are the transcripts' relative abundances. If we knew which transcript every read came
from, we would just count. We do not, for the reads that fit several.

## Further reading

- [Mixture model](https://en.wikipedia.org/wiki/Mixture_model) — Wikipedia
