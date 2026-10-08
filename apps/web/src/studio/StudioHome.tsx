// /studio: the first page the member's role can open (M4S.4) — Drafts, for every role the gate
// lets in.
import { Navigate } from "react-router";
import { useMe } from "../api/queries";
import { pagesFor } from "./pages";

export function StudioHome() {
  const first = pagesFor(useMe().data?.user?.role ?? "")[0];
  return first === undefined ? null : <Navigate to={first.path} replace />;
}
