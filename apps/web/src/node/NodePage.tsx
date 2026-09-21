// The Node page (L5, spec M3P5): one node, its Learn it resources and its try questions, with
// the links around it and, when it was opened from a route, where it sits on that route.
//
// Everything the page knows is in the URL: the node, and the route as goal and known (M3P5.4).
// What the board also shows — progress, review, the problem, figures, "Not yet reviewed" —
// needs learner records (T7), problems (M6) or reviewers (M4), and is not drawn.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ApiUnreachable } from "../api/client";
import { fetchNode } from "../api/nodes";
import { fetchRoute } from "../api/routes";
import type { NodeOut } from "../api/schema";
import { TopBar } from "../layout/TopBar";
import { type Around, Aside, aroundCount } from "./Aside";
import { Body } from "./Body";
import { headingsOf } from "./body";
import { withRoute } from "./embed";
import { FirstSteps } from "./FirstSteps";
import { LearnIt } from "./LearnIt";
import { RouteStrip } from "./RouteStrip";
import { LevelTag } from "./tags";

const sentenceOf = (error: Error) =>
  error instanceof ApiUnreachable && error.status !== undefined
    ? error.reason
    : `Can't reach the API · ${error instanceof ApiUnreachable ? error.reason : "unexpected error"}`;

/** The section being read: the last heading above the top quarter of the window. */
function useReading(ids: string[]) {
  const [reading, setReading] = useState<string | undefined>(ids[0]);
  const key = ids.join(" ");
  useEffect(() => {
    const wanted = key === "" ? [] : key.split(" ");
    setReading(wanted[0]);
    if (typeof IntersectionObserver === "undefined" || wanted.length === 0) return;
    const watcher = new IntersectionObserver(
      () => {
        const passed = wanted.filter((id) => {
          const top = document.getElementById(id)?.getBoundingClientRect().top;
          return top !== undefined && top < window.innerHeight / 4;
        });
        setReading(passed.at(-1) ?? wanted[0]);
      },
      { rootMargin: "0px 0px -75% 0px" },
    );
    for (const id of wanted) {
      const heading = document.getElementById(id);
      if (heading !== null) watcher.observe(heading);
    }
    return () => watcher.disconnect();
  }, [key]);
  return reading;
}

function Contents({ sections }: { sections: { id: string; text: string }[] }) {
  const reading = useReading(sections.map((section) => section.id));
  // The column stays even when empty, so the body sits in the same place on every node.
  if (sections.length === 0) return <div className="hidden lg:block" />;
  return (
    <nav aria-label="On this page" className="hidden lg:block">
      <div className="sticky top-6 flex flex-col gap-px pt-1">
        <span className="pb-2 text-[12px] font-medium text-ink-3">On this page</span>
        {sections.map((section) => {
          const here = section.id === reading;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={here ? "location" : undefined}
              className={`border-l-2 px-2.5 py-[5px] text-[13px] leading-[1.25] ${
                here
                  ? "border-line font-semibold text-ink"
                  : "border-border text-ink-2 hover:text-ink"
              }`}
            >
              {section.text}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function Needs({ node, goals, known }: { node: NodeOut; goals: string[]; known: string[] }) {
  if (node.needs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="needs" className="mr-1 text-[13px] font-semibold">
        Before this, all of:
      </span>
      <ul aria-labelledby="needs" className="contents">
        {node.needs.map((need) => (
          <li key={need.id} className="contents">
            <Link
              to={withRoute(`/node/${need.id}`, goals, known)}
              title={need.reason}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-2 bg-surface px-[11px] py-1 text-[13px] hover:border-sel"
            >
              {known.includes(need.id) ? (
                <svg width="12" height="12" viewBox="0 0 12 12" role="img" aria-label="known">
                  <path
                    d="M2 6.5l2.5 2.5 5.5-6"
                    className="fill-none stroke-ink-2"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
              {need.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The level whose page takes the First steps form (T10.2, M3P6.2). */
export const FIRST_STEPS = "first-steps";

/** Past this width there is room for the rail and a full body at once, so it starts open. */
const WIDE = 1536;
const REMEMBERED = "code.node.rail";

/** Whether the rail is open: the learner's last choice in this browser, else the screen's width. */
function useRail(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      const kept = window.localStorage.getItem(REMEMBERED);
      if (kept === "open" || kept === "folded") return kept === "open";
    } catch {
      // Storage can be blocked; the width decides instead.
    }
    return window.innerWidth >= WIDE;
  });
  const toggle = () => {
    setOpen(!open);
    try {
      window.localStorage.setItem(REMEMBERED, open ? "folded" : "open");
    } catch {
      // Nothing to keep; the choice holds for this page.
    }
  };
  return [open, toggle];
}

function Page({ node, goals, known }: { node: NodeOut; goals: string[]; known: string[] }) {
  const [open, toggle] = useRail();
  const around: Around = {
    deeper: node.goes_deeper,
    related: node.related,
    neededBy: node.needed_by,
  };
  const rail = aroundCount(around) > 0 && open;
  const sections = [
    ...(node.resources.length > 0 ? [{ id: "learn-it", text: "Learn it" }] : []),
    ...headingsOf(node.body),
  ];
  const minutes = node.minutes + node.questions.length;
  return (
    <main
      data-rail={rail ? "open" : "folded"}
      className={`grid gap-x-10 gap-y-10 px-4 py-[30px] sm:px-9 ${
        rail
          ? "lg:grid-cols-[200px_minmax(0,1fr)_290px]"
          : "lg:grid-cols-[200px_minmax(0,1fr)_44px]"
      }`}
    >
      <Contents sections={sections} />
      <article
        className={`mx-auto flex w-full min-w-0 flex-col gap-5 ${rail ? "max-w-[800px]" : "max-w-[920px]"}`}
      >
        <div className="flex flex-col gap-2">
          <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
            {node.region.name} › {node.title}
          </nav>
          <h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[42px]">
            {node.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <LevelTag level={node.level} />
            <span className="text-[13.5px] text-ink-2">
              About {minutes} min{node.questions.length > 0 ? " with the questions" : ""}
            </span>
          </div>
        </div>
        <section
          aria-labelledby="claim"
          className="rounded-xl border-[1.5px] border-ink bg-surface px-5 py-4"
        >
          <span id="claim" className="text-[12px] font-medium text-ink-3">
            What you’ll be able to do
          </span>
          <p className="mt-1.5 text-[17px] leading-[1.45] font-medium">{node.claim}</p>
        </section>
        <Needs node={node} goals={goals} known={known} />
        <LearnIt resources={node.resources} />
        <Body body={node.body} questions={node.questions} />
      </article>
      <Aside around={around} goals={goals} known={known} open={open} onToggle={toggle} />
    </main>
  );
}

export function NodePage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const goals = params.getAll("goal");
  const known = params.getAll("known");

  const node = useQuery({
    queryKey: ["node", id],
    queryFn: ({ signal }) => fetchNode(id, signal),
    retry: false,
  });
  // The Route page's own query, so a node opened from the map reuses the route it drew.
  const route = useQuery({
    queryKey: ["route", goals.join(","), known.join(",")],
    queryFn: ({ signal }) => fetchRoute(goals, known, signal),
    enabled: goals.length > 0,
    retry: false,
  });

  // What comes after this stop, in the order the weaver gave (M3P6.2).
  const stops = route.data?.stops ?? [];
  const at = stops.findIndex((stop) => stop.id === id);
  const nextStop = at >= 0 ? stops[at + 1] : undefined;

  // A link from one node to another is a new page: start it at the top.
  useEffect(() => {
    if (id !== "") window.scrollTo?.(0, 0);
  }, [id]);

  return (
    <div className="min-h-screen">
      <TopBar />
      {goals.length > 0 && !route.isError ? (
        <RouteStrip
          id={id}
          goals={goals}
          known={known}
          route={route.data}
          big={node.data?.level === FIRST_STEPS}
        />
      ) : null}
      {node.isPending ? (
        <main className="px-4 py-6 sm:px-9">
          <p className="text-[15px] text-ink-2">Loading the page…</p>
        </main>
      ) : node.isError ? (
        <main className="flex flex-col gap-3 px-4 py-6 sm:px-9">
          <p className="rounded-control bg-open-soft px-4 py-3 text-[15px] text-open">
            {sentenceOf(node.error)}
          </p>
          <p className="text-[15px] text-ink-2">
            <Link to="/" className="text-sel underline">
              Start from what you want to learn
            </Link>
            .
          </p>
        </main>
      ) : // A First steps node is the same node in another interface (T10.2, M3P6.2).
      node.data.level === FIRST_STEPS ? (
        <FirstSteps node={node.data} goals={goals} known={known} next={nextStop} />
      ) : (
        <Page node={node.data} goals={goals} known={known} />
      )}
    </div>
  );
}
