// Whether the sheets and the form can hold a figure's file, and why not (M6.5 spec, M6CO.3): one
// that does not parse, reads two ways, would be laid out anew, is a layered chart, or holds a key
// or a list the form does not show opens in Edit as YAML with this line.
import { type FigureDocument, linesKept, type Path, pathText } from "../../figures/document";
import { type Component, SCHEMAS, TWO_READINGS } from "../../figures/schemas";
import { resolve, sheetPaths } from "./sheets";

// biome-ignore lint/suspicious/noExplicitAny: a schema is JSON, walked by key
type Schema = { readonly [key: string]: any };

const FORMS = TWO_READINGS.map((form) => new RegExp(form.pattern));
const KEYS = ["component", "alt", "data", "source"];
const AS_YAML = "edit it as YAML.";

const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

/** The first place in `value` the form cannot show, as a sentence. */
function unshown(
  given: Schema,
  value: unknown,
  path: Path,
  root: Schema,
  sheets: string[],
): string | null {
  let schema = resolve(given, root);
  if (Array.isArray(schema.oneOf)) {
    const kind = typeOf(value);
    schema = resolve(
      (schema.oneOf as Schema[]).find((b) => {
        const t = resolve(b, root).type;
        return t === kind || (t === "number" && kind === "integer");
      }) ?? {},
      root,
    );
  }
  const where = pathText(path);
  if (Array.isArray(value)) {
    if (!sheets.includes(where)) return `${where} is a list the form does not show: ${AS_YAML}`;
    const items = resolve(schema.items ?? {}, root);
    if (items.type !== "object" || !items.properties) return null; // a table's rows
    for (const [row, item] of value.entries()) {
      const found = unshown(items, item, [...path, row], root, sheets);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isMapping(value) || !isMapping(schema.properties)) return null;
  for (const [key, item] of Object.entries(value)) {
    const own = (schema.properties as Record<string, Schema>)[key];
    if (own === undefined) {
      if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
        continue; // a chart's values: a row's keys are its columns
      }
      return `${pathText([...path, key])} is a key the form does not show: ${AS_YAML}`;
    }
    const found = unshown(own, item, [...path, key], root, sheets);
    if (found !== null) return found;
  }
  return null;
}

export function formable(fd: FigureDocument): string | null {
  const error = fd.errors[0];
  if (error !== undefined)
    return `It does not parse as YAML: ${error.message} (line ${error.line}).`;
  if (fd.aliased) return `It uses a YAML alias: write the data out in full, as YAML.`;
  if (fd.twice.length > 0 || fd.plain.some((p) => FORMS.some((form) => form.test(p.text)))) {
    return "It reads two ways: quote the values Checks names.";
  }
  if (!linesKept(fd)) return `The form would lay this file out anew: ${AS_YAML}`;
  const file: unknown = fd.doc.toJS();
  if (!isMapping(file) || !isMapping(file.data)) {
    return `It is not a figure the form can hold: ${AS_YAML}`;
  }
  const stray = Object.keys(file).find((key) => !KEYS.includes(key));
  if (stray !== undefined) return `${stray} is a key the form does not show: ${AS_YAML}`;
  const component = String(file.component);
  if (!Object.hasOwn(SCHEMAS, component)) return `${component} is not a component: ${AS_YAML}`;
  if (component === "chart" && Object.hasOwn(file.data, "layer")) {
    return `A layered chart: the form edits one mark, so ${AS_YAML}`;
  }
  const root = SCHEMAS[component as Component] as Schema;
  return unshown(root, file.data, ["data"], root, sheetPaths(component as Component));
}
