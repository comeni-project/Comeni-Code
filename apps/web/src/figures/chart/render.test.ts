import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartData } from "../schemas";
import { chartSpec, refusingLoader, renderChart, themeConfig } from "./render";

const THEME = {
  ink: "#171a26",
  ink2: "#474d63",
  ink3: "#666c84",
  border: "#e1e4ec",
  surface: "#ffffff",
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

// biome-ignore lint/suspicious/noExplicitAny: reading the built Vega-Lite spec
const specOf = (data: ChartData) => chartSpec(data, THEME) as any;

describe("a chart drawn as the L5 board draws it (#371)", () => {
  it("reads numbers as the board does: 3, not 3.0; 6,000", async () => {
    const el = document.createElement("div");
    const done = await renderChart(el, CHART, THEME);
    const labels = [...el.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toContain("3");
    expect(labels.some((l) => /^\d+\.0$/.test(l ?? ""))).toBe(false);
    done();
  });

  it("draws horizontal grid lines only", () => {
    const config = themeConfig(THEME);
    expect(config.axisX?.grid).toBe(false);
    expect(config.axisY?.grid).toBe(true);
  });

  it("sets the y title level, above its axis", () => {
    expect(themeConfig(THEME).axisY?.titleAngle).toBe(0);
  });

  it("colours series in the data's order, never by sorted name", () => {
    expect(specOf(CHART).layer[0].encoding.color.sort).toBeNull();
  });

  it("keeps an order the author gave", () => {
    const sorted = {
      ...CHART,
      encoding: {
        ...CHART.encoding,
        color: { field: "genome", type: "nominal", sort: "descending" },
      },
    } as ChartData;
    expect(specOf(sorted).layer[0].encoding.color.sort).toBe("descending");
  });

  it("draws a line's points as hollow rings filled with the surface", () => {
    expect(specOf(CHART).layer[0].mark.point).toEqual({
      filled: false,
      fill: THEME.surface,
      size: 50,
      strokeWidth: 2,
    });
  });

  it("names each line at its end in place of a legend", async () => {
    const spec = specOf(CHART);
    expect(spec.layer[0].encoding.color.legend).toBeNull();
    expect(spec.layer[1].mark.type).toBe("text");
    const el = document.createElement("div");
    const done = await renderChart(el, CHART, THEME);
    const labels = [...el.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toEqual(expect.arrayContaining(["simple", "repeat-rich"]));
    expect(el.querySelector(".role-legend")).toBeNull();
    done();
  });

  it("leaves a chart that is not lines of a named series as the author wrote it", () => {
    const bars = { ...CHART, mark: { type: "bar" } } as ChartData;
    const spec = specOf(bars);
    expect(spec.layer).toBeUndefined();
    expect(spec.mark).toEqual({ type: "bar" });
    expect(spec.encoding.color.sort).toBeNull();
  });
});
