// The board's tags (L5): a grey one for a kind, and the level tag with its bars. A level describes
// a node's content, never the learner, so it spends no colour (tutor spec T10.1).
import { shownLevel } from "../start/format";

const TAG =
  "inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-pill border border-border-2 px-[9px] py-0.5 text-[11.5px] font-medium text-ink-2";

export function Tag({ children }: { children: string }) {
  return <span className={TAG}>{children}</span>;
}

export function LevelTag({ level }: { level: string }) {
  return (
    <span className={TAG}>
      <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true" className="fill-current">
        <rect x="0" y="6" width="2.4" height="4" rx="0.6" />
        <rect x="3.2" y="4" width="2.4" height="6" rx="0.6" />
        <rect x="6.4" y="2" width="2.4" height="8" rx="0.6" opacity={0.35} />
        <rect x="9.6" y="0" width="2.4" height="10" rx="0.6" opacity={0.35} />
      </svg>
      {shownLevel(level)}
    </span>
  );
}
