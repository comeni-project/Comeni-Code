// Figures that ask a question, as the page receives them, for tests (M6.6b spec, M6FA.8): the
// de Bruijn page's trace and pick, and four small graphs drawn as options, marks hidden.
import type { FigureOut } from "../../api/schema";
import { derive } from "../kits";

type Kit = "kmer-graph" | "graph-artifacts";
const read = (sequence: string) => ({ sequence });

export function record(stem: string, component: Kit, data: object, interact?: object): FigureOut {
  const read: FigureOut = {
    stem,
    component,
    alt: `${stem}: a graph of k-mers.`,
    data: data as FigureOut["data"],
    derived: derive(component, data, interact),
    source: null,
  };
  return interact === undefined ? read : { ...read, interact: interact as FigureOut["data"] };
}

export const PATH = ["ACG", "CGT", "GTT", "TTA", "TAG"];
export const TRACE_PATH = record(
  "trace-path",
  "kmer-graph",
  { reads: ["ACGTT", "CGTTA", "GTTAG", "CGTC"].map(read), k: 3, highlight: "none" },
  { task: "trace", spells: "ACGTTAG" },
);
export const ERROR_BUBBLE = record(
  "error-bubble",
  "graph-artifacts",
  { reads: ["ACGTTAGC", "ACGTTAGC", "ACGTCAGC", "ACGTTAGG"].map(read), k: 3, marks: "hidden" },
  { task: "pick", artifact: "bubble" },
);
const option = (stem: string, reads: string[]) =>
  record(stem, "graph-artifacts", { reads: reads.map(read), k: 3, marks: "hidden" });
export const OPTIONS = [
  option("options-tip", ["ACGTTAG", "ACGTTAG", "ACGTTC"]),
  option("options-bubble", ["ACGTTAG", "ACGTTAG", "ACGATAG"]),
  option("options-clean", ["ACGTTAG", "ACGTTAG"]),
  option("options-loop", ["TACGACGT", "TACGACGT"]),
];
