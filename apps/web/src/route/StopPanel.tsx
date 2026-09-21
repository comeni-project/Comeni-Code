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
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd>
        {ids.length === 0
          ? "nothing on this route"
          : ids.map((id) => titles.get(id) ?? id).join(", ")}
      </dd>
    </>
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
      <aside className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-[18px]">
        <h2 className="text-[12px] font-medium text-ink-3">Selected stop</h2>
        <p className="text-[14px] text-ink-2">
          Pick a stop to see why it's on your route, what it needs and what it unlocks.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-[18px]">
      <span className="text-[12px] font-medium text-ink-3">Selected stop</span>
      <h2 className="text-[20px] leading-tight font-semibold">{stop.title}</h2>
      <p className="text-[14px] leading-normal">{stop.claim}</p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
        <dt className="text-ink-3">Level</dt>
        <dd>{shownLevel(stop.level)}</dd>
        <dt className="text-ink-3">Time</dt>
        <dd>{stop.minutes} min</dd>
        <Names label="Needs" ids={drawn.needs.get(stop.id) ?? []} titles={titles} />
        <Names label="Unlocks" ids={drawn.unlocks.get(stop.id) ?? []} titles={titles} />
      </dl>

      <div className="flex flex-col gap-1.5 rounded-[9px] bg-line-soft px-3 py-2.5">
        <span className="text-[12px] font-semibold">Why it's on this route</span>
        {stop.needed_by.length === 0 ? (
          <p className="text-[13px] text-ink-2">
            It is your goal — the route is built back from it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stop.needed_by.map((needing) => (
              <li key={needing.id} className="flex flex-col gap-0.5">
                <span className="text-[12px] font-medium text-ink-2">{needing.title} needs it</span>
                <span className="text-[13px] text-ink">{needing.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href={`/node/${stop.id}`}
        className="self-start rounded-[9px] border border-border-2 bg-surface px-3.5 py-[7px] text-[13px] font-medium hover:border-sel"
      >
        Open page
      </a>
    </aside>
  );
}
