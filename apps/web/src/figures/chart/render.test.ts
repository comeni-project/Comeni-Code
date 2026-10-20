import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartData } from "../schemas";
import { refusingLoader, renderChart, themeConfig } from "./render";

const THEME = {
  ink: "#171a26",
  ink2: "#474d63",
  ink3: "#666c84",
  border: "#e1e4ec",
  series: ["#6250d6", "#eb6834", "#c2457f"],
};
const CHART: ChartData = {
  mark: { type: "line", point: true },
  data: {
    values: [
      { k: 3, genome: "simple", kmers: 64 },
      { k: 5, genome: "simple", kmers: 812 },
      { k: 3, genome: "repeat-rich", kmers: 64 },
      { k: 5, genome: "repeat-rich", kmers: 702 },
    ],
  },
  encoding: {
    x: { field: "k", type: "quantitative" },
    y: { field: "kmers", type: "quantitative" },
    color: { field: "genome", type: "nominal" },
  },
};

afterEach(() => vi.restoreAllMocks());

describe("renderChart (M6FG.4)", () => {
  it("draws an SVG chart from the data, and nothing leaves the page", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    const el = document.createElement("div");
    const done = await renderChart(el, CHART, THEME);
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(fetched).not.toHaveBeenCalled();
    done();
  });

  it("refuses every load and every link, even when handed one", async () => {
    await expect(refusingLoader.load("https://example.org/data.csv")).rejects.toThrow(/refuses/);
    await expect(refusingLoader.sanitize("https://example.org", {})).rejects.toThrow(/refuses/);
    await expect(refusingLoader.http("https://example.org", {})).rejects.toThrow(/refuses/);
    await expect(refusingLoader.file("/etc/passwd")).rejects.toThrow(/refuses/);
  });

  it("takes its colours and type from the theme, never from the data", () => {
    const config = themeConfig(THEME);
    expect(config.range?.category).toEqual(THEME.series);
    expect(config.mark?.color).toBe(THEME.ink2); // one series spends no colour
    expect(config.axis?.domainColor).toBe(THEME.ink3);
    expect(config.axis?.gridColor).toBe(THEME.border);
  });
});
