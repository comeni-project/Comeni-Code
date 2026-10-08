// S19 · Drafts (M4.8b spec, M4K.1): the open drafts, a new node, and a node that exists. One GET
// of the open drafts; Mine is filtered here; In review is asked only when chosen (M4K.4).
import { useState } from "react";
import { useDrafts, useMe } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { DraftsTable } from "./DraftsTable";
import { NewNodeForm } from "./NewNodeForm";
import { OpenExisting } from "./OpenExisting";

const VIEWS = ["Mine", "All open", "In review"] as const;
type View = (typeof VIEWS)[number];

export function DraftsPage() {
  const [view, setView] = useState<View>("Mine");
  const you = useMe().data?.user?.public_id;
  const open = useDrafts("open");
  const review = useDrafts("submitted", view === "In review");
  const mine = (open.data ?? []).filter((draft) =>
    draft.contributors.some((member) => member.public_id === you),
  );
  const shown = { Mine: mine, "All open": open.data ?? [], "In review": review.data ?? [] };
  const count = {
    Mine: mine.length,
    "All open": open.data?.length,
    "In review": review.data?.length,
  };
  const failed = view === "In review" ? review.error : open.error;
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Drafts</h1>
        <p className="text-[13.5px] text-ink-2">
          Nodes being written. Open one to keep working, or start a new node.
        </p>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col gap-3">
          <div role="tablist" aria-label="Drafts" className="flex gap-0.5 border-b border-border">
            {VIEWS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={view === name}
                onClick={() => setView(name)}
                className={`flex items-center gap-[7px] px-3.5 py-[9px] text-[13.5px] ${
                  view === name
                    ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]"
                    : "text-ink-2"
                }`}
              >
                {name}
                <span
                  className={`rounded-pill px-[7px] text-[11.5px] tabular-nums ${
                    view === name ? "bg-ink text-bg" : "bg-bg text-ink-3"
                  }`}
                >
                  {count[name] ?? ""}
                </span>
              </button>
            ))}
          </div>
          {failed !== null && <ErrorNotice error={failed} />}
          <DraftsTable drafts={shown[view]} />
        </section>
        <aside className="flex flex-col gap-4">
          <NewNodeForm />
          <OpenExisting />
        </aside>
      </div>
    </>
  );
}
