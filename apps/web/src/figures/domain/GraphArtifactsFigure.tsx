// `graph-artifacts` (M6.6a spec, M6DC.1, M6DC.4), as the L5 board's Figure 4: the reads' k-mers laid
// out by dagre, a tip's k-mers amber and a bubble's red, dashed, as are the edges that reach them,
// and each run named in words beneath, never by colour alone (W10).
import { useId } from "react";
import type { KitProps } from "../registry";
import { layoutKmers } from "./graphLayout";
import {
  Arrowheads,
  BUBBLE,
  Edge,
  KmerBox,
  legible,
  NEUTRAL,
  Picks,
  TIP,
  type Tone,
  Undrawn,
  viewTone,
} from "./parts";

const LINE = 22;
const SAYS = {
  bubble: "bubble: a read with one wrong base rejoins the path",
  tip: "tip: an error near a read’s end dead-ends",
} as const;
const TONES: Record<Kind, Tone> = { bubble: BUBBLE, tip: TIP };
const WORDS: Record<Kind, string> = { bubble: "var(--open)", tip: "var(--meas)" };

type Kind = keyof typeof SAYS;
interface Artifact {
  kind: Kind;
  kmers: string[];
}

export function GraphArtifactsFigure({ data, derived, alt, view }: KitProps<"graph-artifacts">) {
  const id = `ga-${useId().replace(/:/g, "")}`;
  const kmers = derived.kmers as string[] | undefined;
  const edges = derived.edges as [string, string][] | undefined;
  const artifacts = (derived.artifacts ?? []) as Artifact[];
  if (!Array.isArray(kmers) || !Array.isArray(edges)) return <Undrawn alt={alt} />;
  const runOf = new Map(artifacts.flatMap((a) => a.kmers.map((k) => [k, a.kind] as const)));
  // Marks hidden (M6FA.5): every k-mer plain, for an option or a question asked; a view says.
  const marks = view === undefined ? data.marks !== "hidden" : view.marks;
  const of = marks ? runOf : new Map<string, Kind>();
  // The k-mers the reads agree on in one row; each weak run leaves it in a row of its own.
  const laid = layoutKmers(
    kmers,
    edges,
    kmers.filter((kmer) => !runOf.has(kmer)),
  );
  const width = Math.max(laid.width, 420);
  const said = marks ? artifacts : [];
  const height = laid.height + 14 + said.length * LINE;
  const drawing = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={legible(width, 1.4)}
      role="img"
      aria-label={alt}
      className="mx-auto block"
    >
      <Arrowheads
        id={id}
        colours={{ plain: "var(--ink-3)", bubble: "var(--open)", tip: "var(--meas-bar)" }}
      />
      {laid.paths.map((p, at) => {
        const kind = of.get(p.to) ?? of.get(p.from);
        return (
          <Edge
            // biome-ignore lint/suspicious/noArrayIndexKey: edges are distinct, in order
            key={at}
            path={p}
            colour={kind ? TONES[kind].stroke : "var(--ink-3)"}
            marker={`${id}-${kind ?? "plain"}`}
            dashed={kind !== undefined}
          />
        );
      })}
      {laid.boxes.map((box) => {
        const kind = of.get(box.id);
        return (
          <KmerBox
            key={box.id}
            box={box}
            tone={viewTone(view, box.id) ?? (kind ? TONES[kind] : NEUTRAL)}
            data-artifact={kind}
          />
        );
      })}
      {said.map((a, at) => (
        <text
          key={a.kmers.join(" ")}
          x={10}
          y={laid.height + 14 + at * LINE + 4}
          style={{ fontSize: 12.5, fontWeight: 600, fill: WORDS[a.kind] }}
        >
          {SAYS[a.kind]}
        </text>
      ))}
    </svg>
  );
  if (view?.onPick === undefined) return drawing;
  return (
    <div className="relative mx-auto" style={legible(width, 1.4)}>
      {drawing}
      <Picks boxes={laid.boxes} width={width} height={height} view={view} />
    </div>
  );
}
