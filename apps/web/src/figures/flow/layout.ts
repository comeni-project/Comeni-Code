// A flow's layout (M6.4 spec, M6FG.3): boxes, arrows and groups placed by dagre, then drawn in our
// own SVG. Pure: the same data lays out the same way, so the page and the workbench agree.
import { graphlib, layout } from "@dagrejs/dagre";
import type { FlowData } from "../schemas";

export interface Box {
  id: string;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Path {
  from: string;
  to: string;
  d: string;
  label?: string;
  labelAt?: { x: number; y: number };
}
export interface Group {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Laid {
  boxes: Box[];
  paths: Path[];
  groups: Group[];
  width: number;
  height: number;
}

const CHAR = 7.2; // Lexend at 12.5 px, about
const LINE = 15;
const PAD_X = 14;
const MIN_W = 76;
const ONE_LINE = 14; // characters a box keeps on one line before it wraps
const GROUP_LABEL = 22; // room under a group for its label

/** A label on one line, or two split at the space nearest its middle. */
export function wrap(label: string): string[] {
  if (label.length <= ONE_LINE || !label.includes(" ")) return [label];
  const middle = label.length / 2;
  let best = -1;
  for (let at = label.indexOf(" "); at !== -1; at = label.indexOf(" ", at + 1)) {
    if (best === -1 || Math.abs(at - middle) < Math.abs(best - middle)) best = at;
  }
  return [label.slice(0, best), label.slice(best + 1)];
}

function curve(points: { x: number; y: number }[]): string {
  const [first, ...rest] = points;
  if (first === undefined) return "";
  return `M${first.x.toFixed(1)} ${first.y.toFixed(1)}${rest.map((p) => ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")}`;
}

export function layoutFlow(data: FlowData): Laid {
  const g = new graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({
    rankdir: data.direction === "down" ? "TB" : "LR",
    nodesep: 22,
    ranksep: 44,
    edgesep: 12,
    marginx: 10,
    marginy: 10,
  });
  g.setDefaultEdgeLabel(() => ({}));
  const lines = new Map(data.nodes.map((node) => [node.id, wrap(node.label)]));
  for (const group of data.groups ?? [])
    g.setNode(group.id, { label: group.label, paddingBottom: GROUP_LABEL });
  for (const node of data.nodes) {
    const text = lines.get(node.id) ?? [node.label];
    const longest = Math.max(...text.map((line) => line.length));
    g.setNode(node.id, {
      width: Math.max(MIN_W, Math.ceil(longest * CHAR) + 2 * PAD_X),
      height: 30 + LINE * text.length,
    });
    if (node.group !== undefined) g.setParent(node.id, node.group);
  }
  data.edges.forEach((edge, at) => {
    g.setEdge(
      edge.from,
      edge.to,
      {
        label: edge.label,
        width: edge.label ? edge.label.length * 6.5 : 0,
        height: edge.label ? 14 : 0,
        labelpos: "c",
      },
      `e${at}`,
    );
  });
  layout(g);

  const boxes = data.nodes.map((node) => {
    const n = g.node(node.id);
    return {
      id: node.id,
      lines: lines.get(node.id) ?? [node.label],
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      w: n.width,
      h: n.height,
    };
  });
  const paths = data.edges.map((edge, at): Path => {
    const e = g.edge({ v: edge.from, w: edge.to, name: `e${at}` });
    const path: Path = { from: edge.from, to: edge.to, d: curve(e.points ?? []) };
    if (edge.label !== undefined) {
      path.label = edge.label;
      path.labelAt = { x: e.x ?? 0, y: e.y ?? 0 };
    }
    return path;
  });
  const groups = (data.groups ?? []).map((group) => {
    const n = g.node(group.id);
    return {
      id: group.id,
      label: group.label,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      w: n.width,
      h: n.height,
    };
  });
  const graph = g.graph();
  return {
    boxes,
    paths,
    groups,
    width: Math.ceil(graph.width ?? 0),
    height: Math.ceil(graph.height ?? 0),
  };
}
