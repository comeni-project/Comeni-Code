// A landing's state as a tag (M4.9c spec, M4LS.3): blue while it moves, red when it failed and
// holds its drafts, grey once settled (invariant 11).
import { moving } from "../../api/landing";
import type { LandingOut } from "../../api/schema";

const TAG =
  "inline-flex w-fit rounded-pill px-[9px] py-0.5 text-[11.5px] font-semibold whitespace-nowrap";

export function StateTag({ landing }: { landing: LandingOut }) {
  if (moving(landing)) return <span className={`${TAG} bg-sel-soft text-sel`}>Landing</span>;
  if (landing.state === "failed")
    return <span className={`${TAG} bg-open-soft text-open`}>Failed</span>;
  const word =
    landing.state === "merged" ? "Landed" : landing.state === "refused" ? "Refused" : "Closed";
  return <span className={`${TAG} border border-border-2 font-medium text-ink-2`}>{word}</span>;
}
