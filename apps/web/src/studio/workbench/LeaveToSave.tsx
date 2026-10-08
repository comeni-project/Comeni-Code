// An edit saves when you leave what you changed (M4K.3): focus moving outside this box calls
// `onLeave`; moving within it does not.
import type { ReactNode } from "react";

export function LeaveToSave({ onLeave, children }: { onLeave: () => void; children: ReactNode }) {
  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onLeave();
      }}
    >
      {children}
    </fieldset>
  );
}
