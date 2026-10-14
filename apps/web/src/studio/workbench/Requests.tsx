// A send back's requests in the workbench (M4.9b spec, M4RS.5): a banner, and each note beside the
// block it is now. Read only, from the draft the workbench already holds: no request of its own.
import { useSearchParams } from "react-router";
import { useDraft } from "../../api/queries";
import type { DraftOut } from "../../api/schema";

/** The tab a key is edited in. */
export const tabOf = (key: string) =>
  key.startsWith("resource/")
    ? "resources"
    : key.startsWith("exam/")
      ? "exam"
      : key === "node"
        ? "settings"
        : "content";

export function RequestsBanner({ draft }: { draft: DraftOut }) {
  const [, setParams] = useSearchParams();
  const back = draft.requests;
  if (back === null || back === undefined) return null;
  const who = back.by === null ? "a reviewer" : back.by.name || back.by.email;
  const count = back.items.length;
  return (
    <section
      aria-label="Sent back"
      className="flex flex-col gap-1.5 rounded-panel border border-meas bg-meas-soft px-4 py-3 text-[13px]"
    >
      <span className="font-semibold">
        {`Sent back by ${who} · ${count} ${count === 1 ? "request" : "requests"}`}
      </span>
      {back.reason && <span>{back.reason}</span>}
      <ul className="flex flex-col gap-1">
        {back.items.map((request) => (
          <li key={request.key}>
            {request.now === null ? (
              <span className="text-ink-2">{`${request.note} · block removed`}</span>
            ) : (
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => {
                  const tab = tabOf(request.now ?? "");
                  setParams(tab === "content" ? {} : { tab }, { replace: true });
                }}
              >
                {request.note}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The notes on the block a key is now, from the cached draft; nothing when there are none. */
export function RequestNote({ draftId, keyNow }: { draftId: string; keyNow: string }) {
  const notes = (useDraft(draftId).data?.requests?.items ?? []).filter((r) => r.now === keyNow);
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-[8px] bg-meas-soft px-2.5 py-1.5 text-[12.5px] text-meas">
      {notes.map((request) => (
        <span key={request.key}>
          <b className="font-semibold">Requested:</b> {request.note}
        </span>
      ))}
    </div>
  );
}
