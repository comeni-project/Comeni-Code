// One array of records as a grid (M6.5 spec, M6CO.4; the boards' sheets): a row per item, a cell
// per key, rows added, moved and removed, and a paste filling rows from the cell pasted into. Each
// cell carries its path, so a check can go to it.

import type { Finding } from "../../figures/validate";
import { type Op, pathText } from "../../yaml/document";
import { type Column, cellValue, pasteOps, type SheetSpec } from "./sheets";
import { TypedInput } from "./TypedInput";

const CELL =
  "h-8 w-full min-w-0 border-0 bg-transparent px-2 font-mono text-[12.5px] text-ink outline-none focus:bg-sel-soft aria-[invalid=true]:bg-open-soft aria-[invalid=true]:outline-2 aria-[invalid=true]:-outline-offset-2 aria-[invalid=true]:outline-open";
const ROW_BUTTON = "px-1 text-[12px] text-ink-3 hover:text-ink disabled:opacity-40";

function textOf(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function CellInput({
  label,
  path,
  column,
  value,
  invalid,
  onType,
  onPaste,
}: {
  label: string;
  path: string;
  column: Column;
  value: unknown;
  invalid: boolean;
  onType: (typed: string) => void;
  onPaste: (text: string) => boolean;
}) {
  const common = {
    "aria-label": label,
    "aria-invalid": invalid,
    "data-path": path,
    className: CELL,
  };
  if (column.cell === "select") {
    return (
      <select {...common} value={textOf(value)} onChange={(e) => onType(e.target.value)}>
        {!column.required && <option value="">—</option>}
        {column.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return (
    <TypedInput
      {...common}
      inputMode={column.cell === "number" ? "decimal" : "text"}
      value={textOf(value)}
      onType={onType}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text/plain");
        if (/[\t\n]/.test(text) && onPaste(text)) e.preventDefault();
      }}
    />
  );
}

export function Sheet({
  sheet,
  problems,
  onOps,
}: {
  sheet: SheetSpec;
  problems: Finding[];
  onOps: (ops: Op[], note?: string) => void;
}) {
  const bad = new Set(problems.map((p) => p.path));
  const where = pathText(sheet.path);
  const set = (row: number, column: Column, typed: string) => {
    const path = [...sheet.path, row, column.key];
    const value = cellValue(column, typed);
    onOps([value === undefined ? { op: "remove", path } : { op: "set", path, value }]);
  };
  const paste = (row: number, column: number, text: string) => {
    const { ops, dropped } = pasteOps(sheet, row, column, text);
    const note =
      dropped === 0
        ? undefined
        : dropped === 1
          ? "1 pasted cell did not fit and was left out."
          : `${dropped} pasted cells did not fit and were left out.`;
    if (note === undefined) onOps(ops);
    else onOps(ops, note);
    return true;
  };
  return (
    <div className="overflow-hidden rounded-[9px] border border-border-2 bg-surface">
      <table aria-label={sheet.title} className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[34px]" />
          {sheet.columns.map((column) => (
            <col key={column.key} />
          ))}
          <col className="w-[52px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border-2 bg-bg text-left text-[11.5px] text-ink-3">
            <th className="border-r border-border px-2 py-1 font-mono font-normal">#</th>
            {sheet.columns.map((column) => (
              <th
                key={column.key}
                className="truncate border-r border-border px-2 py-1 font-mono font-normal"
              >
                {column.label}
              </th>
            ))}
            <th>
              <span className="sr-only">Row</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((item, row) => {
            const name = `${sheet.title} row ${row + 1}`;
            const rowPath = `${where}[${row}]`;
            return (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place in the list
                key={row}
                data-path={rowPath}
                className={`border-b border-border last:border-b-0 ${bad.has(rowPath) ? "bg-open-soft" : ""}`}
              >
                <td className="border-r border-border px-2 font-mono text-[12px] text-ink-3">
                  {row + 1}
                </td>
                {sheet.columns.map((column, index) => {
                  const path = `${rowPath}${typeof column.key === "number" ? `[${column.key}]` : `.${column.key}`}`;
                  const value = (item as Record<string | number, unknown> | null)?.[column.key];
                  return (
                    <td key={column.key} className="border-r border-border p-0">
                      <CellInput
                        label={`${name} ${column.label}`}
                        path={path}
                        column={column}
                        value={value}
                        invalid={bad.has(path)}
                        onType={(typed) => set(row, column, typed)}
                        onPaste={(text) => paste(row, index, text)}
                      />
                    </td>
                  );
                })}
                <td className="whitespace-nowrap text-right">
                  <button
                    type="button"
                    aria-label={`Move ${name} up`}
                    disabled={row === 0}
                    className={ROW_BUTTON}
                    onClick={() =>
                      onOps([{ op: "move", path: sheet.path, from: row, to: row - 1 }])
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    className={ROW_BUTTON}
                    onClick={() => onOps([{ op: "remove", path: [...sheet.path, row] }])}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        aria-label={`Add a row to ${sheet.title}`}
        className="w-full border-t border-border px-2 py-1.5 text-left text-[12px] text-ink-3 hover:text-ink"
        onClick={() =>
          onOps([{ op: "insert", path: sheet.path, at: sheet.rows.length, item: sheet.blank }])
        }
      >
        + a row · or paste rows into a cell
      </button>
    </div>
  );
}
