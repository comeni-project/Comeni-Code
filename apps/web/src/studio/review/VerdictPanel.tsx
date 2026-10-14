// Your verdict on the open block, and the draft's decision (M4.9a M4V.2; M4.9b spec, M4RS.4).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { decided, reviewed, useMe, useReview } from "../../api/queries";
import { approveDraft, putVerdicts, sendBack } from "../../api/review";
import type { QueuedDraftOut, ReviewItemOut } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";

const FIELD =
  "rounded-control border border-border-2 bg-surface px-2.5 py-2 text-[13px] font-normal";

function Condition({ ok, children }: { ok: boolean; children: string }) {
  return (
    <div className={`flex gap-2 text-[12.5px] ${ok ? "text-ink-2" : "font-semibold text-ink"}`}>
      <span aria-hidden="true" className={ok ? "text-ink-2" : "text-open"}>
        {ok ? "✓" : "✕"}
      </span>
      {children}
    </div>
  );
}

export function VerdictPanel({ draft, item }: { draft: QueuedDraftOut; item: ReviewItemOut }) {
  const client = useQueryClient();
  const me = useMe();
  const review = useReview(draft.public_id);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const verdict = useMutation({
    mutationFn: (given: { verdict: "approved" | "changes"; note?: string }) =>
      putVerdicts(draft.public_id, draft.revision, [{ key: item.key, ...given }]),
    onSuccess: (answer) => {
      reviewed(client, draft.public_id, answer);
      setAsking(false);
      setNote("");
    },
  });
  const decide = useMutation({
    mutationFn: (how: "approve" | "send back") =>
      how === "approve"
        ? approveDraft(draft.public_id, draft.revision, reason)
        : sendBack(draft.public_id, draft.revision, reason),
    onSuccess: (moved) => decided(client, moved),
  });
  const own = draft.contributors.some((c) => c.public_id === me.data?.user?.public_id);
  const answered = item.question === null || item.question.given !== null;
  const canApprove = answered && !verdict.isPending;
  // The page's keys: A approves, R asks for changes (M4RS.4); typing in a field never reaches here.
  useEffect(() => {
    const approve = () => {
      if (canApprove) verdict.mutate({ verdict: "approved" });
    };
    const request = () => setAsking(true);
    document.addEventListener("review:a", approve);
    document.addEventListener("review:r", request);
    return () => {
      document.removeEventListener("review:a", approve);
      document.removeEventListener("review:r", request);
    };
  }, [canApprove, verdict.mutate]);
  const items = review.data?.items ?? [];
  const approved = items.filter((i) => i.verdict === "approved").length;
  const asks = items.filter((i) => i.verdict === "changes").length;
  const all = items.length > 0 && approved === items.length;
  const share = (n: number) => `${(100 * n) / Math.max(items.length, 1)}%`;
  return (
    <aside
      aria-label="Your verdict"
      className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4"
    >
      <h2 className="text-[14px] font-semibold">Your verdict</h2>
      <div className="flex flex-col gap-[7px]">
        <Condition ok>Read standalone</Condition>
        {item.question !== null && <Condition ok={answered}>Answered it yourself</Condition>}
        <Condition ok={!own}>
          {own ? "You wrote it: approving the draft needs a reason" : "You didn’t write it"}
        </Condition>
      </div>
      <button
        type="button"
        className={PRIMARY}
        disabled={!canApprove}
        onClick={() => verdict.mutate({ verdict: "approved" })}
      >
        Approve this block
      </button>
      {asking ? (
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            What to change
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={FIELD}
            />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={SECONDARY}
              disabled={note.trim() === "" || verdict.isPending}
              onClick={() => verdict.mutate({ verdict: "changes", note })}
            >
              Request
            </button>
            <button
              type="button"
              className="text-[13px] text-ink-2"
              onClick={() => setAsking(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={SECONDARY} onClick={() => setAsking(true)}>
          Request changes…
        </button>
      )}
      {verdict.error !== null && <ErrorNotice error={verdict.error} />}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-[13px] font-semibold">
          {`This draft · ${approved} of ${items.length} blocks approved`}
        </span>
        <span className="flex h-1.5 overflow-hidden rounded-[3px] bg-border">
          <span style={{ width: share(approved) }} className="bg-ink-2" />
          <span style={{ width: share(asks) }} className="bg-meas" />
        </span>
        <label className="flex flex-col gap-1 text-[12.5px] font-medium">
          {own
            ? "Why you approve your own draft, or a note for the author"
            : "A note for the author"}
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={FIELD}
          />
        </label>
        <button
          type="button"
          className={PRIMARY}
          disabled={!all || (own && reason.trim() === "") || decide.isPending}
          onClick={() => decide.mutate("approve")}
        >
          {all ? "Approve the draft" : `Approve the draft · ${items.length - approved} blocks left`}
        </button>
        <button
          type="button"
          className={SECONDARY}
          disabled={(asks === 0 && reason.trim() === "") || decide.isPending}
          onClick={() => decide.mutate("send back")}
        >
          {`Send back · ${asks} ${asks === 1 ? "request" : "requests"}`}
        </button>
        {decide.error !== null && <ErrorNotice error={decide.error} />}
      </div>
      <div className="flex flex-col gap-1 rounded-[10px] border-[1.5px] border-dashed border-border-2 px-3.5 py-3 text-[12.5px] text-ink-3">
        <span className="font-semibold text-ink-2">Was the score right? · M5</span>
        <span>Your answer will measure the judge in Quality.</span>
      </div>
      <div className="flex flex-wrap gap-2.5 text-[11.5px] text-ink-3">
        <span>
          <kbd>A</kbd> approve
        </span>
        <span>
          <kbd>R</kbd> request
        </span>
        <span>
          <kbd>J</kbd> <kbd>K</kbd> next / previous
        </span>
      </div>
    </aside>
  );
}
