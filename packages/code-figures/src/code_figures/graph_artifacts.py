"""`graph-artifacts`: tips and bubbles found from the reads (M6.6a spec, M6DC.1).

A k-mer held by one read is weak, by two or more solid. Weak k-mers joined by edges form a run; a
run with an edge in from a solid k-mer and an edge out to one is a bubble (an error in a read's
middle rejoins the path), any other a tip (an error near a read's end dead-ends).
"""

from collections.abc import Mapping

from code_figures.findings import Finding
from code_figures.kmers import graph, reads_findings, sequences, support
from code_figures.tasks import Answer, Task, task

NO_SUPPORT = "CS1015"  # no k-mer is in two reads
NO_ARTIFACT = "CS1032"  # a pick of a kind of run the figure does not have

STARTER: Mapping[str, object] = {
    "reads": [
        {"sequence": "ACGTTAGC"},
        {"sequence": "ACGTTAGC"},
        {"sequence": "ACGTCAGC"},
        {"sequence": "ACGTTAGG"},
    ],
    "k": 3,
}


def check(data: Mapping[str, object]) -> list[Finding]:
    found = reads_findings(data)
    if found:
        return found
    k = data["k"]
    assert isinstance(k, int)
    if max(support(sequences(data), k).values()) < 2:
        return [
            Finding(
                NO_SUPPORT, "data.reads", "share no k-mer; add reads that agree, so a path stands"
            )
        ]
    return []


def derive(data: Mapping[str, object]) -> dict[str, object]:
    k = data["k"]
    assert isinstance(k, int)
    reads = sequences(data)
    kmers, edges = graph(reads, k)
    held = support(reads, k)
    weak = [kmer for kmer in kmers if held[kmer] < 2]
    # Runs: weak k-mers joined by an edge, either way; each run in first-seen order.
    run_of: dict[str, int] = {}
    runs: list[list[str]] = []
    for kmer in weak:
        if kmer in run_of:
            continue
        run_of[kmer] = len(runs)
        members = [kmer]
        frontier = [kmer]
        while frontier:
            here = frontier.pop()
            for a, b in edges:
                other = b if a == here else a if b == here else None
                if other is not None and held[other] < 2 and other not in run_of:
                    run_of[other] = run_of[kmer]
                    members.append(other)
                    frontier.append(other)
        runs.append([m for m in kmers if m in members])
    artifacts = []
    for members in runs:
        inside = set(members)
        enters = any(a not in inside and b in inside for a, b in edges)
        leaves = any(a in inside and b not in inside for a, b in edges)
        artifacts.append({"kind": "bubble" if enters and leaves else "tip", "kmers": members})
    return {
        "kmers": kmers,
        "edges": [[a, b] for a, b in edges],
        "support": held,
        "artifacts": artifacts,
    }


def _runs(computed: Mapping[str, object], kind: object) -> list[str]:
    artifacts = computed["artifacts"]
    assert isinstance(artifacts, list)
    return [kmer for a in artifacts if a["kind"] == kind for kmer in a["kmers"]]


def _check_pick(
    data: Mapping[str, object], computed: Mapping[str, object], fields: Mapping[str, object]
) -> list[Finding]:
    kind = fields["artifact"]
    if not _runs(computed, kind):
        return [
            Finding(
                NO_ARTIFACT,
                "interact.artifact",
                f"the reads make no {kind}: add a read that does, or pick the other kind",
            )
        ]
    return []


def _answer_pick(
    data: Mapping[str, object], computed: Mapping[str, object], fields: Mapping[str, object]
) -> Answer:
    """Any k-mer of a run of the kind is right; the wrong one drawn is the first solid k-mer."""
    held = computed["support"]
    kmers = computed["kmers"]
    assert isinstance(held, Mapping) and isinstance(kmers, list)
    solid = next(kmer for kmer in kmers if held[kmer] >= 2)  # one exists: CS1015
    return [[kmer] for kmer in _runs(computed, fields["artifact"])], [solid]


TASKS: Mapping[str, Task] = {"pick": task("graph-artifacts", "pick", _check_pick, _answer_pick)}
