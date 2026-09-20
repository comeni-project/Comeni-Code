// The route drawn as lines meeting at the goal (spec M3P4.2).
//
// The paths are SVG; the stops are real HTML buttons laid over it, so a stop can be reached with
// the keyboard and named for a screen reader. One colour for every line — W10 gives one meaning
// per colour — and the lines are named in the page's rail above the map, as the board does it.
import type { RouteOut } from "../api/schema";
import { layout } from "./layout";

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
  const stops = new Map(route.stops.map((stop) => [stop.id, stop]));
  const goalTitles = route.stops
    .filter((stop) => route.goals.includes(stop.id))
    .map((stop) => stop.title)
    .join(", ");

  return (
    <div className="overflow-x-auto">
      <div
        className="relative min-w-[720px]"
        style={{ aspectRatio: `${drawn.width} / ${drawn.height}` }}
      >
        <svg
          viewBox={`0 0 ${drawn.width} ${drawn.height}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`${drawn.stops.length} stops on ${drawn.bands.length} lines, ending at ${goalTitles}`}
        >
          <title>{`${drawn.stops.length} stops on ${drawn.bands.length} lines`}</title>
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
          {drawn.links.map((link) => (
            <path
              key={link}
              d={link}
              className="fill-none stroke-line"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          ))}
        </svg>

        {drawn.stops.map((placed) => {
          const stop = stops.get(placed.id);
          if (stop === undefined) return null;
          const chosen = placed.id === selected;
          return (
            <button
              key={placed.id}
              type="button"
              onClick={() => onSelect(placed.id)}
              aria-current={chosen ? "true" : undefined}
              aria-label={`${stop.title} · ${stop.minutes} min · ${stop.region.name}${
                placed.goal ? " · your goal" : ""
              }`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{
                left: `${(placed.x / drawn.width) * 100}%`,
                top: `${(placed.y / drawn.height) * 100}%`,
              }}
            >
              <span className="max-w-36 text-center text-[12px] leading-tight font-medium text-ink">
                {stop.title}
              </span>
              <span
                aria-hidden="true"
                className={`rounded-pill border-2 bg-surface ${
                  chosen ? "border-sel" : "border-ink"
                } ${placed.goal ? "size-4" : "size-3"}`}
              />
              <span className="font-mono text-[11px] text-ink-3">
                {placed.goal ? "your goal" : `${stop.minutes} min`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
