// The landings of one view, a row each (M4.9c spec, M4LS.3); picking one shows its card.
import type { LandingOut } from "../../api/schema";
import { StateTag } from "./StateTag";
import { ago, who } from "./words";

const COLS = "grid-cols-[90px_minmax(0,1.4fr)_minmax(0,1fr)_110px_90px]";

export function LandingRows({
  landings,
  picked,
  onPick,
}: {
  landings: LandingOut[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  if (landings.length === 0) return <p className="text-[14px] text-ink-2">No landings here.</p>;
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface">
      <div className={`grid ${COLS} gap-3 px-3.5 py-2.5 text-[11.5px] text-ink-3`}>
        <span>Pull request</span>
        <span>Nodes</span>
        <span>Started by</span>
        <span>When</span>
        <span>State</span>
      </div>
      {landings.map((landing) => (
        <button
          key={landing.public_id}
          type="button"
          aria-current={picked === landing.public_id}
          onClick={() => onPick(landing.public_id)}
          className={`grid w-full ${COLS} h-[52px] items-center gap-3 border-t border-border px-3.5 text-left text-[13.5px] ${
            picked === landing.public_id ? "bg-sel-soft shadow-[inset_3px_0_0_var(--sel)]" : ""
          }`}
        >
          <span className="font-mono text-[13px] text-ink-2">
            {landing.pull_number === null ? "none" : `#${landing.pull_number}`}
          </span>
          <span className="truncate font-mono text-[12.5px]">
            {landing.entries.map((e) => e.node_id).join(" · ")}
          </span>
          <span className="truncate text-ink-2">{who(landing.started_by)}</span>
          <span className="text-ink-3">{ago(landing.started_at)}</span>
          <StateTag landing={landing} />
        </button>
      ))}
    </div>
  );
}
