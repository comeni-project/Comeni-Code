// Leaving the composer with unsaved work asks first (M6CO.2, #391): the browser's own prompt for
// a reload or a closed tab, and a confirm for any move inside the app (a link, the rail, Back).
// The composer's own moves (Cancel, and back after a save) are let through with `allow`.
import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";
import { useLeaveWarning } from "../workbench/useLeaveWarning";

export const LEAVE = "Leave the composer? What you changed here is not saved.";

export function useLeaveGuard(unsaved: boolean): () => void {
  const allowed = useRef(false);
  useLeaveWarning(unsaved);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      unsaved && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(LEAVE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  return () => {
    allowed.current = true;
  };
}
