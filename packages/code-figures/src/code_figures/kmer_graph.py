"""`kmer-graph`: reads joined by their k-mers (M6.6a spec, M6DC.1).

The author writes the reads, k and what to highlight; the k-mers, edges, branches, a highlighted
path and what it spells are computed. A read's note sits beside the first k-mer that read adds.
"""

from collections.abc import Mapping

from code_figures.findings import WRONG, Finding
from code_figures.kmers import graph, is_walk, kmers_of, reads_findings, sequences, spells

NOT_A_WALK = "CS1014"  # the highlighted reads do not make one path

STARTER: Mapping[str, object] = {
    "reads": [
        {"sequence": "ACGTT"},
        {"sequence": "CGTTA"},
        {"sequence": "GTTAG"},
        {"sequence": "CGTC", "note": "another read — a branch"},
    ],
    "k": 3,
    "highlight": "path",
    "path": [1, 3],
    "spell": "shown",
}


def _range(data: Mapping[str, object]) -> tuple[int, int]:
    span = data["path"]
    assert isinstance(span, list)
    return int(span[0]), int(span[1])


def _path(data: Mapping[str, object]) -> list[str]:
    first, last = _range(data)
    reads = sequences(data)[first - 1 : last]
    k = data["k"]
    assert isinstance(k, int)
    return list(dict.fromkeys(kmer for read in reads for kmer in kmers_of(read, k)))


def check(data: Mapping[str, object]) -> list[Finding]:
    found = reads_findings(data)
    if found:
        return found
    if data["highlight"] != "path":
        return []
    if "path" not in data:
        return [Finding(WRONG, "data.path", "is required with highlight: path")]
    first, last = _range(data)
    count = len(sequences(data))
    if not 1 <= first <= last <= count:
        return [Finding(NOT_A_WALK, "data.path", f"names reads past the {count} there are")]
    broken = is_walk(_path(data))
    if broken is not None:
        return [Finding(NOT_A_WALK, "data.path", f"reads {first}–{last} do not make one path")]
    return []


def derive(data: Mapping[str, object]) -> dict[str, object]:
    k = data["k"]
    assert isinstance(k, int)
    reads = data["reads"]
    assert isinstance(reads, list)
    kmers, edges = graph(sequences(data), k)
    outs: dict[str, int] = {}
    ins: dict[str, int] = {}
    for a, b in edges:
        outs[a] = outs.get(a, 0) + 1
        ins[b] = ins.get(b, 0) + 1
    seen: set[str] = set()
    notes: dict[str, str] = {}
    for read in reads:
        own = kmers_of(str(read["sequence"]), k)
        new = next((kmer for kmer in own if kmer not in seen), None)
        seen.update(own)
        if "note" in read and new is not None:
            notes[new] = str(read["note"])
    computed: dict[str, object] = {
        "kmers": kmers,
        "edges": [[a, b] for a, b in edges],
        "branches": [m for m in kmers if outs.get(m, 0) > 1 or ins.get(m, 0) > 1],
        "notes": notes,
    }
    if data["highlight"] == "path" and "path" in data:
        path = _path(data)
        computed["path"] = path
        computed["spells"] = spells(path)
    return computed
