// Where every stop is drawn (spec M3P4.2).
//
// A line is a region — one band each, in the order the regions first appear, which is
// regions.yaml's order because the weave sorts by region position (M2P1.3). A column is a stop's
// depth in this route's *needs*: the board's "stops at the same distance can be done in any
// order". Pure: the same route gives the same geometry, and the tests read it directly.

import type { RegionOut, RouteOut } from "../api/schema";

export const COLUMN = 210; // x between depths
export const ROW = 46; // y between rows inside a band
export const PAD = 54; // space above and below a band's rows
export const MARGIN = 110; // left and right margin, for the titles

export interface Placed {
  id: string;
  x: number;
  y: number;
  depth: number;
  goal: boolean;
}

export interface Band {
  region: RegionOut;
  y: number;
  height: number;
  stops: string[];
}

export interface Layout {
  width: number;
  height: number;
  bands: Band[];
  stops: Placed[];
  /** The thick line paths, one per band, each ending at the goal. */
  runs: string[];
  /** The thin paths for a need that crosses bands. */
  links: string[];
  /** What each stop needs, on this route only. */
  needs: Map<string, string[]>;
  /** What each stop unlocks: the stops that need it. */
  unlocks: Map<string, string[]>;
}

/** `needed_by` says who needs me; the map wants the other direction as well. */
function relations(route: RouteOut): {
  needs: Map<string, string[]>;
  unlocks: Map<string, string[]>;
} {
  const needs = new Map(route.stops.map((stop) => [stop.id, [] as string[]]));
  const unlocks = new Map(route.stops.map((stop) => [stop.id, [] as string[]]));
  for (const stop of route.stops) {
    for (const needing of stop.needed_by) {
      needs.get(needing.id)?.push(stop.id);
      unlocks.get(stop.id)?.push(needing.id);
    }
  }
  return { needs, unlocks };
}

/** Longest path, so a stop sits one column past the deepest thing it needs. */
function depths(route: RouteOut, needs: Map<string, string[]>): Map<string, number> {
  const depth = new Map<string, number>();
  const walk = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    // The route is acyclic (the weaver refuses a cycle), so this recursion terminates.
    const mine = (needs.get(id) ?? []).reduce(
      (deepest, need) => Math.max(deepest, walk(need) + 1),
      0,
    );
    depth.set(id, mine);
    return mine;
  };
  for (const stop of route.stops) walk(stop.id);
  return depth;
}

/** A horizontal run, then a 45° elbow into the next row — the board's own geometry. */
export function elbow(x1: number, y1: number, x2: number, y2: number): string {
  if (y1 === y2) return `M ${x1} ${y1} H ${x2}`;
  const turn = x2 - Math.abs(y2 - y1);
  return turn > x1 ? `M ${x1} ${y1} H ${turn} L ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
}

function joined(points: { x: number; y: number }[]): string {
  const first = points[0];
  if (first === undefined) return "";
  let path = `M ${first.x} ${first.y}`;
  let from = first;
  for (const point of points.slice(1)) {
    path +=
      point.y === from.y
        ? ` H ${point.x}`
        : elbow(from.x, from.y, point.x, point.y).slice(`M ${from.x} ${from.y}`.length);
    from = point;
  }
  return path;
}

export function layout(route: RouteOut): Layout {
  const { needs, unlocks } = relations(route);
  const depth = depths(route, needs);
  const goals = new Set(route.goals);

  // One band per region, in the order the regions first appear in the route (M2P1.3).
  const regions: RegionOut[] = [];
  for (const stop of route.stops) {
    if (!regions.some((region) => region.id === stop.region.id)) regions.push(stop.region);
  }

  const bands: Band[] = [];
  const stops: Placed[] = [];
  let y = 0;

  for (const region of regions) {
    const mine = route.stops.filter((stop) => stop.region.id === region.id);
    const rows = new Map<number, number>(); // depth → how many are already there
    let tallest = 1;
    for (const stop of mine) {
      const column = depth.get(stop.id) ?? 0;
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      tallest = Math.max(tallest, row + 1);
    }
    const height = PAD * 2 + (tallest - 1) * ROW;
    const taken = new Map<number, number>();
    const placed: Placed[] = [];
    for (const stop of mine) {
      const column = depth.get(stop.id) ?? 0;
      const row = taken.get(column) ?? 0;
      taken.set(column, row + 1);
      placed.push({
        id: stop.id,
        x: MARGIN + column * COLUMN,
        y: y + PAD + row * ROW,
        depth: column,
        goal: goals.has(stop.id),
      });
    }
    bands.push({ region, y, height, stops: placed.map((stop) => stop.id) });
    stops.push(...placed);
    y += height;
  }

  const where = new Map(stops.map((stop) => [stop.id, stop]));
  const goal = stops.find((stop) => stop.goal) ?? stops[stops.length - 1];

  // Every line ends at the goal: a band runs along its own row, then on to it.
  //
  // Only the band's first row is on the run. A stop sharing a column with another sits on a lower
  // row, and is reached by the thin link from what it needs — the board's "thin lines are extra
  // needs" — rather than by bending the line vertically, which a metro line never does.
  const runs = bands.map((band) => {
    const points = band.stops
      .map((id) => where.get(id))
      .filter((stop): stop is Placed => stop !== undefined && stop.y === band.y + PAD)
      .sort((left, right) => left.x - right.x);
    const last = points[points.length - 1];
    const whole =
      goal === undefined || (last !== undefined && last.id === goal.id)
        ? points
        : [...points, goal];
    return joined(whole);
  });

  const links: string[] = [];
  for (const [id, needed] of needs) {
    const stop = where.get(id);
    for (const need of needed) {
      const from = where.get(need);
      if (stop === undefined || from === undefined || from.y === stop.y) continue;
      links.push(elbow(from.x, from.y, stop.x, stop.y));
    }
  }
  // A stop on a lower row with nothing to link it — everything it needs shares its row — would
  // float free of its line, so it is joined to the run it belongs to.
  for (const band of bands) {
    for (const id of band.stops) {
      const stop = where.get(id);
      if (stop === undefined || stop.y === band.y + PAD) continue;
      const linked = (needs.get(id) ?? []).some((need) => where.get(need)?.y !== stop.y);
      if (!linked) links.push(elbow(stop.x - COLUMN / 2, band.y + PAD, stop.x, stop.y));
    }
  }

  const width = MARGIN * 2 + Math.max(...stops.map((stop) => stop.depth), 0) * COLUMN;
  return { width, height: y, bands, stops, runs, links, needs, unlocks };
}
