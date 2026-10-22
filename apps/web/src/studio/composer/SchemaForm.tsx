// Everything in a figure's data that is not a sheet, as a form generated from its schema (M6.5
// spec, M6CO.4): an enum is a select, a string an input, a number a number, a boolean a switch, an
// object a group, and a oneOf a choice between its branches by JSON type, as the validator picks
// them. Only what the schema takes is offered, so the form cannot write a key it refuses. A
// chart's field is offered from its values' columns; a track's sequence takes pasted FASTA.
import { type Op, type Path, pathText, type Value } from "../../figures/document";
import { type Component, SCHEMAS } from "../../figures/schemas";
import type { Finding } from "../../figures/validate";
import { fastaLetters } from "./fasta";
import { resolve, sheetPaths } from "./sheets";
import { TypedInput } from "./TypedInput";

// biome-ignore lint/suspicious/noExplicitAny: a schema is JSON, walked by key
type Schema = { readonly [key: string]: any };
type Record_ = Record<string, unknown>;

const CONTROL =
  "h-8 min-w-0 rounded-[8px] border border-border-2 bg-surface px-2 font-mono text-[12.5px] text-ink outline-none focus:border-sel aria-[invalid=true]:border-open aria-[invalid=true]:bg-open-soft";
const SMALL = "text-[12px] text-ink-3 hover:text-ink";

const BRANCH_NAMES: Record<string, string> = {
  string: "a name",
  object: "settings",
  boolean: "on or off",
  null: "none",
  number: "a number",
  integer: "a number",
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

const isRecord = (value: unknown): value is Record_ =>
  value !== null && typeof value === "object" && !Array.isArray(value);

interface Context {
  root: Schema;
  sheets: string[];
  columns: string[];
  bad: Set<string>;
  onOps: (ops: Op[]) => void;
}

function branches(schema: Schema, root: Schema): Schema[] {
  return (schema.oneOf as Schema[])
    .map((branch) => resolve(branch, root))
    .filter((branch) => branch.type !== "array");
}

function branchFor(schema: Schema, value: unknown, root: Schema): Schema | undefined {
  const kind = typeOf(value);
  return branches(schema, root).find(
    (b) => b.type === kind || (b.type === "number" && kind === "integer"),
  );
}

/** The simplest value a schema takes; `from` is the value it replaces, kept where it fits. */
function startOf(given: Schema, root: Schema, from?: unknown): unknown {
  const schema = resolve(given, root);
  if (Array.isArray(schema.oneOf)) return startOf(branches(schema, root)[0] ?? {}, root, from);
  if (Array.isArray(schema.enum)) {
    const kept = isRecord(from) ? from.type : from;
    return schema.enum.includes(kept) ? kept : schema.enum[0];
  }
  if (schema.type === "object") {
    const start: Record_ = {};
    for (const key of (schema.required ?? []) as string[]) {
      start[key] = startOf(schema.properties[key], root, from);
    }
    return start;
  }
  if (schema.type === "boolean") return false;
  if (schema.type === "null") return null;
  if (schema.type === "integer" || schema.type === "number") return schema.minimum ?? 0;
  return "";
}

function setOp(path: Path, value: unknown): Op {
  return { op: "set", path, value: value as Value | Record_ };
}

function Scalar({
  schema,
  value,
  path,
  name,
  context,
}: {
  schema: Schema;
  value: unknown;
  path: Path;
  name: string;
  context: Context;
}) {
  const where = pathText(path);
  const common = {
    "aria-label": name,
    "aria-invalid": context.bad.has(where),
    "data-path": where,
  };
  const set = (next: unknown) => context.onOps([setOp(path, next)]);
  if (Array.isArray(schema.enum) || (path.at(-1) === "field" && context.columns.length > 0)) {
    const options: string[] = Array.isArray(schema.enum)
      ? schema.enum.map(String)
      : [...new Set([...context.columns, ...(typeof value === "string" ? [value] : [])])];
    return (
      <select
        {...common}
        className={CONTROL}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => set(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (schema.type === "boolean") {
    return (
      <button
        {...common}
        type="button"
        role="switch"
        aria-checked={value === true}
        className={`relative h-4 w-7 rounded-full ${value === true ? "bg-sel" : "bg-border-2"}`}
        onClick={() => set(value !== true)}
      >
        <span
          className={`absolute top-0.5 size-3 rounded-full bg-surface ${value === true ? "right-0.5" : "left-0.5"}`}
        />
      </button>
    );
  }
  if (schema.type === "null") return <span className="text-[12.5px] text-ink-3">none</span>;
  const number = schema.type === "integer" || schema.type === "number";
  const text = value === undefined || value === null ? "" : String(value);
  if (path.length === 2 && path[1] === "sequence") {
    return (
      <textarea
        {...common}
        rows={3}
        spellCheck={false}
        className={`${CONTROL} h-auto py-1.5`}
        value={text}
        onChange={(e) => set(fastaLetters(e.target.value))}
      />
    );
  }
  return (
    <TypedInput
      {...common}
      className={CONTROL}
      inputMode={number ? "decimal" : "text"}
      value={text}
      onType={(typed) => {
        const read = Number(typed);
        set(number && typed.trim() !== "" && Number.isFinite(read) ? read : typed);
      }}
    />
  );
}

/** Whether a schema is a group of groups, every key a group (a chart's encoding: a channel per
 * key). */
function holdsGroups(schema: Schema, root: Schema): boolean {
  const owns = Object.values((schema.properties ?? {}) as Record<string, Schema>);
  return owns.length > 0 && owns.every((own) => resolve(own, root).type === "object");
}

/** One value's control(s), inline: a scalar, a oneOf's branch choice and its value, or a small
 * object's keys side by side (a channel's field and type), with what it can add. */
function Field({
  given,
  value,
  path,
  context,
}: {
  given: Schema;
  value: unknown;
  path: Path;
  context: Context;
}) {
  const schema = resolve(given, context.root);
  const name = path.slice(1).join(" ");
  if (Array.isArray(schema.oneOf)) {
    const options = branches(schema, context.root);
    const chosen = branchFor(schema, value, context.root) ?? options[0] ?? {};
    return (
      <>
        {options.length > 1 && (
          <select
            aria-label={`${name} as`}
            title="What this value is"
            className={`${CONTROL} font-sans`}
            value={String(chosen.type)}
            onChange={(e) => {
              const next = options.find((b) => String(b.type) === e.target.value) ?? {};
              context.onOps([setOp(path, startOf(next, context.root, value))]);
            }}
          >
            {options.map((b) => (
              <option key={String(b.type)} value={String(b.type)}>
                {BRANCH_NAMES[String(b.type)] ?? String(b.type)}
              </option>
            ))}
          </select>
        )}
        <Field given={chosen} value={value} path={path} context={context} />
      </>
    );
  }
  if (schema.type === "object") {
    return (
      <Inline schema={schema} value={isRecord(value) ? value : {}} path={path} context={context} />
    );
  }
  return <Scalar schema={schema} value={value} path={path} name={name} context={context} />;
}

interface Shown {
  properties: Record<string, Schema>;
  required: string[];
  keys: string[];
  present: string[];
  absent: string[];
}

function shownKeys(schema: Schema, value: Record_, path: Path, context: Context): Shown {
  const properties = (schema.properties ?? {}) as Record<string, Schema>;
  const required = (schema.required ?? []) as string[];
  const keys = Object.keys(properties).filter((key: string): boolean => {
    const own = resolve(properties[key] ?? {}, context.root);
    if (context.sheets.includes(pathText([...path, key])) || own.type === "array") return false;
    // A group that holds only sheets (a chart's `data`) shows nothing.
    if (own.type === "object") return shownKeys(own, {}, [...path, key], context).keys.length > 0;
    return true;
  });
  const present = keys.filter((key) => Object.hasOwn(value, key) || required.includes(key));
  return { properties, required, keys, present, absent: keys.filter((k) => !present.includes(k)) };
}

function AddSelect({
  name,
  absent,
  properties,
  path,
  context,
}: {
  name: string;
  absent: string[];
  properties: Record<string, Schema>;
  path: Path;
  context: Context;
}) {
  if (absent.length === 0) return null;
  return (
    <select
      aria-label={name === "" ? "Add a setting" : `Add to ${name}`}
      data-add=""
      className={`${CONTROL} w-14 font-sans text-ink-3`}
      value=""
      onChange={(e) => {
        const key = e.target.value;
        context.onOps([setOp([...path, key], startOf(properties[key] ?? {}, context.root))]);
      }}
    >
      <option value="">{name === "" ? "+ a setting" : "+"}</option>
      {absent.map((key) => (
        <option key={key} value={key}>
          {key}
        </option>
      ))}
    </select>
  );
}

/** A small object's keys side by side: each control named by its path, a switch with its key
 * beside it, and the keys it may add. */
function Inline({
  schema,
  value,
  path,
  context,
}: {
  schema: Schema;
  value: Record_;
  path: Path;
  context: Context;
}) {
  const { properties, present, absent } = shownKeys(schema, value, path, context);
  return (
    <>
      {present.map((key) => {
        const own = resolve(properties[key] ?? {}, context.root);
        const at = [...path, key];
        return [
          <Field key={key} given={own} value={value[key]} path={at} context={context} />,
          own.type === "boolean" && (
            <span key={`${key}:name`} className="text-[12.5px]">
              {key}
            </span>
          ),
        ];
      })}
      <AddSelect
        name={path.slice(1).join(" ")}
        absent={absent}
        properties={properties}
        path={path}
        context={context}
      />
    </>
  );
}

/** An object's keys as the board's rows: a label, then its controls on one line; a group of
 * groups (a chart's encoding) gives each of its groups a row of its own. */
function Group({
  schema,
  value,
  path,
  context,
}: {
  schema: Schema;
  value: Record_;
  path: Path;
  context: Context;
}) {
  const { properties, required, present, absent } = shownKeys(schema, value, path, context);
  const name = path.slice(1).join(" ");
  return (
    <div className="flex flex-col gap-[7px]">
      {present.map((key) => {
        const own = resolve(properties[key] ?? {}, context.root);
        const at = [...path, key];
        const held = isRecord(value[key]) ? (value[key] as Record_) : {};
        if (own.type === "object" && holdsGroups(own, context.root)) {
          return <Group key={key} schema={own} value={held} path={at} context={context} />;
        }
        return (
          <div key={key} className="grid grid-cols-[62px_minmax(0,1fr)] items-center gap-2">
            <span className="text-[12.5px] text-ink-2">{key}</span>
            <div className="flex flex-wrap items-center gap-1.5 [&>select:not([data-add])]:min-w-[120px]">
              <Field given={own} value={value[key]} path={at} context={context} />
              {!required.includes(key) && (
                <RemoveButton name={at.slice(1).join(" ")} path={at} context={context} />
              )}
            </div>
          </div>
        );
      })}
      {absent.length > 0 && (
        <div className="flex">
          <AddSelect
            name={name}
            absent={absent}
            properties={properties}
            path={path}
            context={context}
          />
        </div>
      )}
    </div>
  );
}

function RemoveButton({ name, path, context }: { name: string; path: Path; context: Context }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      className={SMALL}
      onClick={() => context.onOps([{ op: "remove", path }])}
    >
      ✕
    </button>
  );
}

function contextOf(
  component: Component,
  data: Record_,
  problems: Finding[],
  onOps: (ops: Op[]) => void,
): Context {
  const root = SCHEMAS[component] as Schema;
  const values = component === "chart" ? (data.data as Record_ | undefined)?.values : undefined;
  const columns = Array.isArray(values)
    ? [...new Set(values.flatMap((row) => (isRecord(row) ? Object.keys(row) : [])))]
    : [];
  return {
    root,
    sheets: sheetPaths(component),
    columns,
    bad: new Set(problems.map((p) => p.path)),
    onOps,
  };
}

/** Whether a kit has anything besides its sheets for the form to show (a table has not). */
export function hasSettings(component: Component, data: Record_): boolean {
  const context = contextOf(component, data, [], () => {});
  return shownKeys(context.root, data, ["data"], context).keys.length > 0;
}

export function SchemaForm({
  component,
  data,
  problems,
  onOps,
}: {
  component: Component;
  data: Record_;
  problems: Finding[];
  onOps: (ops: Op[]) => void;
}) {
  const context = contextOf(component, data, problems, onOps);
  return <Group schema={context.root} value={data} path={["data"]} context={context} />;
}
