// Every component the page can draw, by the name code-figures gives it (M6FG.2). A test fails
// unless these are exactly the components schemas.ts holds.
import type { ComponentType } from "react";
import { ChartFigure } from "./ChartFigure";
import { CompareGraphsFigure } from "./domain/CompareGraphsFigure";
import { GraphArtifactsFigure } from "./domain/GraphArtifactsFigure";
import { KmerGraphFigure } from "./domain/KmerGraphFigure";
import { KmerWindowFigure } from "./domain/KmerWindowFigure";
import { ReadTilingFigure } from "./domain/ReadTilingFigure";
import { FlowFigure } from "./FlowFigure";
import type { Component, FigureData } from "./schemas";
import { TableFigure } from "./TableFigure";
import { TrackFigure } from "./TrackFigure";

/** How a figure that asks a question is drawn (M6.6b spec, M6FA.4): the k-mers picked, in order,
 * in one tone (blue while picking, red when checked wrong, teal when right), where a trace can go
 * next, whether its computed marks show, and, when the learner may pick, what a pick does. Asked,
 * a kit draws no highlight and spells nothing. */
export interface FigureView {
  selection: string[];
  tone: "sel" | "open" | "line";
  next: string[];
  marks: boolean;
  order: boolean;
  onPick?: (kmer: string) => void;
}

export interface KitProps<C extends Component> {
  data: FigureData[C];
  derived: Record<string, unknown>;
  alt: string;
  view?: FigureView;
}

export const RENDERERS: { [C in Component]: ComponentType<KitProps<C>> } = {
  chart: ChartFigure,
  "compare-graphs": CompareGraphsFigure,
  flow: FlowFigure,
  "graph-artifacts": GraphArtifactsFigure,
  "kmer-graph": KmerGraphFigure,
  "kmer-window": KmerWindowFigure,
  "read-tiling": ReadTilingFigure,
  "sequence-track": TrackFigure,
  table: TableFigure,
};
