// The top bar's account cell (M4S.1): Sign in when signed out, else the avatar and its menu.
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { safeNext } from "../account/next";
import { useMe } from "../api/queries";
import { AccountMenu } from "./AccountMenu";
import { SECONDARY } from "./buttons";

export function AccountButton() {
  const me = useMe();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  if (me.isPending) return null;
  // A failed or odd answer is treated as signed out: the bar never blocks a learner's page.
  const user = me.data?.user ?? null;
  if (user === null) {
    const next = encodeURIComponent(safeNext(`${pathname}${search}`));
    return (
      <Link to={`/sign-in?next=${next}`} className={SECONDARY}>
        Sign in
      </Link>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface py-1 pr-2 pl-1 text-ink-2"
      >
        <span className="flex size-[26px] items-center justify-center rounded-full bg-sel-soft text-sel">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="6" r="3" className="fill-none stroke-current" strokeWidth={1.6} />
            <path
              d="M2.5 14c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4"
              className="fill-none stroke-current"
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </svg>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 4.5l3 3 3-3"
            className="fill-none stroke-current"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && <AccountMenu user={user} onClose={() => setOpen(false)} />}
    </div>
  );
}
