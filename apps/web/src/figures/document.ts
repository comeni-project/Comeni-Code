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
    const quoted = was?.type === Scalar.QUOTE_DOUBLE || was?.type === Scalar.QUOTE_SINGLE;
    if (quoted && was?.type !== undefined) node.type = was.type;
    else if (!readsAsItself(value)) node.type = Scalar.QUOTE_DOUBLE;
  }
  return node;
}

function edited(fd: FigureDocument, change: (doc: Document) => void): string {
  const doc = fd.doc.clone();
  change(doc);
  return doc.toString(WRITE);
}

/** One value set at `path`, made if it was not there; every other line as it was. */
export function setAt(fd: FigureDocument, path: Path, value: Value): string {
  return edited(fd, (doc) => {
    const was = doc.getIn(path, true);
    const node = scalarFor(value, isScalar(was) ? was : undefined);
    if (isScalar(was)) {
      if (was.comment != null) node.comment = was.comment;
      if (was.commentBefore != null) node.commentBefore = was.commentBefore;
      if (was.spaceBefore !== undefined) node.spaceBefore = was.spaceBefore;
    }
    doc.setIn(path, node);
  });
}

/** A value made from plain data, numbers in plain decimal and strings quoted where they must be. */
function nodeFor(doc: Document, value: unknown, flow: boolean): Node {
  if (value === null || typeof value !== "object") return scalarFor(value as Value);
  const node = doc.createNode(Array.isArray(value) ? [] : {}) as Node;
  if (isSeq(node)) {
    for (const item of value as unknown[]) node.items.push(nodeFor(doc, item, true));
  } else if (isMap(node)) {
    for (const [key, item] of Object.entries(value)) {
      node.add(doc.createPair(scalarFor(key), nodeFor(doc, item, true)));
    }
  }
  if (isSeq(node) || isMap(node)) node.flow = flow;
  return node;
}

function itemsAt(doc: Document, path: Path) {
  const list = doc.getIn(path, true);
  if (!isSeq(list)) throw new Error(`${pathText(path)} is not a list`);
  return list;
}

/** A new item at `at` in the list at `path`, written in its neighbours' style. */
export function insertAt(fd: FigureDocument, path: Path, at: number, item: unknown): string {
  return edited(fd, (doc) => {
    const list = itemsAt(doc, path);
    const neighbour = list.items[Math.max(0, Math.min(at, list.items.length - 1))];
    const flow = (isSeq(neighbour) || isMap(neighbour)) && neighbour.flow === true;
    list.items.splice(at, 0, nodeFor(doc, item, flow));
  });
}

export function removeAt(fd: FigureDocument, path: Path): string {
  return edited(fd, (doc) => {
    doc.deleteIn(path);
  });
}

export function moveAt(fd: FigureDocument, path: Path, from: number, to: number): string {
  return edited(fd, (doc) => {
    const list = itemsAt(doc, path);
    const [item] = list.items.splice(from, 1);
    list.items.splice(to, 0, item);
  });
}

/** The 1-based line a path's node starts on, or null when the file has no such node. */
export function lineOf(fd: FigureDocument, path: Path): number | null {
  const node = fd.doc.getIn(path, true);
  const start = isPair(node) || isAlias(node) ? undefined : (node as Node | undefined)?.range?.[0];
  if (start === undefined) return null;
  return fd.text.slice(0, start).split("\n").length;
}
