// A try question as an edit sends it (M4K.3): a new one named by the first free number, and a
// draft's own question turned back into what the API takes.
import type { OptionIn, StudioQuestionOut, TryQuestionIn } from "../../api/schema";

export const blankOptions = (): OptionIn[] => [
  { text: "", right: true, misconception: "" },
  { text: "", right: false, misconception: "" },
];

export function newQuestion(nodeId: string, questions: readonly { id: string }[]): TryQuestionIn {
  const taken = new Set(questions.map((q) => q.id));
  let n = 1;
  while (taken.has(`${nodeId}-q${n}`)) n += 1;
  return {
    id: `${nodeId}-q${n}`,
    kind: "choice",
    ask: "",
    options: blankOptions(),
    answer: null,
    unit: "",
    tolerance: null,
    hints: [],
    rationale: "",
  };
}

export function questionIn(out: StudioQuestionOut): TryQuestionIn {
  return {
    id: out.id,
    kind: out.kind as TryQuestionIn["kind"],
    ask: out.ask,
    answer: out.answer,
    unit: out.unit,
    tolerance: out.tolerance,
    accept: out.accept,
    exact: out.exact,
    steps: out.steps,
    hints: out.hints,
    rationale: out.rationale,
    options:
      out.options?.map(({ text, right, misconception }) => ({ text, right, misconception })) ??
      null,
  };
}
