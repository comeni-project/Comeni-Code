"""Our own PRNG (M6.7 spec, M6PR.1): splitmix64 over 64-bit integers.

Python promises that `random.random()` reproduces from a seed, not `randrange` or `choice`; a
learner's dataset must read the same in a later Python, so every draw comes from here.
"""

from collections.abc import Sequence

MASK = (1 << 64) - 1


class Rng:
    def __init__(self, seed: int) -> None:
        self.seed = seed  # what a dataset is named after
        self.state = seed & MASK

    def next(self) -> int:
        self.state = (self.state + 0x9E3779B97F4A7C15) & MASK
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        return z ^ (z >> 31)

    def below(self, n: int) -> int:
        """A draw in [0, n), without modulo bias (rejection above the last whole multiple)."""
        if n <= 0:
            raise ValueError("below() needs a positive bound")
        limit = (1 << 64) - (1 << 64) % n
        while True:
            drawn = self.next()
            if drawn < limit:
                return drawn % n

    def choice[T](self, items: Sequence[T]) -> T:
        return items[self.below(len(items))]

    def letters(self, n: int, alphabet: str = "ACGT") -> str:
        return "".join(alphabet[self.below(len(alphabet))] for _ in range(n))
