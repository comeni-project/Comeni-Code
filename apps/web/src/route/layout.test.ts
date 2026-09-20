// @vitest-environment node
// The map's geometry, against the route the API really answers (spec M3P4.2, M3P4.5).
import { describe, expect, it } from "vitest";
import { type Layout, layout } from "./layout";
import { SALMON, SALMON_KNOWN } from "./salmon.fixture";

const bandIds = (drawn: Layout) => drawn.bands.map((band) => band.region.id);
const at = (drawn: Layout) => new Map(drawn.stops.map((stop) => [stop.id, stop]));

describe("the route's geometry", () => {
  it("draws every stop once, in a band per region the route touches", () => {
    const drawn = layout(SALMON);
    expect(drawn.stops).toHaveLength(17);
    // Algorithms is not on this route: de Bruijn graphs sits below it (M1P4.2).
    expect(bandIds(drawn)).toEqual([
      "molecular-biology",
      "sequencing",
      "sequence-analysis",
      "statistics",
      "transcriptomics",
    ]);
    expect(drawn.bands.flatMap((band) => band.stops)).toHaveLength(17);
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
    }
  });

  it("starts the unblocked stops at the first column", () => {
    const drawn = layout(SALMON);
    const first = drawn.stops.filter((stop) => stop.depth === 0);
    expect(first.map((stop) => stop.id)).toContain("dna-and-genes");
    expect(new Set(first.map((stop) => stop.x)).size).toBe(1);
  });

  it("marks the goal, and draws it last", () => {
    const drawn = layout(SALMON);
    const goals = drawn.stops.filter((stop) => stop.goal);
    expect(goals.map((stop) => stop.id)).toEqual(["salmon"]);
    expect(Math.max(...drawn.stops.map((stop) => stop.x))).toBe(goals[0]?.x);
  });

  it("ends every band's run at the goal", () => {
    const drawn = layout(SALMON);
    const goal = at(drawn).get("salmon");
    expect(drawn.runs).toHaveLength(drawn.bands.length);
    for (const run of drawn.runs) {
      expect(run.endsWith(`${goal?.x} ${goal?.y}`) || run.endsWith(`H ${goal?.x}`)).toBe(true);
    }
  });

  it("links a need that crosses bands, and leaves one inside a band to the run", () => {
    const drawn = layout(SALMON);
    const placed = at(drawn);
    let crossing = 0;
    for (const [id, needed] of drawn.needs) {
      for (const need of needed) {
        if (placed.get(id)?.y !== placed.get(need)?.y) crossing += 1;
      }
    }
    expect(drawn.links).toHaveLength(crossing);
    expect(crossing).toBeGreaterThan(0);
  });

  it("gives two stops of one region at one depth their own rows", () => {
    const drawn = layout(SALMON);
    const placed = at(drawn);
    for (const band of drawn.bands) {
      const seen = new Map<number, number[]>();
      for (const id of band.stops) {
        const stop = placed.get(id);
        if (stop === undefined) continue;
        seen.set(stop.depth, [...(seen.get(stop.depth) ?? []), stop.y]);
      }
      for (const rows of seen.values()) expect(new Set(rows).size).toBe(rows.length);
    }
  });

  it("knows what each stop unlocks", () => {
    const drawn = layout(SALMON);
    expect(drawn.unlocks.get("read-mapping")).toContain("multi-mapping-reads");
    expect(drawn.unlocks.get("salmon")).toEqual([]);
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
    expect(drawn.bands).toEqual([]);
    expect(drawn.width).toBeGreaterThan(0);
  });
});

describe("the lines themselves", () => {
  it("never bends a line vertically", () => {
    // A metro line runs and turns at 45°; it does not drop straight down a column.
    for (const run of layout(SALMON).runs) {
      const points = [...run.matchAll(/L (\d+) (\d+)/g)];
      const from = [...run.matchAll(/M (\d+) (\d+)|H (\d+)/g)];
      expect(points.every((point) => point[1] !== undefined)).toBe(true);
      expect(from.length).toBeGreaterThan(0);
      expect(run).not.toMatch(/M (\d+) \d+ L \1 \d+/);
    }
  });

  it("draws the goal's own band once", () => {
    const drawn = layout(SALMON);
    const goal = at(drawn).get("salmon");
    const last = drawn.runs[drawn.runs.length - 1] ?? "";
    expect(last.endsWith(`H ${goal?.x} H ${goal?.x}`)).toBe(false);
  });

  it("joins a stop on a lower row to its line", () => {
    const drawn = layout(SALMON);
    const placed = at(drawn);
    for (const band of drawn.bands) {
      for (const id of band.stops) {
        const stop = placed.get(id);
        if (stop === undefined || stop.y === band.y + 54) continue;
        const reaches = drawn.links.some((link) => link.endsWith(`${stop.x} ${stop.y}`));
        expect(reaches, `${id} floats free of its line`).toBe(true);
      }
    }
  });
});
