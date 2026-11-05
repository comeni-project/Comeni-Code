"""What the de Bruijn components share (M6.6a spec, M6DC.1): a read's k-mers, the graph they make,
how many reads hold each, and the walk a path takes.

An edge joins two k-mers that follow each other in some read: they overlap by k - 1, and a read
shows the step. Everything is listed in first-seen order, reads in order and each left to right,
so the server and the browser compute the same lists.
"""

import re
from collections.abc import Mapping, Sequence

from code_figures.findings import Finding

LETTER = "CS1010"  # shared with the track: a letter outside the alphabet
SHORT = "CS1013"  # k not shorter than every read
TOO_MANY = "CS1016"  # more k-mers than a page can draw
MAX_KMERS = 12
_DNA = re.compile(r"^[ACGT]+$")


def kmers_of(read: str, k: int) -> list[str]:
    return [read[at : at + k] for at in range(len(read) - k + 1)]


def graph(reads: Sequence[str], k: int) -> tuple[list[str], list[tuple[str, str]]]:
    """The distinct k-mers and the edges between them, each once, in first-seen order."""
    kmers: dict[str, None] = {}
    edges: dict[tuple[str, str], None] = {}
    for read in reads:
        own = kmers_of(read, k)
        for kmer in own:
            kmers.setdefault(kmer)
        for step in zip(own, own[1:], strict=False):
            edges.setdefault(step)
    return list(kmers), list(edges)


def support(reads: Sequence[str], k: int) -> dict[str, int]:
    """How many reads hold each k-mer, in first-seen order."""
    held: dict[str, int] = {}
    for read in reads:
        for kmer in dict.fromkeys(kmers_of(read, k)):
            held[kmer] = held.get(kmer, 0) + 1
    return held


def spells(path: Sequence[str]) -> str:
    """The sequence a walk spells: its first k-mer, then the last letter of each next one."""
    return path[0] + "".join(kmer[-1] for kmer in path[1:]) if path else ""


def missing_step(path: Sequence[str], edges: Sequence[tuple[str, str]]) -> tuple[str, str] | None:
    """The first step of a path that is not an edge, a step no read takes (#408), or None."""
    held = set(edges)
    return next((step for step in zip(path, path[1:], strict=False) if step not in held), None)


def sequences(data: Mapping[str, object]) -> list[str]:
    reads = data["reads"]
    assert isinstance(reads, list)
    return [str(read["sequence"]) for read in reads]


def letters_findings(value: str, path: str) -> list[Finding]:
    if _DNA.match(value):
        return []
    strays = "".join(sorted({ch for ch in value if ch not in "ACGT"}))
    return [Finding(LETTER, path, f"{strays} is not DNA (A, C, G, T, upper case)")]


def reads_findings(data: Mapping[str, object], *, limit: int = MAX_KMERS) -> list[Finding]:
    """What every graph kit checks of its reads and k: letters, then k, then the page's size."""
    reads = sequences(data)
    found = [
        problem
        for at, read in enumerate(reads)
        for problem in letters_findings(read, f"data.reads[{at}].sequence")
    ]
    if found:
        return found
    k = data["k"]
    assert isinstance(k, int)
    shortest = min(reads, key=len)
    if k >= len(shortest):
        return [Finding(SHORT, "data.k", f"is not shorter than the read {shortest}")]
    count = len(graph(reads, k)[0])
    if count > limit:
        return [
            Finding(TOO_MANY, "data.reads", f"make {count} k-mers; a page draws at most {limit}")
        ]
    return []
