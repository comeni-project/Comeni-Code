import { describe, expect, it } from "vitest";
import { openFile } from "../../yaml/document";
import { problemFormable } from "./formable";
import { KITS, PROBLEM_TEXT } from "./kits.fixture";

const why = (text: string) => problemFormable(openFile(text), KITS);

describe("problemFormable (M6PB.2)", () => {
  it("holds the fixture's file", () => {
    expect(why(PROBLEM_TEXT)).toBeNull();
  });

  it.each([
    [
      "an unknown kit",
      PROBLEM_TEXT.replace("kit: de-bruijn-edges", "kit: walk"),
      /walk is not a kit/,
    ],
    ["a stray key", `${PROBLEM_TEXT}colour: red\n`, /colour is a key the form does not show/],
    ["hints as text", PROBLEM_TEXT.replace(/hints:\n {2}- .*\n/, "hints: one\n"), /hints/],
    [
      "mistakes not text",
      PROBLEM_TEXT.replace("duplicates: Every edge appears once", "duplicates: 3"),
      /mistakes/,
    ],
    ["a tag", PROBLEM_TEXT.replace("rung: 3", "rung: !!int 3"), /tag/],
    ["no parse", "title: [\n", /does not parse/],
  ])("sends %s to Edit as YAML with its reason", (_, text, reason) => {
    expect(why(text)).toMatch(reason);
  });
});
