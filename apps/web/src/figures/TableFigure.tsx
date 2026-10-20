// `table` (M6FG.3), as the board's Figure 1: a header rule, numbers right-aligned in Geist Mono
// with tabular figures and grouped thousands, the unit in the header.
import type { KitProps } from "./registry";

const grouped = new Intl.NumberFormat("en");

function shown(cell: string | number | null, decimals: number | undefined): string {
  if (cell === null) return "";
  if (typeof cell === "number") {
    return decimals === undefined
      ? grouped.format(cell)
      : new Intl.NumberFormat("en", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(cell);
  }
  return cell;
}

export function TableFigure({ data, alt }: KitProps<"table">) {
  return (
    <table aria-label={alt} className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr>
          {data.columns.map((column) => (
            <th
              key={column.name}
              scope="col"
              className={`border-b-[1.5px] border-ink-2 px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 ${column.type === "number" ? "text-right" : "text-left"}`}
            >
              {column.unit ? `${column.name} (${column.unit})` : column.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond their place
          <tr key={at} className="border-b border-border last:border-b-0">
            {row.map((cell, column) => {
              const kind = data.columns[column]?.type;
              return (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: a cell is its column
                  key={column}
                  className={`px-3.5 py-2 font-mono tabular-nums text-ink ${kind === "number" ? "text-right" : "text-left"}`}
                >
                  {shown(cell, data.columns[column]?.decimals)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
