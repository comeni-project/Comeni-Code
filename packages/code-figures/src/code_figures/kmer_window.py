"""`kmer-window`: a read cut into k-mers, k the learner's to drag (M6.6a spec, M6DC.1).

The author writes the read, the k it starts at and the slider's range; every k's windows and count
(L - k + 1) are computed, so the page only looks them up as the slider moves.
"""

from collections.abc import Mapping

from code_figures.findings import WRONG, Finding
from code_figures.kmers import SHORT, kmers_of, letters_findings

STARTER: Mapping[str, object] = {"read": "ACGTTAGCAT", "k": 4, "range": [3, 7]}


def _range(data: Mapping[str, object]) -> tuple[int, int]:
    span = data["range"]
    assert isinstance(span, list)
    return int(span[0]), int(span[1])


def check(data: Mapping[str, object]) -> list[Finding]:
    read = str(data["read"])
    found = letters_findings(read, "data.read")
    if found:
        return found
    low, high = _range(data)
    if low > high:
        return [Finding(WRONG, "data.range", "starts after it ends")]
    if high >= len(read):
        return [Finding(SHORT, "data.range", f"reaches {high}; k must stay shorter than the read")]
    k = data["k"]
    if not isinstance(k, int) or not low <= k <= high:
        return [Finding(WRONG, "data.k", f"is outside its range, {low} to {high}")]
    return []


def derive(data: Mapping[str, object]) -> dict[str, object]:
    read = str(data["read"])
    low, high = _range(data)
    by_k: dict[str, object] = {}
    for k in range(low, high + 1):
        windows = [[at + 1, kmer] for at, kmer in enumerate(kmers_of(read, k))]
        by_k[str(k)] = {"windows": windows, "count": len(windows)}
    return {"by_k": by_k}
