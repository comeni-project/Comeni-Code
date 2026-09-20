// What can be started now, and where the lines meet (L4, M3P4.3).
//
// Both are derived from the route: "next up" is the stops nothing on this route blocks, and the
// junctions are the needs that cross from one line to another. The board's per-stop progress and
// its milestones need T7 and M6.
import type { RouteOut } from "../api/schema";
import type { Layout } from "./layout";

const MOST = 4;

export function NextUp({ route, drawn }: { route: RouteOut; drawn: Layout }) {
  const titles = new Map(route.stops.map((stop) => [stop.id, stop]));
  const ready = drawn.stops
    .filter((stop) => stop.depth === 0)
    .slice(0, MOST)
    .map((stop) => titles.get(stop.id))
    .filter((stop): stop is RouteOut["stops"][number] => stop !== undefined);

  const bands = new Map(
    drawn.bands.flatMap((band) => band.stops.map((id) => [id, band.region.name] as const)),
  );
  const junctions: string[] = [];
  for (const [id, needed] of drawn.needs) {
    for (const need of needed) {
      const from = bands.get(need);
      const to = bands.get(id);
      if (from === undefined || to === undefined || from === to) continue;
      junctions.push(`${titles.get(need)?.title} (${from}) feeds ${titles.get(id)?.title} (${to})`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[17px] font-semibold">Next up</h2>
          <span className="font-mono text-[11px] text-ink-3">
            {ready.length} can start now · any order
          </span>
        </div>
        <ul aria-label="What you can start now" className="flex flex-wrap gap-3">
          {ready.map((stop) => {
            const unlocks = drawn.unlocks.get(stop.id)?.length ?? 0;
            return (
              <li
                key={stop.id}
                className="flex min-w-56 flex-1 flex-col gap-1 rounded-panel border border-border bg-surface px-4 py-3"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">{stop.title}</span>
                  <span className="font-mono text-[12px] text-ink-3">{stop.minutes} min</span>
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {stop.region.name}
                  {unlocks > 0 ? ` · unlocks ${unlocks} stop${unlocks === 1 ? "" : "s"}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Where lines meet</h2>
        <ul className="flex flex-col gap-1">
          {junctions.map((junction) => (
            <li key={junction} className="text-[13px] text-ink-2">
              {junction}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
