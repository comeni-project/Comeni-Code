// What the de Bruijn components share: the twin of code_figures/kmers.py (M6.6a spec, M6DC.1,
// M6DC.3). Edges join k-mers that follow each other in some read; everything is in first-seen
// order, so the browser computes exactly the lists the server does.
import type { Finding } from "../validate";

export const LETTER = "CS1010";
export const SHORT = "CS1013";
export const TOO_MANY = "CS1016";
export const MAX_KMERS = 12;
const DNA = /^[ACGT]+$/;

export type Data = Record<string, unknown>;

export function kmersOf(read: string, k: number): string[] {
  const out: string[] = [];
  for (let at = 0; at + k <= read.length; at++) out.push(read.slice(at, at + k));
  return out;
}

export function graph(reads: string[], k: number): [string[], [string, string][]] {
  const kmers = new Set<string>();
  const edges = new Map<string, [string, string]>();
  for (const read of reads) {
    const own = kmersOf(read, k);
    for (const kmer of own) kmers.add(kmer);
    for (let at = 1; at < own.length; at++) {
      const step: [string, string] = [own[at - 1] as string, own[at] as string];
      const key = step.join(">");
      if (!edges.has(key)) edges.set(key, step);
    }
  }
  return [[...kmers], [...edges.values()]];
}

export function support(reads: string[], k: number): Record<string, number> {
  const held: Record<string, number> = {};
  for (const read of reads) {
    for (const kmer of new Set(kmersOf(read, k))) held[kmer] = (held[kmer] ?? 0) + 1;
  }
  return held;
}

export function spells(path: string[]): string {
  if (path.length === 0) return "";
  return (
    (path[0] as string) +
    path
      .slice(1)
      .map((kmer) => kmer.at(-1))
      .join("")
  );
}

export function isWalk(path: string[]): number | null {
  for (let at = 1; at < path.length; at++) {
    if ((path[at - 1] as string).slice(1) !== (path[at] as string).slice(0, -1)) return at;
  }
  return null;
}

export const sequences = (data: Data): string[] =>
  (data.reads as { sequence: unknown }[]).map((read) => String(read.sequence));

export function lettersFindings(value: string, path: string): Finding[] {
  if (DNA.test(value)) return [];
  const strays = [...new Set(value)].filter((ch) => !"ACGT".includes(ch)).sort();
  return [
    { code: LETTER, path, message: `${strays.join("")} is not DNA (A, C, G, T, upper case)` },
  ];
}

export function readsFindings(data: Data, limit = MAX_KMERS): Finding[] {
  const reads = sequences(data);
  const found = reads.flatMap((read, at) => lettersFindings(read, `data.reads[${at}].sequence`));
  if (found.length > 0) return found;
  const k = data.k as number;
  const shortest = reads.reduce((a, b) => (b.length < a.length ? b : a));
  if (k >= shortest.length) {
    return [{ code: SHORT, path: "data.k", message: `is not shorter than the read ${shortest}` }];
  }
  const count = graph(reads, k)[0].length;
  if (count > limit) {
    return [
      {
        code: TOO_MANY,
        path: "data.reads",
        message: `make ${count} k-mers; a page draws at most ${limit}`,
      },
    ];
  }
  return [];
}
