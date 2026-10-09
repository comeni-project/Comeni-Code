// The one executor (M4K.2): the revision is read from the cache when the edit is sent, so two
// quick saves chain; the answer is the new draft, written in place, and Checks go stale.
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
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

/** Moving on while a save to this draft is in flight (#255): what was clicked waits for the saves
 * to land, and does not happen if one is refused, so its editor stays open with your text and the
 * problem. `go` is given the draft as saved and the edits that landed, so a place it names can
 * follow them. */
export function useAfterSaves(id: string) {
  const client = useQueryClient();
  return (go: (draft: DraftOut, landed: Edit[]) => void) => {
    const cache = client.getMutationCache();
    const pending = () => cache.findAll({ mutationKey: ["draft-edit", id], status: "pending" });
    const now = () => client.getQueryData<DraftOut>(queryKeys.draft(id));
    const waiting = pending();
    const drawn = now();
    if (waiting.length === 0) return drawn && go(drawn, []);
    const stop = cache.subscribe(() => {
      if (pending().length > 0) return;
      stop();
      const saved = now();
      if (waiting.some((m) => m.state.status === "error") || saved === undefined) return;
      go(
        saved,
        waiting.map((m) => m.state.variables as Edit),
      );
    });
  };
}

/** Where block `at` is after `edits` landed; null when one of them deleted it. */
export function follow(at: number | null, edits: Edit[]): number | null {
  return edits.reduce<number | null>((place, edit) => {
    if (place === null) return null;
    const [what, index, how] = edit.path.split("/");
    if (what !== "blocks") return place;
    if (edit.method === "POST" && index === undefined) {
      const added = Number(edit.body?.at);
      return added <= place ? place + 1 : place;
    }
    const from = Number(index);
    if (edit.method === "DELETE") return from === place ? null : from < place ? place - 1 : place;
    if (how === "move") {
      const to = Number(edit.body?.to);
      if (from === place) return to;
      if (from < place && to >= place) return place - 1;
      if (from > place && to <= place) return place + 1;
    }
    return place;
  }, at);
}

/** Reload the draft alone: Checks, hidden or not, are not asked again by it (Review Focus 5). */
export const reloadDraft = (client: QueryClient, id: string) =>
  client.refetchQueries({ queryKey: queryKeys.draft(id), exact: true });
