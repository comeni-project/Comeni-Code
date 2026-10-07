// The transit-line mark and the name; Studio's bar adds its dark tag (the Studio boards).
import { Link } from "react-router";

export function Mark({ studio = false }: { studio?: boolean }) {
  return (
    <Link to={studio ? "/studio" : "/"} className="flex shrink-0 items-center gap-2.5">
      <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
        <line
          x1="3"
          y1="8"
          x2="27"
          y2="8"
          className="stroke-line"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {[4, 15, 26].map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy="8"
            r="3.5"
            className="fill-surface stroke-ink"
            strokeWidth="2"
          />
        ))}
      </svg>
      <span className="text-[17px] font-bold tracking-[-0.01em]">Comeni Code</span>
      {studio && (
        <span className="rounded-[6px] bg-ink px-2.5 py-0.5 text-[12px] font-semibold text-bg">
          Studio
        </span>
      )}
    </Link>
  );
}
