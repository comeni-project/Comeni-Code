// The preview in a tab of its own (M4K.1): the same drawing, full width, from the same one GET.
import { useParams } from "react-router";
import { useDraft } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { NodePreview } from "./PreviewPanel";

export function PreviewPage() {
  const id = useParams().id ?? "";
  const draft = useDraft(id);
  if (draft.isPending) return <p className="text-[15px] text-ink-2">Loading the draft…</p>;
  if (draft.isError) return <ErrorNotice error={draft.error} />;
  if (draft.data.node === null)
    return <p className="text-[15px] text-ink-2">This draft's files no longer read.</p>;
  return <NodePreview node={draft.data.node} />;
}
