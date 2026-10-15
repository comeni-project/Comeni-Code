// Main and the index (M4.9c spec, M4LS.3): main's head, the live build, how often it follows.
import { useStudioIndex } from "../../api/queries";
import { ago, every } from "./words";

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between gap-2.5 text-[12.5px]">
      <span className="text-ink-3">{name}</span>
      <span className="text-right text-ink-2">{value}</span>
    </div>
  );
}

export function IndexCard() {
  const { data: index } = useStudioIndex();
  if (index === undefined) return null;
  const short = (commit: string) => commit.slice(0, 7);
  return (
    <section
      aria-label="Main and the index"
      className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-[18px]"
    >
      <span className="text-[14px] font-semibold">Main and the index</span>
      <Fact
        name="main"
        value={
          index.main_head === null
            ? "not seen yet"
            : `${short(index.main_head)}${index.checked_at === null ? "" : ` · ${ago(index.checked_at)}`}`
        }
      />
      <Fact
        name="Live build"
        value={
          index.live === null
            ? "none yet"
            : // A build from a folder has no commit (#314).
              [short(index.live.commit), `${index.live.node_count} nodes`]
                .filter((part) => part !== "")
                .join(" · ")
        }
      />
      <Fact name="Follows main" value={`${every(index.follow_seconds)}, and on a merge`} />
      <span className="text-[12px] text-ink-3">
        {index.behind ? "Behind main." : "Up to date."}
      </span>
    </section>
  );
}
