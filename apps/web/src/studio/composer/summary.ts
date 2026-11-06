// What a domain component computed, in words (M6.6a spec, M6DC.5): the Computed block under the
// settings and the Checks line *Computed from the reads*. Shown, never written; a general kit has
// none. Worked out from the same `derive` the page draws from.
import { derive, figureFindings } from "../../figures/kits";
import type { Component } from "../../figures/schemas";

export interface Said {
  label: string;
  value: string;
}

type Data = Record<string, unknown>;
type Got = Record<string, unknown>;

const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const many = (n: number, noun: string) => `${NUMBERS[n] ?? n} ${noun}${n === 1 ? "" : "es"}`;

function branches(at: string[]): string {
  if (at.length === 0) return "no branch";
  return `${many(at.length, "branch")} at ${at.join(", ")}`;
}

const SAYS: Partial<Record<Component, (data: Data, got: Got) => Said[]>> = {
  "kmer-graph": (data, got) => {
    const kmers = got.kmers as string[];
    const said: Said[] = [
      { label: "k-mers", value: kmers.join(" ") },
      {
        label: "edges",
        value: `${(got.edges as unknown[]).length} · ${branches(got.branches as string[])}`,
      },
    ];
    if (typeof got.spells === "string") {
      const [first, last] = data.path as [number, number];
      said.push({ label: `path of ${first}–${last}`, value: `spells ${got.spells}` });
    }
    return said;
  },
  "read-tiling": (_, got) => {
    const starts = got.starts as number[];
    const lanes = Math.max(0, ...(got.lanes as number[])) + 1;
    return [
      { label: "starts", value: starts.join(" ") },
      { label: "lanes", value: String(lanes) },
    ];
  },
  "kmer-window": (data, got) => {
    const byK = got.by_k as Record<string, { count: number }>;
    const read = String(data.read);
    return Object.entries(byK).map(([k, at]) => ({
      label: `k = ${k}`,
      value: `${read.length} − ${k} + 1 = ${at.count} k-mers`,
    }));
  },
  "compare-graphs": (_, got) => {
    const nodes = got.as_nodes as { nodes: string[]; edges: unknown[] };
    const edges = got.as_edges as { nodes: string[]; edges: unknown[] };
    return [
      { label: "as nodes", value: `${nodes.nodes.length} k-mers, ${nodes.edges.length} edges` },
      {
        label: "as edges",
        value: `${edges.nodes.length} (k−1)-mers, ${edges.edges.length} k-mers as edges`,
      },
    ];
  },
  "graph-artifacts": (_, got) => {
    const support = got.support as Record<string, number>;
    const artifacts = got.artifacts as { kind: string; kmers: string[] }[];
    return [
      { label: "k-mers", value: (got.kmers as string[]).join(" ") },
      {
        label: "in one read",
        value: Object.keys(support)
          .filter((kmer) => support[kmer] === 1)
          .join(" "),
      },
      {
        label: "found",
        value:
          artifacts.length === 0
            ? "no tip or bubble"
            : artifacts.map((a) => `a ${a.kind} (${a.kmers.join(" ")})`).join(" · "),
      },
    ];
  },
};

/** What was worked out from the data, a line per value: none for a general kit, and none while
 * the data's own checks fail (the alt text and caption are not the data's). */
export function summary(component: Component, data: unknown): Said[] {
  const say = SAYS[component];
  if (say === undefined || figureFindings(component, data).length > 0) return [];
  return say(data as Data, derive(component, data));
}

/** The Checks line's detail: the computed values in one sentence, or null for a general kit. */
export function headline(component: Component, data: unknown): string | null {
  const said = summary(component, data);
  if (said.length === 0) return null;
  if (component === "kmer-graph") {
    const got = derive(component, data);
    const kmers = (got.kmers as string[]).length;
    const edges = (got.edges as unknown[]).length;
    const path = said[2];
    return `${kmers} k-mers, ${edges} edges${path ? `; the ${path.label} ${path.value}` : ""}`;
  }
  return said.map((s) => `${s.label} ${s.value}`).join("; ");
}
