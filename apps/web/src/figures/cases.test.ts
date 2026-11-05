// @vitest-environment node
// The shared cases: Python's tests/figures/test_cases.py runs the same file, so the browser and the
// API refuse the same data and the same files with the same codes (M6.4 spec, M6FG.2; M6.5 spec,
// M6CO.5).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODES, derive, figureFindings, STARTERS } from "./kits";
import { readFigure } from "./read";
import type { Component } from "./schemas";

interface Shared {
  cases: { name: string; component: Component; data: unknown; codes: string[] }[];
  files: { name: string; text: string; pad?: number; codes: string[] }[];
  starters: Record<string, unknown>;
}

const SHARED: Shared = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../tests/fixtures/figures/cases.json", import.meta.url)),
    "utf8",
  ),
);
const textOf = (c: Shared["files"][number]) =>
  c.text + (c.pad === undefined ? "" : `${"#".repeat(c.pad)}\n`);
const distinct = (codes: string[]) => [...new Set(codes)];

describe("the shared cases", () => {
  it.each(SHARED.cases.map((c) => [c.name, c] as const))("%s", (_, c) => {
    expect(distinct(figureFindings(c.component, c.data).map((f) => f.code))).toEqual(c.codes);
  });

  it.each(SHARED.files.map((c) => [c.name, c] as const))("the file: %s", (_, c) => {
    expect(distinct(readFigure(textOf(c)).problems.map((f) => f.code))).toEqual(c.codes);
  });

  it("names a path the way Python does", () => {
    const chart = SHARED.cases.find((c) => c.name === "a chart that links out");
    expect(figureFindings("chart", chart?.data).map((f) => f.path)).toEqual(["data.encoding.href"]);
    const flow = SHARED.cases.find((c) => c.name === "a flow edge to no node");
    expect(figureFindings("flow", flow?.data)).toEqual([
      { code: "CS1007", path: "data.edges[0].to", message: "no node is kmrs" },
    ]);
  });

  it("has a case for every code the browser writes", () => {
    const found = new Set([...SHARED.cases, ...SHARED.files].flatMap((c) => c.codes));
    expect([...CODES].filter((code) => !found.has(code))).toEqual([]);
    expect([...CODES].sort()).toEqual(
      [...Array.from({ length: 11 }, (_, n) => `CS10${String(n + 1).padStart(2, "0")}`)]
        .concat(["CS1023", "CS1024", "CS1025", "CS1026", "CS1027"])
        .sort(),
    );
  });

  it("starts each component from code-figures' own starter", () => {
    expect(STARTERS).toEqual(SHARED.starters);
  });

  it("reads a figure that passes, with its source", () => {
    const text = `${SHARED.files[0]?.text}source:\n  title: Our counts\n`;
    const { figure, problems } = readFigure(text);
    expect(problems).toEqual([]);
    expect(figure?.component).toBe("flow");
    expect(figure?.source).toEqual({ title: "Our counts", url: null });
  });

  it("derives a track's lanes as code-figures does", () => {
    const features = [
      { start: 1, end: 5, label: "a", kind: "exon" },
      { start: 3, end: 8, label: "b", kind: "exon" },
      { start: 6, end: 9, label: "c", kind: "exon" },
    ];
    expect(derive("sequence-track", { alphabet: "dna", length: 10, features })).toEqual({
      lanes: [0, 1, 0],
    });
    expect(derive("flow", STARTERS.flow)).toEqual({});
  });
});
