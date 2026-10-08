// The S3 board's header (M4K.1): where the draft sits, its title, state and level, its revision —
// or when this page last saved it — the preview in a tab of its own, and Submit for review.
import { useMutationState } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { DraftNodeOut, DraftOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { LevelTag } from "../../node/tags";
import { SubmitButton } from "./SubmitButton";

const STATE: Record<string, string> = {
  open: "Draft",
  submitted: "In review",
  approved: "Approved",
  landed: "Landed",
  discarded: "Discarded",
};

export function Header({ draft, node }: { draft: DraftOut; node: DraftNodeOut }) {
  const region = node.region.replace("-", " ");
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <nav aria-label="Where" className="text-[12.5px] text-ink-3">
          <Link to="/studio/drafts" className="hover:text-sel">
            Drafts
          </Link>
          {" › "}
          <span className="capitalize">{region}</span>
          {" › "}
          {node.title}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{node.title}</h1>
          <span className="rounded-pill bg-sel-soft px-[9px] py-0.5 text-[11.5px] font-semibold text-sel">
            {STATE[draft.state] ?? draft.state}
          </span>
          <LevelTag level={node.level} />
          <Saved draft={draft} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/studio/drafts/${draft.public_id}/preview`}
          target="_blank"
          rel="noreferrer"
          className={SECONDARY}
        >
          Open preview in a new tab
        </a>
        {draft.state === "open" && <SubmitButton draft={draft} />}
      </div>
    </header>
  );
}

/** `Revision n`, or how long ago this page saved it: read from the edits' own record (M4K.2). */
function Saved({ draft }: { draft: DraftOut }) {
  const times = useMutationState({
    filters: { mutationKey: ["draft-edit", draft.public_id], status: "success" },
    select: (mutation) => mutation.state.submittedAt,
  });
  const last = times.at(-1);
  const now = useNow(last !== undefined);
  const said =
    last === undefined
      ? `Revision ${draft.revision}`
      : `Revision ${draft.revision} · saved ${Math.max(0, Math.round((now - last) / 1000))}s ago`;
  return <span className="text-[12.5px] text-ink-3 tabular-nums">{said}</span>;
}

/** The time, again every few seconds while something is counting from it. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}
