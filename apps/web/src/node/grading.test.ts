import { describe, expect, it } from "vitest";
import type { QuestionOut } from "../api/schema";
import { isRight, score } from "./grading";

const base = { id: "q", ask: "?", hints: [], rationale: "", unit: null, tolerance: null };
const sequence: QuestionOut = {
  ...base,
  kind: "sequence",
  options: null,
  answer: "ACGTTGA",
  accept: ["ACGTTGA*"],
  exact: false,
  steps: null,
};
const order: QuestionOut = {
  ...base,
  kind: "order",
  options: null,
  answer: null,
  accept: [],
  exact: false,
  steps: ["A", "B", "C", "D"],
};

describe("grading, the server's rule (M4Q.3)", () => {
  it("ignores case and spaces in a sequence, and takes an accepted form", () => {
    expect(isRight(sequence, "acg ttga")).toBe(true);
    expect(isRight(sequence, "acgttga*")).toBe(true);
    expect(isRight(sequence, "ACGTTG")).toBe(false);
    expect(isRight(sequence, "   ")).toBe(false);
  });

  it("trims only the ends of an exact sequence", () => {
    const exact = { ...sequence, answer: "FASTQ", accept: [], exact: true };
    expect(isRight(exact, " FASTQ ")).toBe(true);
    expect(isRight(exact, "fastq")).toBe(false);
  });

  it("scores an order by the pairs in order", () => {
    expect(score(order, ["A", "B", "C", "D"])).toBe(1);
    expect(score(order, ["A", "B", "D", "C"])).toBeCloseTo(5 / 6);
    expect(score(order, ["B", "C", "D", "A"])).toBeCloseTo(3 / 6);
    expect(score(order, ["D", "C", "B", "A"])).toBe(0);
    expect(isRight(order, ["A", "B", "D", "C"])).toBe(false);
  });
});
