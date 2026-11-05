// `compare-graphs` (M6.6a spec, M6DC.4), as the L5 board's Figure 3: one set of reads under both
// conventions side by side, k-mers as nodes on the left and k-mers as edges between (k−1)-mers on
// the right, each edge there named by its k-mer. Nothing spends colour (W10).
import { useId } from "react";
import type { Laid } from "../flow/layout";
import type { KitProps } from "../registry";
import { layoutKmers } from "./graphLayout";
import { kmersOf } from "./kmers";
import { Arrowheads, Edge, KmerBox, Undrawn } from "./parts";

const HEAD = 52;
const GAP = 48;

interface Half {
  nodes: string[];
  edges: string[][];
}

function Side({
  laid,
  x,
  down,
  title,
  note,
  convention,
  marker,
}: {
  laid: Laid;
  x: number;
  /** How far this half sits lower, so both halves' rows line up. */
  down: number;
  title: string;
  note: string;
  convention: "nodes" | "edges";
  marker: string;
}) {
  return (
    <g data-convention={convention} transform={`translate(${x} 0)`}>
      <text x={10} y={20} style={{ fontSize: 13, fontWeight: 600, fill: "var(--ink)" }}>
        {title}
      </text>
      <text x={10} y={38} style={{ fontSize: 12, fill: "var(--ink-3)" }}>
        {note}
      </text>
      <g transform={`translate(0 ${HEAD + down})`}>
        {laid.paths.map((p, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: edges are distinct, in order
          <Edge key={at} path={p} colour="var(--ink-3)" marker={marker} />
        ))}
        {laid.boxes.map((box) => (
          <KmerBox key={box.id} box={box} />
        ))}
      </g>
    </g>
  );
}

export function CompareGraphsFigure({ data, derived, alt }: KitProps<"compare-graphs">) {
  const id = `cg-${useId().replace(/:/g, "")}`;
  const asNodes = derived.as_nodes as Half | undefined;
  const asEdges = derived.as_edges as Half | undefined;
  if (asNodes === undefined || asEdges === undefined) return <Undrawn alt={alt} />;
  // Each half in one row along the first read, as the board draws them.
  const first = data.reads[0]?.sequence ?? "";
  const left = layoutKmers(asNodes.nodes, asNodes.edges, kmersOf(first, data.k));
  const right = layoutKmers(asEdges.nodes, asEdges.edges, kmersOf(first, data.k - 1));
  const leftW = Math.max(left.width, 230);
  const width = leftW + GAP + Math.max(right.width, 290);
  const height = HEAD + Math.max(left.height, right.height);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width * 1.3 }}
      role="img"
      aria-label={alt}
      className="mx-auto block"
    >
      <Arrowheads id={id} colours={{ plain: "var(--ink-3)" }} />
      <Side
        laid={left}
        x={0}
        down={Math.max(left.height, right.height) - left.height}
        title="k-mers as nodes"
        note="common in tools and teaching"
        convention="nodes"
        marker={`${id}-plain`}
      />
      <line
        x1={leftW + GAP / 2}
        y1={6}
        x2={leftW + GAP / 2}
        y2={height - 6}
        style={{ stroke: "var(--border)" }}
      />
      <Side
        laid={right}
        x={leftW + GAP}
        down={Math.max(left.height, right.height) - right.height}
        title="k-mers as edges"
        note="the formal definition · nodes are (k−1)-mers"
        convention="edges"
        marker={`${id}-plain`}
      />
    </svg>
  );
}
