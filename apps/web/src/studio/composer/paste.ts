// Rows pasted from a spreadsheet into a sheet (M6CO.4): tab-separated when any tab is present,
// else CSV with " quoting. A first row whose cells all name the sheet's columns is a header, and
// says which column each pasted one fills; cells past the room the sheet has are dropped, and
// counted so the composer can say so.

export interface Pasted {
  /** For each pasted column, the sheet column it fills; null when there is no header row. */
  header: number[] | null;
  rows: string[][];
  dropped: number;
}

function csvRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let at = 0; at < line.length; at++) {
    const ch = line[at];
    if (quoted) {
      if (ch === '"' && line[at + 1] === '"') {
        cell += '"';
        at++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** `room` is how many columns the sheet has from the cell pasted into; `keys` its column names,
 * all of them, for a header row. */
export function parsePaste(text: string, room: number, keys: string[] = []): Pasted {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const split = text.includes("\t") ? (line: string) => line.split("\t") : csvRow;
  let rows = lines.map(split);
  const names = keys.map((key) => key.trim().toLowerCase());
  const first = rows[0] ?? [];
  const header =
    names.length > 0 &&
    first.length > 0 &&
    first.every((cell) => names.includes(cell.trim().toLowerCase()))
      ? first.map((cell) => names.indexOf(cell.trim().toLowerCase()))
      : null;
  if (header !== null) rows = rows.slice(1);
  const width = header === null ? room : header.length;
  let dropped = 0;
  rows = rows.map((row) => {
    dropped += Math.max(0, row.length - width);
    return row.slice(0, width);
  });
  return { header, rows, dropped };
}
