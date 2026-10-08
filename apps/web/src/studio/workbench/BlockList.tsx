// The body's blocks (S3, M4K.3): a row per block with Edit, Move and Delete (confirmed in place)
// and a drag handle; add points between rows. One editor is open at a time, and opening another
// leaves the first, which saves it. A draft that is not open shows the rows alone.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../api/queries";
import type { DraftNodeOut, TryQuestionIn } from "../../api/schema";
import type { Block } from "../../node/body";
import { BlockEditor } from "./BlockEditor";
import { deleteBlock, moveBlock } from "./edits";
import { firstWords } from "./Outline";
import { newQuestion, questionIn } from "./question";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { useDraftEdit } from "./useDraftEdit";

/** Which editor is open: an existing block's, or a new block's at a place. */
export interface Opened {
  at: number;
  fresh: Block | null;
  question?: TryQuestionIn | undefined;
}

/** The editor for a block already there: a try brings its question. */
export function existing(node: DraftNodeOut, at: number): Opened {
  const block = node.blocks[at];
  const found =
    block?.kind === "try" ? node.questions.find((q) => q.id === block.question) : undefined;
  return { at, fresh: null, question: found && questionIn(found) };
}

const BLANK = {
  text: { kind: "text", markdown: "" },
  callout: { kind: "callout", callout: "misconception", title: "", markdown: "" },
} as const satisfies Record<string, Block>;
const ADDS = [
  ["text", "Add a text block"],
  ["try", "Add a try block"],
  ["callout", "Add a callout"],
] as const;
const TOOL = "rounded-[6px] px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-bg disabled:opacity-40";

interface Props {
  draftId: string;
  nodeId: string;
  node: DraftNodeOut;
  editable: boolean;
  opened: Opened | null;
  open: (opened: Opened) => void;
  close: (opened: Opened) => void;
}

export function BlockList({ draftId, nodeId, node, editable, opened, open, close }: Props) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [confirming, setConfirming] = useState<number | null>(null);
  const last = node.blocks.length - 1;
  const refusal = refusalOf(edit.error);

  const editor = (o: Opened, block: Block) => (
    <BlockEditor
      key={`${o.at}:${o.fresh === null ? "edit" : "new"}`}
      draftId={draftId}
      at={o.at}
      insert={o.fresh !== null}
      initial={block}
      question={o.question}
      onClose={() => close(o)}
    />
  );
  const adder = (at: number) =>
    editable && (
      <div className="group flex items-center gap-2 py-0.5">
        <span className="h-px flex-1 bg-border" />
        <span className="flex gap-1.5 opacity-40 group-hover:opacity-100 group-focus-within:opacity-100">
          {ADDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              aria-label={label}
              onClick={() => open(fresh(at, kind))}
              className="rounded-[6px] border border-border-2 bg-surface px-2 py-0.5 font-mono text-[11.5px] text-sel"
            >
              + {kind}
            </button>
          ))}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  const fresh = (at: number, kind: (typeof ADDS)[number][0]): Opened => {
    if (kind !== "try") return { at, fresh: BLANK[kind] };
    const question = newQuestion(nodeId, node.questions);
    return { at, fresh: { kind: "try", question: question.id }, question };
  };
  const freshAt = (at: number) =>
    opened !== null && opened.fresh !== null && opened.at === at && editor(opened, opened.fresh);

  return (
    <section aria-label="Blocks" className="flex min-w-0 flex-col gap-1.5">
      {refusal !== null && (
        <RefusalNotice
          refusal={refusal}
          onReload={() => {
            edit.reset();
            void client.refetchQueries({ queryKey: queryKeys.draft(draftId) });
          }}
        />
      )}
      {node.blocks.map((block, at) => {
        const n = at + 1;
        const row =
          opened !== null && opened.fresh === null && opened.at === at ? (
            editor(opened, block)
          ) : (
            // biome-ignore lint/a11y/noStaticElementInteractions: dragging is the pointer's shortcut; Move up and down are the keyboard's way
            <div
              draggable={editable}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(at))}
              onDragOver={(e) => editable && e.preventDefault()}
              onDrop={(e) => {
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (editable && from !== at) edit.mutate(moveBlock(from, at));
              }}
              className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-[9px]"
            >
              {editable && (
                <span
                  aria-hidden="true"
                  className="cursor-grab text-[13px] tracking-[-2px] text-ink-3"
                >
                  ⋮⋮
                </span>
              )}
              <span className="rounded-[5px] border border-border bg-bg px-[7px] py-px font-mono text-[11px] text-ink-2">
                {block.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                {firstWords(block, node)}
              </span>
              {editable && confirming === at && (
                <span className="flex items-center gap-2 text-[12.5px]">
                  <span className="text-open">
                    {block.kind === "try"
                      ? "Delete this block and its question?"
                      : "Delete this block?"}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-open"
                    onClick={() => {
                      setConfirming(null);
                      edit.mutate(deleteBlock(at));
                    }}
                  >
                    Delete
                  </button>
                  <button type="button" className="text-ink-2" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </span>
              )}
              {editable && confirming !== at && (
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Edit block ${n}`}
                    className={TOOL}
                    onClick={() => open(existing(node, at))}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Move block ${n} up`}
                    className={TOOL}
                    disabled={at === 0 || edit.isPending}
                    onClick={() => edit.mutate(moveBlock(at, at - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move block ${n} down`}
                    className={TOOL}
                    disabled={at === last || edit.isPending}
                    onClick={() => edit.mutate(moveBlock(at, at + 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete block ${n}`}
                    className={TOOL}
                    onClick={() => setConfirming(at)}
                  >
                    Delete
                  </button>
                </span>
              )}
            </div>
          );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a block has no identity beyond its place
          <div key={`${at}:${block.kind}`} className="flex flex-col gap-1.5">
            {adder(at)}
            {freshAt(at)}
            {row}
          </div>
        );
      })}
      {adder(node.blocks.length)}
      {freshAt(node.blocks.length)}
    </section>
  );
}
