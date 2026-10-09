// One kind of link (the WorkbenchLinks board, M4K.3): rows of node and reason, saved as a whole
// list when you leave it. A row left without a node is dropped.
import { useRef } from "react";
import type { LinkOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { CARD, HINT, INPUT } from "./bench";
import { type LinkKind, links } from "./edits";
import { LeaveToSave } from "./LeaveToSave";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { useLeaveEdit } from "./useLeaveEdit";

const ROW = "grid gap-2.5 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center";
const kept = (rows: LinkOut[]) => rows.filter((row) => row.node.trim() !== "");

export function LinkList(props: {
  draftId: string;
  kind: LinkKind;
  title: string;
  sub: string;
  saved: LinkOut[];
  editable: boolean;
  after?: string;
  onReload: () => void;
}) {
  const { draftId, kind, title, sub, saved, editable, after, onReload } = props;
  const list = useLeaveEdit(draftId, saved, (rows) =>
    JSON.stringify(kept(rows)) === JSON.stringify(saved) ? null : links(kind, kept(rows)),
  );
  const rows = list.shown;
  const put = (at: number, row: LinkOut) => list.set(rows.map((r, i) => (i === at ? row : r)));
  const refusal = refusalOf(list.edit.error);
  // Focus stays in the list when a row goes, so leaving the list afterwards still saves it.
  const add = useRef<HTMLButtonElement>(null);
  const remove = (at: number) => {
    add.current?.focus();
    list.set(rows.filter((_, i) => i !== at));
  };
  return (
    <div className={`${CARD} gap-2.5`}>
      <LeaveToSave onLeave={list.leave}>
        <legend className="float-left flex w-full items-baseline justify-between gap-3 p-0">
          <span className="text-[14.5px] font-semibold">{title}</span>
        </legend>
        <span className={HINT}>{sub}</span>
        {rows.length > 0 && (
          <div className={`${ROW} ${HINT} max-sm:hidden`} aria-hidden="true">
            <span>Node</span>
            <span>Reason</span>
            <span className="w-[84px]" />
          </div>
        )}
        {rows.map((row, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a row has no identity beyond its place while typed
          <div key={at} className={ROW}>
            <input
              aria-label="Node"
              value={row.node}
              disabled={!editable}
              onChange={(e) => put(at, { ...row, node: e.target.value })}
              className={`${INPUT} font-mono text-[13px]`}
            />
            <input
              aria-label="Reason"
              value={row.reason}
              disabled={!editable}
              onChange={(e) => put(at, { ...row, reason: e.target.value })}
              className={INPUT}
            />
            {editable && (
              <button type="button" className={SECONDARY} onClick={() => remove(at)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2.5">
          {editable && (
            <button
              ref={add}
              type="button"
              className={`${SECONDARY} text-sel`}
              onClick={() => list.set([...rows, { node: "", reason: "" }])}
            >
              + Link
            </button>
          )}
          {after !== undefined && <span className={HINT}>{after}</span>}
        </div>
        {refusal !== null && (
          <RefusalNotice
            refusal={refusal}
            onReload={() => {
              list.edit.reset();
              onReload();
            }}
          />
        )}
      </LeaveToSave>
    </div>
  );
}
