// S3 · Exam pool (M4.8d spec, M4P.5): the board's three columns — the questions, one question's
// editor, and its preview and checks. The tab brings its own side panel.
import { useState } from "react";
import type { DraftNodeOut, ExamQuestionIn } from "../../api/schema";
import { newExamQuestion } from "./exam";
import { useAfterSaves } from "./useDraftEdit";

/** The question open in the editor: one the draft holds, or a new one not saved yet. */
export type Selected = { id: string } | { fresh: ExamQuestionIn } | null;

const NOTE =
  "A node needs at least 4 approved questions to be included in tests. No hints in exam questions.";

export function ExamPoolTab({
  draftId,
  nodeId,
  node,
  editable,
}: {
  draftId: string;
  nodeId: string;
  node: DraftNodeOut;
  editable: boolean;
}) {
  const after = useAfterSaves(draftId);
  const [selected, setSelected] = useState<Selected>(() =>
    node.exam[0] ? { id: node.exam[0].id } : null,
  );
  // A choice waits for the editor's save to land, and stays put if it is refused (#255).
  const choose = (next: Selected) => after(() => setSelected(next));
  const approved = node.exam.filter((q) => q.state === "approved").length;
  const fresh = selected !== null && "fresh" in selected ? selected.fresh : null;
  const openId = selected !== null && "id" in selected ? selected.id : null;
  return (
    <div className="grid gap-[18px] xl:grid-cols-[230px_minmax(0,1fr)_460px]">
      <aside className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">Questions</h2>
          {editable && (
            <button
              type="button"
              onClick={() => choose({ fresh: newExamQuestion(nodeId, node) })}
              className="text-[12px] text-sel"
            >
              + New
            </button>
          )}
        </div>
        <p className="text-[12px] text-ink-3 tabular-nums">
          {node.exam.length} of 4 · {approved} approved
        </p>
        {node.exam.length === 0 && fresh === null && (
          <p className="text-[12.5px] text-ink-2">No exam questions yet.</p>
        )}
        {node.exam.map((q, at) => (
          <Row
            key={q.id}
            n={at + 1}
            title={q.title || q.id}
            kind={q.kind}
            state={q.state}
            on={openId === q.id}
            onClick={() => choose({ id: q.id })}
          />
        ))}
        {fresh !== null && (
          <Row
            n={node.exam.length + 1}
            title={fresh.title || "New question"}
            kind={fresh.kind}
            state="new"
            on
            onClick={() => {}}
          />
        )}
        <p className="pt-1 text-[11.5px] leading-[1.45] text-ink-3">{NOTE}</p>
      </aside>
    </div>
  );
}

function Row({
  n,
  title,
  kind,
  state,
  on,
  onClick,
}: {
  n: number;
  title: string;
  kind: string;
  state: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={on}
      aria-label={`${title}, ${kind}, ${state}`}
      onClick={onClick}
      className={`flex flex-col gap-[3px] rounded-[9px] px-2.5 py-[9px] text-left ${
        on ? "bg-sel-soft shadow-[inset_3px_0_0_var(--sel)]" : "border border-border bg-surface"
      }`}
    >
      <span className="font-mono text-[11px] text-ink-3">
        Q{n} · {kind}
      </span>
      <span className={`text-[12.5px] leading-[1.35] ${on ? "font-semibold" : "font-medium"}`}>
        {title}
      </span>
      <span className={`text-[11px] ${state === "approved" ? "text-ink-3" : "text-sel"}`}>
        {state}
      </span>
    </button>
  );
}
