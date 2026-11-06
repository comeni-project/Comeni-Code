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

export interface KitProps<C extends Component> {
  data: FigureData[C];
  derived: Record<string, unknown>;
  alt: string;
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
