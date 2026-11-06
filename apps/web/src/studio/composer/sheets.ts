// A figure's arrays of records as sheets (M6.5 spec, M6CO.4): a row per item, a column per key,
// each column's cell decided by its key's schema. Which arrays are sheets is said once per kit;
// everything else is the form (SchemaForm.tsx).
import { type Op, type Path, pathText, type Value } from "../../figures/document";
import { type Component, SCHEMAS } from "../../figures/schemas";
import { isFasta, parseFasta } from "./fasta";
import { parsePaste } from "./paste";

export type Cell = "text" | "number" | "select";

export interface Column {
  key: string | number;
  label: string;
  cell: Cell;
  options?: string[];
  required: boolean;
  /** Letters marked `format: dna`: FASTA pasted into it fills a row per record (M6DC.5). */
  dna?: boolean;
}

export interface SheetSpec {
  title: string;
  path: Path;
  columns: Column[];
  rows: unknown[];
  /** A new row: its required keys, each at its simplest value. */
  blank: unknown;
}

// biome-ignore lint/suspicious/noExplicitAny: a schema is JSON, walked by key
type Schema = { readonly [key: string]: any };
type Item = Record<string, unknown>;

const SHEETS: { [C in Component]: { title: string; path: Path }[] } = {
  table: [
    { title: "Columns", path: ["data", "columns"] },
    { title: "Rows", path: ["data", "rows"] },
  ],
  chart: [{ title: "Values", path: ["data", "data", "values"] }],
  flow: [
    { title: "Nodes", path: ["data", "nodes"] },
    { title: "Edges", path: ["data", "edges"] },
    { title: "Groups", path: ["data", "groups"] },
  ],
  "sequence-track": [{ title: "Features", path: ["data", "features"] }],
  "read-tiling": [{ title: "Reads", path: ["data", "reads"] }],
  "kmer-window": [],
  "kmer-graph": [{ title: "Reads", path: ["data", "reads"] }],
  "compare-graphs": [{ title: "Reads", path: ["data", "reads"] }],
  "graph-artifacts": [{ title: "Reads", path: ["data", "reads"] }],
};

/** Where each kit's sheets are, as paths: the form leaves these out. */
export const sheetPaths = (component: Component) =>
  SHEETS[component].map((sheet) => pathText(sheet.path));

/** A short list of a fixed length, every item a number (a path's first and last read, a range):
 * the form shows it as that many inputs side by side, never as a sheet (M6DC.5). */
export function isPair(schema: Schema): boolean {
  const items = schema.items as Schema | undefined;
  return (
    schema.type === "array" &&
    typeof schema.minItems === "number" &&
    schema.minItems === schema.maxItems &&
    schema.minItems <= 4 &&
    (items?.type === "integer" || items?.type === "number")
  );
}

export function resolve(schema: Schema, root: Schema): Schema {
  const ref = schema.$ref;
  return typeof ref === "string" ? (root.$defs?.[ref.replace("#/$defs/", "")] ?? {}) : schema;
}

/** The schema of the array at `path` (which starts at the file's `data`). */
function arraySchema(component: Component, path: Path): Schema {
  const root = SCHEMAS[component] as Schema;
  let schema = root;
  for (const key of path.slice(1)) schema = resolve(schema.properties?.[key] ?? {}, root);
  return schema;
}

function columnOf(key: string, schema: Schema, required: boolean): Column {
  if (Array.isArray(schema.enum)) {
    return { key, label: key, cell: "select", options: schema.enum.map(String), required };
  }
  const number = schema.type === "integer" || schema.type === "number";
  const column: Column = { key, label: key, cell: number ? "number" : "text", required };
  if (schema.format === "dna") column.dna = true;
  return column;
}

function at(data: unknown, path: Path): unknown {
  return path.slice(1).reduce<unknown>((value, key) => (value as Item | undefined)?.[key], data);
}

function blankOf(columns: Column[]): Item {
  const blank: Item = {};
  for (const column of columns.filter((c) => c.required)) {
    blank[column.key] =
      column.cell === "select" ? (column.options?.[0] ?? "") : column.cell === "number" ? 1 : "";
  }
  return blank;
}

export function sheetsOf(component: Component, data: unknown): SheetSpec[] {
  return SHEETS[component].flatMap(({ title, path }): SheetSpec[] => {
    const found = at(data, path);
    const rows = Array.isArray(found) ? found : [];
    if (component === "table" && title === "Rows") {
      const columns = ((at(data, ["data", "columns"]) ?? []) as Item[]).map(
        (column, index): Column => ({
          key: index,
          label: String(column.name ?? `column ${index + 1}`),
          cell: column.type === "number" ? "number" : "text",
          required: true,
        }),
      );
      return [{ title, path, columns, rows, blank: columns.map(() => null) }];
    }
    if (component === "chart") {
      const keys = [...new Set((rows as Item[]).flatMap((row) => Object.keys(row)))];
      const columns = keys.map((key): Column => {
        const present = (rows as Item[]).map((row) => row[key]).filter((v) => v != null);
        const number = present.length > 0 && present.every((v) => typeof v === "number");
        return { key, label: key, cell: number ? "number" : "text", required: false };
      });
      return [
        { title, path, columns, rows, blank: Object.fromEntries(keys.map((k) => [k, null])) },
      ];
    }
    const items = arraySchema(component, path).items as Schema;
    const required: string[] = items.required ?? [];
    const columns = Object.entries(items.properties as Record<string, Schema>).map(([key, own]) =>
      columnOf(key, own, required.includes(key)),
    );
    return [{ title, path, columns, rows, blank: blankOf(columns) }];
  });
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/** What a cell typed as `typed` writes: undefined removes an optional key. A number cell that
 * does not hold a number writes the text, which Checks then names. */
export function cellValue(column: Column, typed: string): Value | undefined {
  if (typed === "") {
    if (typeof column.key === "number") return null; // an empty table cell
    if (!column.required) return undefined;
    return column.cell === "number" ? null : "";
  }
  if (column.cell === "number") {
    const trimmed = typed.trim();
    return NUMBER.test(trimmed) && Number.isFinite(Number(trimmed)) ? Number(trimmed) : typed;
  }
  return typed;
}

/** A paste into the cell at `row`, `column`: the changes it makes, rows added as needed, and how
 * many cells did not fit. */
export function pasteOps(
  sheet: SheetSpec,
  row: number,
  column: number,
  text: string,
): { ops: Op[]; dropped: number } {
  const into = sheet.columns[column];
  if (into?.dna === true && isFasta(text)) return fastaOps(sheet, row, into, text);
  const pasted = parsePaste(
    text,
    sheet.columns.length - column,
    sheet.columns.map((c) => c.label),
  );
  const ops: Op[] = [];
  let length = sheet.rows.length;
  pasted.rows.forEach((cells, offset) => {
    const target = row + offset;
    while (length <= target) {
      ops.push({ op: "insert", path: sheet.path, at: length, item: sheet.blank });
      length += 1;
    }
    cells.forEach((cell, index) => {
      const owner = sheet.columns[pasted.header ? (pasted.header[index] ?? -1) : column + index];
      if (owner === undefined) return;
      const path = [...sheet.path, target, owner.key];
      const value = cellValue(owner, cell);
      ops.push(value === undefined ? { op: "remove", path } : { op: "set", path, value });
    });
  });
  return { ops, dropped: pasted.dropped };
}

/** FASTA into a `format: dna` column: a row per record from the row pasted into, its letters in
 * that column and its header in the sheet's `note`, when it has one (M6DC.5). */
function fastaOps(
  sheet: SheetSpec,
  row: number,
  into: Column,
  text: string,
): { ops: Op[]; dropped: number } {
  const note = sheet.columns.find((column) => column.key === "note");
  const ops: Op[] = [];
  let length = sheet.rows.length;
  parseFasta(text).forEach((record, offset) => {
    const target = row + offset;
    if (length <= target) {
      ops.push({ op: "insert", path: sheet.path, at: length, item: sheet.blank });
      length += 1;
    }
    ops.push({ op: "set", path: [...sheet.path, target, into.key], value: record.letters });
    if (note !== undefined && record.header !== "") {
      ops.push({ op: "set", path: [...sheet.path, target, note.key], value: record.header });
    }
  });
  return { ops, dropped: 0 };
}
