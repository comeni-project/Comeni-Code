// @vitest-environment node
// A figure's file as a YAML document (M6.5 spec, M6CO.3): read, edited where it is touched, and
// written back with every other line as it was.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  insertAt,
  lineOf,
  moveAt,
  openFile,
  pathParts,
  pathText,
  removeAt,
  setAt,
} from "./document";
import { TWO_READINGS } from "./schemas";

const ROOT = fileURLToPath(new URL("../../../../tests/fixtures/", import.meta.url));
const FIXTURES = ["algorithms/de-bruijn-graphs", "transcriptomics/tpm"].flatMap((node) => {
  const folder = `${ROOT}salmon/${node}/figures/`;
  return readdirSync(folder).map((name) => [name, readFileSync(folder + name, "utf8")] as const);
});
const FILES: { name: string; text: string; codes: string[] }[] = JSON.parse(
  readFileSync(`${ROOT}figures/cases.json`, "utf8"),
).files;
const COUNTS = FIXTURES.find(([name]) => name === "kmer-counts.yaml")?.[1] ?? "";

const FLOW =
  "component: flow\nalt: Reads become k-mers.\ndata:\n  nodes:\n    - {id: reads, label: reads}\n" +
  "    - {id: kmers, label: k-mers}\n  edges:\n    - {from: reads, to: kmers}\n";

/** The lines of `after` that differ from `before`'s, by number. */
function changed(before: string, after: string): number[] {
  const a = before.split("\n");
  const b = after.split("\n");
  return a.flatMap((line, at) => (line === b[at] ? [] : [at + 1]));
}

describe("a figure's file as a document", () => {
  it("has five fixture figures to read", () => {
    expect(FIXTURES).toHaveLength(5);
  });

  it.each([
    ...FIXTURES,
    ...FILES.filter((f) => f.codes.length === 0).map((f) => [f.name, f.text] as const),
  ])("writes %s back byte for byte", (_, text) => {
    expect(openFile(text).written).toBe(text);
  });

  it("changes one cell's line and no other", () => {
    const text = COUNTS.replace("  rows:", "  # counted with jellyfish\n  rows:");
    const fd = openFile(text);
    const after = setAt(fd, ["data", "rows", 0, 1], 65);
    const line = text.split("\n").findIndex((l) => l.includes("rows:")) + 2;
    expect(changed(text, after)).toEqual([line]);
    expect(after).toContain("# counted with jellyfish");
  });

  it.each(["on", "012", "1e3", "true", "~", "yes", "1:30"])(
    "writes %s as a string that reads back as itself",
    (label) => {
      const after = setAt(openFile(FLOW), ["data", "nodes", 1, "label"], label);
      expect(parse(after).data.nodes[1].label).toBe(label);
      const plain = openFile(after).plain.map((p) => p.text);
      expect(plain.filter((t) => TWO_READINGS.some((f) => new RegExp(f.pattern).test(t)))).toEqual(
        [],
      );
    },
  );

  it("writes a plain word plain", () => {
    expect(setAt(openFile(FLOW), ["data", "nodes", 1, "label"], "k-mer")).toContain(
      "label: k-mer}",
    );
  });

  it.each([
    [1000, "1000"],
    [0.0000001, "0.0000001"],
    [-2.5, "-2.5"],
  ])("writes the number %s in plain decimal", (value, written) => {
    const after = setAt(openFile(COUNTS), ["data", "rows", 0, 1], value);
    expect(after).toContain(`[3, ${written}, 41, 98]`);
    expect(parse(after).data.rows[0][1]).toBe(value);
  });

  it("adds a key a map did not have", () => {
    const after = setAt(openFile(COUNTS), ["data", "columns", 0, "unit"], "bp");
    expect(parse(after).data.columns[0].unit).toBe("bp");
  });

  it("inserts, removes and moves rows in the siblings' style", () => {
    const fd = openFile(FLOW);
    const inserted = insertAt(fd, ["data", "nodes"], 2, { id: "graph", label: "graph" });
    expect(inserted).toContain("    - {id: graph, label: graph}\n");
    const moved = moveAt(openFile(inserted), ["data", "nodes"], 2, 0);
    expect(parse(moved).data.nodes.map((n: { id: string }) => n.id)).toEqual([
      "graph",
      "reads",
      "kmers",
    ]);
    const removed = removeAt(openFile(moved), ["data", "nodes", 0]);
    expect(removed).toBe(FLOW);
  });

  it("finds a node's line", () => {
    expect(lineOf(openFile(FLOW), ["data", "edges", 0, "to"])).toBe(8);
    expect(lineOf(openFile(FLOW), ["data", "nowhere"])).toBeNull();
  });

  it("lists plain keys and values with their paths", () => {
    const plain = openFile('a: on\nb: "on"\nc:\n  - 012\n').plain;
    expect(plain).toEqual([
      { path: ["a"], text: "a", key: true },
      { path: ["a"], text: "on", key: false },
      { path: ["b"], text: "b", key: true },
      { path: ["c"], text: "c", key: true },
      { path: ["c", 0], text: "012", key: false },
    ]);
  });

  it("reports what does not parse with its line", () => {
    const fd = openFile("component: [\n");
    expect(fd.errors[0]?.line).toBe(2);
    expect(openFile("a: 1\nb:\n  c: 1\n  c: 2\n").twice).toEqual([["b", "c"]]);
    expect(openFile("a: &x 1\nb: *x\n").aliased).toBe(true);
  });

  it("turns a path into text and back", () => {
    expect(pathText(["data", "data", "values", 2, "x"])).toBe("data.data.values[2].x");
    expect(pathText(["data", "rows", 3, 1])).toBe("data.rows[3][1]");
    expect(pathParts("data.rows[3][1]")).toEqual(["data", "rows", 3, 1]);
    expect(pathParts("alt")).toEqual(["alt"]);
  });
});
