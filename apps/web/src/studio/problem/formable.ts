// Whether the problem form can hold a problem.yaml (M6.8b spec, M6PB.2): first what every content
// file must be (yaml/formable), then the problem's shape. Anything else opens in Edit as YAML with
// the line that says why. Within this shape, a wrong count or a mapping the kit does not declare is
// a finding under its field (findings.ts), not a reason to leave the form.
import type { ProblemKitOut } from "../../api/schema";
import type { YamlDocument } from "../../yaml/document";
import { AS_YAML, readsOneWay } from "../../yaml/formable";

export const PROBLEM_KEYS = [
  "title",
  "rung",
  "statement",
  "given",
  "return",
  "kit",
  "params",
  "sample",
  "hints",
  "mistakes",
  "rationale",
] as const;
const TEXTS = ["title", "statement", "given", "return", "rationale"];

const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function problemFormable(fd: YamlDocument, kits: readonly ProblemKitOut[]): string | null {
  const general = readsOneWay(fd);
  if (general !== null) return general;
  if (fd.tagged !== null) return `It holds a YAML tag (${fd.tagged}): ${AS_YAML}`;
  const file: unknown = fd.doc.toJS();
  if (!isMapping(file)) return `It is not a problem the form can hold: ${AS_YAML}`;
  const stray = Object.keys(file).find((key) => !(PROBLEM_KEYS as readonly string[]).includes(key));
  if (stray !== undefined) return `${stray} is a key the form does not show: ${AS_YAML}`;
  const text = TEXTS.find((key) => key in file && typeof file[key] !== "string");
  if (text !== undefined) return `${text} is not text: ${AS_YAML}`;
  if ("rung" in file && typeof file.rung !== "number") return `rung is not a number: ${AS_YAML}`;
  if (!kits.some((kit) => kit.name === file.kit))
    return `${String(file.kit)} is not a kit: ${AS_YAML}`;
  if (!isMapping(file.params)) return `params is not a mapping: ${AS_YAML}`;
  if (!isMapping(file.sample) || !isMapping(file.sample.params)) {
    return `sample is not a seed and its params: ${AS_YAML}`;
  }
  const hints = file.hints ?? [];
  if (!Array.isArray(hints) || !hints.every((hint) => typeof hint === "string")) {
    return `hints are not a list of lines: ${AS_YAML}`;
  }
  const mistakes = file.mistakes ?? {};
  if (
    !isMapping(mistakes) ||
    !Object.values(mistakes).every((title) => typeof title === "string")
  ) {
    return `mistakes do not map a mistake to a callout's title: ${AS_YAML}`;
  }
  return null;
}
