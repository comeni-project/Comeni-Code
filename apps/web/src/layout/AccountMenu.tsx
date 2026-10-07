// The account menu of the AccountMenu board, trimmed to what exists (M4S.1): who you are, Open
// Studio for the team, Sign out. Knowledge, routes, problems and theme arrive with their phases.
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router";
import { signOut } from "../api/auth";
import type { MemberOut } from "../api/schema";
import { leave } from "./leave";

const ITEM = "flex rounded-[8px] px-3.5 py-2.5 text-left text-[14px] hover:bg-bg";

export function AccountMenu({ user, onClose }: { user: MemberOut; onClose: () => void }) {
  const out = useMutation({
    mutationFn: signOut,
    // A full load of Start: nothing the signed-in session asked stays in memory, and a Studio
    // page's gate never sees the sign-out and sends you to Sign in instead.
    onSuccess: () => leave("/"),
  });
  return (
    <div
      role="menu"
      className="absolute top-full right-0 z-10 mt-2 flex w-72 flex-col rounded-panel border border-border bg-surface p-2 shadow-[var(--float)]"
    >
      <div className="flex flex-col gap-0.5 border-b border-border px-3.5 pt-2.5 pb-3">
        <span className="text-[14px] font-semibold">{user.name || user.email}</span>
        {user.name !== "" && <span className="text-[12.5px] text-ink-3">{user.email}</span>}
      </div>
      {user.role !== "" && (
        <Link role="menuitem" to="/studio" onClick={onClose} className={ITEM}>
          Open Studio
        </Link>
      )}
      <button role="menuitem" type="button" onClick={() => out.mutate()} className={ITEM}>
        Sign out
      </button>
    </div>
  );
}
