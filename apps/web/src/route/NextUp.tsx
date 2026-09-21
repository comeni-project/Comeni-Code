// Where to start (L4, M3P4.3): the stops nothing on this route blocks, each with what it gives you.
//
// Derived from the route: "next up" is every stop at the first column. The board's milestones
// sit beside it once problems exist (M6); until then next up takes the whole width, and says
// in each stop's own claim what you get from starting there. Picking one selects it on the map.
import type { RouteOut } from "../api/schema";
import type { Layout } from "./layout";

const MOST = 4;

export function NextUp({
  route,
  drawn,
  onSelect,
}: {
  route: RouteOut;
  drawn: Layout;
  onSelect: (id: string) => void;
}) {
  const stops = new Map(route.stops.map((stop) => [stop.id, stop]));
  const ready = drawn.stops
    .filter((stop) => stop.depth === 0)
    .slice(0, MOST)
    .map((stop) => stops.get(stop.id))
    .filter((stop): stop is RouteOut["stops"][number] => stop !== undefined);

  return (
    <section className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface px-5 py-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Next up</h2>
        <span className="text-[12px] text-ink-3">{ready.length} can start now · any order</span>
      </div>
      <ul
        aria-label="What you can start now"
        className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]"
      >
        {ready.map((stop) => {
          const unlocks = drawn.unlocks.get(stop.id)?.length ?? 0;
          return (
            <li key={stop.id} className="flex">
              <button
                type="button"
                onClick={() => onSelect(stop.id)}
                className="flex w-full flex-col gap-1.5 rounded-[10px] border border-border bg-surface px-3.5 py-3 text-left hover:border-sel"
              >
                <span className="flex justify-between gap-2">
                  <span className="text-[14px] font-semibold">{stop.title}</span>
                  <span className="shrink-0 font-mono text-[11.5px] text-ink-3">
                    {stop.minutes} min
                  </span>
                </span>
                <span className="text-[13px] leading-snug text-ink-2">{stop.claim}</span>
                <span className="text-[12px] text-ink-3">
                  {stop.region.name}
                  {unlocks > 0 ? ` · unlocks ${unlocks} stop${unlocks === 1 ? "" : "s"}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
