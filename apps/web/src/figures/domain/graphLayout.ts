// A k-mer graph's layout (M6.6a spec, M6DC.4), as the boards draw one: a main line of k-mers in one
// row, and each run that leaves it in a row of its own, the first below, the next above, and so on
// outward. dagre gives only the columns (its ranks, which survive a cycle); the rows are ours, since
// dagre's ordering pulls a solid k-mer toward a bubble beside it. Pure: the same graph lays out the
// same way on the page and in the composer.
import { graphlib, layout } from "@dagrejs/dagre";
import type { Box, Laid, Path } from "../flow/layout";

const LETTER = 9.4; // the mono face at 15 px, about
const PAD = 14;
const MIN_W = 58;
const BOX_H = 34;
const ROW = 60; // a row's height, box and gap
const COLUMN_GAP = 44;
const MARGIN = 10;
const LABEL = 18; // room above a row for its edges' labels
const LOOP = 34; // how far a k-mer's loop to itself rises above its box

const widthOf = (id: string) => Math.max(MIN_W, Math.ceil(id.length * LETTER) + 2 * PAD);

/** Each k-mer's column: dagre's rank, read back from its x in a left-to-right layout. */
function columns(nodes: string[], edges: readonly (readonly string[])[]): Map<string, number> {
  const g = new graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "LR", ranksep: 10, nodesep: 10 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of nodes) g.setNode(id, { width: 1, height: 1 });
  edges.forEach(([from = "", to = ""], at) => {
    g.setEdge(from, to, {}, `e${at}`);
  });
  layout(g);
  const xs = [...new Set(nodes.map((id) => Math.round(g.node(id).x)))].sort((a, b) => a - b);
  return new Map(nodes.map((id) => [id, xs.indexOf(Math.round(g.node(id).x))]));
}

/** The runs off the line: k-mers joined by edges among themselves, in first-seen order. */
function runs(nodes: string[], edges: readonly (readonly string[])[], line: Set<string>) {
  const off = nodes.filter((id) => !line.has(id));
  const run = new Map(off.map((id) => [id, id]));
  const root = (id: string): string => {
    const up = run.get(id) ?? id;
    return up === id ? id : root(up);
  };
  for (const [from = "", to = ""] of edges) {
    if (run.has(from) && run.has(to)) run.set(root(to), root(from));
  }
  const groups = new Map<string, string[]>();
  for (const id of off) groups.set(root(id), [...(groups.get(root(id)) ?? []), id]);
  return [...groups.values()];
}

function curve(from: Box, to: Box): string {
  if (from === to) {
    // A k-mer followed by itself (a homopolymer read): a loop over its box, back down into it.
    const [out, back, y] = [from.x + from.w * 0.7, from.x + from.w * 0.3, from.y];
    return `M${out} ${y} C${out + 18} ${y - LOOP} ${back - 18} ${y - LOOP} ${back} ${y}`;
  }
  const [x1, y1] = [from.x + from.w, from.y + from.h / 2];
  const [x2, y2] = [to.x, to.y + to.h / 2];
  if (x2 > x1) {
    if (y1 === y2) return `M${x1} ${y1} H${x2}`;
    const bend = Math.min(COLUMN_GAP / 2, (x2 - x1) / 2);
    return `M${x1} ${y1} C${x2 - bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
  }
  // Back to an earlier column (a repeat makes a cycle): over the top of both boxes.
  const top = Math.min(from.y, to.y) - 16;
  return `M${from.x + from.w / 2} ${from.y} C${from.x + from.w / 2} ${top} ${to.x + to.w / 2} ${top} ${to.x + to.w / 2} ${to.y}`;
}

/**
 * Each edge is [from, to] or [from, to, label]; `line` names the k-mers drawn in the main row
 * (a path, the k-mers reads agree on, or the first read's). Nodes and edges keep the order given.
 */
export function layoutKmers(
  nodes: string[],
  edges: readonly (readonly string[])[],
  line: readonly string[],
): Laid {
  const column = columns(nodes, edges);
  const count = Math.max(0, ...column.values()) + 1;
  const colW = Array.from({ length: count }, (_, c) =>
    Math.max(MIN_W, ...nodes.filter((id) => column.get(id) === c).map(widthOf)),
  );
  const left = colW.map(
    (_, c) => MARGIN + colW.slice(0, c).reduce((a, w) => a + w + COLUMN_GAP, 0),
  );
  const labelled = edges.some((edge) => edge[2] !== undefined);
  // An edge back to an earlier column loops over the top: room for it above the first row.
  const back = edges.some(
    ([from = "", to = ""]) => (column.get(to) ?? 0) <= (column.get(from) ?? 0),
  );
  const head = (labelled ? LABEL : 0) + (back ? 26 : 0);
  // Rows: 0 is the line; the runs off it take 1, -1, 2, -2… in first-seen order.
  const row = new Map<string, number>();
  const onLine = new Set(line.filter((id) => nodes.includes(id)));
  for (const id of onLine) row.set(id, 0);
  const outward = (n: number) => (n % 2 === 0 ? n / 2 + 1 : -(n + 1) / 2); // 1, -1, 2, -2…
  runs(nodes, edges, onLine).forEach((run, n) => {
    for (const id of run) row.set(id, outward(n));
  });
  // Two k-mers in one row and one column would overlap (a fork within the line or a run, #404):
  // the later one moves to the nearest row outward that is free at its column.
  const taken = new Set<string>();
  for (const id of nodes) {
    const c = column.get(id) ?? 0;
    let r = row.get(id) ?? 0;
    for (let n = 0; taken.has(`${r}:${c}`); n++) r = outward(n);
    row.set(id, r);
    taken.add(`${r}:${c}`);
  }
  const rows = [...new Set(row.values())];
  const top = Math.min(0, ...rows);
  const rowH = ROW + (labelled ? LABEL : 0);
  const boxes: Box[] = nodes.map((id) => {
    const c = column.get(id) ?? 0;
    const w = widthOf(id);
    return {
      id,
      lines: [id],
      x: (left[c] ?? MARGIN) + ((colW[c] ?? w) - w) / 2,
      y: MARGIN + head + ((row.get(id) ?? 0) - top) * rowH,
      w,
      h: BOX_H,
    };
  });
  const at = new Map(boxes.map((box) => [box.id, box]));
  const paths: Path[] = edges.map(([from = "", to = "", label]) => {
    const a = at.get(from) as Box;
    const b = at.get(to) as Box;
    const path: Path = { from, to, d: curve(a, b) };
    if (label !== undefined) {
      path.label = label;
      path.labelAt =
        a === b
          ? { x: a.x + a.w / 2, y: a.y - LOOP - 6 }
          : { x: (a.x + a.w + b.x) / 2, y: (a.y + b.y) / 2 + BOX_H / 2 };
    }
    return path;
  });
  const last = count - 1;
  return {
    boxes,
    paths,
    groups: [],
    width: Math.ceil((left[last] ?? MARGIN) + (colW[last] ?? 0) + MARGIN),
    height: Math.ceil(MARGIN * 2 + head + (Math.max(0, ...rows) - top) * rowH + BOX_H),
  };
}
