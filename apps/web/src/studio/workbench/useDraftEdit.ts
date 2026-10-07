// The one executor (M4K.2): the revision is read from the cache when the edit is sent, so two
// quick saves chain; the answer is the new draft, written in place, and Checks go stale.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { type Edit, sendEdit } from "./edits";

export function useDraftEdit(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["draft-edit", id],
    scope: { id: `draft-edit:${id}` }, // edits to one draft run one after another
    mutationFn: (edit: Edit) => {
      const draft = client.getQueryData<DraftOut>(queryKeys.draft(id));
      if (draft === undefined) throw new Error("The draft is not loaded.");
      return sendEdit(id, draft.revision, edit);
    },
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.draft(id), saved.draft);
      return client.invalidateQueries({ queryKey: queryKeys.draftChecks(id) });
    },
  });
}
