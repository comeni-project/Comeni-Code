// The Start board's second half: the route this goal would build, before committing to it (L1).
// It is the same map the Route page draws; picking a stop opens the route with that stop chosen.
import { useNavigate } from "react-router";
import type { RouteOut } from "../api/schema";
import { RouteMap } from "../route/RouteMap";
import { shownLevel, shownStops, shownTime } from "./format";

export function RoutePreview({ route, href }: { route: RouteOut; href: string }) {
  const navigate = useNavigate();
  const goals = new Set(route.goals);
  const titles = route.stops
    .filter((stop) => goals.has(stop.id))
    .map((stop) => stop.title)
    .join(", ");

  return (
    <section className="flex flex-col gap-3 border-border border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[12px] font-medium text-ink-3">2 · Your route</h2>
        <p className="text-[12.5px] text-ink-3">
          Built by following what each page needs, back from {titles} · columns can be done in any
          order
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-[22px] gap-y-2">
        <span className="text-[26px] font-semibold tracking-[-0.02em]">
          {shownStops(route.stops.length)}
        </span>
        <span className="text-[15px] text-ink-2">{shownTime(route.minutes)}</span>
        <span className="rounded-pill border border-border-2 px-2.5 py-0.5 text-[11.5px] text-ink-2">
          {shownLevel(route.span.lowest)} → {shownLevel(route.span.highest)}
        </span>
      </div>

      <RouteMap
        route={route}
        selected={null}
        onSelect={(id) => navigate(`${href}&stop=${encodeURIComponent(id)}`)}
      />

      <div className="flex items-center justify-end gap-3.5 rounded-[10px] bg-bg px-4 py-3">
        <a
          href={href}
          className="inline-block rounded-control bg-btn px-[26px] py-2.5 text-[14.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110"
        >
          Start from the beginning
        </a>
      </div>
    </section>
  );
}
