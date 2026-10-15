// S10 · Land (M4.9c spec, M4LS.3): approved drafts go out as one pull request; the landings and
// the index beside them. Three GETs open it.
import { useState } from "react";
import { moving } from "../../api/landing";
import { useLandings, useReadyDrafts } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { IndexCard } from "./IndexCard";
import { LandingCard } from "./LandingCard";
import { LandingRows } from "./LandingRows";
import { ReadyTable } from "./ReadyTable";
import { landingsIn, VIEWS, type View } from "./views";

export function LandPage() {
  const ready = useReadyDrafts();
  const landings = useLandings();
  const [view, setView] = useState<View>("Ready to land");
  const [picked, setPicked] = useState<string | null>(null);
  const all = landings.data ?? [];
  const live = all.find(moving);
  const shown = all.find((l) => l.public_id === picked) ?? live;
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
      <div className="grid min-h-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-w-0 flex-col gap-3">
          {view === "Ready to land" && (
            <ReadyTable
              rows={ready.data ?? []}
              loaded={ready.data !== undefined}
              onLanded={(made) => {
                setPicked(made.public_id);
                setView("Landing");
              }}
            />
          )}
          {view !== "Ready to land" && (
            <LandingRows
              landings={landingsIn(view, all)}
              picked={shown?.public_id ?? null}
              onPick={setPicked}
            />
          )}
        </section>
        <aside className="flex flex-col gap-4">
          {shown !== undefined && shown.state !== "failed" && (
            <LandingCard key={shown.public_id} landing={shown} />
          )}
          <IndexCard />
        </aside>
      </div>
    </>
  );
}
