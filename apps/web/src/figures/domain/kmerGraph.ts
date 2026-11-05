// `kmer-graph`: the twin of code_figures/kmer_graph.py (M6.6a spec, M6DC.1).
import type { Finding } from "../validate";
import { type Data, graph, isWalk, kmersOf, readsFindings, sequences, spells } from "./kmers";

const NOT_A_WALK = "CS1014";

function pathOf(data: Data): string[] {
  const [first, last] = data.path as [number, number];
  const k = data.k as number;
  const reads = sequences(data).slice(first - 1, last);
  return [...new Set(reads.flatMap((read) => kmersOf(read, k)))];
}

export function check(data: Data): Finding[] {
  const found = readsFindings(data);
  if (found.length > 0 || data.highlight !== "path") return found;
  if (!Object.hasOwn(data, "path")) {
    return [{ code: "CS1003", path: "data.path", message: "is required with highlight: path" }];
  }
  const [first, last] = data.path as [number, number];
  const count = sequences(data).length;
  if (!(1 <= first && first <= last && last <= count)) {
    return [
      { code: NOT_A_WALK, path: "data.path", message: `names reads past the ${count} there are` },
    ];
  }
  if (isWalk(pathOf(data)) !== null) {
    return [
      {
        code: NOT_A_WALK,
        path: "data.path",
        message: `reads ${first}–${last} do not make one path`,
      },
    ];
  }
  return [];
}

export function derive(data: Data): Record<string, unknown> {
  const k = data.k as number;
  const [kmers, edges] = graph(sequences(data), k);
  const outs: Record<string, number> = {};
  const ins: Record<string, number> = {};
  for (const [a, b] of edges) {
    outs[a] = (outs[a] ?? 0) + 1;
    ins[b] = (ins[b] ?? 0) + 1;
  }
  const seen = new Set<string>();
  const notes: Record<string, string> = {};
  for (const read of data.reads as { sequence: string; note?: string }[]) {
    const own = kmersOf(String(read.sequence), k);
    const fresh = own.find((kmer) => !seen.has(kmer));
    for (const kmer of own) seen.add(kmer);
    if (read.note !== undefined && fresh !== undefined) notes[fresh] = String(read.note);
  }
  const computed: Record<string, unknown> = {
    kmers,
    edges: edges.map(([a, b]) => [a, b]),
    branches: kmers.filter((m) => (outs[m] ?? 0) > 1 || (ins[m] ?? 0) > 1),
    notes,
  };
  if (data.highlight === "path" && Object.hasOwn(data, "path")) {
    const path = pathOf(data);
    computed.path = path;
    computed.spells = spells(path);
  }
  return computed;
}
