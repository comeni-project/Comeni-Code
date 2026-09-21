// The map's other view: every stop in order, grouped by what can be done in any order (M3P4.2).
import type { RouteOut } from "../api/schema";
import { shownLevel } from "../start/format";
import { layout } from "./layout";

export function RouteList({
  route,
  selected,
  onSelect,
}: {
  route: RouteOut;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const drawn = layout(route);
  const depth = new Map(drawn.stops.map((stop) => [stop.id, stop.depth]));
  const columns = [...new Set(drawn.stops.map((stop) => stop.depth))].sort(
    (left, right) => left - right,
  );

  return (
    <ol aria-label="Every stop, in order" className="flex flex-col gap-5">
      {columns.map((column) => {
        const stops = route.stops.filter((stop) => depth.get(stop.id) === column);
        return (
          <li key={column} className="flex flex-col gap-2">
            {stops.length > 1 ? (
              <p className="font-mono text-[11px] text-ink-3">These can be done in any order</p>
            ) : null}
            <ul className="flex flex-col divide-y divide-border elevated rounded-panel border border-border bg-surface">
              {stops.map((stop) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(stop.id)}
                    aria-current={stop.id === selected ? "true" : undefined}
                    className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left ${
                      stop.id === selected ? "bg-sel-soft" : ""
                    }`}
                  >
                    <span className="flex-1 text-[15px]">{stop.title}</span>
                    {route.goals.includes(stop.id) ? (
                      <span className="rounded-pill bg-line-soft px-2 py-0.5 text-[11px] text-line">
                        your goal
                      </span>
                    ) : null}
                    <span className="font-mono text-[12px] text-ink-3">
                      {shownLevel(stop.level)} · {stop.region.name} · {stop.minutes}m
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
