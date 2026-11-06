// `graph-artifacts`: the twin of code_figures/graph_artifacts.py (M6.6a spec, M6DC.1).
import type { Finding } from "../validate";
import { type Data, graph, readsFindings, sequences, support } from "./kmers";

const NO_SUPPORT = "CS1015";

export function check(data: Data): Finding[] {
  const found = readsFindings(data);
  if (found.length > 0) return found;
  const held = support(sequences(data), data.k as number);
  if (Math.max(...Object.values(held)) < 2) {
    return [
      {
        code: NO_SUPPORT,
        path: "data.reads",
        message: "share no k-mer; add reads that agree, so a path stands",
      },
    ];
  }
  return [];
}

export function derive(data: Data): Record<string, unknown> {
  const reads = sequences(data);
  const k = data.k as number;
  const [kmers, edges] = graph(reads, k);
  const held = support(reads, k);
  const weak = (kmer: string) => (held[kmer] ?? 0) < 2;
  const runOf = new Map<string, number>();
  const runs: string[][] = [];
  for (const kmer of kmers.filter(weak)) {
    if (runOf.has(kmer)) continue;
    const run = runs.length;
    runOf.set(kmer, run);
    const members = new Set([kmer]);
    const frontier = [kmer];
    while (frontier.length > 0) {
      const here = frontier.pop() as string;
      for (const [a, b] of edges) {
        const other = a === here ? b : b === here ? a : null;
        if (other !== null && weak(other) && !runOf.has(other)) {
          runOf.set(other, run);
          members.add(other);
          frontier.push(other);
        }
      }
    }
    runs.push(kmers.filter((m) => members.has(m)));
  }
  const artifacts = runs.map((members) => {
    const inside = new Set(members);
    const enters = edges.some(([a, b]) => !inside.has(a) && inside.has(b));
    const leaves = edges.some(([a, b]) => inside.has(a) && !inside.has(b));
    return { kind: enters && leaves ? "bubble" : "tip", kmers: members };
  });
  return { kmers, edges: edges.map(([a, b]) => [a, b]), support: held, artifacts };
}
