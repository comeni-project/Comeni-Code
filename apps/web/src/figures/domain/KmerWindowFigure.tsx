// `kmer-window` (M6.6a spec, M6DC.4), as the L5 board's Figure 2: the read in letter boxes, its
// windows for the current k, the count as L − k + 1, and a k slider over the range. The slider is
// the learner's: its value lives in the page, is never saved and answers nothing. The current
// window is blue (selected, W10); nothing here is teal, which is a route's.
import { useId, useState } from "react";
import type { KitProps } from "../registry";
import { MONO, Undrawn } from "./parts";

const CELL = 34;
const LEFT = 10;
const ROW = 20;

interface ForK {
  windows: [number, string][];
  count: number;
}

export function KmerWindowFigure({ data, derived, alt }: KitProps<"kmer-window">) {
  // The learner's k, until the author's changes (in the composer): then the author's again.
  const [moved, setMoved] = useState({ from: data.k, k: data.k });
  const k = moved.from === data.k ? moved.k : data.k;
  const setK = (next: number) => setMoved({ from: data.k, k: next });
  const label = useId();
  const byK = (derived.by_k ?? {}) as Record<string, ForK | undefined>;
  const now = byK[String(k)];
  if (now === undefined) return <Undrawn alt={alt} />;
  const [min, max] = data.range;
  const read = data.read;
  const width = LEFT * 2 + read.length * CELL + 12 + max * 8.5;
  const height = 62 + now.windows.length * ROW;
  const ks = Array.from({ length: max - min + 1 }, (_, at) => min + at);
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: width * 1.2, flex: "1 1 320px" }}
        role="img"
        aria-label={alt}
        className="block"
      >
        {[...read].map((ch, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a letter's place is its key
          <g key={at}>
            <rect
              x={LEFT + at * CELL}
              y={10}
              width={CELL - 4}
              height={34}
              rx={6}
              style={{
                fill: at < k ? "var(--sel-soft)" : "var(--surface)",
                stroke: at < k ? "var(--sel)" : "var(--border-2)",
                strokeWidth: 1.5,
              }}
            />
            <text
              x={LEFT + at * CELL + (CELL - 4) / 2}
              y={33}
              textAnchor="middle"
              style={{ ...MONO, fontSize: 16, fontWeight: 500, fill: "var(--ink)" }}
            >
              {ch}
            </text>
          </g>
        ))}
        {now.windows.map(([start, kmer], at) => (
          <g key={start}>
            <rect
              x={LEFT + (start - 1) * CELL}
              y={58 + at * ROW}
              width={k * CELL - 4}
              height={14}
              rx={4}
              style={{
                fill: at === 0 ? "var(--sel)" : "var(--exon)",
                stroke: at === 0 ? "var(--sel)" : "var(--ink-3)",
                strokeWidth: 1,
              }}
            />
            <text
              data-testid="window"
              x={LEFT + (start - 1 + k) * CELL + 6}
              y={58 + at * ROW + 11}
              style={{ ...MONO, fontSize: 11.5, fill: "var(--ink-2)" }}
            >
              {kmer}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex min-w-[220px] flex-[0_1_260px] flex-col gap-2 pt-1">
        <div className="flex items-center gap-3">
          <label htmlFor={label} className="text-[13px] font-semibold">
            k
          </label>
          <input
            id={label}
            type="range"
            min={min}
            max={max}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="flex-1 accent-[var(--sel)]"
          />
        </div>
        <div className="flex justify-between pl-6 font-mono text-[11px] text-ink-3">
          {ks.map((v) => (
            <span key={v} className={v === k ? "font-semibold text-sel" : undefined}>
              {v}
            </span>
          ))}
        </div>
        <p className="mt-2 font-mono text-[15px]">
          {`${read.length} − ${k} + 1 = ${now.count} k-mers`}
        </p>
        <p className="text-[12.5px] leading-[1.5] text-ink-2">
          A read of length L has L − k + 1 k-mers. Drag k and watch the windows change.
        </p>
      </div>
    </div>
  );
}
