// A chart drawn by Vega, locked down (M6.4 spec, M6FG.4). The data has already passed the
// allowlist in the browser; here nothing can run or load: Vega parses to an AST and runs it with
// vega-interpreter (no `new Function`), its loader refuses every load and every link, it draws
// SVG, and there is no tooltip handler. `$schema`, `config`, `width`, `height` and `autosize` are
// ours, added here, never the author's. Vega loads only on a page with a chart.
import type { ChartData } from "../schemas";

export interface ChartTheme {
  ink: string;
  ink2: string;
  ink3: string;
  border: string;
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
  const spec = {
    ...data,
    width: "container",
    height: 260,
    autosize: { type: "fit-x", contains: "padding" },
    config: themeConfig(theme),
  };
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
