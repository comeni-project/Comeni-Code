"""`sequence-track`: a sequence or its length, a ruler, and features in lanes (M6.4 spec, M6FG.3).

Positions are 1-based and inclusive, as biologists count. Lanes are derived, never written: each
feature, taken by its start, goes to the first lane whose last feature ended before it begins.
"""

from collections.abc import Mapping

from code_figures.findings import WRONG, Finding

OUT = "CS1009"  # a feature outside the sequence, or ending before it starts
LETTER = "CS1010"  # a letter outside the alphabet

_ALPHABETS = {
    "dna": frozenset("ACGTN"),
    "rna": frozenset("ACGUN"),
    "protein": frozenset("ACDEFGHIKLMNPQRSTVWYX"),
}

STARTER: Mapping[str, object] = {
    "alphabet": "dna",
    "sequence": "ATGGCGTACGTTAGCCTAGG",
    "features": [{"start": 1, "end": 12, "label": "exon 1", "kind": "exon"}],
}


def check(data: Mapping[str, object]) -> list[Finding]:
    sequence, length = data.get("sequence"), data.get("length")
    if (sequence is None) == (length is None):
        return [Finding(WRONG, "data", "gives its sequence or its length, one of the two")]
    found: list[Finding] = []
    if isinstance(sequence, str):
        letters = _ALPHABETS[str(data["alphabet"])]
        strays = sorted({ch for ch in sequence.upper() if ch not in letters})
        if strays:
            found.append(
                Finding(LETTER, "data.sequence", f"{''.join(strays)} is not {data['alphabet']}")
            )
        length = len(sequence)
    assert isinstance(length, int)
    features = data["features"]
    assert isinstance(features, list)
    for at, feature in enumerate(features):
        start, end = feature["start"], feature["end"]
        if start > end:
            found.append(
                Finding(OUT, f"data.features[{at}].start", f"starts after it ends ({end})")
            )
        elif end > length:
            found.append(
                Finding(OUT, f"data.features[{at}].end", f"ends past the sequence ({length})")
            )
    return found


def derive(data: Mapping[str, object]) -> dict[str, object]:
    features = data["features"]
    assert isinstance(features, list)
    order = sorted(range(len(features)), key=lambda at: (features[at]["start"], at))
    ends: list[int] = []  # the last end in each lane
    lanes = [0] * len(features)
    for at in order:
        start, end = features[at]["start"], features[at]["end"]
        lane = next((n for n, last in enumerate(ends) if last < start), len(ends))
        if lane == len(ends):
            ends.append(end)
        else:
            ends[lane] = end
        lanes[at] = lane
    return {"lanes": lanes}
