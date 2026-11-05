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

describe("no two k-mers overlap (#404)", () => {
  const overlaps = (laid: ReturnType<typeof layoutKmers>) =>
    laid.boxes.flatMap((a, i) =>
      laid.boxes
        .slice(i + 1)
        .filter((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        .map((b) => `${a.id}/${b.id}`),
    );
  const graph = (component: "kmer-graph" | "graph-artifacts", data: unknown) =>
    derive(component, data) as { kmers: string[]; edges: [string, string][]; path?: string[] };
  const reads = (...sequences: string[]) => sequences.map((sequence) => ({ sequence }));

  it.each([
    ["a solid fork", "graph-artifacts", { reads: reads("ACGTT", "ACGTT", "ACGAA", "ACGAA"), k: 3 }],
    [
      "a fork off the line",
      "kmer-graph",
      { reads: reads("AAAC", "ACGT", "ACGA"), k: 3, highlight: "branches" },
    ],
    [
      "a path by overlap",
      "kmer-graph",
      { reads: reads("ACGT", "GTAA"), k: 3, highlight: "path", path: [1, 2] },
    ],
    ["the starter", "kmer-graph", STARTERS["kmer-graph"]],
    ["the artifacts' starter", "graph-artifacts", STARTERS["graph-artifacts"]],
  ] as const)("%s", (_, component, data) => {
    const got = graph(component, data);
    const line = got.path ?? got.kmers.slice(0, 1);
    expect(overlaps(layoutKmers(got.kmers, got.edges, line))).toEqual([]);
  });
});

describe("a k-mer's edge to itself (#406)", () => {
  it("is a loop above its box, its label above the loop", () => {
    const laid = layoutKmers(["AA"], [["AA", "AA", "AAA"]], ["AA"]);
    const [box] = laid.boxes;
    const [loop] = laid.paths;
    const numbers = [...(loop?.d ?? "").matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeLessThan((box?.y ?? 0) - 15);
    const xs = numbers.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(10);
    expect(loop?.labelAt?.y).toBeLessThan(Math.min(...ys));
    expect(Math.min(...laid.boxes.map((b) => b.y))).toBeGreaterThan(40);
  });
});
