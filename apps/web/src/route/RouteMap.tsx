// The route drawn as the canvas's metro map (spec M3P4R.3), at the canvas's line weights: 7 for a
// line, 2.2 for a connector, rings of 6.5, 8.5 and 12.5.
//
// Everything visible is SVG, labels included, so the drawing scales as one piece and a label
// never slides over its neighbour. Each stop also gets a real HTML button laid over it, so it can
// be reached with the keyboard and named for a screen reader. One colour for every line — W10
// gives one meaning per colour — and the lines are named in the page's rail, as the board does.
import { useEffect, useRef } from "react";
import type { RouteOut } from "../api/schema";
import { GOAL_WRAP, LABEL, layout, type Placed, wrapTitle } from "./layout";

const NAME = LABEL.name;
const META = LABEL.meta;
const LEADING = LABEL.leading;
/** Below this scale the text gets too small to read, so the map scrolls instead. */
const SMALLEST = 0.55;
/** Above this a short route would draw its text huge, so the map stops growing and centres. */
export const LARGEST = 0.85;

const halo = { paintOrder: "stroke", strokeLinejoin: "round" } as const;

/** A faint grid behind every map: one layer of fine lines, quieter than the canvas's drafting grid. */
const grid = {
  backgroundImage: [
    "linear-gradient(var(--grid-2) 1px, transparent 1px)",
    "linear-gradient(90deg, var(--grid-2) 1px, transparent 1px)",
  ].join(","),
  backgroundSize: "20px 20px",
};

function Label({ placed, title, minutes }: { placed: Placed; title: string; minutes: number }) {
  const { x, y } = placed;
  if (placed.label === "right") {
    return (
      <g style={halo} className="stroke-canvas" strokeWidth={6}>
        {wrapTitle(title, GOAL_WRAP).map((line, index, lines) => (
          <text
            key={line}
            x={x + 26}
            y={y - 2 - (lines.length - 1 - index) * LABEL.goalLeading}
            className="fill-ink font-mono"
            fontSize={LABEL.goalName}
            fontWeight={700}
          >
            {line}
          </text>
        ))}
        <text x={x + 26} y={y + 18} className="fill-btn font-mono" fontSize={META}>
          your goal
        </text>
      </g>
    );
  }
  const lines = wrapTitle(title);
  const weight = placed.meets ? 600 : 500;
  const anchor = placed.align;
  const textX = anchor === "start" ? x - LABEL.nudge : anchor === "end" ? x + LABEL.nudge : x;
  const below = placed.label === "below";
  const nameY = (index: number) =>
    below
      ? y + LABEL.below + index * LEADING
      : y - LABEL.above - (lines.length - 1 - index) * LEADING;
  return (
    <g style={halo} className="stroke-canvas" strokeWidth={6} textAnchor={anchor}>
      {lines.map((line, index) => (
        <text
          key={line}
          x={textX}
          y={nameY(index)}
          className="fill-ink font-sans"
          fontSize={NAME}
          fontWeight={weight}
        >
          {line}
        </text>
      ))}
      <text
        x={textX}
        y={below ? y + LABEL.below + lines.length * LEADING : y - LABEL.metaAbove}
        className="fill-ink-3 font-mono"
        fontSize={META}
      >
        {minutes} min
      </text>
    </g>
  );
}

function Mark({ placed }: { placed: Placed }) {
  const { x, y, id } = placed;
  if (placed.goal && placed.label === "right") {
    return (
      <g data-mark="goal" data-stop={id}>
        <circle cx={x} cy={y} r={12.5} className="fill-surface stroke-ink" strokeWidth={3.2} />
        <rect x={x - 4.5} y={y - 4.5} width={9} height={9} className="fill-line" />
      </g>
    );
  }
  return placed.meets || placed.goal ? (
    <circle
      data-mark="meets"
      data-stop={id}
      cx={x}
      cy={y}
      r={8.5}
      className="fill-surface stroke-ink"
      strokeWidth={2.6}
    />
  ) : (
    <circle
      data-mark="stop"
      data-stop={id}
      cx={x}
      cy={y}
      r={6.5}
      className="fill-surface stroke-ink-3"
      strokeWidth={2}
    />
  );
}

export function RouteMap({
  route,
  selected,
  onSelect,
}: {
  route: RouteOut;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const drawn = layout(route);
  const { box } = drawn;
  const stops = new Map(route.stops.map((stop) => [stop.id, stop]));
  const goalTitles = route.stops
    .filter((stop) => route.goals.includes(stop.id))
    .map((stop) => stop.title)
    .join(", ");
  const chosen = drawn.stops.find((placed) => placed.id === selected);

  // Where the map is wider than the screen, bring the chosen stop into view.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = scroller.current;
    if (selected === null || area === null || area.scrollWidth <= area.clientWidth) return;
    const button = [...area.querySelectorAll<HTMLElement>("[data-stop-button]")].find(
      (one) => one.dataset.stopButton === selected,
    );
    if (button === undefined) return;
    area.scrollLeft = button.offsetLeft - area.clientWidth / 2;
  }, [selected]);

  return (
    <div
      ref={scroller}
      data-ground="grid"
      className="overflow-x-auto rounded-[10px] border border-border bg-canvas px-3 py-2"
      style={grid}
    >
      <div
        className="relative mx-auto"
        style={{
          aspectRatio: `${box.width} / ${box.height}`,
          minWidth: box.width * SMALLEST,
          maxWidth: box.width * LARGEST,
        }}
      >
        <svg
          viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`${drawn.stops.length} stops on ${drawn.lines.length} lines, ending at ${goalTitles}`}
        >
          <title>{`${drawn.stops.length} stops on ${drawn.lines.length} lines`}</title>
          {drawn.links.map((link) => (
            <g key={link} className="fill-none" strokeLinejoin="round">
              <path d={link} className="stroke-canvas" strokeWidth={7} />
              <path d={link} className="stroke-line" strokeWidth={2.2} />
            </g>
          ))}
          {drawn.runs.map((run) => (
            <path
              key={run}
              d={run}
              className="fill-none stroke-line"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {chosen === undefined ? null : (
            <circle
              data-selected={chosen.id}
              cx={chosen.x}
              cy={chosen.y}
              r={(chosen.goal ? 12.5 : chosen.meets ? 8.5 : 6.5) + 7}
              className="fill-none stroke-sel"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
          {drawn.stops.map((placed) => (
            <Mark key={placed.id} placed={placed} />
          ))}
          {drawn.stops.map((placed) => {
            const stop = stops.get(placed.id);
            return stop === undefined ? null : (
              <Label key={placed.id} placed={placed} title={stop.title} minutes={stop.minutes} />
            );
          })}
        </svg>

        {drawn.stops.map((placed) => {
          const stop = stops.get(placed.id);
          if (stop === undefined) return null;
          return (
            <button
              key={placed.id}
              type="button"
              data-stop-button={placed.id}
              onClick={() => onSelect(placed.id)}
              aria-current={placed.id === selected ? "true" : undefined}
              aria-label={`${stop.title} · ${stop.minutes} min · ${stop.region.name}${
                placed.goal ? " · your goal" : ""
              }`}
              className="absolute size-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-pill hover:bg-sel-soft/60 focus-visible:outline-2 focus-visible:outline-sel"
              style={{
                left: `${((placed.x - box.x) / box.width) * 100}%`,
                top: `${((placed.y - box.y) / box.height) * 100}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
