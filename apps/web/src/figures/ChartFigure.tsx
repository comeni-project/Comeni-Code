// `chart` (M6FG.4): a Vega-Lite subset, drawn by Vega locked down, in the page's tokens. Drawn
// again when the theme changes; if drawing fails, the alt text stands in.
import { useEffect, useRef, useState } from "react";
import { renderChart } from "./chart/render";
import { useChartTheme } from "./chart/theme";
import type { KitProps } from "./registry";

export function ChartFigure({ data, alt }: KitProps<"chart">) {
  const into = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const theme = useChartTheme();
  useEffect(() => {
    const el = into.current;
    if (el === null) return;
    let done: (() => void) | undefined;
    let gone = false;
    renderChart(el, data, theme)
      .then((finish) => {
        if (gone) finish();
        else done = finish;
      })
      .catch(() => setFailed(true));
    return () => {
      gone = true;
      done?.();
      el.replaceChildren();
    };
  }, [data, theme]);
  if (failed) {
    return (
      <div className="flex flex-col gap-1.5 py-2">
        <span className="text-[13.5px] font-semibold">This figure could not be drawn.</span>
        <span className="text-[13.5px] leading-[1.55] text-ink-2">{alt}</span>
      </div>
    );
  }
  return <div ref={into} role="img" aria-label={alt} className="w-full min-h-[260px]" />;
}
