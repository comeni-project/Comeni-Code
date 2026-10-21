// A chart drawn by Vega, locked down (M6.4 spec, M6FG.4). The data has already passed the
// allowlist in the browser; here nothing can run or load: Vega parses to an AST and runs it with
// vega-interpreter (no `new Function`), its loader refuses every load and every link, it draws
// SVG, and there is no tooltip handler. `$schema`, `config`, `width`, `height` and `autosize` are
// ours, added here, never the author's. Vega loads only on a page with a chart. It draws as the L5
// board does (#371): series coloured in the data's order, lines named at their ends.
import type { Channel, ChartData } from "../schemas";

export interface ChartTheme {
  ink: string;
  ink2: string;
  ink3: string;
  border: string;
  surface: string;
  series: string[];
}

const refused =
  (what: string) =>
  (..._asked: unknown[]): Promise<never> =>
    Promise.reject(new Error(`a chart refuses to ${what}: its data is inline (M6FG.4)`));

/** Vega's loader interface, every method refusing. */
export const refusingLoader = {
  load: refused("load"),
  sanitize: refused("sanitize a link"),
  http: refused("fetch"),
  file: refused("read a file"),
};

const UI = "Lexend Variable, Lexend, system-ui, sans-serif";
const MONO = "Geist Mono Variable, Geist Mono, ui-monospace, monospace";

export function themeConfig(theme: ChartTheme) {
  return {
    background: null,
    font: UI,
    view: { stroke: null },
    // One series spends no colour; several take the series palette, never cycled past three.
    mark: { color: theme.ink2 },
    // 3 and 6,000, never 3.0: trailing zeros trimmed, thousands grouped.
    numberFormat: ",~f",
    line: { strokeWidth: 2 },
    point: { size: 50, filled: false, strokeWidth: 2 },
    bar: { cornerRadiusEnd: 4 },
    range: { category: theme.series },
    axis: {
      domainColor: theme.ink3,
      tickColor: theme.ink3,
      gridColor: theme.border,
      labelColor: theme.ink3,
      labelFont: MONO,
      labelFontSize: 11,
      titleColor: theme.ink2,
      titleFont: UI,
      titleFontSize: 12,
      titleFontWeight: 400,
      tickCount: 6,
    },
    // A recessive grid: horizontal lines only; the y title level, above its axis.
    axisX: { grid: false },
    axisY: {
      grid: true,
      titleAngle: 0,
      titleAlign: "left",
      titleAnchor: "end",
      titleBaseline: "bottom",
      titleX: -6,
      titleY: -10,
    },
    legend: {
      labelColor: theme.ink2,
      labelFont: UI,
      labelFontSize: 12,
      titleColor: theme.ink2,
      titleFont: UI,
      titleFontSize: 12,
      titleFontWeight: 500,
    },
    text: { color: theme.ink, font: UI },
  };
}

/** What a nominal or ordinal colour channel names: the series, when there are several. */
const seriesField = (color: Channel | undefined) =>
  color?.field !== undefined && (color.type === "nominal" || color.type === "ordinal")
    ? color.field
    : undefined;

/** The Vega-Lite spec drawn from the author's data: ours around it, theirs unchanged within. */
export function chartSpec(data: ChartData, theme: ChartTheme) {
  const color = data.encoding?.color;
  const encoding =
    color === undefined
      ? data.encoding
      : // A series keeps its colour by its place in the data, not its name's (#371).
        {
          ...data.encoding,
          color: { ...color, sort: color.sort === undefined ? null : color.sort },
        };
  const mark = typeof data.mark === "string" ? { type: data.mark } : data.mark;
  const spec = {
    ...data,
    ...(encoding === undefined ? {} : { encoding }),
    width: "container",
    height: 260,
    autosize: { type: "fit-x", contains: "padding" },
    config: themeConfig(theme),
  };
  const series = seriesField(color);
  const x = data.encoding?.x;
  const y = data.encoding?.y;
  // Lines of named series are named at their ends, in place of a legend, unless the author asked
  // for a legend; their points are rings filled with the surface (the L5 board).
  if (mark?.type !== "line" || series === undefined || !x?.field || !y?.field) return spec;
  if (color?.legend !== undefined) return spec;
  const { mark: _mark, encoding: _encoding, ...rest } = spec;
  const point =
    mark.point === true
      ? { filled: false, fill: theme.surface, size: 50, strokeWidth: 2 }
      : mark.point;
  return {
    ...rest,
    layer: [
      {
        mark: point === undefined ? mark : { ...mark, point },
        encoding: { ...encoding, color: { ...encoding?.color, legend: null } },
      },
      {
        mark: { type: "text", align: "left", baseline: "middle", dx: 8, fontWeight: 500 },
        encoding: {
          // The lines' own titles, so the shared axes keep one title each.
          x: { field: x.field, type: x.type, aggregate: "max", title: x.title ?? x.field },
          y: {
            field: y.field,
            type: y.type,
            aggregate: { argmax: x.field },
            title: y.title ?? y.field,
          },
          text: { field: series },
          detail: { field: series },
        },
      },
    ],
  };
}

/** Draws `data` into `el`; resolves with the function that takes the chart down again. */
export async function renderChart(
  el: HTMLElement,
  data: ChartData,
  theme: ChartTheme,
): Promise<() => void> {
  const [{ compile }, vega, { expressionInterpreter }] = await Promise.all([
    import("vega-lite"),
    import("vega"),
    import("vega-interpreter"),
  ]);
  const spec = chartSpec(data, theme);
  // biome-ignore lint/suspicious/noExplicitAny: the allowlisted subset is a Vega-Lite spec
  const compiled = compile(spec as any).spec;
  const runtime = vega.parse(compiled, undefined, { ast: true });
  const view = new vega.View(runtime, {
    expr: expressionInterpreter,
    // biome-ignore lint/suspicious/noExplicitAny: Vega's Loader type, every method refusing
    loader: refusingLoader as any,
    renderer: "svg",
    container: el,
    hover: false,
  });
  await view.runAsync();
  return () => view.finalize();
}
