// S6 as M4 builds it (M4.9b spec, M4RS.4): the queue, the open block, your verdict. One GET opens
// it; a draft's review is asked once, when one of its blocks is first opened.
import { useState } from "react";
import { useReview, useReviewQueue } from "../../api/queries";
import type { QueuedDraftOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { BlockPanel } from "./BlockPanel";
import { type Opened, QueueList, VIEWS, type View } from "./QueueList";

const KINDS = ["node", "text", "callout", "sequence", "try", "resource", "exam"];
const FILTER = "rounded-[7px] border border-border-2 bg-surface px-2 py-1 text-sel";

export function ReviewPage() {
  const queue = useReviewQueue();
  const [view, setView] = useState<View>("To review");
  const [node, setNode] = useState("");
  const [kind, setKind] = useState("");
  const [open, setOpen] = useState<Opened | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const tick = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const drafts = queue.data ?? [];
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Review</h1>
        <span className="text-[13px] text-ink-2">
          Every block of a submitted draft gets your verdict; then you approve the draft.
        </span>
      </div>
      <div role="tablist" aria-label="Review views" className="flex gap-0.5 border-b border-border">
        {VIEWS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={view === name}
            onClick={() => setView(name)}
            className={`px-3.5 py-[9px] text-[13.5px] ${
              view === name
                ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]"
                : "text-ink-2"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-ink-3">Filter</span>
        <select
          aria-label="Node"
          value={node}
          onChange={(e) => setNode(e.target.value)}
          className={FILTER}
        >
          <option value="">+ Node</option>
          {drafts.map((d) => (
            <option key={d.public_id} value={d.public_id}>
              {d.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Block type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={FILTER}
        >
          <option value="">+ Block type</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      {queue.isError && <ErrorNotice error={queue.error} />}
      {queue.data !== undefined && drafts.length === 0 && (
        <p className="text-[14px] text-ink-2">Nothing is waiting for review.</p>
      )}
      {drafts.length > 0 && (
        <div className="grid min-h-0 items-start gap-4 xl:grid-cols-[400px_minmax(0,1fr)_290px]">
          <QueueList
            queue={drafts}
            view={view}
            node={node}
            kind={kind}
            open={open}
            ticked={ticked}
            onOpen={setOpen}
            onTick={tick}
          />
          <OpenedBlock queue={drafts} open={open} />
        </div>
      )}
    </>
  );
}

/** The open block, from its draft's review, asked once per draft (M4RS.4). */
function OpenedBlock({ queue, open }: { queue: QueuedDraftOut[]; open: Opened | null }) {
  const review = useReview(open?.draft ?? null);
  const draft = queue.find((d) => d.public_id === open?.draft);
  if (open === null || draft === undefined)
    return <p className="text-[14px] text-ink-2">Choose a block to review it.</p>;
  if (review.isError) return <ErrorNotice error={review.error} />;
  const item = review.data?.items.find((i) => i.key === open.key);
  if (item === undefined) return <p className="text-[14px] text-ink-2">Loading the draft…</p>;
  return <BlockPanel draft={draft} item={item} />;
}
