// `compare-graphs`: the twin of code_figures/compare_graphs.py (M6.6a spec, M6DC.1).
import type { Finding } from "../validate";
import { type Data, graph, readsFindings, sequences, TOO_MANY } from "./kmers";

const LIMIT = 16;

function halves(data: Data): [string[], [string, string][], string[]] {
  const [kmers, edges] = graph(sequences(data), data.k as number);
  const smaller = [...new Set(kmers.flatMap((kmer) => [kmer.slice(0, -1), kmer.slice(1)]))];
  return [kmers, edges, smaller];
}

export function check(data: Data): Finding[] {
  const found = readsFindings(data, LIMIT);
  if (found.length > 0) return found;
  const [kmers, , smaller] = halves(data);
  const total = kmers.length + smaller.length;
  if (total > LIMIT) {
    return [
      {
        code: TOO_MANY,
        path: "data.reads",
        message: `make ${total} nodes in all; a page draws at most ${LIMIT}`,
      },
    ];
  }
  return [];
}

export function derive(data: Data): Record<string, unknown> {
  const [kmers, edges, smaller] = halves(data);
  return {
    as_nodes: { nodes: kmers, edges: edges.map(([a, b]) => [a, b]) },
    as_edges: {
      nodes: smaller,
      edges: kmers.map((kmer) => [kmer.slice(0, -1), kmer.slice(1), kmer]),
    },
  };
}
