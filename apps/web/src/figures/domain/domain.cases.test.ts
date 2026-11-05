// @vitest-environment node
// What the domain components compute, held to the same cases as Python's (M6.6a spec, M6DC.3):
// tests/fixtures/figures/cases.json's `derived`, compared whole, order included.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { derive, figureFindings } from "../kits";
import type { Component } from "../schemas";

const SHARED: {
  derived: { name: string; component: Component; data: unknown; derived: unknown }[];
} = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../../tests/fixtures/figures/cases.json", import.meta.url)),
    "utf8",
  ),
);

const DOMAIN = ["read-tiling", "kmer-window", "kmer-graph", "compare-graphs", "graph-artifacts"];

describe("the domain components' computed values", () => {
  it.each(SHARED.derived.map((c) => [c.name, c] as const))("%s", (_, c) => {
    expect(figureFindings(c.component, c.data)).toEqual([]);
    expect(derive(c.component, c.data)).toEqual(c.derived);
  });

  it.each(DOMAIN)("%s survives the empty and the minimal data (Review Focus 5)", (component) => {
    for (const data of [
      { reads: [], k: 2, highlight: "none", genome: "AC", read: "AC", range: [2, 2] },
      {
        reads: [{ sequence: "AC" }],
        k: 2,
        highlight: "none",
        genome: "AC",
        read: "AC",
        range: [2, 2],
      },
    ]) {
      expect(() => figureFindings(component, data)).not.toThrow();
    }
  });
});

describe("a highlighted path (#408, decided A)", () => {
  it("is refused where no read takes a step, naming the step", () => {
    const data = {
      reads: [{ sequence: "ACGT" }, { sequence: "GTAA" }],
      k: 3,
      highlight: "path",
      path: [1, 2],
      spell: "shown",
    };
    expect(figureFindings("kmer-graph", data)).toEqual([
      {
        code: "CS1014",
        path: "data.path",
        message: "reads 1–2 do not make one path: no read goes from CGT to GTA",
      },
    ]);
  });
});
