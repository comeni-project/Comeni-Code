// Ticked blocks approved together (M4.9b spec, M4RS.4): one PUT per draft, all or nothing each; a
// question you have not answered is left out, and the bar says so.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewed } from "../../api/queries";
import { putVerdicts } from "../../api/review";
import type { QueuedDraftOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";

export function BulkBar({
  queue,
  ticked,
  onDone,
}: {
  queue: QueuedDraftOut[];
  ticked: Set<string>;
  onDone: () => void;
}) {
  const client = useQueryClient();
  const chosen = queue.flatMap((draft) =>
    draft.keys
      .filter((key) => ticked.has(`${draft.public_id}:${key.key}`))
      .map((key) => ({ draft, key })),
  );
  const skipped = chosen.filter(({ key }) => key.answered === false);
  const sent = chosen.filter(({ key }) => key.answered !== false);
  const approve = useMutation({
    mutationFn: async () => {
      // One PUT per draft; a refused one leaves the others' approvals standing (Review Focus 3).
      for (const draft of queue) {
        const keys = sent
          .filter((one) => one.draft === draft)
          .map(({ key }) => ({ key: key.key, verdict: "approved" as const }));
        if (keys.length === 0) continue;
        reviewed(client, draft.public_id, await putVerdicts(draft.public_id, draft.revision, keys));
      }
    },
    onSuccess: onDone,
  });
  if (chosen.length === 0) return null;
  return (
    <section
      aria-label="Ticked blocks"
      className="flex flex-col gap-1 rounded-[12px] bg-ink px-3.5 py-2.5 text-bg shadow-float"
    >
      <div className="flex items-center gap-3 text-[13px]">
        <span className="font-semibold">{`${chosen.length} selected`}</span>
        <button
          type="button"
          disabled={sent.length === 0 || approve.isPending}
          onClick={() => approve.mutate()}
          className="ml-auto rounded-[8px] bg-surface px-[11px] py-[5px] font-semibold text-ink disabled:opacity-60"
        >
          {`Approve ${sent.length} ${sent.length === 1 ? "block" : "blocks"}`}
        </button>
        <button type="button" onClick={onDone} className="opacity-75">
          Clear
        </button>
      </div>
      {skipped.map(({ key }) => (
        <span key={key.key} className="text-[11.5px] opacity-75">
          {`${key.label} is skipped: answer it first.`}
        </span>
      ))}
      {approve.error !== null && <ErrorNotice error={approve.error} />}
    </section>
  );
}
