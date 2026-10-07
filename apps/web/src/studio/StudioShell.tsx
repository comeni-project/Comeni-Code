// The Studio shell (M4.8a spec, M4S.4): the boards' bar and rail, and one gate for every page.
// The API checks every route itself (M4A.4); the gate only decides what the screen shows.
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { canActAs } from "../api/accounts";
import { useMe } from "../api/queries";
import { ErrorNotice } from "../layout/ErrorNotice";
import { pageAt } from "./pages";
import { Rail } from "./Rail";
import { StudioBar } from "./StudioBar";

function Refused({ needs }: { needs: string | null }) {
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Studio is for the team</h1>
      <p className="text-[15px] text-ink-2">
        {needs === null ? "Your account has no Studio role." : `This page needs the ${needs} role.`}
      </p>
    </div>
  );
}

export function StudioShell() {
  const me = useMe();
  const { pathname, search } = useLocation();
  let inside: ReactNode = null;
  let role: string | null = null;
  // An answer already held stands when asking again fails: the open page is kept.
  if (me.data === undefined) {
    if (me.isError) inside = <ErrorNotice error={me.error} />;
  } else {
    const user = me.data.user;
    const page = pageAt(pathname);
    if (user === null) {
      const next = encodeURIComponent(`${pathname}${search}`);
      inside = <Navigate to={`/sign-in?next=${next}`} replace />;
    } else if (!canActAs(user.role, "author")) {
      inside = <Refused needs={null} />;
    } else if (page !== undefined && !canActAs(user.role, page.minRole)) {
      role = user.role;
      inside = <Refused needs={page.minRole} />;
    } else {
      role = user.role;
      inside = <Outlet />;
    }
  }
  return (
    <div className="flex min-h-screen flex-col">
      <StudioBar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {role !== null && <Rail role={role} />}
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-[26px] py-[22px]">{inside}</main>
      </div>
    </div>
  );
}
