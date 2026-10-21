// The browser's check of a figure's data, against the schemas the API checked it with (M6.4 spec,
// M6FG.2, M6FG.4). The twin of code_figures/schema.py: the same subset of JSON Schema, the same
// codes and paths, and both run tests/fixtures/figures/cases.json. A figure that fails is never
// drawn; the page shows its alt text instead.

export interface Finding {
  code: string;
  path: string;
  message: string;
}

// biome-ignore lint/suspicious/noExplicitAny: a schema is JSON, walked by key
type Schema = { readonly [key: string]: any };

const NOT_ALLOWED = "CS1002";
const WRONG = "CS1003";
const BOUND = "CS1004";
const LARGEST = 1e15;

function jsonType(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}

const is = (value: unknown, kind: string) => {
  const found = jsonType(value);
  return found === kind || (kind === "number" && found === "integer");
};

const finite = (value: number) => Number.isFinite(value) && Math.abs(value) < LARGEST;
const same = (a: unknown, b: unknown) => jsonType(a) === jsonType(b) && a === b;

function resolve(schema: Schema, root: Schema): Schema {
  const ref = schema.$ref;
  if (typeof ref !== "string") return schema;
  const found = root.$defs?.[ref.replace("#/$defs/", "")];
  if (found === undefined) throw new Error(`no $defs entry for ${ref}`);
  return found;
}

export function validate(schema: Schema, value: unknown, path = "data"): Finding[] {
  return check(schema, value, path, schema);
}

function check(given: Schema, value: unknown, path: string, root: Schema): Finding[] {
  const schema = resolve(given, root);
  if (Array.isArray(schema.oneOf)) {
    for (const branch of schema.oneOf as Schema[]) {
      const resolved = resolve(branch, root);
      if (is(value, resolved.type)) return check(resolved, value, path, root);
    }
    return [{ code: WRONG, path, message: "is not of a type this field takes" }];
  }
  if (typeof schema.type === "string" && !is(value, schema.type)) {
    return [{ code: WRONG, path, message: `must be ${schema.type}` }];
  }
  if (typeof value === "number" && !finite(value)) {
    return [{ code: WRONG, path, message: "is not a number a page can draw" }];
  }
  if ("const" in schema && !same(value, schema.const)) {
    return [{ code: WRONG, path, message: `must be ${String(schema.const)}` }];
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((a: unknown) => same(value, a))) {
    return [{ code: WRONG, path, message: "is not one of the values this field takes" }];
  }
  if (typeof value === "string") return string(schema, value, path);
  if (typeof value === "number") return number(schema, value, path);
  if (Array.isArray(value)) return array(schema, value, path, root);
  if (value !== null && typeof value === "object") {
    return object(schema, value as Record<string, unknown>, path, root);
  }
  return [];
}

function string(schema: Schema, value: string, path: string): Finding[] {
  if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
    return [{ code: WRONG, path, message: "is not of the form this field takes" }];
  }
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    return [{ code: BOUND, path, message: `is shorter than ${schema.minLength} characters` }];
  }
  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    return [{ code: BOUND, path, message: `is longer than ${schema.maxLength} characters` }];
  }
  return [];
}

function number(schema: Schema, value: number, path: string): Finding[] {
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    return [{ code: BOUND, path, message: `is less than ${schema.minimum}` }];
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    return [{ code: BOUND, path, message: `is more than ${schema.maximum}` }];
  }
  return [];
}

function object(
  schema: Schema,
  value: Record<string, unknown>,
  path: string,
  root: Schema,
): Finding[] {
  const properties: Schema = schema.properties ?? {};
  const other = schema.additionalProperties ?? true;
  const found: Finding[] = [];
  for (const [key, item] of Object.entries(value)) {
    const where = `${path}.${key}`;
    if (Object.hasOwn(properties, key)) found.push(...check(properties[key], item, where, root));
    else if (other === false)
      found.push({ code: NOT_ALLOWED, path: where, message: "not allowed" });
    else if (typeof other === "object") found.push(...check(other, item, where, root));
  }
  for (const key of (schema.required ?? []) as string[]) {
    if (!Object.hasOwn(value, key)) {
      found.push({ code: WRONG, path: `${path}.${key}`, message: "is required" });
    }
  }
  return found;
}

function array(schema: Schema, value: unknown[], path: string, root: Schema): Finding[] {
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    return [{ code: BOUND, path, message: `holds fewer than ${schema.minItems}` }];
  }
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    return [{ code: BOUND, path, message: `holds more than ${schema.maxItems}` }];
  }
  if (schema.items === undefined) return [];
  return value.flatMap((item, at) => check(schema.items, item, `${path}[${at}]`, root));
}
