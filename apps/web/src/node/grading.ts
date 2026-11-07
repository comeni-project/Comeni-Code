// How right an answer is, by the rule code-schema's grading uses (M4.5 spec, M4.8c spec M4Q.3):
// a choice at its right option, a number within its tolerance, a sequence by its forms (case and
// spaces aside unless exact), an order by the share of step pairs in order. Only an order scores
// between 0 and 1. A figure question is right when the k-mers picked, in order, are one of the
// selections its figure computes (M6.6b spec, M6FA.3), so it is graded with its figure's record.
import type { FigureOut, QuestionOut } from "../api/schema";

export type Given = string | string[];

const loose = (text: string) => text.replace(/\s+/g, "").toLowerCase();

/** The selections a figure's task makes right, from what its component computed. */
export function accepted(record: FigureOut | undefined): string[][] {
  const answer = record?.derived.answer as { accept?: string[][] } | undefined;
  return answer?.accept ?? [];
}

export function score(question: QuestionOut, given: Given, figure?: FigureOut): number {
  if (question.kind === "figure") {
    if (!Array.isArray(given)) return 0;
    const picked = given.join(" ");
    return accepted(figure).some((selection) => selection.join(" ") === picked) ? 1 : 0;
  }
  if (question.kind === "order") {
    const steps = question.steps ?? [];
    if (!Array.isArray(given) || given.length !== steps.length) return 0;
    const place = new Map(given.map((step, at) => [step, at]));
    let inOrder = 0;
    let pairs = 0;
    for (const [at, first] of steps.entries()) {
      for (const later of steps.slice(at + 1)) {
        pairs += 1;
        if ((place.get(first) ?? 0) < (place.get(later) ?? 0)) inOrder += 1;
      }
    }
    return pairs === 0 ? 0 : inOrder / pairs;
  }
  if (Array.isArray(given)) return 0;
  if (question.kind === "choice") {
    // An option is given as its text, or its figure's stem when it is one (M6FA.3).
    const said = (option: { text: string; figure?: string | null }) => option.figure || option.text;
    return question.options?.some((option) => option.right && said(option) === given) ? 1 : 0;
  }
  if (question.kind === "sequence") {
    const key = question.exact ? (text: string) => text.trim() : loose;
    const forms = [String(question.answer ?? ""), ...question.accept].map(key);
    return given.trim() !== "" && forms.includes(key(given)) ? 1 : 0;
  }
  const value = Number(given.replace(",", "."));
  if (given.trim() === "" || Number.isNaN(value) || typeof question.answer !== "number") return 0;
  return Math.abs(value - question.answer) <= (question.tolerance ?? 0) + 1e-9 ? 1 : 0;
}

export const isRight = (question: QuestionOut, given: Given, figure?: FigureOut): boolean =>
  score(question, given, figure) === 1;

/** The pairs an order got right, for its feedback: "3 of 6 pairs in order." */
export function pairsInOrder(question: QuestionOut, given: string[]): [number, number] {
  const n = (question.steps ?? []).length;
  const pairs = (n * (n - 1)) / 2;
  return [Math.round(score(question, given) * pairs), pairs];
}
