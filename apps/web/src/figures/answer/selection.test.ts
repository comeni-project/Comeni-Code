// A learner's selection in a figure (M6.6b spec, M6FA.4): picks along the arrows only.
import { describe, expect, it } from "vitest";
import { follows, nextOf, pick, refused, said } from "./selection";

const EDGES: [string, string][] = [
  ["ACG", "CGT"],
  ["CGT", "GTT"],
  ["GTT", "TTA"],
  ["TTA", "TAG"],
  ["CGT", "GTC"],
];

describe("a trace", () => {
  it("starts anywhere, then follows an arrow from the last pick", () => {
    expect(pick("trace", EDGES, [], "GTT")).toEqual(["GTT"]);
    expect(pick("trace", EDGES, ["ACG", "CGT"], "GTC")).toEqual(["ACG", "CGT", "GTC"]);
    expect(pick("trace", EDGES, ["ACG", "CGT", "GTT"], "TAG")).toBeNull();
    expect(follows(EDGES, ["ACG"], "CGT")).toBe(true);
    expect(follows(EDGES, ["ACG"], "ACG")).toBe(false);
  });

  it("names where it can go next, and why a pick was not taken", () => {
    expect(nextOf(EDGES, [])).toEqual([]);
    expect(nextOf(EDGES, ["ACG", "CGT", "GTT"])).toEqual(["TTA"]);
    expect(nextOf(EDGES, ["ACG", "CGT"])).toEqual(["GTT", "GTC"]);
    expect(refused(EDGES, ["ACG", "CGT", "GTT"], "TAG")).toBe(
      "TAG doesn’t follow GTT: the only arrow from GTT leads to TTA.",
    );
    expect(refused(EDGES, ["ACG", "CGT"], "TTA")).toBe(
      "TTA doesn’t follow CGT: the arrows from CGT lead to GTT and GTC.",
    );
    expect(refused(EDGES, ["ACG", "CGT", "GTT", "TTA", "TAG"], "ACG")).toBe(
      "ACG doesn’t follow TAG: no arrow leads on from TAG.",
    );
  });

  it("reads itself back", () => {
    expect(said("trace", [])).toBe("Click the k-mer the path starts at. Tab and Enter work too.");
    expect(said("trace", ["ACG", "CGT", "GTT"])).toBe("Your path ACG → CGT → GTT spells ACGTT");
  });
});

describe("a pick", () => {
  it("is one k-mer, replaced by the next", () => {
    expect(pick("pick", EDGES, [], "TCA")).toEqual(["TCA"]);
    expect(pick("pick", EDGES, ["TCA"], "ACG")).toEqual(["ACG"]);
    expect(said("pick", [])).toBe("Click one k-mer. Tab and Enter work too.");
    expect(said("pick", ["TCA"])).toBe("Your pick TCA");
  });
});
