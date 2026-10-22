// A figure's file as a YAML document (M6.5 spec, M6CO.3). The composer never regenerates a file:
// it parses the text with the yaml package's Document API, changes the nodes an edit touches and
// writes the document back, so comments, key order, quoting and every other line stay as written.
// What it writes reads one way on the server too: numbers in plain decimal, and a string quoted
// whenever its plain form would read as something else (TWO_READINGS, generated from
// code-figures' readings.json).
import {
  type Document,
  isAlias,
  isMap,
  isPair,
  isScalar,
  isSeq,
  type Node,
  parseDocument,
  Scalar,
  type ScalarTag,
  type Tags,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import { TWO_READINGS } from "./schemas";

export type Path = (string | number)[];
export type Value = string | number | boolean | null;

export interface FigureDocument {
  doc: Document;
  text: string;
  /** The document written back: the text itself whenever it parses and nothing was edited. */
  written: string;
  errors: { message: string; line: number }[];
  /** Every plain (unquoted) key and value, for the one-reading check. */
  plain: { path: Path; text: string; key: boolean }[];
  /** Keys written twice in one map, by path. */
  twice: Path[];
  aliased: boolean;
}

const WRITE = { flowCollectionPadding: false, lineWidth: 0 } as const;
const READINGS = TWO_READINGS.map((form) => new RegExp(form.pattern));
const NUMBER_TAGS = new Set(["tag:yaml.org,2002:int", "tag:yaml.org,2002:float"]);

/** A number the composer writes, marked so it is written in plain decimal. */
class Decimal extends Scalar<number> {
  readonly decimal = true;
}

/** Plain decimal: 0.0000001, never 1e-7, which YAML 1.1 reads as text. */
export function decimal(value: number): string {
  const text = String(value);
  if (!/e/i.test(text)) return text;
  return value.toFixed(20).replace(/\.?0+$/, "");
}

/** Every number tag writes a Decimal in plain decimal; what the file holds keeps its form. */
function decimalTags(tags: Tags): Tags {
  return tags.map((tag) => {
    if (typeof tag === "string" || !NUMBER_TAGS.has(tag.tag) || !("stringify" in tag)) return tag;
    const written = tag.stringify;
    if (written === undefined) return tag;
    const decimalTag: ScalarTag = {
      ...(tag as ScalarTag),
      stringify: (item, ctx, onComment, onChompKeep) =>
        item instanceof Decimal ? decimal(item.value) : written(item, ctx, onComment, onChompKeep),
    };
    return decimalTag;
  });
}

const PARSE = {
  version: "1.2",
  schema: "core",
  merge: false,
  uniqueKeys: false, // a key twice is found by the walk, with its path
  customTags: decimalTags,
} as const;

/** A new file from plain data, written as the composer writes every edit. */
export function writeFile(value: unknown): string {
  const doc = parseDocument("", PARSE);
  doc.contents = nodeFor(doc, value, false) as never;
  return doc.toString(WRITE);
}

export function pathText(path: Path): string {
  return path.reduce<string>(
    (text, key) =>
      typeof key === "number" ? `${text}[${key}]` : text === "" ? key : `${text}.${key}`,
    "",
  );
}

export function pathParts(text: string): Path {
  return [...text.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map((m) =>
    m[2] !== undefined ? Number(m[2]) : (m[1] as string),
  );
}

/** One walk over the document, in its order: plain keys and values, keys written twice in one
 * map (YAML 1.2 would refuse them, PyYAML keeps the last), and whether an alias is used. */
function walkOf(doc: Document, text: string): Pick<FigureDocument, "plain" | "twice" | "aliased"> {
  const plain: FigureDocument["plain"] = [];
  const twice: Path[] = [];
  let aliased = false;
  const source = (node: Scalar) =>
    node.range ? text.slice(node.range[0], node.range[1]) : String(node.value);
  const walk = (node: unknown, path: Path) => {
    if (isAlias(node)) aliased = true;
    else if (isScalar(node)) {
      if (node.type === Scalar.PLAIN) plain.push({ path, text: source(node), key: false });
    } else if (isMap(node)) {
      const seen = new Set<string>();
      for (const pair of node.items) {
        const name = isScalar(pair.key) ? String(pair.key.value) : "?";
        if (isAlias(pair.key)) aliased = true;
        if (isScalar(pair.key) && pair.key.type === Scalar.PLAIN) {
          plain.push({ path: [...path, name], text: source(pair.key), key: true });
        }
        if (seen.has(name)) twice.push([...path, name]);
        seen.add(name);
        walk(pair.value, [...path, name]);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, at) => {
        walk(item, [...path, at]);
      });
    }
  };
  walk(doc.contents, []);
  return { plain, twice, aliased };
}

export function openFile(text: string): FigureDocument {
  const doc = parseDocument(text, PARSE);
  const errors = doc.errors.map((error) => ({
    message: error.message.split("\n")[0] ?? error.message,
    line: error.linePos?.[0]?.line ?? 1,
  }));
  if (errors.length > 0)
    return { doc, text, written: text, errors, plain: [], twice: [], aliased: false };
  const walked = walkOf(doc, text);
  let written = text;
  try {
    written = doc.toString(WRITE);
  } catch {
    written = ""; // an alias with no anchor: it cannot be written back
  }
  return { doc, text, written, errors, ...walked };
}

/** Whether a string written plain would read back as itself, on both sides. */
function readsAsItself(value: string): boolean {
  if (READINGS.some((form) => form.test(value))) return false;
  const doc = parseDocument(value, PARSE);
  return doc.errors.length === 0 && doc.contents !== null && doc.toJS() === value;
}

function scalarFor(value: Value, was?: Scalar): Scalar {
  if (typeof value === "number") return new Decimal(value);
  const node = new Scalar(value);
  if (typeof value === "string") {
    // Quoted only when its plain form would read otherwise, in the old quote's style if it had one.
    if (!readsAsItself(value)) {
      node.type = was?.type === Scalar.QUOTE_SINGLE ? Scalar.QUOTE_SINGLE : Scalar.QUOTE_DOUBLE;
    }
  }
  return node;
}

/** A value made from plain data, numbers in plain decimal and strings quoted where they must be.
 * Inside a flow collection everything is flow. Otherwise, as the fixtures are written: a map is a
 * block, a list of plain values is one flow line, and a list of records is a block of flow
 * records (`- {id: reads, label: reads}`). */
function nodeFor(doc: Document, value: unknown, flow: boolean): Node {
  if (value === null || typeof value !== "object") return scalarFor(value as Value);
  if (Array.isArray(value)) {
    const node = doc.createNode([]) as YAMLSeq;
    const plain = value.every((item) => item === null || typeof item !== "object");
    node.flow = flow || plain;
    for (const item of value) node.items.push(nodeFor(doc, item, true));
    return node;
  }
  const node = doc.createNode({}) as YAMLMap;
  node.flow = flow;
  for (const [key, item] of Object.entries(value)) {
    node.add(doc.createPair(scalarFor(key), nodeFor(doc, item, flow)));
  }
  return node;
}

function itemsAt(doc: Document, path: Path) {
  const list = doc.getIn(path, true);
  if (!isSeq(list)) throw new Error(`${pathText(path)} is not a list`);
  return list;
}

/** One change to a document: a value set (made if it was not there), an item inserted in a
 * list in its neighbours' style, a key or item removed, or an item moved. */
export type Op =
  | { op: "set"; path: Path; value: Value | Record<string, unknown> }
  | { op: "insert"; path: Path; at: number; item: unknown }
  | { op: "remove"; path: Path }
  | { op: "move"; path: Path; from: number; to: number };

function run(doc: Document, change: Op): void {
  if (change.op === "set" && change.value !== null && typeof change.value === "object") {
    doc.setIn(change.path, nodeFor(doc, change.value, false));
  } else if (change.op === "set") {
    const was = doc.getIn(change.path, true);
    const node = scalarFor(change.value as Value, isScalar(was) ? was : undefined);
    if (isScalar(was)) {
      if (was.comment != null) node.comment = was.comment;
      if (was.commentBefore != null) node.commentBefore = was.commentBefore;
      if (was.spaceBefore !== undefined) node.spaceBefore = was.spaceBefore;
    }
    doc.setIn(change.path, node);
  } else if (change.op === "insert") {
    const list = itemsAt(doc, change.path);
    const neighbour = list.items[Math.max(0, Math.min(change.at, list.items.length - 1))];
    const flow = (isSeq(neighbour) || isMap(neighbour)) && neighbour.flow === true;
    list.items.splice(change.at, 0, nodeFor(doc, change.item, flow));
  } else if (change.op === "remove") {
    doc.deleteIn(change.path);
  } else {
    const list = itemsAt(doc, change.path);
    const [item] = list.items.splice(change.from, 1);
    list.items.splice(change.to, 0, item);
  }
}

/** The changes made in order on a copy of the document, written back: every line they do not
 * touch stays as it was. */
export function apply(fd: FigureDocument, changes: Op[]): string {
  const doc = fd.doc.clone();
  for (const change of changes) run(doc, change);
  return kept(fd, doc.toString(WRITE));
}

/** Whether the document writes the file back line for line, differing at most in the spaces
 * around a comment (`}  # note` is written `} # note`): then an edit can keep every line it does
 * not touch as the file has it. */
export function linesKept(fd: FigureDocument): boolean {
  const text = fd.text.split("\n");
  const written = fd.written.split("\n");
  const plain = (line: string) => line.replace(/\s+/g, " ").trimEnd();
  return (
    text.length === written.length &&
    text.every((line, n) => plain(line) === plain(written[n] ?? ""))
  );
}

/** The edited document's text, with each line it did not change taken from the file as written:
 * the changed lines are those between the common head and tail of the old and new writings. */
function kept(fd: FigureDocument, next: string): string {
  if (!linesKept(fd)) return next;
  const text = fd.text.split("\n");
  const old = fd.written.split("\n");
  const now = next.split("\n");
  let head = 0;
  while (head < old.length && head < now.length && old[head] === now[head]) head++;
  let tail = 0;
  while (
    tail < old.length - head &&
    tail < now.length - head &&
    old[old.length - 1 - tail] === now[now.length - 1 - tail]
  ) {
    tail++;
  }
  const was = old.slice(head, old.length - tail);
  const middle = now.slice(head, now.length - tail);
  const own = text.slice(head, text.length - tail);
  const lines =
    was.length === middle.length
      ? middle.map((line, n) => (line === was[n] ? (own[n] ?? line) : line))
      : middle;
  return [...text.slice(0, head), ...lines, ...text.slice(text.length - tail)].join("\n");
}

export const setAt = (fd: FigureDocument, path: Path, value: Value) =>
  apply(fd, [{ op: "set", path, value }]);
export const insertAt = (fd: FigureDocument, path: Path, at: number, item: unknown) =>
  apply(fd, [{ op: "insert", path, at, item }]);
export const removeAt = (fd: FigureDocument, path: Path) => apply(fd, [{ op: "remove", path }]);
export const moveAt = (fd: FigureDocument, path: Path, from: number, to: number) =>
  apply(fd, [{ op: "move", path, from, to }]);

/** The 1-based line a path's node starts on, or null when the file has no such node. */
export function lineOf(fd: FigureDocument, path: Path): number | null {
  const node = fd.doc.getIn(path, true);
  const start = isPair(node) || isAlias(node) ? undefined : (node as Node | undefined)?.range?.[0];
  if (start === undefined) return null;
  return fd.text.slice(0, start).split("\n").length;
}
