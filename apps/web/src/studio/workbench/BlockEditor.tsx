// One block, open (M4K.3): edited here, saved when you leave it or press Done. Unchanged, or new
// and left empty, it closes with no request; refused, it stays open with what you typed.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BlockIn, TryQuestionIn } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import type { Block } from "../../node/body";
import { NOTE } from "./bench";
import { CalloutFields } from "./CalloutFields";
import { insertBlock, updateBlock } from "./edits";
import { LeaveToSave } from "./LeaveToSave";
import { MarkdownField } from "./MarkdownField";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { BOX, LABEL, TryEditor } from "./TryEditor";
import { reloadDraft, useDraftEdit } from "./useDraftEdit";
import { useLeaveWarning } from "./useLeaveWarning";

export interface BlockEditorProps {
  draftId: string;
  at: number;
  insert: boolean;
  initial: Block;
  question?: TryQuestionIn | undefined;
  onClose: () => void;
}

/** A new block with nothing in it is not worth a request. */
function empty(block: Block, question: TryQuestionIn | undefined): boolean {
  if (block.kind === "text") return block.markdown.trim() === "";
  if (block.kind === "callout") return block.title.trim() === "" && block.markdown.trim() === "";
  if (block.kind === "sequence") return block.letters.trim() === "";
  return question === undefined || question.ask.trim() === "";
}

/** What is sent: text that ends its last line, as every block in a body does (#256). */
function ended(block: Block): Block {
  if (block.kind === "try") return block;
  if (block.kind === "sequence") {
    return block.letters.endsWith("\n") ? block : { ...block, letters: `${block.letters}\n` };
  }
  return block.markdown.endsWith("\n") ? block : { ...block, markdown: `${block.markdown}\n` };
}

/** A try the workbench cannot edit yet: sequence and order arrive with the builder (M4.8d). */
const LATER = new Set(["sequence", "order"]);

/** What is sent: hints without the empty lines a half-typed list has. */
const cleaned = (question: TryQuestionIn | undefined) =>
  question && { ...question, hints: question.hints.filter((hint) => hint.trim() !== "") };

export function BlockEditor({ draftId, at, insert, initial, question, onClose }: BlockEditorProps) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [block, setBlock] = useState<Block>(initial);
  const [asked, setAsked] = useState(question);
  const changed =
    JSON.stringify(block) !== JSON.stringify(initial) ||
    JSON.stringify(cleaned(asked)) !== JSON.stringify(question);
  useLeaveWarning(changed);

  const commit = () => {
    if (edit.isPending) return;
    if (!changed || (insert && empty(block, asked))) return onClose();
    const sent = ended(block) as BlockIn;
    const q = cleaned(asked);
    edit.mutate(insert ? insertBlock(at, sent, q) : updateBlock(at, sent, q), {
      onSuccess: onClose,
    });
  };
  const refusal = refusalOf(edit.error);
  return (
    <LeaveToSave
      onLeave={commit}
      className="flex flex-col gap-2.5 rounded-[10px] border-2 border-sel bg-surface p-3.5 shadow-[0_0_0_4px_var(--sel-soft)]"
    >
      <span className="font-mono text-[11px] text-ink-3">
        {insert ? `new ${block.kind}` : `${block.kind} · block ${at + 1}`}
      </span>
      {block.kind === "text" && (
        <MarkdownField
          value={block.markdown}
          onChange={(markdown) => setBlock({ ...block, markdown })}
        />
      )}
      {block.kind === "callout" && <CalloutFields block={block} onChange={setBlock} />}
      {block.kind === "sequence" && (
        <label className={LABEL}>
          Letters
          <textarea
            value={block.letters}
            rows={3}
            spellCheck={false}
            onChange={(e) => setBlock({ ...block, letters: e.target.value })}
            className={`${BOX} font-mono`}
          />
        </label>
      )}
      {block.kind === "try" && asked !== undefined && LATER.has(asked.kind) && (
        <p className={NOTE}>A {asked.kind} question. Edited in the exam pool's builder (M4.8d).</p>
      )}
      {block.kind === "try" && asked !== undefined && !LATER.has(asked.kind) && (
        <TryEditor question={asked} onChange={setAsked} />
      )}
      {refusal !== null && (
        <RefusalNotice
          refusal={refusal}
          onReload={() => {
            edit.reset();
            void reloadDraft(client, draftId);
          }}
        />
      )}
      <div className="flex justify-end">
        <button type="button" className={SECONDARY} disabled={edit.isPending} onClick={commit}>
          Done
        </button>
      </div>
    </LeaveToSave>
  );
}
