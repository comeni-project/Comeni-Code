// /studio: the first page the member's role can open (M4S.4); none yet for an author.
import { Navigate } from "react-router";
import { useMe } from "../api/queries";
import { pagesFor } from "./pages";

export function StudioHome() {
  const first = pagesFor(useMe().data?.user?.role ?? "")[0];
  if (first !== undefined) return <Navigate to={first.path} replace />;
  return <p className="text-[15px] text-ink-2">Nothing in Studio for your role yet.</p>;
}
