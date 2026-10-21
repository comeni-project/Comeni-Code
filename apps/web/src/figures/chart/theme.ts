// The chart's colours, read from the tokens the page already wears (tokens.json → tokens.css), so
// a chart is light or dark as the page is, and changes with it.
import { useEffect, useState } from "react";
import type { ChartTheme } from "./render";

const read = (styles: CSSStyleDeclaration, name: string) => styles.getPropertyValue(name).trim();

export function readTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    ink: read(styles, "--ink"),
    ink2: read(styles, "--ink-2"),
    ink3: read(styles, "--ink-3"),
    border: read(styles, "--border"),
    surface: read(styles, "--surface"),
    series: [read(styles, "--series-1"), read(styles, "--series-2"), read(styles, "--series-3")],
  };
}

/** The chart's colours as the page wears them now, read again whenever the theme may have
 * changed: the system's, or one chosen on the page. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const again = () => setTheme(readTheme());
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener("change", again);
    const watched = new MutationObserver(again);
    watched.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      media?.removeEventListener("change", again);
      watched.disconnect();
    };
  }, []);
  return theme;
}
