// A kit's params as inputs (M6.8b spec, M6PB.3): one per property of its schema, its bounds as the
// hint, a range of two numbers as two inputs. Only the flat objects of numbers kits declare; the
// composer's SchemaForm, made for figures' data, is not used.
import type { Finding, Schema } from "../../figures/validate";
import type { Path, Value } from "../../yaml/document";
import { TypedInput } from "../composer/TypedInput";

const CONTROL =
  "h-9 w-full min-w-0 rounded-[8px] border border-border-2 bg-surface px-2.5 font-mono text-[13px] text-ink outline-none focus:border-sel aria-[invalid=true]:border-open aria-[invalid=true]:bg-open-soft";

/** What a typed number writes: a number when it reads as one, else the text, for the check to name. */
export const typedNumber = (typed: string): Value =>
  /^-?\d+(\.\d+)?$/.test(typed.trim()) ? Number(typed) : typed;

const bounds = (schema: Schema): string => {
  const min = schema.minimum;
  const max = schema.maximum;
  if (min === undefined && max === undefined) return "";
  if (max === undefined) return `at least ${min}`;
  if (min === undefined) return `at most ${max}`;
  return `${Number(min).toLocaleString("en")}–${Number(max).toLocaleString("en")}`;
};

export function ParamsForm({
  schema,
  root,
  value,
  onSet,
  findings,
  disabled = false,
}: {
  schema: Schema;
  root: Path;
  value: Record<string, unknown>;
  onSet: (path: Path, value: Value) => void;
  findings: readonly Finding[];
  disabled?: boolean;
}) {
  const where = root.join(".");
  const properties = Object.entries((schema.properties ?? {}) as Record<string, Schema>);
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
      {properties.map(([name, own]) => {
        const said = findings.filter(
          (f) => f.path === `${where}.${name}` || f.path.startsWith(`${where}.${name}[`),
        );
        const pair = own.type === "array" && own.minItems === 2 && own.maxItems === 2;
        const item = (pair ? own.items : own) as Schema;
        const input = (label: string, path: Path, shown: unknown) => (
          <TypedInput
            key={label}
            aria-label={label}
            aria-invalid={said.length > 0}
            disabled={disabled}
            value={shown === undefined || shown === null ? "" : String(shown)}
            onType={(typed) => onSet(path, typedNumber(typed))}
            className={CONTROL}
          />
        );
        const current = value[name];
        return (
          <div key={name} className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[12.5px] font-medium">{name}</span>
            {pair ? (
              <div className="flex gap-1.5">
                {input(
                  `${name}, shortest`,
                  [...root, name, 0],
                  (current as unknown[] | undefined)?.[0],
                )}
                {input(
                  `${name}, longest`,
                  [...root, name, 1],
                  (current as unknown[] | undefined)?.[1],
                )}
              </div>
            ) : (
              input(name, [...root, name], current)
            )}
            <span className="text-[12px] text-ink-3">{bounds(item)}</span>
            {said.map((f) => (
              <span key={f.path + f.message} className="text-[12px] text-open">
                {f.message}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
