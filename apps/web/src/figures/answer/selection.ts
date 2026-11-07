// A learner's selection in a figure that asks a question (M6.6b spec, M6FA.4): the k-mers picked,
// in order. A trace starts anywhere and then follows an arrow from its last pick, each k-mer once,
// so a path can be wrong but never broken; a pick is one k-mer, replaced by the next.
import { spells } from "../domain/kmers";

export type TaskName = "trace" | "pick";
type Edges = readonly (readonly [string, string])[];

const last = (selection: readonly string[]) => selection[selection.length - 1];

/** Whether `kmer` may come next in a trace. */
export function follows(edges: Edges, selection: readonly string[], kmer: string): boolean {
  if (selection.length === 0) return true;
  if (selection.includes(kmer)) return false;
  return edges.some(([a, b]) => a === last(selection) && b === kmer);
}

/** The k-mers a trace may go to next, in the edges' order; none before it starts. */
export function nextOf(edges: Edges, selection: readonly string[]): string[] {
  if (selection.length === 0) return [];
  return edges
    .filter(([a, b]) => a === last(selection) && !selection.includes(b))
    .map(([, b]) => b);
}

/** The selection after picking `kmer`, or null when a trace does not take it. */
export function pick(
  task: TaskName,
  edges: Edges,
  selection: readonly string[],
  kmer: string,
): string[] | null {
  if (task === "pick") return [kmer];
  return follows(edges, selection, kmer) ? [...selection, kmer] : null;
}

const listed = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** Why a trace did not take `kmer`, naming where it can go instead. */
export function refused(edges: Edges, selection: readonly string[], kmer: string): string {
  const from = last(selection) ?? "";
  const next = nextOf(edges, selection);
  const where =
    next.length === 0
      ? `no arrow leads on from ${from}`
      : next.length === 1
        ? `the only arrow from ${from} leads to ${next[0]}`
        : `the arrows from ${from} lead to ${listed(next)}`;
  return `${kmer} doesn’t follow ${from}: ${where}.`;
}

/** The live line: what the selection is, in words (W10: never colour alone). */
export function said(task: TaskName, selection: readonly string[]): string {
  if (task === "pick") {
    return selection.length === 0
      ? "Click one k-mer. Tab and Enter work too."
      : `Your pick ${selection[0]}`;
  }
  if (selection.length === 0) return "Click the k-mer the path starts at. Tab and Enter work too.";
  return `Your path ${selection.join(" → ")} spells ${spells([...selection])}`;
}
