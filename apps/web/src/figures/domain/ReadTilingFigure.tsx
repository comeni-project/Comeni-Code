// `read-tiling` (M6.6a spec, M6DC.4), as the L5 board's Figure 1: the genome letter by letter on a
// ruler, each read a bar where code-figures found it, in the lane it computed (first fit). Bars
// are neutral: teal is a route's, and no read here is one (W10).
import type { KitProps } from "../registry";
import { MONO, Undrawn } from "./parts";

const LEFT = 70;
const STEP = 16;
const LANE = 20;

export function ReadTilingFigure({ data, derived, alt }: KitProps<"read-tiling">) {
  const starts = derived.starts as number[] | undefined;
  const lanes = derived.lanes as number[] | undefined;
  if (!Array.isArray(starts) || !Array.isArray(lanes)) return <Undrawn alt={alt} />;
  const genome = data.genome;
  const at = (position: number) => LEFT + (position - 1) * STEP;
  const width = at(genome.length + 1) + 10;
  const height = 52 + (Math.max(0, ...lanes) + 1) * LANE + 6;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width * 1.2 }}
      role="img"
      aria-label={alt}
      className="block"
    >
      <text x={0} y={24} style={{ ...MONO, fontSize: 11, fill: "var(--ink-3)" }}>
        genome
      </text>
      {[...genome].map((ch, i) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: a letter's place is its key
          key={i}
          x={at(i + 1) + STEP / 2 - 2}
          y={24}
          textAnchor="middle"
          style={{ ...MONO, fontSize: 13, fill: "var(--ink)" }}
        >
          {ch}
        </text>
      ))}
      <line
        x1={LEFT - 4}
        y1={34}
        x2={at(genome.length + 1)}
        y2={34}
        style={{ stroke: "var(--ink)", strokeWidth: 2 }}
      />
      <text x={0} y={62} style={{ ...MONO, fontSize: 11, fill: "var(--ink-3)" }}>
        reads
      </text>
      {data.reads.map((read, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: two reads may be the same letters
          key={i}
          data-read=""
          data-start={starts[i]}
          data-lane={lanes[i]}
          x={at(starts[i] ?? 1)}
          y={48 + (lanes[i] ?? 0) * LANE}
          width={read.sequence.length * STEP - 4}
          height={12}
          rx={4}
          style={{ fill: "var(--exon)", stroke: "var(--ink-2)", strokeWidth: 1.2 }}
        >
          <title>{read.sequence}</title>
        </rect>
      ))}
    </svg>
  );
}
