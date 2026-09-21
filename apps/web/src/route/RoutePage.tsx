// The Route page (L4, spec M3P4): the woven route as a map, with the stop you picked explained.
//
// Everything is in the URL — goal, known, the selected stop and the view — so a route, a stop and
// a shortened map are each a link someone can send (M3P3.2).
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { ApiUnreachable } from "../api/client";
import { fetchRoute } from "../api/routes";
import type { RouteOut } from "../api/schema";
import { TopBar } from "../layout/TopBar";
import { shownLevel, shownStops, shownTime } from "../start/format";
import { layout } from "./layout";
import { NextUp } from "./NextUp";
import { RouteList } from "./RouteList";
import { RouteMap } from "./RouteMap";
import { StopPanel } from "./StopPanel";

const sentenceOf = (error: Error) =>
  error instanceof ApiUnreachable && error.status !== undefined
    ? error.reason
    : `Can't reach the API · ${error instanceof ApiUnreachable ? error.reason : "unexpected error"}`;

function Facts({ route }: { route: RouteOut }) {
  const lines = layout(route).lines;
  return (
    <section className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-panel border border-border bg-surface px-5 py-3.5">
      <div className="flex min-w-44 flex-col gap-0.5">
        <span className="text-[22px] font-semibold">{shownStops(route.stops.length)}</span>
        <span className="text-[13px] text-ink-2">{shownTime(route.minutes)}</span>
      </div>
      {/* Neutral bars: a full teal bar would read as done, and nothing is settled yet (T7). */}
      <ul
        data-rail
        className="flex min-w-64 flex-1 flex-wrap gap-5 sm:border-border sm:border-l sm:pl-6"
      >
        {lines.map((line) => (
          <li key={line.region.id} className="flex min-w-32 flex-1 flex-col gap-[5px]">
            <span className="flex justify-between gap-3 text-[12.5px]">
              <span className="font-semibold">{line.region.name}</span>
              <span className="shrink-0 whitespace-nowrap text-ink-3">
                {shownStops(line.stops.length)}
              </span>
            </span>
            <span className="flex gap-[3px]">
              {line.stops.map((id) => (
                <span key={id} className="h-1.5 flex-1 rounded-pill bg-border-2" />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How to read the map: the board's legend, with only the marks that exist yet. */
function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-2">
      <li>
        Every line ends at your goal. Thin lines are extra needs. Stops at the same distance can be
        done in any order.
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="20" height="20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" className="fill-surface stroke-ink" strokeWidth={2.5} />
        </svg>
        Where lines meet
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="20" height="20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" className="fill-surface stroke-ink" strokeWidth={2.5} />
          <rect x="7" y="7" width="6" height="6" className="fill-line" />
        </svg>
        Your goal
      </li>
    </ul>
  );
}

export function RoutePage() {
  const [params, setParams] = useSearchParams();
  const goals = params.getAll("goal");
  const known = params.getAll("known");
  const selected = params.get("stop");
  const view = params.get("view") === "list" ? "list" : "map";

  const query = useQuery({
    queryKey: ["route", goals.join(","), known.join(",")],
    queryFn: ({ signal }) => fetchRoute(goals, known, signal),
    enabled: goals.length > 0,
    retry: false,
  });

  function select(id: string) {
    const next = new URLSearchParams(params);
    next.set("stop", id);
    setParams(next);
  }

  function show(which: "map" | "list") {
    const next = new URLSearchParams(params);
    if (which === "map") next.delete("view");
    else next.set("view", "list");
    setParams(next);
  }

  const route = query.data;
  const goalStops = route?.stops.filter((stop) => route.goals.includes(stop.id)) ?? [];
  const title = goalStops.map((stop) => stop.title).join(", ");

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-[18px] px-4 py-6 sm:px-9">
        {goals.length === 0 ? (
          <section className="flex flex-col gap-2">
            <h1 className="text-[30px] font-semibold tracking-[-0.02em]">No goal yet</h1>
            <p className="text-[15px] text-ink-2">
              A route needs somewhere to go.{" "}
              <a className="text-sel underline" href="/">
                Start by naming what you want to learn
              </a>
              .
            </p>
          </section>
        ) : query.isPending ? (
          <p className="text-[15px] text-ink-2">Weaving your route…</p>
        ) : query.isError ? (
          <p className="rounded-control bg-open-soft px-4 py-3 text-[15px] text-open">
            {sentenceOf(query.error)}
          </p>
        ) : route === undefined ? null : (
          <>
            <section className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex flex-col gap-2">
                <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
                  <a href="/" className="hover:text-ink">
                    Home
                  </a>{" "}
                  › Your route
                </nav>
                <h1 className="text-[36px] font-semibold tracking-[-0.02em]">Learn {title}</h1>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-pill border border-border-2 bg-surface px-2.5 py-0.5 text-[11.5px] text-ink-2">
                    {shownLevel(route.span.lowest)} → {shownLevel(route.span.highest)}
                  </span>
                </div>
                {goalStops.map((stop) => (
                  <p key={stop.id} className="max-w-[70ch] text-[16px] leading-normal text-ink">
                    <b className="font-semibold">At the end you can</b> {stop.claim}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-2.5 pt-[26px]">
                <div className="flex gap-0.5 rounded-control border border-border bg-bg p-[3px]">
                  {(["map", "list"] as const).map((which) => (
                    <button
                      key={which}
                      type="button"
                      onClick={() => show(which)}
                      aria-pressed={view === which}
                      className={`rounded-[7px] px-3 py-1.5 text-[12.5px] ${
                        view === which
                          ? "bg-surface font-semibold text-ink shadow-sm"
                          : "text-ink-2"
                      }`}
                    >
                      {which === "map" ? "Map" : "List"}
                    </button>
                  ))}
                </div>
                <a
                  href="/"
                  className="rounded-control border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-medium hover:border-sel"
                >
                  Change goal
                </a>
              </div>
            </section>

            <Facts route={route} />

            <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="flex min-w-0 flex-col gap-2 rounded-panel border border-border bg-surface px-[18px] pt-3.5 pb-3">
                {view === "map" ? (
                  <>
                    {/* A short route's map is small; it sits in the middle of the room it gets. */}
                    <div className="flex flex-1 flex-col justify-center">
                      <RouteMap route={route} selected={selected} onSelect={select} />
                    </div>
                    <Legend />
                  </>
                ) : (
                  <RouteList route={route} selected={selected} onSelect={select} />
                )}
              </section>
              <StopPanel
                route={route}
                drawn={layout(route)}
                stop={route.stops.find((stop) => stop.id === selected)}
              />
            </div>

            <NextUp route={route} drawn={layout(route)} />
          </>
        )}
      </main>
    </div>
  );
}
