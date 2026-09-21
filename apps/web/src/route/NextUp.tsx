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

  const lineOf = new Map(
    drawn.lines.flatMap((line) => line.stops.map((id) => [id, line.region.name] as const)),
  );
  // Each stop where another line comes in, with the stops it comes from.
  const junctions: { id: string; from: string[] }[] = [];
  for (const [id, needed] of drawn.needs) {
    const from = needed.filter((need) => lineOf.get(need) !== lineOf.get(id));
    if (from.length > 0) junctions.push({ id, from });
  }

  // The board's two cards: next up, and beside it milestones. Milestones need problems (M6), so
  // until then that place says where the lines meet.
  return (
    <div className="grid items-start gap-[18px] lg:grid-cols-2">
      <section className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface px-5 py-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Next up</h2>
          <span className="text-[12px] text-ink-3">{ready.length} can start now · any order</span>
        </div>
        <ul aria-label="What you can start now" className="grid gap-2.5 sm:grid-cols-2">
          {ready.map((stop) => {
            const unlocks = drawn.unlocks.get(stop.id)?.length ?? 0;
            return (
              <li
                key={stop.id}
                className="flex flex-col gap-1 rounded-[10px] border border-border bg-surface px-3.5 py-[11px]"
              >
                <span className="flex justify-between gap-2">
                  <span className="text-[14px] font-semibold">{stop.title}</span>
                  <span className="font-mono text-[11.5px] text-ink-3">{stop.minutes} min</span>
                </span>
                <span className="text-[12.5px] leading-snug text-ink-2">
                  {stop.region.name}
                  {unlocks > 0 ? ` · unlocks ${unlocks} stop${unlocks === 1 ? "" : "s"}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-5 py-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Where lines meet</h2>
          <span className="text-[12px] text-ink-3">
            a need that crosses from one line to another
          </span>
        </div>
        <ul className="flex flex-col">
          {junctions.map(({ id, from }) => (
            <li key={id} className="flex flex-col gap-0.5 border-border border-t py-2">
              <span className="text-[14px] font-semibold">
                {titles.get(id)?.title}{" "}
                <span className="text-[12px] font-normal text-ink-3">{lineOf.get(id)}</span>
              </span>
              <span className="text-[12.5px] text-ink-2">
                from {from.map((need) => titles.get(need)?.title).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
