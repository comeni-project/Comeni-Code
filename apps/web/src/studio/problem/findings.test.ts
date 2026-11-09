import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { problemFindings } from "./findings";
import { DE_BRUIJN_KIT, PROBLEM_TEXT } from "./kits.fixture";

const CALLOUTS = ["Every edge appears once"];
const at = (text: string, callouts = CALLOUTS) =>
  problemFindings(parse(text) as Record<string, unknown>, DE_BRUIJN_KIT, callouts).map(
    (f) => `${f.code} ${f.path}`,
  );

describe("problemFindings (M6PB.3)", () => {
  it("finds nothing in the fixture's file", () => {
    expect(at(PROBLEM_TEXT)).toEqual([]);
  });

  it("checks params and the sample's against the kit's schema", () => {
    expect(at(PROBLEM_TEXT.replace("params: {k: 4", "params: {k: 2"))).toEqual(["CS1101 params.k"]);
    expect(at(PROBLEM_TEXT.replace("genome: 7,", "genome: 2,"))).toEqual([
      "CS1101 sample.params.genome",
    ]);
  });

  it("wants the words and one to three hints", () => {
    expect(at(PROBLEM_TEXT.replace("title: Construct a de Bruijn graph", 'title: ""'))).toEqual([
      "CS1107 title",
    ]);
    const four = PROBLEM_TEXT.replace("hints:\n", "hints:\n  - one\n  - two\n  - three\n");
    expect(at(four)).toEqual(["CS1107 hints"]);
  });

  it("wants each mapping to name a callout the body has, and a mistake the kit declares", () => {
    expect(at(PROBLEM_TEXT, ["Every edge, once"])).toEqual(["CS1110 mistakes.duplicates"]);
    expect(at(PROBLEM_TEXT.replace("  duplicates:", "  doubled:"))).toEqual([
      "CS1110 mistakes.doubled",
    ]);
  });
});
