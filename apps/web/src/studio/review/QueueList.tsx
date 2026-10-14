// The queue (M4.9b spec, M4RS.1, M4RS.4): a group per draft, its keys with the score placeholder
// and your verdict, filtered by view, node and block type.
import type { QueuedDraftOut } from "../../api/schema";

export interface Opened {
  draft: string;
  key: string;
}

export const VIEWS = ["To review", "Changes requested", "Approved"] as const;
export type View = (typeof VIEWS)[number];

export const inView = (view: View, verdict: string | null) =>
  view === "To review"
    ? verdict === null
    : view === "Approved"
      ? verdict === "approved"
      : verdict === "changes";

const COLS = "grid-cols-[18px_minmax(0,1.2fr)_74px_46px_96px]";

function Verdict({ verdict }: { verdict: string | null }) {
  if (verdict === "approved")
    return (
      <span className="rounded-pill border border-border-2 px-[9px] py-0.5 text-[11.5px] text-ink-2">
        ✓ approved
      </span>
    );
  if (verdict === "changes")
    return (
      <span className="rounded-pill bg-meas-soft px-[9px] py-0.5 text-[11.5px] font-semibold text-meas">
        changes
      </span>
    );
  return null;
}

export function QueueList({
  queue,
  view,
  node,
  kind,
  open,
  ticked,
  onOpen,
  onTick,
}: {
  queue: QueuedDraftOut[];
  view: View;
  node: string;
  kind: string;
  open: Opened | null;
  ticked: Set<string>;
  onOpen: (opened: Opened) => void;
  onTick: (id: string) => void;
}) {
  const shown = queue.filter((d) => node === "" || d.public_id === node);
  const total = shown.reduce((n, d) => n + d.keys.length, 0);
  return (
    <section
      aria-label="Queue"
      className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"
    >
      <div className={`grid ${COLS} gap-2.5 px-3 py-[9px] text-[11.5px] text-ink-3`}>
        <span />
        <span>Block</span>
        <span>Type</span>
        <span>Score</span>
        <span className="text-right">Your verdict</span>
      </div>
      {shown.map((draft) => {
        const approved = draft.keys.filter((k) => k.verdict === "approved").length;
        const keys = draft.keys.filter(
          (k) => inView(view, k.verdict) && (kind === "" || k.kind === kind),
        );
        const by = draft.contributors.map((c) => c.name || c.email).join(", ");
        return (
          <div key={draft.public_id} className="flex flex-col">
            <div className="flex items-center justify-between gap-2.5 border-t border-border bg-bg px-3 py-[9px] text-[12px]">
              <span>
                <b className="font-semibold text-ink">{draft.title}</b>
                <span className="text-ink-3">{` · rev ${draft.revision} · ${by}`}</span>
              </span>
              <span className="text-ink-3 tabular-nums">{`${approved} of ${draft.keys.length}`}</span>
            </div>
            {!draft.reads && (
              <p className="border-t border-border px-3 py-2 text-[12.5px] text-open">
                This draft no longer reads against the index.
              </p>
            )}
            {keys.map((key) => {
              const id = `${draft.public_id}:${key.key}`;
              const on = open?.draft === draft.public_id && open.key === key.key;
              return (
                <div
                  key={id}
                  className={`grid ${COLS} items-center gap-2.5 border-t border-border px-3 text-[13px] ${
                    on
                      ? "bg-sel-soft shadow-[inset_3px_0_0_var(--sel)]"
                      : ticked.has(id)
                        ? "bg-bg"
                        : ""
                  }`}
                >
                  {key.verdict === "approved" ? (
                    <span />
                  ) : (
                    <input
                      type="checkbox"
                      aria-label={`Tick ${key.label}`}
                      checked={ticked.has(id)}
                      onChange={() => onTick(id)}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`${key.label}, ${key.kind}`}
                    aria-current={on}
                    onClick={() => onOpen({ draft: draft.public_id, key: key.key })}
                    className="h-11 truncate text-left font-semibold"
                  >
                    {key.label}
                  </button>
                  <span className="font-mono text-[11.5px] text-ink-2">{key.kind}</span>
                  <span
                    title="Scores arrive with the judge in M5"
                    className="font-mono text-[12.5px] text-border-2"
                  >
                    —
                  </span>
                  <span className="flex justify-end">
                    <Verdict verdict={key.verdict} />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="mt-auto border-t border-border px-3 py-2.5 text-[12px] text-ink-3">
        {`${total} blocks in ${shown.length} ${shown.length === 1 ? "draft" : "drafts"} · scores arrive with the judge in M5`}
      </div>
    </section>
  );
}
