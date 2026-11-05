// The k-mer graphs' layout (M6DC.4): the boards' rule, which dagre's own rows do not keep.
import { describe, expect, it } from "vitest";
import { derive, STARTERS } from "../kits";
import { layoutKmers } from "./graphLayout";

const rows = (laid: ReturnType<typeof layoutKmers>) =>
  Object.fromEntries(laid.boxes.map((box) => [box.id, box.y]));

describe("a k-mer graph's layout", () => {
  it("keeps the k-mers reads agree on in one row, the bubble below and the tip above", () => {
    const got = derive("graph-artifacts", STARTERS["graph-artifacts"]) as {
      kmers: string[];
      edges: [string, string][];
    };
    const y = rows(layoutKmers(got.kmers, got.edges, ["ACG", "CGT", "GTT", "TTA", "TAG", "AGC"]));
    const line = y.ACG as number;
    expect([y.CGT, y.GTT, y.TTA, y.TAG, y.AGC]).toEqual([line, line, line, line, line]);
    expect([y.TCA, y.CAG]).toEqual([y.GTC, y.GTC]);
    expect(y.GTC).toBeGreaterThan(line);
    expect(y.AGG).toBeLessThan(line);
  });

  it("puts each k-mer in its column, left to right along its edges", () => {
    const laid = layoutKmers(
      ["ACG", "CGT", "GTT", "GTC"],
      [
        ["ACG", "CGT"],
        ["CGT", "GTT"],
        ["CGT", "GTC"],
      ],
      ["ACG", "CGT", "GTT"],
    );
    const x = Object.fromEntries(laid.boxes.map((box) => [box.id, box.x]));
    expect(x.ACG).toBeLessThan(x.CGT as number);
    expect(x.CGT).toBeLessThan(x.GTT as number);
    expect(x.GTC).toBe(x.GTT);
    expect(laid.boxes.every((box) => box.x >= 0 && box.x + box.w <= laid.width)).toBe(true);
    expect(laid.boxes.every((box) => box.y >= 0 && box.y + box.h <= laid.height)).toBe(true);
  });

  it("lays out a cycle, its edge back looping inside the drawing (Review Focus 1)", () => {
    const laid = layoutKmers(
      ["ACG", "CGA", "GAC"],
      [
        ["ACG", "CGA"],
        ["CGA", "GAC"],
        ["GAC", "ACG"],
      ],
      ["ACG", "CGA", "GAC"],
    );
    expect(laid.paths).toHaveLength(3);
    const top = Math.min(...laid.boxes.map((box) => box.y));
    expect(top).toBeGreaterThanOrEqual(26);
  });
});
