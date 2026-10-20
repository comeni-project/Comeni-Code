// `sequence-track` (M6FG.3), as the board's Figure 5: a ruler, the sequence letter by letter when
// it is short enough to read, and each feature in the lane code-figures computed for it. A kind is
// a shape, never a colour alone: a box for an exon or a coding stretch, a thinner box for a UTR, a
// chevron for an intron, an arrow for a primer, a bracket for a motif or a region.
import type { KitProps } from "./registry";
import type { SequenceTrackData } from "./schemas";

type Feature = SequenceTrackData["features"][number];

const W = 740;
const LEFT = 24;
const TOP = 56; // the ruler and the letters
const LANE = 46;

const STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
const tickStep = (length: number) => STEPS.find((step) => length / step <= 12) ?? 100000;

function Shape({ feature, x1, x2, y }: { feature: Feature; x1: number; x2: number; y: number }) {
  const line = { stroke: "var(--ink-2)", strokeWidth: 1.4 };
  switch (feature.kind) {
    case "intron":
      return (
        <path
          d={`M${x1} ${y + 8} L${(x1 + x2) / 2} ${y} L${x2} ${y + 8}`}
          style={{ ...line, fill: "none" }}
        />
      );
    case "primer": {
      const back = feature.strand === "-";
      const tip = back ? x1 : x2;
      const base = back ? x1 + 8 : x2 - 8;
      const tail = back ? x2 : x1;
      return (
        <path
          d={`M${tail} ${y + 2} H${base} L${tip} ${y + 8} L${base} ${y + 14} H${tail} Z`}
          style={{ ...line, fill: "var(--surface)" }}
        />
      );
    }
    case "motif":
    case "region":
      return (
        <path
          d={`M${x1} ${y + 14} V${y + 4} H${x2} V${y + 14}`}
          style={{ ...line, fill: "none" }}
        />
      );
    default: {
      const thin = feature.kind === "utr";
      return (
        <rect
          x={x1}
          y={thin ? y + 4 : y}
          width={Math.max(2, x2 - x1)}
          height={thin ? 8 : 16}
          rx={3}
          style={{ ...line, strokeWidth: 1.2, fill: "var(--exon)" }}
        />
      );
    }
  }
}

export function TrackFigure({ data, derived, alt }: KitProps<"sequence-track">) {
  const letters = data.sequence ?? "";
  const length = data.sequence?.length ?? data.length ?? 1;
  const step = (W - 2 * LEFT) / length;
  const at = (position: number) => LEFT + (position - 1) * step;
  const lanes = (derived.lanes as number[] | undefined) ?? data.features.map(() => 0);
  const used = Math.max(0, ...lanes) + 1;
  const height = TOP + 22 + used * LANE;
  const every = tickStep(length);
  const ticks = [1];
  for (let p = every; p <= length; p += every) ticks.push(p);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={alt} className="block">
      {ticks.map((p) => (
        <g key={p}>
          <line
            x1={at(p)}
            y1={22}
            x2={at(p)}
            y2={30}
            style={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
          />
          <text
            x={at(p)}
            y={16}
            textAnchor="middle"
            className="font-mono"
            style={{ fontSize: 11, fill: "var(--ink-3)" }}
          >
            {p.toLocaleString("en")}
          </text>
        </g>
      ))}
      <line
        x1={at(1)}
        y1={30}
        x2={at(length + 1)}
        y2={30}
        style={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
      />
      {[...letters].map((letter, i) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: a letter is its position
          key={i}
          data-letter=""
          x={at(i + 1) + step / 2}
          y={48}
          textAnchor="middle"
          className="font-mono"
          style={{ fontSize: 11, fill: "var(--ink)" }}
        >
          {letter}
        </text>
      ))}
      {data.features.map((feature, i) => {
        const lane = lanes[i] ?? 0;
        const y = TOP + 18 + lane * LANE;
        const x1 = at(feature.start);
        const x2 = at(feature.end + 1);
        return (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: features are ordered as written
            key={i}
            data-feature=""
            data-lane={lane}
            data-kind={feature.kind}
          >
            <Shape feature={feature} x1={x1} x2={x2} y={y} />
            <text x={x1} y={y + 32} style={{ fontSize: 11.5, fill: "var(--ink-2)" }}>
              {`${feature.label} `}
              <tspan className="font-mono" style={{ fill: "var(--ink-3)" }}>
                {`${feature.start}–${feature.end}`}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
