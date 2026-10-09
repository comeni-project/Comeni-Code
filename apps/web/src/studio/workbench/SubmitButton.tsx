// Submit for review (S3's header, M4K.6): the board's green button opens Before you submit, which
// asks the checklist once while open. Submit sends the revision; the draft that comes back is
// written in place, so the page turns read only.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { submitDraft } from "../../api/drafts";
import { draftMoved, useDraftChecks } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { PRIMARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { CheckItems } from "./CheckItems";
import { refusalOf } from "./refusal";

export function SubmitButton({ draft }: { draft: DraftOut }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} className={PRIMARY} onClick={() => setOpen(!open)}>
        Submit for review
      </button>
      {open && <BeforeYouSubmit draft={draft} onClose={() => setOpen(false)} />}
    </div>
  );
}

function BeforeYouSubmit({ draft, onClose }: { draft: DraftOut; onClose: () => void }) {
  const client = useQueryClient();
  const checks = useDraftChecks(draft.public_id, true);
  const submit = useMutation({
    mutationFn: () => submitDraft(draft.public_id, draft.revision),
    onSuccess: (sent) => draftMoved(client, sent),
  });
  const refusal = refusalOf(submit.error);
  const left = checks.data?.items.filter((item) => !item.passed).length ?? 0;
  const ready = checks.data?.passed === true;
  return (
    <div
      role="dialog"
      aria-label="Before you submit"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="absolute top-[52px] right-0 z-10 flex w-[340px] flex-col gap-2.5 rounded-panel border border-border bg-surface p-3.5 shadow-float"
    >
      <span className="text-[13.5px] font-semibold">Before you submit</span>
      {checks.isPending && <p className="text-[12.5px] text-ink-2">Checking the draft…</p>}
      {checks.isError && <ErrorNotice error={checks.error} />}
      {checks.data !== undefined && <CheckItems items={checks.data.items} />}
      {refusal !== null && (
        <div className="flex flex-col gap-1.5 rounded-control bg-open-soft px-3 py-2 text-[12.5px] text-open">
          <span className="font-semibold">{refusal.sentence}</span>
          <CheckItems items={refusal.items} />
        </div>
      )}
      <button
        type="button"
        disabled={!ready || submit.isPending}
        onClick={() => submit.mutate()}
        className={`${PRIMARY} h-9 text-[13px] disabled:bg-border disabled:text-ink-3 disabled:shadow-none`}
      >
        {ready || checks.data === undefined ? "Submit" : `Fix ${left} items to submit`}
      </button>
    </div>
  );
}
