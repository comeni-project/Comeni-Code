import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

describe("wordDiff", () => {
  it("keeps what stayed, and marks what went and what came", () => {
    expect(wordDiff("more reads here", "more fragments here")).toEqual([
      { text: "more ", kind: "same" },
      { text: "reads ", kind: "gone" },
      { text: "fragments ", kind: "new" },
      { text: "here", kind: "same" },
    ]);
  });

  it("is one same piece when nothing changed", () => {
    expect(wordDiff("a b", "a b")).toEqual([{ text: "a b", kind: "same" }]);
  });

  it("is all new from nothing", () => {
    expect(wordDiff("", "new text")).toEqual([{ text: "new text", kind: "new" }]);
  });
});
