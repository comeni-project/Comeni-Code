"""`compare-graphs`: one set of reads under both conventions (M6.6a spec, M6DC.1).

Left, k-mers as nodes and the steps between them as edges; right, the formal definition: (k-1)-mers
as nodes, each k-mer an edge from its prefix to its suffix. Both are computed from the reads.
"""

from collections.abc import Mapping

from code_figures.findings import Finding
from code_figures.kmers import TOO_MANY, graph, reads_findings, sequences

LIMIT = 16  # k-mers and (k-1)-mers together

STARTER: Mapping[str, object] = {"reads": [{"sequence": "ACGTT"}], "k": 3}


def _halves(data: Mapping[str, object]) -> tuple[list[str], list[tuple[str, str]], list[str]]:
    k = data["k"]
    assert isinstance(k, int)
    kmers, edges = graph(sequences(data), k)
    smaller = list(dict.fromkeys(part for kmer in kmers for part in (kmer[:-1], kmer[1:])))
    return kmers, edges, smaller


def check(data: Mapping[str, object]) -> list[Finding]:
    found = reads_findings(data, limit=LIMIT)
    if found:
        return found
    kmers, _, smaller = _halves(data)
    total = len(kmers) + len(smaller)
    if total > LIMIT:
        return [
            Finding(
                TOO_MANY, "data.reads", f"make {total} nodes in all; a page draws at most {LIMIT}"
            )
        ]
    return []


def derive(data: Mapping[str, object]) -> dict[str, object]:
    kmers, edges, smaller = _halves(data)
    return {
        "as_nodes": {"nodes": kmers, "edges": [[a, b] for a, b in edges]},
        "as_edges": {
            "nodes": smaller,
            "edges": [[kmer[:-1], kmer[1:], kmer] for kmer in kmers],
        },
    }
