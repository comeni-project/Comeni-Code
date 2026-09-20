// The selected stop, explained without leaving the route — the roadmap.sh pattern (L4, M3P4.3).
//
// Everything here is stored content: the claim, the level and the time from the node, the needs
// and unlocks from this route's own links, and the reasons from the links themselves (M2P2.2).
// What the board also shows — questions answered, the problem that proves it, "in progress" —
// needs learner records (T7) and problems (M6), so it is not drawn.
import type { RouteOut, StopOut } from "../api/schema";
import { shownLevel } from "../start/format";
import type { Layout } from "./layout";

function Names({
  label,
  ids,
  titles,
}: {
  label: string;
  ids: string[];
  titles: Map<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] text-ink-3">{label}</span>
      {ids.length === 0 ? (
        <span className="text-[13px] text-ink-2">nothing on this route</span>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {ids.map((id) => (
            <li key={id} className="text-[13px]">
              {titles.get(id) ?? id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StopPanel({
  route,
  drawn,
  stop,
}: {
  route: RouteOut;
  drawn: Layout;
  stop: StopOut | undefined;
}) {
  const titles = new Map(route.stops.map((one) => [one.id, one.title]));

  if (stop === undefined) {
    return (
      <aside className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-5 py-4">
        <h2 className="font-mono text-[11px] text-ink-3">Selected stop</h2>
        <p className="text-[14px] text-ink-2">
          Pick a stop to see why it's on your route, what it needs and what it unlocks.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 rounded-panel border border-border bg-surface px-5 py-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] text-ink-3">Selected stop</span>
        <h2 className="text-[20px] font-semibold">{stop.title}</h2>
        <p className="text-[14px] text-ink-2">{stop.claim}</p>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 border-border border-t pt-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-ink-3">Level</span>
          <span className="text-[13px]">{shownLevel(stop.level)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-ink-3">Time</span>
          <span className="text-[13px]">{stop.minutes} min</span>
        </div>
        <Names label="Needs" ids={drawn.needs.get(stop.id) ?? []} titles={titles} />
        <Names label="Unlocks" ids={drawn.unlocks.get(stop.id) ?? []} titles={titles} />
      </div>

      <div className="flex flex-col gap-2 border-border border-t pt-3">
        <span className="text-[13px] font-semibold">Why it's on this route</span>
        {stop.needed_by.length === 0 ? (
          <p className="text-[13px] text-ink-2">
            It is your goal — the route is built back from it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stop.needed_by.map((needing) => (
              <li key={needing.id} className="flex flex-col gap-0.5">
                <span className="font-mono text-[11px] text-ink-3">{needing.title} needs it</span>
                <span className="text-[13px] text-ink">{needing.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href={`/node/${stop.id}`}
        className="self-start rounded-control border border-border-2 px-4 py-2 text-[13px] font-medium hover:border-sel"
      >
        Open page
      </a>
    </aside>
  );
}
