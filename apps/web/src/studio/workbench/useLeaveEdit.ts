// A value edited here and saved when you leave it (M4K.3): what you typed is held until the save
// lands, then the draft's own value shows again. Unchanged, nothing is sent; refused, it stays.
import { useState } from "react";
import type { Edit } from "./edits";
import { useDraftEdit } from "./useDraftEdit";
import { useLeaveWarning } from "./useLeaveWarning";

export function useLeaveEdit<T>(draftId: string, saved: T, toEdit: (value: T) => Edit | null) {
  const edit = useDraftEdit(draftId);
  const [typed, setTyped] = useState<{ value: T } | null>(null);
  const shown = typed === null ? saved : typed.value;
  useLeaveWarning(typed !== null);
  // Leaving again while a save is in flight sends again, after it; a save that lands clears only
  // what it sent, never what was typed since (#255).
  const leave = () => {
    if (typed === null) return;
    const change =
      JSON.stringify(typed.value) === JSON.stringify(saved) ? null : toEdit(typed.value);
    if (change === null) return setTyped(null);
    const sent = typed;
    edit.mutate(change, { onSuccess: () => setTyped((now) => (now === sent ? null : now)) });
  };
  return { shown, set: (value: T) => setTyped({ value }), leave, edit };
}
