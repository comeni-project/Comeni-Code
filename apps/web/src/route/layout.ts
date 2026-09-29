// Where every stop is drawn (spec M3P4R.2, amending M3P4.2).
//
// The canvas's metro map: a line per region, a column per depth in this route's *needs*. The
// goal's line runs through the middle; the others sit above and below it in the order that keeps
// needs between lines shortest, leave the stop they branch from at 45°, run level, and turn in
// to meet at the goal. Pure: the same route gives the same geometry, and the tests read it.

import type { RegionOut, RouteOut } from "../api/schema";

export const COLUMN = 230; // x between depths, at the least: a gap widens to fit its climbs
export const LANE = 100; // y between neighbouring lines
export const ROW = 92; // y to a second stop in one column of one line, further out
export const LEAD = 70; // how far a branching line runs level before it turns out
/** The least level run a 45° climb leaves before it turns, so it never starts inside a mark. */
export const TURN = 30;
/** How much a gap beside a crowded label widens per round, and how many rounds are tried. */
export const WIDEN = 60;
const MOST_WIDENINGS = 10;
/** Past this many lines besides the goal's, trying every order costs too much. */
export const MOST_ORDERED = 7;
const MARGIN = { left: 130, right: 60, top: 90, bottom: 90 };
/** The goal's name: mono at 20 map units, wrapped at this many characters. */
export const GOAL_WRAP = 16;
/** How wide one mono character of it is, with a little to spare. */
export const GOAL_CHAR = 12.5;
const GOAL_GAP = 26; // from the goal's centre to its name

/** A stop's label, in map units: RouteMap draws it from these, and `labelBox` measures it. */
export const LABEL = {
  name: 17, // a stop's title
  meta: 14, // its minutes
  leading: 19,
  above: 44, // from the stop to the baseline of a name's last line, when the label is above
  metaAbove: 26, // …and to the minutes' baseline
  below: 36, // from the stop to the baseline of a name's first line, when it is below
  goalName: 20,
  goalLeading: 22,
  halo: 3, // half the halo's stroke
  nudge: 4, // how far past the stop a label aligned to its start or end begins
} as const;
/** How wide one character is, with a little to spare: Lexend at 17, Geist Mono at 14. */
const NAME_CHAR = 10;
const META_CHAR = 8.6;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a stop's label is drawn, as a box around its text and halo. */
export function labelBox(placed: Placed, title: string, minutes: number): Box {
  const { x, y } = placed;
  const pad = LABEL.halo;
  if (placed.label === "right") {
    const lines = wrapTitle(title, GOAL_WRAP);
    const width = Math.max(...lines.map((line) => line.length), 9) * GOAL_CHAR;
    const top = y - 2 - (lines.length - 1) * LABEL.goalLeading - LABEL.goalName * 0.75;
    return {
      x: x + GOAL_GAP - pad,
      y: top - pad,
      width: width + 2 * pad,
      height: y + 22 - top + 2 * pad,
    };
  }
  const lines = wrapTitle(title);
  const width = Math.max(
    Math.max(...lines.map((line) => line.length)) * NAME_CHAR,
    `${minutes} min`.length * META_CHAR,
  );
  const [top, bottom] =
    placed.label === "below"
      ? [y + LABEL.below - LABEL.name * 0.75, y + LABEL.below + lines.length * LABEL.leading + 4]
      : [
          y - LABEL.above - (lines.length - 1) * LABEL.leading - LABEL.name * 0.75,
          y - LABEL.metaAbove + 4,
        ];
  const left =
    placed.align === "start"
      ? x - LABEL.nudge
      : placed.align === "end"
        ? x + LABEL.nudge - width
        : x - width / 2;
  return { x: left - pad, y: top - pad, width: width + 2 * pad, height: bottom - top + 2 * pad };
}

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
  /** Centred on the stop, or starting or ending at it: aligned away from lines that arrive. */
  align: "middle" | "start" | "end";
}

export interface Line {
  region: RegionOut;
  /** 0 is the goal's line; negative lanes are above it, positive below. */
  lane: number;
  stops: string[];
  /** Its thick line; none when every stop on it is a goal, which the goal's mark draws. */
  run: string | null;
}

export interface Layout {
  box: { x: number; y: number; width: number; height: number };
  /** In route order, which is regions.yaml's order (M2P1.3). */
  lines: Line[];
  stops: Placed[];
  /** The thick lines, in line order, each ending at a goal. */
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

interface Hop {
  from: string;
  to: string;
  /** A branch turning out at once, rather than a line or connector turning in at the stop. */
  early: boolean;
}

/** Points along a path every few units, for testing what it passes through. */
function sampled(path: string): Point[] {
  const corners: Point[] = [];
  for (const [, command, a, b] of path.matchAll(/([MHL]) (-?[\d.]+)(?: (-?[\d.]+))?/g)) {
    const last = corners[corners.length - 1];
    corners.push(
      command === "H" ? { x: Number(a), y: last?.y ?? 0 } : { x: Number(a), y: Number(b) },
    );
  }
  return corners.slice(1).flatMap((to, index) => {
    const from = corners[index] as Point;
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4);
    return Array.from({ length: steps }, (_, k) => ({
      x: from.x + ((to.x - from.x) * k) / steps,
      y: from.y + ((to.y - from.y) * k) / steps,
    }));
  });
}

const within = (point: Point, box: Box) =>
  point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height;
const touches = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const markBox = (mark: Point): Box => ({ x: mark.x - 10, y: mark.y - 10, width: 20, height: 20 });

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
  const yOf = new Map(
    route.stops.map((stop) => {
      const region = stop.region.id;
      return [stop.id, (laneY.get(region) ?? 0) + outward(region) * (row.get(stop.id) ?? 0) * ROW];
    }),
  );
  const y = (id: string) => yOf.get(id) as number;

  // The thick lines: from where each branches, along its first row, to the goal — or to its own
  // last stop when that is a goal too. A line whose stops are all goals draws nothing (issue 77).
  const carried = new Set<string>(); // "need>stop" pairs a thick line draws
  const meets = new Set<string>();
  const chains = regions.map((region): Hop[] | null => {
    const mine = route.stops.filter((stop) => stop.region.id === region.id).map((stop) => stop.id);
    if (mine.every((id) => goals.has(id))) return null;
    const on = mine.filter((id) => row.get(id) === 0).sort((a, b) => column(a) - column(b));
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
    if (!goals.has(chain[chain.length - 1] as string)) chain.push(anchor);
    if (branch !== undefined) meets.add(branch);
    return chain.slice(1).map((to, index) => {
      const from = chain[index] as string;
      carried.add(`${from}>${to}`);
      return { from, to, early: index === 0 && branch !== undefined };
    });
  });

  // The thin connectors: every need no thick line carries, arriving at the stop that needs it.
  const connectors: Hop[] = [];
  for (const stop of route.stops) {
    for (const need of needs.get(stop.id) ?? []) {
      if (carried.has(`${need}>${stop.id}`)) continue;
      if (y(need) === y(stop.id) && (regionOf.get(need) === stop.region.id || stop.id === anchor))
        continue;
      connectors.push({ from: need, to: stop.id, early: false });
      meets.add(need);
      meets.add(stop.id);
    }
  }

  // Columns: each gap as wide as the 45° climbs made in it need, and never under COLUMN. A line
  // turns in during the gap before the stop it reaches, and a branch turns out in the gap after
  // the stop it leaves. Then the labels are placed; a column whose label no side keeps clear
  // widens the gaps beside it, and the map is drawn again (issue 77).
  const deepest = Math.max(...route.stops.map((stop) => column(stop.id)));
  const gaps = Array.from({ length: deepest }, () => COLUMN);
  for (const hop of [...chains.flatMap((chain) => chain ?? []), ...connectors]) {
    const rise = Math.abs(y(hop.to) - y(hop.from));
    if (rise === 0) continue;
    const at = hop.early ? column(hop.from) : column(hop.to) - 1;
    gaps[at] = Math.max(gaps[at] ?? COLUMN, rise + TURN);
  }
  let drawn = draw(gaps);
  for (let round = 0; round < MOST_WIDENINGS && drawn.crowded.size > 0; round++) {
    for (const depth of drawn.crowded) {
      for (const at of [depth - 1, depth]) {
        const width = gaps[at];
        if (width !== undefined) gaps[at] = width + WIDEN;
      }
    }
    drawn = draw(gaps);
  }
  const { runsByLine, runs, links, stops, box } = drawn;

  function draw(widths: number[]) {
    const columnX = [0];
    for (const width of widths) columnX.push((columnX[columnX.length - 1] as number) + width);
    const at = (id: string): Point => ({ x: columnX[column(id)] as number, y: y(id) });
    const runsByLine = chains.map((chain) => {
      if (chain === null || chain.length === 0) return null;
      const start = at(chain[0]?.from as string);
      return chain.reduce(
        (path, hop) => path + elbow(at(hop.from), at(hop.to), hop.early).replace(/^M \S+ \S+/, ""),
        `M ${start.x} ${start.y}`,
      );
    });
    const runs = runsByLine.filter((run): run is string => run !== null);
    const links = connectors.map((hop) => elbow(at(hop.from), at(hop.to)));

    // Labels: centred away from the middle, unless a line crosses there; then the other side, or
    // aligned to one side of the stop, away from where lines arrive. Decided in route order, each
    // against every path and the labels already placed.
    const points = [...runs, ...links].flatMap(sampled);
    const decided: Box[] = [];
    const crowded = new Set<number>();
    const marks = route.stops.map((stop) => ({ ...at(stop.id), id: stop.id }));
    const stops: Placed[] = route.stops.map((stop) => {
      const base = {
        id: stop.id,
        ...at(stop.id),
        depth: column(stop.id),
        goal: goals.has(stop.id),
        meets: meets.has(stop.id),
      };
      const away: Placed["label"] =
        stop.id === anchor ? "right" : laneOf(stop.id) > 0 ? "below" : "above";
      const other = away === "above" ? "below" : "above";
      type Side = Pick<Placed, "label" | "align">;
      const sides: Side[] =
        away === "right"
          ? [{ label: "right", align: "start" }]
          : [
              { label: away, align: "middle" },
              { label: other, align: "middle" },
              { label: away, align: "start" },
              { label: away, align: "end" },
              { label: other, align: "start" },
              { label: other, align: "end" },
            ];
      const cost = (side: Side) => {
        const box = labelBox({ ...base, ...side }, stop.title, stop.minutes);
        const crossed = points.filter((point) => within(point, box)).length;
        const clashes =
          decided.filter((placed) => touches(box, placed)).length +
          marks.filter((mark) => mark.id !== stop.id && touches(box, markBox(mark))).length;
        return crossed + 1000 * clashes;
      };
      const scored = sides.map((side) => ({ side, cost: cost(side) }));
      const best = scored.reduce((a, b) => (b.cost < a.cost ? b : a));
      if (best.cost > 0) crowded.add(base.depth);
      const placed = { ...base, ...best.side };
      decided.push(labelBox(placed, stop.title, stop.minutes));
      return placed;
    });

    // The box holds every stop and every label, with the margins the canvas leaves.
    const xs = stops.flatMap((stop) => [stop.x - MARGIN.left, stop.x + MARGIN.right]);
    const ys = stops.flatMap((stop) => [stop.y - MARGIN.top, stop.y + MARGIN.bottom]);
    for (const label of decided) {
      xs.push(label.x - 12, label.x + label.width + 12);
      ys.push(label.y - 12, label.y + label.height + 12);
    }
    const [left, top] = [Math.min(...xs), Math.min(...ys)];
    const box = { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
    return { runsByLine, runs, links, stops, box, crowded };
  }

  const lines: Line[] = regions.map((region, index) => ({
    region,
    lane: lane.get(region.id) ?? 0,
    stops: route.stops.filter((stop) => stop.region.id === region.id).map((stop) => stop.id),
    run: runsByLine[index] ?? null,
  }));

  return { box, lines, stops, runs, links, needs, unlocks };
}
