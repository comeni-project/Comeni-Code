// What the k-mer figures draw alike (M6.6a spec, M6DC.4): an arrowhead, a k-mer's box, an edge, and
// the words a figure shows when what it was sent cannot be drawn. Colour comes from the caller: the
// path is the only teal, a tip amber and a bubble red, each also named in words (W10).
import type { CSSProperties } from "react";
import type { Box, Path } from "../flow/layout";
import type { FigureView } from "../registry";

export const MONO = { fontFamily: "var(--font-mono)" } as const;

/** A drawing's width bounds: never under three quarters of its own, so 15 px letters stay at 11 px
 * or more at phone width, scrolling in the figure's frame instead (#402); up to `grow` times it. */
export const legible = (width: number, grow: number) => ({
  minWidth: width * 0.75,
  maxWidth: width * grow,
});

export interface Tone {
  fill: string;
  stroke: string;
  dashed?: boolean;
}
export const NEUTRAL: Tone = { fill: "var(--surface)", stroke: "var(--ink-2)" };
export const ON_PATH: Tone = { fill: "var(--line-soft)", stroke: "var(--line)" };
export const BUBBLE: Tone = { fill: "var(--open-soft)", stroke: "var(--open)", dashed: true };
export const TIP: Tone = { fill: "var(--meas-soft)", stroke: "var(--meas-bar)", dashed: true };
// A question's selection (M6FA.4): blue while picked, red when checked wrong, teal when right.
export const PICKED: Record<FigureView["tone"], Tone> = {
  sel: { fill: "var(--sel-soft)", stroke: "var(--sel)" },
  open: { fill: "var(--open-soft)", stroke: "var(--open)" },
  line: ON_PATH,
};
export const STROKE: Record<FigureView["tone"], string> = {
  sel: "var(--sel)",
  open: "var(--open)",
  line: "var(--line)",
};
/** Where a trace can go next: dashed in the selection's blue. */
export const NEXT: Tone = { fill: "var(--surface)", stroke: "var(--sel)", dashed: true };

/** A box's tone in a question's view, or null when the view leaves it as the kit draws it. */
export function viewTone(view: FigureView | undefined, id: string): Tone | null {
  if (view === undefined) return null;
  if (view.selection.includes(id)) return PICKED[view.tone];
  if (view.next.includes(id)) return NEXT;
  return null;
}

/** Whether an edge is a step of the view's selection. */
export const isPicked = (view: FigureView | undefined, from: string, to: string) =>
  view?.selection.some((kmer, at) => kmer === from && view.selection[at + 1] === to) ?? false;

/** A pick's place in a trace, drawn at its box's corner (1, 2, 3…). */
export function Order({ box, n, tone }: { box: Box; n: number; tone: FigureView["tone"] }) {
  return (
    <g data-order={n}>
      <circle cx={box.x + box.w - 2} cy={box.y + 2} r={9} style={{ fill: STROKE[tone] }} />
      <text
        x={box.x + box.w - 2}
        y={box.y + 6}
        textAnchor="middle"
        style={{ ...MONO, fontSize: 11, fontWeight: 600, fill: "#FFFFFF" }}
      >
        {n}
      </text>
    </g>
  );
}

/** Each k-mer a real button over the drawing (M6FA.4), placed in % of the drawing so it scales
 * with it, its tap area at least 44 px; Tab follows reading order, row by row. */
export function Picks({
  boxes,
  width,
  height,
  top = 0,
  view,
}: {
  boxes: Box[];
  width: number;
  height: number;
  top?: number;
  view: FigureView;
}) {
  const onPick = view.onPick;
  if (onPick === undefined) return null;
  const reading = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  return (
    <div className="pointer-events-none absolute inset-0">
      {reading.map((box) => (
        <button
          key={box.id}
          type="button"
          data-kmer={box.id}
          data-next={view.next.includes(box.id) ? "" : undefined}
          aria-pressed={view.selection.includes(box.id)}
          aria-label={box.id}
          onClick={() => onPick(box.id)}
          className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg bg-transparent focus-visible:outline-2 focus-visible:outline-sel"
          style={{
            left: `${((box.x + box.w / 2) / width) * 100}%`,
            top: `${((top + box.y + box.h / 2) / height) * 100}%`,
            width: `${(box.w / width) * 100}%`,
            height: `${(box.h / height) * 100}%`,
            minWidth: "44px",
            minHeight: "44px",
          }}
        />
      ))}
    </div>
  );
}

/** An arrowhead per colour the figure uses, each its own id. */
export function Arrowheads({ id, colours }: { id: string; colours: Record<string, string> }) {
  return (
    <defs>
      {Object.entries(colours).map(([name, colour]) => (
        <marker
          key={name}
          id={`${id}-${name}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" style={{ fill: colour }} />
        </marker>
      ))}
    </defs>
  );
}

export function KmerBox({
  box,
  tone = NEUTRAL,
  double = false,
  ...data
}: { box: Box; tone?: Tone; double?: boolean } & Record<`data-${string}`, string | undefined>) {
  const line: CSSProperties = {
    fill: tone.fill,
    stroke: tone.stroke,
    strokeWidth: tone === NEUTRAL ? 1.5 : 2,
    strokeDasharray: tone.dashed ? "4 3" : undefined,
  };
  return (
    <g data-kmer={box.id} {...data}>
      {double && (
        <rect
          x={box.x - 4}
          y={box.y - 4}
          width={box.w + 8}
          height={box.h + 8}
          rx={10}
          style={{ fill: "none", stroke: tone.stroke, strokeWidth: 1.2 }}
        />
      )}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={7} style={line} />
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h / 2 + 5}
        textAnchor="middle"
        style={{ ...MONO, fontSize: 15, fontWeight: 500, fill: "var(--ink)" }}
      >
        {box.id}
      </text>
    </g>
  );
}

export function Edge({
  path,
  colour,
  marker,
  dashed = false,
  ...data
}: { path: Path; colour: string; marker: string; dashed?: boolean } & Record<
  `data-${string}`,
  string | undefined
>) {
  return (
    <g data-edge={`${path.from} ${path.to}`} data-dashed={dashed ? "" : undefined} {...data}>
      <path
        d={path.d}
        markerEnd={`url(#${marker})`}
        style={{
          fill: "none",
          stroke: colour,
          strokeWidth: 2,
          strokeDasharray: dashed ? "5 4" : undefined,
          strokeLinejoin: "round",
        }}
      />
      {path.label && path.labelAt && (
        <text
          data-edge-label=""
          x={path.labelAt.x}
          y={path.labelAt.y - 6}
          textAnchor="middle"
          style={{ ...MONO, fontSize: 11.5, fontWeight: 600, fill: "var(--ink-2)" }}
        >
          {path.label}
        </text>
      )}
    </g>
  );
}

/** What was sent cannot be drawn (computed values missing): the alt text stands in, as a chart's. */
export function Undrawn({ alt }: { alt: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <span className="text-[13.5px] font-semibold">This figure could not be drawn.</span>
      <span className="text-[13.5px] leading-[1.55] text-ink-2">{alt}</span>
    </div>
  );
}
