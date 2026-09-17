// The top bar every page shares: the transit-line mark and the name (W10).
import type { ReactNode } from "react";

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-15 items-center justify-between border-b border-border px-7">
      <a href="/" className="flex items-center gap-2.5">
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
      </a>
      {children}
    </header>
  );
}
