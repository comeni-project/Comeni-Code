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

describe("a figure question (M6.6b spec, M6FA.3)", () => {
  const PATH = ["ACG", "CGT", "GTT", "TTA", "TAG"];
  const traced: QuestionOut = {
    ...base,
    kind: "figure",
    options: null,
    answer: null,
    accept: [],
    exact: false,
    steps: null,
    figure: "trace-path",
  };
  const record = (accept: string[][]) =>
    ({
      stem: "trace-path",
      component: "kmer-graph",
      alt: "",
      data: {},
      derived: { answer: { accept, wrong: [] } },
      source: null,
    }) as const;

  it("is right when the k-mers picked, in order, are one of its figure's selections", () => {
    expect(isRight(traced, PATH, record([PATH]))).toBe(true);
    expect(isRight(traced, ["ACG", "CGT", "GTC"], record([PATH]))).toBe(false);
    expect(isRight(traced, ["TCA"], record([["GTC"], ["TCA"], ["CAG"]]))).toBe(true);
  });

  it("is wrong with no figure, no answer computed, or a string", () => {
    expect(isRight(traced, PATH)).toBe(false);
    expect(isRight(traced, PATH, record([]))).toBe(false);
    expect(isRight(traced, "ACG", record([PATH]))).toBe(false);
  });

  it("grades a figure option by its stem", () => {
    const options: QuestionOut = {
      ...base,
      kind: "choice",
      options: [
        { text: "", right: true, figure: "plain-a" },
        { text: "", right: false, figure: "plain-b" },
      ],
      answer: null,
      accept: [],
      exact: false,
      steps: null,
    };
    expect(isRight(options, "plain-a")).toBe(true);
    expect(isRight(options, "plain-b")).toBe(false);
  });
});
