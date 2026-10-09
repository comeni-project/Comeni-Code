// What a draft that is not open can still do (M4K.1): a submitted one reads only, and a contributor
// or an operator may withdraw it; approved, landed and discarded ones say so and point onward.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { withdrawDraft } from "../../api/drafts";
import { draftMoved, useMe } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { mayTakeBack } from "./who";

const LINE = "flex flex-wrap items-center gap-3 rounded-control bg-surface px-4 py-3 text-[13.5px]";

export function StateLine({ draft }: { draft: DraftOut }) {
  if (draft.state === "submitted") return <Submitted draft={draft} />;
  if (draft.state === "approved") return <p className={LINE}>Approved — read only.</p>;
  if (draft.state === "landed")
    return (
      <p className={LINE}>
        Landed.{" "}
        <Link to={`/node/${draft.node_id}`} className="text-sel">
          Read it as a learner
        </Link>
      </p>
    );
  if (draft.state === "discarded")
    return (
      <p className={LINE}>
        Discarded.{" "}
        <Link to="/studio/drafts" className="text-sel">
          Back to Drafts
        </Link>
      </p>
    );
  return null;
}

function Submitted({ draft }: { draft: DraftOut }) {
  const client = useQueryClient();
  const may = mayTakeBack(useMe().data?.user, draft);
  const withdraw = useMutation({
    mutationFn: () => withdrawDraft(draft.public_id),
    onSuccess: (saved) => draftMoved(client, saved),
  });
  return (
    <div className="flex flex-col gap-2">
      <div className={LINE}>
        <span>Submitted for review — read only.</span>
        {may && (
          <button
            type="button"
            className={SECONDARY}
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            Withdraw
          </button>
        )}
      </div>
      {withdraw.error !== null && <ErrorNotice error={withdraw.error} />}
    </div>
  );
}
