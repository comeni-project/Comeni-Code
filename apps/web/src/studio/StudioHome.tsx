// /studio opens Drafts for every Studio role, independently of rail ordering (issue 490).
import { Navigate } from "react-router";
import { useMe } from "../api/queries";
import { pagesFor } from "./pages";

export function StudioHome() {
  const first = pagesFor(useMe().data?.user?.role ?? "").find(
    (page) => page.path === "/studio/drafts",
  );
  return first === undefined ? null : <Navigate to={first.path} replace />;
}
