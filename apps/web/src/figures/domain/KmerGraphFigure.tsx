// `kmer-graph` (M6.6a spec, M6DC.1, M6DC.4), as the L5 board's try: the reads and k above, the
// k-mers code-figures computed laid out by dagre, each read's note beside the first k-mer it adds,
// the highlight, and with a path, what it spells (or a ? per letter for the learner to work out).
import { useId } from "react";
import type { KitProps } from "../registry";
import { layoutKmers } from "./graphLayout";
import { kmersOf } from "./kmers";
import { Arrowheads, Edge, KmerBox, legible, MONO, NEUTRAL, ON_PATH, Undrawn } from "./parts";

const TOP = 40; // the reads line
const SPELLS = 56; // the path spells line

interface Computed {
  kmers: string[];
  edges: [string, string][];
  branches: string[];
  notes: Record<string, string>;
  path?: string[];
  spells?: string;
}

export function KmerGraphFigure({ data, derived, alt }: KitProps<"kmer-graph">) {
  const id = `kg-${useId().replace(/:/g, "")}`;
  const got = derived as Partial<Computed>;
  if (!Array.isArray(got.kmers) || !Array.isArray(got.edges)) return <Undrawn alt={alt} />;
  const { kmers, edges, branches = [], notes = {}, path = [], spells = "" } = got;
  const highlight = data.highlight;
  const onPath = new Set(highlight === "path" ? path : []);
  const step = new Set(path.slice(1).map((to, at) => `${path[at]} ${to}`));
  const isStep = (from: string, to: string) => highlight === "path" && step.has(`${from} ${to}`);
  // The path in one row when there is one; else the first read's k-mers, as the board draws.
  const line = highlight === "path" ? path : kmersOf(data.reads[0]?.sequence ?? "", data.k);
  const laid = layoutKmers(kmers, edges, line);
  // A note sits right of its k-mer, as the board's does at a row's end; beneath it when another box
  // follows in the row, where right of it is an edge (#403).
  const beneath = new Set(
    laid.boxes
      .filter((box) => notes[box.id] !== undefined)
      .filter((box) => laid.boxes.some((o) => o.y === box.y && o.x > box.x))
      .map((box) => box.id),
  );
  const noteW = Math.max(0, ...Object.values(notes).map((n) => n.length * 6.6 + 12));
  const readsW = 60 + data.reads.reduce((w, r) => w + r.sequence.length * 8.5 + 14, 0) + 60;
  const width = Math.max(laid.width + noteW, readsW, 320);
  const height =
    TOP + laid.height + (beneath.size > 0 ? 16 : 0) + (highlight === "path" ? SPELLS : 0);
  const letters = [...spells].map((ch) => (data.spell === "hidden" ? "?" : ch)).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={legible(width, 1.4)}
      role="img"
      aria-label={alt}
      className="mx-auto block"
    >
      <Arrowheads id={id} colours={{ plain: "var(--ink-3)", path: "var(--line)" }} />
      <text x={10} y={22} style={{ ...MONO, fontSize: 11, fill: "var(--ink-3)" }}>
        reads
        {data.reads.map((read, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two reads may be the same letters
          <tspan key={at} dx={14} style={{ fontSize: 14, fill: "var(--ink-2)" }}>
            {read.sequence}
          </tspan>
        ))}
        <tspan dx={18}>k = {data.k}</tspan>
      </text>
      <g transform={`translate(0 ${TOP})`}>
        {laid.paths.map((p, at) => {
          const on = isStep(p.from, p.to);
          return (
            <Edge
              // biome-ignore lint/suspicious/noArrayIndexKey: edges are distinct, in order
              key={at}
              path={p}
              colour={on ? "var(--line)" : "var(--ink-3)"}
              marker={`${id}-${on ? "path" : "plain"}`}
              dashed={highlight === "path" && !on}
              data-on-path={on ? "" : undefined}
            />
          );
        })}
        {laid.boxes.map((box) => (
          <g key={box.id}>
            <KmerBox
              box={box}
              tone={onPath.has(box.id) ? ON_PATH : NEUTRAL}
              double={highlight === "branches" && branches.includes(box.id)}
              data-on-path={onPath.has(box.id) ? "" : undefined}
              data-branch={highlight === "branches" && branches.includes(box.id) ? "" : undefined}
            />
            {notes[box.id] !== undefined &&
              (beneath.has(box.id) ? (
                <text
                  x={box.x + box.w / 2}
                  y={box.y + box.h + 15}
                  textAnchor="middle"
                  style={{ fontSize: 12, fill: "var(--ink-3)" }}
                >
                  {notes[box.id]}
                </text>
              ) : (
                <text
                  x={box.x + box.w + 10}
                  y={box.y + box.h / 2 + 4}
                  style={{ fontSize: 12, fill: "var(--ink-3)" }}
                >
                  {notes[box.id]}
                </text>
              ))}
          </g>
        ))}
      </g>
      {highlight === "path" && (
        <g transform={`translate(0 ${TOP + laid.height + (beneath.size > 0 ? 16 : 0)})`}>
          <line x1={10} y1={10} x2={width - 10} y2={10} style={{ stroke: "var(--border)" }} />
          <text x={10} y={40} style={{ ...MONO, fontSize: 11, fill: "var(--ink-3)" }}>
            path spells
          </text>
          <text
            data-testid="spells"
            x={100}
            y={42}
            style={{
              ...MONO,
              fontSize: 19,
              fontWeight: 500,
              letterSpacing: 4,
              fill: data.spell === "hidden" ? "var(--ink)" : "var(--line)",
            }}
          >
            {letters}
          </text>
        </g>
      )}
    </svg>
  );
}
