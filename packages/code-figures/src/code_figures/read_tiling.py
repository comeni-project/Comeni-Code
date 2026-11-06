"""`read-tiling`: reads placed on the genome they came from (M6.6a spec, M6DC.1).

The author writes the genome and the reads; where each read sits is computed from its one exact
match, and lanes as the track's are: first fit by start.
"""

import re
from collections.abc import Mapping

from code_figures.findings import Finding
from code_figures.kmers import letters_findings, sequences

PLACE = "CS1012"  # a read in no place, or in two

STARTER: Mapping[str, object] = {
    "genome": "ATGCGTACGTTAGCCTAGGATCCAGTACGTTAGGCATCGA",
    "reads": [
        {"sequence": s}
        for s in (
            "ATGCGTACG",
            "TACGTTAGC",
            "AGCCTAGGA",
            "AGGATCCAG",
            "CCAGTACGT",
            "CGTTAGGCA",
            "AGGCATCGA",
        )
    ],
}


def _starts(genome: str, read: str) -> list[int]:
    return [m.start() + 1 for m in re.finditer(f"(?={read})", genome)]


def check(data: Mapping[str, object]) -> list[Finding]:
    genome = str(data["genome"])
    reads = sequences(data)
    found = letters_findings(genome, "data.genome") + [
        problem
        for at, read in enumerate(reads)
        for problem in letters_findings(read, f"data.reads[{at}].sequence")
    ]
    if found:
        return found
    for at, read in enumerate(reads):
        starts = _starts(genome, read)
        where = f"data.reads[{at}].sequence"
        if not starts:
            found.append(Finding(PLACE, where, "is not in the genome"))
        elif len(starts) > 1:
            places = ", ".join(map(str, starts[:-1])) + f" and {starts[-1]}"
            found.append(Finding(PLACE, where, f"is in the genome twice, at {places}"))
    return found


def derive(data: Mapping[str, object]) -> dict[str, object]:
    genome = str(data["genome"])
    reads = sequences(data)
    starts = [_starts(genome, read)[0] for read in reads]
    order = sorted(range(len(reads)), key=lambda at: (starts[at], at))
    ends: list[int] = []
    lanes = [0] * len(reads)
    for at in order:
        start, end = starts[at], starts[at] + len(reads[at]) - 1
        lane = next((n for n, last in enumerate(ends) if last < start), len(ends))
        if lane == len(ends):
            ends.append(end)
        else:
            ends[lane] = end
        lanes[at] = lane
    return {"starts": starts, "lanes": lanes}
