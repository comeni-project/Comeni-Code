"""Reads drawn from a random genome (M6.7 spec, M6PR.2), shared by the read-based kits."""

from code_problems.rng import Rng

DNA = "ACGT"
_PPM = 1_000_000


def count(genome: int, read: int, coverage: int) -> int:
    """How many reads give `coverage` over a genome: at least one."""
    return max(1, -(-coverage * genome // read))


def draw(rng: Rng, genome: int, read: int, coverage: int, errors: float) -> list[str]:
    """A genome of `genome` letters, then reads of `read` letters at random places until the
    coverage is reached, each letter wrong with probability `errors`."""
    letters = rng.letters(genome)
    wrong = round(errors * _PPM)
    reads: list[str] = []
    for _ in range(count(genome, read, coverage)):
        at = rng.below(genome - read + 1)
        bases = list(letters[at : at + read])
        for i, base in enumerate(bases):
            if wrong and rng.below(_PPM) < wrong:
                bases[i] = rng.choice([b for b in DNA if b != base])
        reads.append("".join(bases))
    return reads


def kmers_of(read: str, k: int) -> list[str]:
    return [read[at : at + k] for at in range(len(read) - k + 1)]


def parse(text: str) -> tuple[int, list[str]]:
    """A read-based dataset: k on the first line, then one read per line."""
    first, *rest = text.splitlines()
    return int(first), [line for line in rest if line]


def written(k: int, reads: list[str]) -> str:
    return "\n".join([str(k), *reads]) + "\n"
