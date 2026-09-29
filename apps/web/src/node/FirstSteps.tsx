// A First steps node, in its own form (L5 · Node at First steps, spec M3P6.2, tutor spec T10.2).
//
// Same node, same data, another interface: one column, larger type, numbered sections, the video
// offered rather than played, one question at a time, and what comes next. The level describes
// the node, never the learner, so a node always reads the same way.
import { useState } from "react";
import { Link } from "react-router";
import type { NodeOut, ResourceOut, StopOut } from "../api/schema";
import { Body } from "./Body";
import { splitReading } from "./body";
import { playerSrc, withRoute } from "./embed";
import { LevelTag } from "./tags";

/** The minutes a part covers, for the watch offer: "Watch · 13 min". */
function minutesOf(part: string): number | null {
  const bounds = part.split(/[–-]/).map((half) => {
    const numbers = half.trim().split(":");
    if (numbers.length < 2 || numbers.some((one) => !/^\d+$/.test(one))) return null;
    return numbers.reduce((total, one) => total * 60 + Number(one), 0);
  });
  const [from, to] = bounds;
  if (from === null || from === undefined || to === null || to === undefined) return null;
  return Math.max(1, Math.round((to - from) / 60));
}

function Watch({ resource, src }: { resource: ResourceOut; src: string }) {
  const [watching, setWatching] = useState(false);
  const long = minutesOf(resource.part);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-[18px] py-3.5">
        <span className="text-[16px] text-ink-2">
          Prefer to watch? A short video explains the same idea.
        </span>
        <div className="flex gap-0.5 rounded-control border border-border bg-bg p-[3px]">
          {[
            { key: false, label: "Read" },
            { key: true, label: long === null ? "Watch" : `Watch · ${long} min` },
          ].map((choice) => (
            <button
              key={choice.label}
              type="button"
              aria-pressed={watching === choice.key}
              onClick={() => setWatching(choice.key)}
              className={`rounded-[7px] px-3.5 py-1.5 text-[13px] ${
                watching === choice.key
                  ? "bg-surface font-semibold text-ink shadow-sm"
                  : "text-ink-2"
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {watching ? (
        <div className="aspect-video overflow-hidden rounded-[16px] border border-border bg-ink">
          <iframe
            title={`${resource.provider.name}: ${resource.covers}`}
            src={src}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full border-0"
          />
        </div>
      ) : null}
    </div>
  );
}

function Next({ stop, goals, known }: { stop: StopOut; goals: string[]; known: string[] }) {
  return (
    <section
      aria-label="Next on your route"
      className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-border bg-surface px-6 py-[22px]"
    >
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-[15px] text-ink-3">Next on your route</span>
        <span className="text-[24px] font-semibold">{stop.title}</span>
        <LevelTag level={stop.level} />
      </div>
      <Link
        to={withRoute(`/node/${stop.id}`, goals, known)}
        className="inline-flex items-center gap-2.5 rounded-[14px] bg-btn px-7 py-4 text-[18px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110"
      >
        Continue
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
          <path
            d="M1 7h15M11 2l5 5-5 5"
            className="fill-none stroke-current"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </section>
  );
}

export function FirstSteps({
  node,
  goals,
  known,
  next,
}: {
  node: NodeOut;
  goals: string[];
  known: string[];
  next: StopOut | undefined;
}) {
  const { body, reading } = splitReading(node.body);
  const video = node.resources.find(
    (resource) => resource.display === "embed" && resource.video !== null,
  );
  const src = video?.video ? playerSrc(video.video, video.part) : null;
  const linked = node.resources.filter((resource) => resource !== video);

  return (
    <main className="flex justify-center px-4 py-11 sm:px-9">
      <article className="flex w-full max-w-[820px] flex-col gap-7">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <LevelTag level={node.level} />
            <span className="text-[16px] text-ink-2">About {node.minutes} minutes</span>
          </div>
          <h1 className="text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance sm:text-[48px]">
            {node.title}
          </h1>
          <p className="text-[21px] leading-[1.6] text-ink">{node.claim}</p>
        </div>

        {video !== undefined && src !== null ? <Watch resource={video} src={src} /> : null}

        <Body body={body} questions={node.questions} big />

        {next !== undefined ? <Next stop={next} goals={goals} known={known} /> : null}

        {reading.trim() !== "" || linked.length > 0 ? (
          <section
            aria-label="Where this comes from"
            className="flex flex-col gap-1.5 rounded-[14px] border border-border px-[18px] py-4 text-[15px] leading-[1.6] text-ink-2"
          >
            <span className="font-semibold text-ink">Where this comes from</span>
            {linked.map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sel hover:text-ink"
              >
                {resource.provider.name}
                {resource.part === "" ? "" : ` · ${resource.part}`} · {resource.licence}
              </a>
            ))}
            {reading.trim() === "" ? null : <Body body={reading} questions={[]} />}
          </section>
        ) : null}
      </article>
    </main>
  );
}
