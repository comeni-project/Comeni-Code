// The selected stop, explained without leaving the route — the roadmap.sh pattern (L4, M3P4.3).
//
// Everything here is stored content: the claim, the level and the time from the node, the needs
// and unlocks from this route's own links, and the reasons from the links themselves (M2P2.2).
// What the board also shows — questions answered, the problem that proves it, "in progress" —
// needs learner records (T7) and problems (M6), so it is not drawn.
import { useCallback, useEffect, useRef, useState } from "react";
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

/** Whether a box that scrolls has more below what shows, so its bottom edge can fade. */
function useMoreBelow(key: string | undefined) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = useCallback(() => {
    const area = box.current;
    if (area !== null) setMore(area.scrollHeight - area.scrollTop - area.clientHeight > 2);
  }, []);
  useEffect(() => {
    // A new stop brings new content to measure; with none selected there is nothing to fade.
    if (key === undefined) return;
    check();
    const area = box.current;
    if (area === null || typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(check);
    watcher.observe(area);
    return () => watcher.disconnect();
  }, [check, key]);
  return { box, more, check };
}

// Beside the map the panel is as tall as the map; beside the list, which can be long, it is a
// card that follows the scroll instead (`follow`). Stacked on a narrow screen, it simply grows.
const PLACED = {
  beside: "lg:min-h-[26rem]",
  follow: "lg:sticky lg:top-6 lg:self-start lg:h-[min(34rem,calc(100vh-3rem))]",
};

export function StopPanel({
  route,
  drawn,
  stop,
  follow = false,
}: {
  route: RouteOut;
  drawn: Layout;
  stop: StopOut | undefined;
  follow?: boolean;
}) {
  const titles = new Map(route.stops.map((one) => [one.id, one.title]));
  const { box, more, check } = useMoreBelow(stop?.id);

  if (stop === undefined) {
    return (
      <aside
        className={`flex flex-col gap-2 self-start elevated rounded-panel border border-border bg-surface p-[18px] ${
          follow ? "lg:sticky lg:top-6" : ""
        }`}
      >
        <h2 className="text-[12px] font-medium text-ink-3">Selected stop</h2>
        <p className="text-[14px] text-ink-2">
          Pick a stop to see why it's on your route, what it needs and what it unlocks.
        </p>
      </aside>
    );
  }

  // The content sits in an inset box, so on a wide screen it adds nothing to the row's height:
  // the title and the action stay put, and only the middle scrolls, fading where there is more.
  return (
    <aside
      className={`relative elevated rounded-panel border border-border bg-surface ${
        follow ? PLACED.follow : PLACED.beside
      }`}
    >
      <div className="flex flex-col lg:absolute lg:inset-0">
        <div className="flex flex-col gap-1.5 px-[18px] pt-[18px] pb-3">
          <span className="text-[12px] font-medium text-ink-3">Selected stop</span>
          <h2 className="text-[20px] leading-tight font-semibold">{stop.title}</h2>
        </div>
        <div
          ref={box}
          onScroll={check}
          data-panel-body
          className={`flex min-h-0 flex-1 flex-col gap-3 px-[18px] pb-3 *:shrink-0 lg:overflow-y-auto ${
            more
              ? "lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-48px),transparent)]"
              : ""
          }`}
        >
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
                    <span className="text-[12px] font-medium text-ink-2">
                      {needing.title} needs it
                    </span>
                    <span className="text-[13px] text-ink">{needing.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="px-[18px] pt-2 pb-[18px]">
          <a
            href={`/node/${stop.id}`}
            className="inline-block rounded-control bg-btn px-[22px] py-2.5 text-[14px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110"
          >
            Open page
          </a>
        </div>
      </div>
    </aside>
  );
}
