// The drafts as the S19 board draws them: node id, region (the folder's first part), revision,
// who wrote it and state. A draft's summary carries no title (M4K.1).
import { Link } from "react-router";
import type { DraftSummaryOut } from "../../api/schema";

const TAG: Record<string, [string, string]> = {
  open: ["Open", "bg-line-soft text-btn"],
  submitted: ["In review", "bg-sel-soft text-sel"],
  approved: ["Approved", "border border-border-2 text-ink-2"],
};
const CELL = "px-4 text-left text-[13.5px]";

export function DraftsTable({ drafts }: { drafts: readonly DraftSummaryOut[] }) {
  return (
    <div className="overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full min-w-[620px] border-collapse">
        <thead>
          <tr className="text-[11.5px] text-ink-3">
            <th className="px-4 py-2.5 text-left font-normal">Node</th>
            <th className="px-4 py-2.5 text-left font-normal">Region</th>
            <th className="px-4 py-2.5 text-left font-normal">Revision</th>
            <th className="px-4 py-2.5 text-left font-normal">Who wrote it</th>
            <th className="px-4 py-2.5">
              <span className="sr-only">State</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((draft) => {
            const [label, tone] = TAG[draft.state] ?? [draft.state, "text-ink-2"];
            return (
              <tr key={draft.public_id} className="h-[52px] border-t border-border">
                <td className={CELL}>
                  <Link
                    to={`/studio/drafts/${draft.public_id}`}
                    className="font-mono text-[13px] font-medium text-sel"
                  >
                    {draft.node_id}
                  </Link>
                </td>
                <td className={`${CELL} text-ink-2 capitalize`}>
                  {(draft.folder.split("/")[0] ?? "").replace("-", " ")}
                </td>
                <td className={`${CELL} text-ink-3 tabular-nums`}>rev {draft.revision}</td>
                <td className={`${CELL} text-ink-2`}>
                  {draft.contributors.map((member) => member.name || member.email).join(", ")}
                </td>
                <td className={`${CELL} text-right`}>
                  <span
                    className={`rounded-pill px-[9px] py-0.5 text-[11.5px] font-semibold ${tone}`}
                  >
                    {label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {drafts.length === 0 && (
        <p className="border-t border-border px-4 py-4 text-[13.5px] text-ink-2">No drafts here.</p>
      )}
    </div>
  );
}
