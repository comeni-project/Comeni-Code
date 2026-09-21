// @vitest-environment node
// The map's geometry, against the route the API really answers (spec M3P4R.2, M3P4.5).
import { describe, expect, it } from "vitest";
import { COLUMN, type Layout, layout, ROW, wrapTitle } from "./layout";
import { SALMON, SALMON_KNOWN } from "./salmon.fixture";

const at = (drawn: Layout) => new Map(drawn.stops.map((stop) => [stop.id, stop]));
const laneOf = (drawn: Layout) => new Map(drawn.lines.map((line) => [line.region.id, line.lane]));

type Point = { x: number; y: number };

/** The corners a path passes through: `M x y`, `H x` and `L x y` only. */
function corners(path: string): Point[] {
  const points: Point[] = [];
  for (const [, command, a, b] of path.matchAll(/([MHL]) (-?[\d.]+)(?: (-?[\d.]+))?/g)) {
    const last = points[points.length - 1];
    if (command === "H") points.push({ x: Number(a), y: last?.y ?? 0 });
    else points.push({ x: Number(a), y: Number(b) });
  }
  return points;
}

const hops = (path: string) => {
  const points = corners(path);
  return points.slice(1).map((to, index) => ({ from: points[index] as Point, to }));
};

describe("where the stops go", () => {
  it("draws every stop once, on a line per region the route touches", () => {
    const drawn = layout(SALMON);
    expect(drawn.stops).toHaveLength(17);
    // Algorithms is not on this route: de Bruijn graphs sits below it (M1P4.2).
    expect(drawn.lines.map((line) => line.region.id)).toEqual([
      "molecular-biology",
      "sequencing",
      "sequence-analysis",
      "statistics",
      "transcriptomics",
    ]);
    expect(drawn.lines.flatMap((line) => line.stops)).toHaveLength(17);
  });

  it("never draws a stop left of something it needs", () => {
    const drawn = layout(SALMON);
    const placed = at(drawn);
    for (const [id, needed] of drawn.needs) {
      for (const need of needed) {
        expect(placed.get(need)?.x).toBeLessThan(placed.get(id)?.x ?? 0);
      }
    }
  });

  it("puts a stop one column past the deepest thing it needs", () => {
    const drawn = layout(SALMON);
    const placed = at(drawn);
    for (const [id, needed] of drawn.needs) {
      if (needed.length === 0) continue;
      const deepest = Math.max(...needed.map((need) => placed.get(need)?.depth ?? 0));
      expect(placed.get(id)?.depth).toBe(deepest + 1);
      expect(placed.get(id)?.x).toBe((deepest + 1) * COLUMN);
    }
  });

  it("puts the goal last, in the middle, on the middle line", () => {
    const drawn = layout(SALMON);
    const goals = drawn.stops.filter((stop) => stop.goal);
    expect(goals.map((stop) => stop.id)).toEqual(["salmon"]);
    expect(goals[0]?.y).toBe(0);
    expect(Math.max(...drawn.stops.map((stop) => stop.x))).toBe(goals[0]?.x);
    expect(laneOf(drawn).get("transcriptomics")).toBe(0);
  });

  it("puts the other lines around it in the order that keeps needs between lines shortest", () => {
    const drawn = layout(SALMON);
    const lanes = laneOf(drawn);
    expect(Object.fromEntries(lanes)).toEqual({
      "molecular-biology": -1,
      sequencing: 1,
      "sequence-analysis": -2,
      statistics: 2,
      transcriptomics: 0,
    });

    // No other order does better.
    const region = new Map(SALMON.stops.map((stop) => [stop.id, stop.region.id]));
    const crossings: [string, string][] = [];
    for (const [id, needed] of drawn.needs) {
      if (id === "salmon") continue;
      for (const need of needed) {
        const [from, to] = [region.get(need) ?? "", region.get(id) ?? ""];
        if (from !== to) crossings.push([from, to]);
      }
    }
    const cost = (lane: Map<string, number>) =>
      crossings.reduce((sum, [a, b]) => sum + Math.abs((lane.get(a) ?? 0) - (lane.get(b) ?? 0)), 0);
    const others = ["molecular-biology", "sequencing", "sequence-analysis", "statistics"];
    const orders = (rest: string[]): string[][] =>
      rest.length === 0
        ? [[]]
        : rest.flatMap((first, index) =>
            orders([...rest.slice(0, index), ...rest.slice(index + 1)]).map((tail) => [
              first,
              ...tail,
            ]),
          );
    const slots = [-1, 1, -2, 2];
    for (const order of orders(others)) {
      const lane = new Map<string, number>(order.map((id, index) => [id, slots[index] ?? 0]));
      expect(cost(lane)).toBeGreaterThanOrEqual(cost(lanes));
    }
  });

  it("gives a second stop in one column its own row, further out", () => {
    const placed = at(layout(SALMON));
    // Sequence analysis runs above the middle, so further out is further up.
    expect(placed.get("sequence-alignment")?.y).toBe((placed.get("k-mers")?.y ?? 0) - ROW);
    expect(placed.get("sequence-alignment")?.x).toBe(placed.get("k-mers")?.x);
  });

  it("marks where lines meet", () => {
    const placed = at(layout(SALMON));
    expect(placed.get("dna-and-genes")?.meets).toBe(true);
    expect(placed.get("read-mapping")?.meets).toBe(true);
    expect(placed.get("likelihood")?.meets).toBe(false);
  });

  it("labels a stop on the side away from the middle", () => {
    const drawn = layout(SALMON);
    const lanes = laneOf(drawn);
    const region = new Map(SALMON.stops.map((stop) => [stop.id, stop.region.id]));
    for (const stop of drawn.stops) {
      const lane = lanes.get(region.get(stop.id) ?? "") ?? 0;
      const expected = stop.goal ? "right" : lane > 0 ? "below" : "above";
      expect(stop.label, stop.id).toBe(expected);
    }
  });

  it("lays out the shortened route when something is known", () => {
    const drawn = layout(SALMON_KNOWN);
    expect(drawn.stops).toHaveLength(14);
    expect(drawn.stops.map((stop) => stop.id)).not.toContain("k-mers");
  });

  it("is the same geometry twice", () => {
    expect(layout(SALMON)).toEqual(layout(SALMON));
  });

  it("draws nothing for an empty route", () => {
    const drawn = layout({ ...SALMON, stops: [], goals: [], minutes: 0 });
    expect(drawn.stops).toEqual([]);
    expect(drawn.lines).toEqual([]);
    expect(drawn.box.width).toBeGreaterThan(0);
  });

  it("knows what each stop unlocks", () => {
    const drawn = layout(SALMON);
    expect(drawn.unlocks.get("read-mapping")).toContain("multi-mapping-reads");
    expect(drawn.unlocks.get("salmon")).toEqual([]);
  });
});

describe("the lines", () => {
  it("run level or at 45°, and nothing else", () => {
    for (const run of layout(SALMON).runs) {
      for (const { from, to } of hops(run)) {
        const [dx, dy] = [Math.abs(to.x - from.x), Math.abs(to.y - from.y)];
        expect(dy === 0 || dx === dy, `${run}`).toBe(true);
        expect(to.x).toBeGreaterThanOrEqual(from.x);
      }
    }
  });

  it("all end at the goal", () => {
    const drawn = layout(SALMON);
    const goal = at(drawn).get("salmon");
    expect(drawn.runs).toHaveLength(drawn.lines.length);
    for (const run of drawn.runs) expect(corners(run).at(-1)).toEqual({ x: goal?.x, y: goal?.y });
  });

  it("start where they branch", () => {
    const drawn = layout(SALMON);
    const placed = at(drawn);
    const start = (region: string) =>
      corners(drawn.runs[drawn.lines.findIndex((line) => line.region.id === region)] ?? "")[0];
    const point = (id: string) => ({ x: placed.get(id)?.x, y: placed.get(id)?.y });
    expect(start("sequencing")).toEqual(point("dna-and-genes"));
    expect(start("sequence-analysis")).toEqual(point("dna-and-genes"));
    expect(start("transcriptomics")).toEqual(point("transcripts-and-isoforms"));
    expect(start("statistics")).toEqual(point("probability"));
    expect(start("molecular-biology")).toEqual(point("dna-and-genes"));
  });
});

describe("the thin connectors", () => {
  it("each arrive at a stop that needs the stop they leave", () => {
    const drawn = layout(SALMON);
    const byPoint = new Map(drawn.stops.map((stop) => [`${stop.x} ${stop.y}`, stop.id]));
    expect(drawn.links.length).toBeGreaterThan(0);
    for (const link of drawn.links) {
      const points = corners(link);
      const from = byPoint.get(`${points[0]?.x} ${points[0]?.y}`) ?? "";
      const to = byPoint.get(`${points.at(-1)?.x} ${points.at(-1)?.y}`) ?? "";
      expect(drawn.needs.get(to), link).toContain(from);
    }
  });

  it("turn in at the stop, not before it", () => {
    for (const link of layout(SALMON).links) {
      const last = hops(link).at(-1);
      if (last === undefined) continue;
      // The last hop is the turn itself, unless the connector never leaves its row.
      const level = corners(link).every((point) => point.y === last.to.y);
      expect(level || last.from.y !== last.to.y, link).toBe(true);
    }
  });

  it("run steeper than 45° only where 45° cannot fit", () => {
    for (const link of layout(SALMON).links) {
      for (const { from, to } of hops(link)) {
        const [dx, dy] = [Math.abs(to.x - from.x), Math.abs(to.y - from.y)];
        if (dy > dx) {
          const points = corners(link);
          const [first, last] = [points[0] as Point, points.at(-1) as Point];
          expect(Math.abs(last.y - first.y), link).toBeGreaterThan(last.x - first.x);
        }
      }
    }
  });

  it("reach a stop on a row of its own", () => {
    const drawn = layout(SALMON);
    const alignment = at(drawn).get("sequence-alignment");
    const reaching = drawn.links.filter((link) => link.endsWith(`${alignment?.x} ${alignment?.y}`));
    expect(reaching.length).toBeGreaterThan(0);
  });
});

describe("a title on the map", () => {
  it("wraps at about twenty characters", () => {
    expect(wrapTitle("Reads that map to several places")).toEqual([
      "Reads that map to",
      "several places",
    ]);
    expect(wrapTitle("k-mers")).toEqual(["k-mers"]);
  });
});
