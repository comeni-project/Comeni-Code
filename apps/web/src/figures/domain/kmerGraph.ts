// `kmer-graph`: the twin of code_figures/kmer_graph.py (M6.6a spec, M6DC.1).
import { TASK_SCHEMAS } from "../schemas";
import type { Answer, Fields, Task } from "../tasks";
import type { Finding } from "../validate";
import { type Data, graph, kmersOf, missingStep, readsFindings, sequences, spells } from "./kmers";

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
  // Every step is an edge a read holds (#408): overlap alone is not a step.
  const step = missingStep(pathOf(data), graph(sequences(data), data.k as number)[1]);
  if (step !== null) {
    return [
      {
        code: NOT_A_WALK,
        path: "data.path",
        message: `reads ${first}–${last} do not make one path: no read goes from ${step[0]} to ${step[1]}`,
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

// ── trace: the twin of kmer_graph.py's (M6.6b spec, M6FA.2) ──────────────────────────────────

const NOT_A_TRACE = "CS1030";
const SHOWS_ANSWER = "CS1031";

const traceKmers = (data: Data, fields: Fields) => kmersOf(String(fields.spells), data.k as number);

function checkTrace(data: Data, computed: Record<string, unknown>, fields: Fields): Finding[] {
  if (data.highlight === "path") {
    return [
      {
        code: SHOWS_ANSWER,
        path: "interact.task",
        message: "a trace on a highlighted path draws its answer: highlight none or branches",
      },
    ];
  }
  const k = data.k as number;
  const spelled = String(fields.spells);
  const wrong = (message: string): Finding[] => [
    { code: NOT_A_TRACE, path: "interact.spells", message },
  ];
  if (spelled.length < k + 1) {
    return wrong(`${spelled} is shorter than k + 1 = ${k + 1}: a path takes at least one step`);
  }
  const path = traceKmers(data, fields);
  const twice = path.find((kmer, at) => path.indexOf(kmer) < at);
  if (twice !== undefined)
    return wrong(`${spelled} holds ${twice} twice: a trace picks each k-mer once`);
  const kmers = computed.kmers as string[];
  const absent = path.find((kmer) => !kmers.includes(kmer));
  if (absent !== undefined) return wrong(`${spelled} needs ${absent}, which no read holds`);
  const step = missingStep(path, computed.edges as [string, string][]);
  if (step !== null)
    return wrong(`${spelled} steps from ${step[0]} to ${step[1]}, which no read does`);
  return [];
}

/** The one right walk; the wrong one drawn turns off it at its first branch. */
function answerTrace(data: Data, computed: Record<string, unknown>, fields: Fields): Answer {
  const path = traceKmers(data, fields);
  const edges = computed.edges as [string, string][];
  for (const [at, kmer] of path.entries()) {
    const off = edges.find(
      ([a, b]) => a === kmer && (at + 1 === path.length || b !== path[at + 1]) && !path.includes(b),
    );
    if (off !== undefined) return { accept: [path], wrong: [...path.slice(0, at + 1), off[1]] };
  }
  return { accept: [path], wrong: path.slice(0, -1) };
}

export const TASKS: Record<string, Task> = {
  trace: {
    label: "Trace a path",
    says: "click k-mers in order, each step along an arrow",
    schema: TASK_SCHEMAS["kmer-graph.trace"],
    check: checkTrace,
    answer: answerTrace,
  },
};
