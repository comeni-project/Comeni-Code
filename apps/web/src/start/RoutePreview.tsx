// The Start board's second half: the route this goal would build, before committing to it (L1).
import type { RouteOut } from "../api/schema";
import { shownLevel, shownStops, shownTime } from "./format";

export function RoutePreview({ route, href }: { route: RouteOut; href: string }) {
  const goals = new Set(route.goals);
  const titles = route.stops
    .filter((stop) => goals.has(stop.id))
    .map((stop) => stop.title)
    .join(", ");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold">Your route</h2>
        <p className="text-[13px] text-ink-3">
          Built by following what each page needs, back from {titles}
        </p>
      </div>

      <ul className="flex flex-wrap gap-2 font-mono text-[12px]">
        {[
          shownStops(route.stops.length),
          shownTime(route.minutes),
          `${shownLevel(route.span.lowest)} → ${shownLevel(route.span.highest)}`,
        ].map((fact) => (
          <li key={fact} className="rounded-pill bg-exon px-3 py-1.5 text-ink-2">
            {fact}
          </li>
        ))}
      </ul>

      <ol className="flex flex-col divide-y divide-border rounded-panel border border-border bg-surface">
        {route.stops.map((stop, index) => (
          <li key={stop.id} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="w-6 shrink-0 font-mono text-[12px] text-ink-3">{index + 1}</span>
            <span className="flex-1 text-[15px]">{stop.title}</span>
            {goals.has(stop.id) ? (
              <span className="rounded-pill bg-line-soft px-2 py-0.5 text-[11px] text-line">
                your goal
              </span>
            ) : null}
            <span className="font-mono text-[12px] text-ink-3">{stop.minutes}m</span>
          </li>
        ))}
      </ol>

      <div>
        <a
          href={href}
          className="inline-block rounded-control bg-btn px-5 py-3 text-[15px] font-semibold text-btn-ink shadow-[0_2px_0_0_var(--btn-sh)] hover:brightness-110"
        >
          Start from the beginning
        </a>
      </div>
    </section>
  );
}
