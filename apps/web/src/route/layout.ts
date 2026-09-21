// Where every stop is drawn (spec M3P4R.2, amending M3P4.2).
//
// The canvas's metro map: a line per region, a column per depth in this route's *needs*. The
// goal's line runs through the middle; the others sit above and below it in the order that keeps
// needs between lines shortest, leave the stop they branch from at 45°, run level, and turn in
// to meet at the goal. Pure: the same route gives the same geometry, and the tests read it.

import type { RegionOut, RouteOut } from "../api/schema";

export const COLUMN = 230; // x between depths
export const LANE = 100; // y between neighbouring lines
export const ROW = 92; // y to a second stop in one column of one line, further out
export const LEAD = 70; // how far a branching line runs level before it turns out
/** Past this many lines besides the goal's, trying every order costs too much. */
export const MOST_ORDERED = 7;
const MARGIN = { left: 130, right: 60, top: 90, bottom: 90 };
/** The goal's name: mono at 20 map units, wrapped at this many characters. */
export const GOAL_WRAP = 16;
/** How wide one mono character of it is, with a little to spare. */
export const GOAL_CHAR = 12.5;
const GOAL_GAP = 26; // from the goal's centre to its name

export interface Point {
  x: number;
  y: number;
}

export interface Placed extends Point {
  id: string;
  depth: number;
  goal: boolean;
  /** A branch point, or a stop a thin connector leaves or reaches. */
  meets: boolean;
  label: "above" | "below" | "right";
}

export interface Line {
  region: RegionOut;
  /** 0 is the goal's line; negative lanes are above it, positive below. */
  lane: number;
  stops: string[];
}

export interface Layout {
  box: { x: number; y: number; width: number; height: number };
  /** In route order, which is regions.yaml's order (M2P1.3). */
  lines: Line[];
  stops: Placed[];
  /** The thick lines, one per line, each ending at the goal. */
  runs: string[];
  /** The thin connectors: a need no thick line carries. */
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

/**
 * From one stop to another, level and at 45° only.
 *
 * `early` leaves at once and runs level into the stop — a line branching out. Otherwise it runs
 * level first and turns in at the stop — a line meeting the goal, or a connector arriving.
 * Where the rise is more than the run, 45° cannot fit and the path goes straight.
 */
export function elbow(a: Point, b: Point, early = false): string {
  const start = `M ${a.x} ${a.y}`;
  if (a.y === b.y) return `${start} H ${b.x}`;
  const rise = Math.abs(b.y - a.y);
  if (b.x - a.x <= rise) return `${start} L ${b.x} ${b.y}`;
  if (early) {
    const lead = Math.min(LEAD, b.x - a.x - rise);
    const out = a.x + lead + rise;
    return `${start}${lead > 0 ? ` H ${a.x + lead}` : ""} L ${out} ${b.y}${out < b.x ? ` H ${b.x}` : ""}`;
  }
  return `${start} H ${b.x - rise} L ${b.x} ${b.y}`;
}

/** A stop's title in lines of about `most` characters, broken between words. */
export function wrapTitle(title: string, most = 20): string[] {
  const lines: string[] = [];
  for (const word of title.split(" ")) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= most)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Every order of `items`, the given order first. */
function orders<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((first, index) =>
    orders([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [first, ...rest]),
  );
}

/** −1, +1, −2, +2, …: outward from the middle, alternating. */
const slot = (index: number) => (index % 2 === 0 ? -(index / 2 + 1) : (index + 1) / 2);

const EMPTY: Layout["box"] = {
  x: -MARGIN.left,
  y: -MARGIN.top,
  width: MARGIN.left + MARGIN.right,
  height: MARGIN.top + MARGIN.bottom,
};

export function layout(route: RouteOut): Layout {
  const { needs, unlocks } = relations(route);
  const depth = depths(route, needs);
  const column = (id: string) => depth.get(id) ?? 0;
  const regionOf = new Map(route.stops.map((stop) => [stop.id, stop.region.id]));

  const regions: RegionOut[] = [];
  for (const stop of route.stops) {
    if (!regions.some((region) => region.id === stop.region.id)) regions.push(stop.region);
  }
  if (route.stops.length === 0) {
    return { box: EMPTY, lines: [], stops: [], runs: [], links: [], needs, unlocks };
  }

  // The goal every line runs to: the deepest one, the first named on a tie.
  const goals = new Set(route.goals);
  const anchor =
    route.stops
      .filter((stop) => goals.has(stop.id))
      .reduce<string | undefined>(
        (best, stop) => (best === undefined || column(stop.id) > column(best) ? stop.id : best),
        undefined,
      ) ?? (route.stops[route.stops.length - 1]?.id as string);
  const middle = regionOf.get(anchor) as string;

  // Lanes: the goal's line in the middle, the others in the order that keeps needs between
  // lines shortest. The first order found wins a tie, and orders are tried from route order.
  const others = regions.map((region) => region.id).filter((id) => id !== middle);
  const crossings: [string, string][] = [];
  for (const [id, needed] of needs) {
    if (id === anchor) continue;
    for (const need of needed) {
      const [from, to] = [regionOf.get(need) as string, regionOf.get(id) as string];
      if (from !== to) crossings.push([from, to]);
    }
  }
  const lanesFor = (order: string[]) =>
    new Map<string, number>([[middle, 0], ...order.map((id, index) => [id, slot(index)] as const)]);
  const cost = (lane: Map<string, number>) =>
    crossings.reduce((sum, [a, b]) => sum + Math.abs((lane.get(a) ?? 0) - (lane.get(b) ?? 0)), 0);
  let lane = lanesFor(others);
  if (others.length <= MOST_ORDERED) {
    let best = Number.POSITIVE_INFINITY;
    for (const order of orders(others)) {
      const candidate = lanesFor(order);
      const spent = cost(candidate);
      if (spent < best) [best, lane] = [spent, candidate];
    }
  }
  const laneOf = (id: string) => lane.get(regionOf.get(id) as string) ?? 0;
  // Which way is "further out" for a line: the middle line's extra rows go up.
  const outward = (region: string) => ((lane.get(region) ?? 0) > 0 ? 1 : -1);

  // Rows: the k-th stop of a line in one column sits k rows further out.
  const row = new Map<string, number>();
  const rows = new Map<string, number>(); // region → rows it needs
  for (const region of regions) {
    const taken = new Map<number, number>();
    for (const stop of route.stops.filter((each) => each.region.id === region.id)) {
      const k = taken.get(column(stop.id)) ?? 0;
      taken.set(column(stop.id), k + 1);
      row.set(stop.id, k);
      rows.set(region.id, Math.max(rows.get(region.id) ?? 1, k + 1));
    }
  }

  // Each line's y, stacked outward from the middle; a line makes room for its own extra rows.
  const laneY = new Map<string, number>([[middle, 0]]);
  for (const side of [-1, 1]) {
    const lines = regions
      .map((region) => region.id)
      .filter((id) => Math.sign(lane.get(id) ?? 0) === side)
      .sort((a, b) => Math.abs(lane.get(a) ?? 0) - Math.abs(lane.get(b) ?? 0));
    let y = 0;
    let extra = outward(middle) === side ? ((rows.get(middle) ?? 1) - 1) * ROW : 0;
    for (const id of lines) {
      y += side * (LANE + extra);
      laneY.set(id, y);
      extra = ((rows.get(id) ?? 1) - 1) * ROW;
    }
  }

  const point = new Map<string, Point>(
    route.stops.map((stop) => {
      const region = stop.region.id;
      const y = (laneY.get(region) ?? 0) + outward(region) * (row.get(stop.id) ?? 0) * ROW;
      return [stop.id, { x: column(stop.id) * COLUMN, y }];
    }),
  );
  const at = (id: string) => point.get(id) as Point;
  const hop = (from: string, to: string, early = false) =>
    elbow(at(from), at(to), early).replace(/^M \S+ \S+/, "");

  // The thick lines: from where each branches, along its first row, to the goal.
  const carried = new Set<string>(); // "need>stop" pairs a thick line draws
  const meets = new Set<string>();
  const runs = regions.map((region) => {
    const on = route.stops
      .filter((stop) => stop.region.id === region.id && row.get(stop.id) === 0)
      .map((stop) => stop.id)
      .sort((a, b) => at(a).x - at(b).x);
    const first = on[0] as string;
    const nearness = (id: string) => Math.abs(laneOf(id) - (lane.get(region.id) ?? 0));
    const branch = (needs.get(first) ?? [])
      .filter((need) => regionOf.get(need) !== region.id)
      .reduce<string | undefined>((best, need) => {
        if (best === undefined) return need;
        if (column(need) !== column(best)) return column(need) > column(best) ? need : best;
        return nearness(need) < nearness(best) ? need : best;
      }, undefined);
    const chain = [...(branch === undefined ? [] : [branch]), ...on];
    if (chain[chain.length - 1] !== anchor) chain.push(anchor);
    if (branch !== undefined) meets.add(branch);
    const start = at(chain[0] as string);
    let path = `M ${start.x} ${start.y}`;
    chain.slice(1).forEach((id, index) => {
      const from = chain[index] as string;
      carried.add(`${from}>${id}`);
      path += hop(from, id, index === 0 && branch !== undefined);
    });
    return path;
  });

  // The thin connectors: every need no thick line carries, arriving at the stop that needs it.
  const links: string[] = [];
  for (const stop of route.stops) {
    for (const need of needs.get(stop.id) ?? []) {
      if (carried.has(`${need}>${stop.id}`)) continue;
      const [from, to] = [at(need), at(stop.id)];
      if (from.y === to.y && (regionOf.get(need) === stop.region.id || stop.id === anchor))
        continue;
      links.push(elbow(from, to));
      meets.add(need);
      meets.add(stop.id);
    }
  }

  const stops: Placed[] = route.stops.map((stop) => ({
    id: stop.id,
    ...at(stop.id),
    depth: column(stop.id),
    goal: goals.has(stop.id),
    meets: meets.has(stop.id),
    label: stop.id === anchor ? "right" : laneOf(stop.id) > 0 ? "below" : "above",
  }));

  const xs = stops.map((stop) => stop.x);
  const ys = stops.map((stop) => stop.y);
  const [left, top] = [Math.min(...xs) - MARGIN.left, Math.min(...ys) - MARGIN.top];
  // The goal's name sits to its right, so the box makes room for its longest line.
  const goalTitle = route.stops.find((stop) => stop.id === anchor)?.title ?? "";
  const name = Math.max(...wrapTitle(goalTitle, GOAL_WRAP).map((line) => line.length), 9);
  const right = Math.max(
    Math.max(...xs) + MARGIN.right,
    at(anchor).x + GOAL_GAP + name * GOAL_CHAR + 24,
  );
  const box = {
    x: left,
    y: top,
    width: right - left,
    height: Math.max(...ys) + MARGIN.bottom - top,
  };

  const lines: Line[] = regions.map((region) => ({
    region,
    lane: lane.get(region.id) ?? 0,
    stops: route.stops.filter((stop) => stop.region.id === region.id).map((stop) => stop.id),
  }));

  return { box, lines, stops, runs, links, needs, unlocks };
}
