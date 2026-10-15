// S10 · Land (M4.9c spec, M4LS.3): approved drafts go out as one pull request; the landings and
// the index beside them. Three GETs open it.
import { useState } from "react";
import { useLandings, useReadyDrafts } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { IndexCard } from "./IndexCard";
import { landingsIn, VIEWS, type View } from "./views";

export function LandPage() {
  const ready = useReadyDrafts();
  const landings = useLandings();
  const [view, setView] = useState<View>("Ready to land");
  const all = landings.data ?? [];
  const count = (name: View) =>
    name === "Ready to land" ? ready.data?.length : landings.data && landingsIn(name, all).length;
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Land</h1>
        <span className="text-[13px] text-ink-2">
          Approved drafts go to comeni-code-content as one pull request; it merges when its checks
          pass.
        </span>
      </div>
      <div role="tablist" aria-label="Land views" className="flex gap-0.5 border-b border-border">
        {VIEWS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={view === name}
            onClick={() => setView(name)}
            className={`flex items-center gap-1.5 px-3.5 py-[9px] text-[13.5px] ${
              view === name
                ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]"
                : "text-ink-2"
            }`}
          >
            {name}{" "}
            {count(name) !== undefined && (
              <span className="text-[12px] font-normal text-ink-3 tabular-nums">{count(name)}</span>
            )}
          </button>
        ))}
      </div>
      {ready.isError && <ErrorNotice error={ready.error} />}
      {landings.isError && <ErrorNotice error={landings.error} />}
      <IndexCard />
    </>
  );
}
