// A tab with unsaved work holds the tab bar (M6.8b spec, M6PB.5): switching tab asks Save · Discard
// · Stay in the page. useLeaveGuard watches the path only, and a tab is `?tab=`, so the bar asks.
// Save switches only once the save lands; a refused save stays, with its problems.
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

export interface Hold {
  /** Saves the tab's work; true once it landed. */
  save: () => Promise<boolean>;
}

type Holder = { current: Hold | null };
const HoldContext = createContext<Holder>({ current: null });

export function TabHoldProvider({ children }: { children: ReactNode }) {
  const holder = useRef<Hold | null>(null);
  return <HoldContext.Provider value={holder}>{children}</HoldContext.Provider>;
}

/** Hold the tab bar while `hold` is given; let go when it is null or the tab goes away. */
export function useHoldTab(hold: Hold | null): void {
  const holder = useContext(HoldContext);
  useEffect(() => {
    holder.current = hold;
    return () => {
      if (holder.current === hold) holder.current = null;
    };
  }, [holder, hold]);
}

/** The tab bar's side: `ask(go)` goes at once when nothing is held, else asks first. */
export function useTabAsk(): { ask: (go: () => void) => void; confirm: ReactNode } {
  const holder = useContext(HoldContext);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const ask = (go: () => void) => {
    if (holder.current === null) go();
    else setPending(() => go);
  };
  const confirm =
    pending === null ? null : (
      <div
        role="dialog"
        aria-label="Unsaved changes"
        className="flex flex-wrap items-center gap-3 rounded-control bg-open-soft px-4 py-2.5 text-[13.5px]"
      >
        <span className="font-semibold">Save the problem first?</span>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const hold = holder.current;
            setSaving(true);
            const landed = hold === null ? true : await hold.save();
            setSaving(false);
            const go = pending;
            setPending(null);
            if (landed) go();
          }}
          className="rounded-control bg-btn px-3 py-1.5 text-[13px] font-semibold text-btn-ink disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            const go = pending;
            holder.current = null;
            setPending(null);
            go();
          }}
          className="rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px]"
        >
          Discard
        </button>
        <button type="button" onClick={() => setPending(null)} className="text-ink-2 underline">
          Stay
        </button>
      </div>
    );
  return { ask, confirm };
}
