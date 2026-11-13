// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { STARTERS } from "../../figures/kits";
import { apply, openFile } from "../../yaml/document";
import { formable } from "./formable";
import { cellValue, pasteOps, sheetsOf } from "./sheets";

const summary = (component: keyof typeof STARTERS) =>
  sheetsOf(component, STARTERS[component]).map((sheet) => [
    sheet.path.join("."),
    sheet.columns.map((c) => `${c.label}:${c.cell}`),
  ]);

const FLOW =
  "component: flow\nalt: Reads become k-mers.\ndata:\n  nodes:\n    - {id: reads, label: reads}\n" +
  "    - {id: kmers, label: k-mers}\n  edges:\n    - {from: reads, to: kmers}\n";

describe("each array of records is a sheet (M6CO.4)", () => {
  it("a table: its columns, then its rows by its columns", () => {
    expect(summary("table")).toEqual([
      ["data.columns", ["name:text", "type:select", "unit:text", "decimals:number"]],
      ["data.rows", ["k:number", "k-mers:number"]],
    ]);
  });

  it("a chart: its values, a column per key its rows use", () => {
    expect(summary("chart")).toEqual([["data.data.values", ["k:number", "n:number"]]]);
  });

  it("a flow: its nodes, edges and groups", () => {
    expect(summary("flow")).toEqual([
      ["data.nodes", ["id:text", "label:text", "group:text"]],
      ["data.edges", ["from:text", "to:text", "label:text"]],
      ["data.groups", ["id:text", "label:text"]],
    ]);
  });

  it("a track: its features", () => {
    expect(summary("sequence-track")).toEqual([
      [
        "data.features",
        ["start:number", "end:number", "label:text", "kind:select", "strand:select"],
      ],
    ]);
  });

  it("offers a select's options from the schema", () => {
    const [features] = sheetsOf("sequence-track", STARTERS["sequence-track"]);
    expect(features?.columns.find((c) => c.key === "strand")?.options).toEqual(["+", "-"]);
  });

  it("starts a new row from its required keys", () => {
    const [nodes] = sheetsOf("flow", STARTERS.flow);
    expect(nodes?.blank).toEqual({ id: "", label: "" });
    const [, rows] = sheetsOf("table", STARTERS.table);
    expect(rows?.blank).toEqual([null, null]);
  });
});

describe("what a cell writes", () => {
  const [nodes] = sheetsOf("flow", STARTERS.flow);
  const [, rows] = sheetsOf("table", STARTERS.table);
  const label = nodes?.columns[1];
  const group = nodes?.columns[2];
  const count = rows?.columns[1];

  it("writes text, a number, or a number it cannot read as typed", () => {
    expect(label && cellValue(label, "k-mers")).toBe("k-mers");
    expect(count && cellValue(count, "812")).toBe(812);
    expect(count && cellValue(count, "8a")).toBe("8a");
  });

  it("removes an optional key left empty, and empties a table cell", () => {
    expect(group && cellValue(group, "")).toBeUndefined();
    expect(count && cellValue(count, "")).toBeNull();
    expect(label && cellValue(label, "")).toBe("");
  });
});

describe("a paste fills rows from the cell pasted into", () => {
  it("sets cells and adds the rows the sheet lacks", () => {
    const fd = openFile(FLOW);
    const [nodes] = sheetsOf("flow", fd.doc.toJS().data);
    if (nodes === undefined) throw new Error("no sheet");
    const { ops, dropped } = pasteOps(nodes, 1, 1, "K-MERS\ngraph\tgraphs\n");
    expect(dropped).toBe(0);
    expect(parse(apply(fd, ops)).data.nodes).toEqual([
      { id: "reads", label: "reads" },
      { id: "kmers", label: "K-MERS" },
      { id: "", label: "graph", group: "graphs" },
    ]);
  });

  it("follows a header row to its columns", () => {
    const fd = openFile(FLOW);
    const [nodes] = sheetsOf("flow", fd.doc.toJS().data);
    if (nodes === undefined) throw new Error("no sheet");
    const { ops } = pasteOps(nodes, 0, 0, "label\tid\nREADS\tr\n");
    expect(parse(apply(fd, ops)).data.nodes[0]).toEqual({ id: "r", label: "READS" });
  });
});

describe("whether the form can hold a file", () => {
  it("holds every starter", () => {
    for (const component of Object.keys(STARTERS) as (keyof typeof STARTERS)[]) {
      const text = stringify({ component, alt: "A figure.", data: STARTERS[component] });
      expect(formable(openFile(text))).toBeNull();
    }
  });

  it("holds a hand-written file whose comments are spaced its own way", () => {
    const text = FLOW.replace("label: reads}", "label: reads}  # the input");
    expect(formable(openFile(text))).toBeNull();
    // yaml writes a blank line before a comment that ends the file: such a file opens as YAML.
    expect(formable(openFile(`${text}# end\n`))).toMatch(/lay this file out anew/);
  });

  it("names why it cannot", () => {
    expect(formable(openFile("component: [\n"))).toMatch(/^It does not parse/);
    const layered =
      "component: chart\nalt: A.\ndata:\n  data: {values: [{a: 1}]}\n  layer:\n" +
      "    - {mark: bar, encoding: {x: {field: a, type: quantitative}}}\n";
    expect(formable(openFile(layered))).toBe(
      "A layered chart: the form edits one mark, so edit it as YAML.",
    );
    const sorted =
      "component: chart\nalt: A.\ndata:\n  mark: bar\n  data: {values: [{a: x}]}\n" +
      "  encoding:\n    x: {field: a, type: nominal, sort: [x, y]}\n";
    expect(formable(openFile(sorted))).toBe(
      "data.encoding.x.sort is a list the form does not show: edit it as YAML.",
    );
    expect(formable(openFile(FLOW.replace("label: reads", "label: on")))).toBe(
      "It reads two ways: quote the values Checks names.",
    );
    expect(formable(openFile(`${FLOW}notes: hi\n`))).toBe(
      "notes is a key the form does not show: edit it as YAML.",
    );
  });
});
