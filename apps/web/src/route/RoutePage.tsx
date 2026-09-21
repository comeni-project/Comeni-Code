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
    <section className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-panel border border-border bg-surface px-5 py-4">
      <div className="flex min-w-44 flex-col">
        <span className="text-[22px] font-semibold">{shownStops(route.stops.length)}</span>
        <span className="text-[13px] text-ink-2">{shownTime(route.minutes)}</span>
      </div>
      <ul className="flex flex-1 flex-wrap gap-x-6 gap-y-3 border-border border-l pl-6">
        {lines.map((line) => (
          <li key={line.region.id} className="flex min-w-36 flex-col gap-1.5">
            <span className="flex justify-between gap-3 text-[12.5px]">
              <span className="font-semibold">{line.region.name}</span>
              <span className="text-ink-3">{shownStops(line.stops.length)}</span>
            </span>
            <span className="flex gap-[3px]">
              {line.stops.map((id) => (
                <span key={id} className="h-1.5 flex-1 rounded-pill bg-line" />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-7 py-8">
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
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Learn {title}</h1>
                <span className="rounded-pill border border-border-2 px-3 py-0.5 text-[11.5px] text-ink-2">
                  {shownLevel(route.span.lowest)} → {shownLevel(route.span.highest)}
                </span>
              </div>
              {goalStops.map((stop) => (
                <p key={stop.id} className="max-w-3xl text-[16px] text-ink">
                  <b className="font-semibold">At the end you can</b> {stop.claim}
                </p>
              ))}
              <div className="flex gap-2 rounded-control border border-border bg-bg p-[3px] self-start">
                {(["map", "list"] as const).map((which) => (
                  <button
                    key={which}
                    type="button"
                    onClick={() => show(which)}
                    aria-pressed={view === which}
                    className={`rounded-[7px] px-3 py-1.5 text-[12.5px] ${
                      view === which ? "bg-surface font-semibold text-ink" : "text-ink-2"
                    }`}
                  >
                    {which === "map" ? "Map" : "List"}
                  </button>
                ))}
              </div>
            </section>

            <Facts route={route} />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="min-w-0 rounded-panel border border-border bg-surface px-5 py-4">
                {view === "map" ? (
                  <RouteMap route={route} selected={selected} onSelect={select} />
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
