"""`kmer-graph`: reads joined by their k-mers (M6.6a spec, M6DC.1).

The author writes the reads, k and what to highlight; the k-mers, edges, branches, a highlighted
path and what it spells are computed. A read's note sits beside the first k-mer that read adds.
"""

from collections.abc import Mapping

from code_figures.findings import WRONG, Finding
from code_figures.kmers import graph, kmers_of, missing_step, reads_findings, sequences, spells
from code_figures.tasks import Answer, Task, task

NOT_A_WALK = "CS1014"  # the highlighted reads do not make one path
NOT_A_TRACE = "CS1030"  # what a trace spells is not one walk of this graph
SHOWS_ANSWER = "CS1031"  # a trace on a figure that highlights its path

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
    k = data["k"]
    assert isinstance(k, int)
    # Every step is an edge a read holds (#408): overlap alone is not a step.
    step = missing_step(_path(data), graph(sequences(data), k)[1])
    if step is not None:
        said = (
            f"reads {first}–{last} do not make one path: no read goes from {step[0]} to {step[1]}"
        )
        return [Finding(NOT_A_WALK, "data.path", said)]
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


def _trace_kmers(data: Mapping[str, object], fields: Mapping[str, object]) -> list[str]:
    k = data["k"]
    assert isinstance(k, int)
    return kmers_of(str(fields["spells"]), k)


def _check_trace(
    data: Mapping[str, object], computed: Mapping[str, object], fields: Mapping[str, object]
) -> list[Finding]:
    """A trace spells one walk of the graph, each k-mer once (M6FA.2): else CS1030 says where."""
    if data["highlight"] == "path":
        return [
            Finding(
                SHOWS_ANSWER,
                "interact.task",
                "a trace on a highlighted path draws its answer: highlight none or branches",
            )
        ]
    k = data["k"]
    assert isinstance(k, int)
    spelled = str(fields["spells"])
    if len(spelled) < k + 1:
        return [
            Finding(
                NOT_A_TRACE,
                "interact.spells",
                f"{spelled} is shorter than k + 1 = {k + 1}: a path takes at least one step",
            )
        ]
    path = _trace_kmers(data, fields)
    twice = next((kmer for at, kmer in enumerate(path) if kmer in path[:at]), None)
    if twice is not None:
        return [
            Finding(
                NOT_A_TRACE,
                "interact.spells",
                f"{spelled} holds {twice} twice: a trace picks each k-mer once",
            )
        ]
    kmers = computed["kmers"]
    assert isinstance(kmers, list)
    absent = next((kmer for kmer in path if kmer not in kmers), None)
    if absent is not None:
        return [
            Finding(
                NOT_A_TRACE, "interact.spells", f"{spelled} needs {absent}, which no read holds"
            )
        ]
    edges = computed["edges"]
    assert isinstance(edges, list)
    step = missing_step(path, [(a, b) for a, b in edges])
    if step is not None:
        return [
            Finding(
                NOT_A_TRACE,
                "interact.spells",
                f"{spelled} steps from {step[0]} to {step[1]}, which no read does",
            )
        ]
    return []


def _answer_trace(
    data: Mapping[str, object], computed: Mapping[str, object], fields: Mapping[str, object]
) -> Answer:
    """The one right walk; the wrong one drawn turns off it at its first branch (M6FA.2)."""
    path = _trace_kmers(data, fields)
    edges = computed["edges"]
    assert isinstance(edges, list)
    for at, kmer in enumerate(path):
        off = next(
            (
                b
                for a, b in edges
                if a == kmer and (at + 1 == len(path) or b != path[at + 1]) and b not in path
            ),
            None,
        )
        if off is not None:
            return [path], [*path[: at + 1], off]
    return [path], path[:-1]


TASKS: Mapping[str, Task] = {"trace": task("kmer-graph", "trace", _check_trace, _answer_trace)}
