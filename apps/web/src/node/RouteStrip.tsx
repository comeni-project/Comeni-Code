// Where this node sits on the route it was opened from (L5's strip, M3P5.4).
//
// The route comes from the URL, as on the Route page, and through the same cached query. The
// board's question count and progress bar need learner records (T7), so they are not drawn.
import { Link } from "react-router";
import type { RouteOut } from "../api/schema";

export function RouteStrip({
  id,
  goals,
  known,
  route,
  big = false,
}: {
  id: string;
  goals: string[];
  known: string[];
  route: RouteOut | undefined;
  big?: boolean;
}) {
  const back = new URLSearchParams();
  for (const goal of goals) back.append("goal", goal);
  for (const topic of known) back.append("known", topic);

  const titles = new Map(route?.stops.map((stop) => [stop.id, stop.title]));
  const aim = goals.map((goal) => titles.get(goal) ?? goal).join(", ");
  const index = route?.stops.findIndex((stop) => stop.id === id) ?? -1;
  const stop = index >= 0 ? route?.stops[index] : undefined;
  if (stop !== undefined) back.set("stop", id);
  const unlocks = (stop?.needed_by ?? []).filter((card) => titles.has(card.id));

  return (
    <section
      aria-label="Your route"
      className={`border-border border-b bg-surface text-ink-2 ${big ? "text-[15px]" : "text-[13px]"}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2.5 sm:px-9 ${big ? "min-h-[52px]" : "min-h-[46px]"}`}
      >
        {route === undefined ? (
          <span>Finding your route…</span>
        ) : stop === undefined ? (
          <span>
            Not on your route to <b className="font-semibold text-ink">{aim}</b>
          </span>
        ) : (
          <span>
            On your route to <b className="font-semibold text-ink">{aim}</b> ·{" "}
            {big && index === 0 ? (
              "the very first stop"
            ) : (
              <>
                {big ? "" : `${stop.region.name} line · `}stop {index + 1} of {route.stops.length}
              </>
            )}
            {unlocks.length > 0 && !big ? (
              <>
                {" "}
                · unlocks{" "}
                <b className="font-semibold text-ink">
                  {unlocks.map((card) => card.title).join(", ")}
                </b>
              </>
            ) : null}
          </span>
        )}
        <Link to={`/route?${back}`} className="font-medium text-sel hover:text-ink">
          Back to the route
        </Link>
      </div>
    </section>
  );
}
