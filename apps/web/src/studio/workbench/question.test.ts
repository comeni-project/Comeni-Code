import { describe, expect, it } from "vitest";
import { newQuestion, questionIn } from "./question";

describe("question", () => {
  it("names a new question by the first free number", () => {
    expect(newQuestion("k-mers", [{ id: "k-mers-q1" }, { id: "k-mers-q3" }]).id).toBe("k-mers-q2");
  });

  it("starts a choice with two empty options, the first right", () => {
    expect(newQuestion("k-mers", []).options).toEqual([
      { text: "", right: true, misconception: "" },
      { text: "", right: false, misconception: "" },
    ]);
  });

  it("turns a draft's question into what an edit sends", () => {
    expect(
      questionIn({
        id: "q",
        kind: "number",
        ask: "How many?",
        options: null,
        answer: 96,
        unit: "k-mers",
        tolerance: null,
        accept: [],
        exact: false,
        steps: null,
        hints: ["n − k + 1"],
        rationale: "Each start.",
      }),
    ).toEqual({
      id: "q",
      kind: "number",
      ask: "How many?",
      answer: 96,
      unit: "k-mers",
      tolerance: null,
      accept: [],
      exact: false,
      steps: null,
      hints: ["n − k + 1"],
      rationale: "Each start.",
      options: null,
    });
  });
});
