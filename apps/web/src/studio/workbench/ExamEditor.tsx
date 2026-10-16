// One exam question, open (M4.8d spec, M4P.5): its title, claim and level, the stem as blocks, the
// answer and the rationale, held here and saved when you leave the editor — POST when new, PUT
// otherwise, nothing when unchanged. Refused, it stays with what you typed and why.
import { useQueryClient } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { BlockIn, ExamQuestionIn, Level } from "../../api/schema";
import { LEVELS } from "../drafts/NewNodeForm";
import { AnswerEditor, type AnswerFields, KindSwitch } from "./AnswerEditor";
import { LettersField } from "./BlockEditor";
import { BOX, LABEL } from "./bench";
import { addExam, deleteExam, updateExam } from "./edits";
import { sent } from "./exam";
import { LeaveToSave } from "./LeaveToSave";
import { MarkdownField } from "./MarkdownField";
import { MathField } from "./MathField";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { reloadDraft, useDraftEdit } from "./useDraftEdit";
import { useLeaveWarning } from "./useLeaveWarning";

const PANEL = "flex flex-col rounded-panel border border-border bg-surface";
const HEAD = "flex items-center gap-2.5 border-b border-border px-3 py-[9px]";
const CHIP =
  "rounded-[5px] border border-border bg-bg px-[7px] py-px font-mono text-[11px] text-ink-2";
const TOOL = "rounded-[6px] px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-bg disabled:opacity-30";

export function ExamEditor({
  draftId,
  initial,
  fresh,
  number,
  editable,
  onSaved,
  onDeleted,
  onChange,
  flush,
}: {
  draftId: string;
  initial: ExamQuestionIn;
  fresh: boolean;
  number: number;
  editable: boolean;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onChange?: (question: ExamQuestionIn, changed: boolean) => void;
  /** Set to this editor's save, so choosing another question saves this one first, blur or not
   * (Safari focuses no button; Firefox blurs nothing that is removed) (#268). */
  flush?: RefObject<(() => void) | null>;
}) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [question, setQuestion] = useState(initial);
  // What the draft holds of this question; null until a new one is first saved.
  const [base, setBase] = useState<ExamQuestionIn | null>(fresh ? null : initial);
  const [confirming, setConfirming] = useState(false);
  // Asking and cancelling each replace the pressed button: focus goes to the one drawn instead,
  // so it stays in the editor and leaving afterwards still saves (#268).
  const cancel = useRef<HTMLButtonElement>(null);
  const ask = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (asked.current) ask.current?.focus();
    asked.current = confirming;
  }, [confirming]);
  // Focus stays in the editor when a stem block goes, so leaving afterwards still saves it.
  const addStem = useRef<HTMLButtonElement>(null);
  const changed =
    base === null
      ? JSON.stringify(question) !== JSON.stringify(initial)
      : JSON.stringify(sent(question)) !== JSON.stringify(sent(base));
  useLeaveWarning(editable && changed);
  useEffect(() => onChange?.(question, changed), [question, changed, onChange]);

  const set = (patch: Partial<ExamQuestionIn>) => setQuestion((now) => ({ ...now, ...patch }));
  // A key per stem block that moves with it, so a moved block keeps its field.
  const made = useRef(initial.stem.length);
  const [keys, setKeys] = useState(() => initial.stem.map((_, at) => at));
  const setStem = (stem: BlockIn[], nextKeys: number[]) => {
    setKeys(nextKeys);
    set({ stem });
  };
  // A save in flight, known at once: a blur and a choice can both ask in one tick, before
  // `isPending` is drawn (#268).
  const sending = useRef(false);
  const commit = () => {
    if (!editable || sending.current || !changed) return;
    const out = sent(question);
    sending.current = true;
    edit.mutate(base === null ? addExam(out) : updateExam(base.id, out), {
      onSuccess: () => {
        setBase(question);
        onSaved(question.id);
      },
      onSettled: () => {
        sending.current = false;
      },
    });
  };
  if (flush) flush.current = commit;
  const remove = () => {
    setConfirming(false);
    if (base === null) return onDeleted();
    edit.mutate(deleteExam(base.id), { onSuccess: onDeleted });
  };
  const refusal = refusalOf(edit.error);

  return (
    <LeaveToSave onLeave={commit} className="flex flex-col gap-2.5 border-0 p-0">
      <fieldset disabled={!editable} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 max-w-full items-center gap-1.5 text-[15px] font-semibold">
            <span className="shrink-0">Q{number} ·</span>
            <input
              aria-label="Title"
              placeholder="A title, in a few words"
              value={question.title}
              onChange={(e) => set({ title: e.target.value })}
              className="min-w-[12ch] max-w-full rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 outline-none [field-sizing:content] hover:border-border focus:border-sel"
            />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 text-[12px] text-ink-3">
            <span>tests the claim:</span>
            <input
              aria-label="Claim"
              placeholder="what a right answer shows"
              value={question.claim ?? ""}
              onChange={(e) => set({ claim: e.target.value })}
              className="min-w-[22ch] max-w-[48ch] rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-ink-2 outline-none [field-sizing:content] hover:border-border focus:border-sel"
            />
            <select
              aria-label="Level"
              value={question.level ?? ""}
              onChange={(e) =>
                set({ level: e.target.value === "" ? null : (e.target.value as Level) })
              }
              className="h-7 rounded-control border border-border-2 bg-surface px-1.5 text-[12px] text-ink"
            >
              <option value="">the node's level</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className={PANEL}>
          <div className={HEAD}>
            <h3 className="text-[12.5px] font-semibold">Stem</h3>
            <span className="text-[12px] text-ink-3">blocks, as on a page</span>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {question.stem.map((block, at) => {
              const n = at + 1;
              const label = `Stem block ${n}`;
              const put = (next: BlockIn) =>
                setStem(
                  question.stem.map((b, i) => (i === at ? next : b)),
                  keys,
                );
              const move = (by: number) => {
                const swapped = <T,>(list: T[]) => {
                  const next = [...list];
                  [next[at], next[at + by]] = [next[at + by] as T, next[at] as T];
                  return next;
                };
                setStem(swapped(question.stem), swapped(keys));
              };
              return (
                <div
                  key={keys[at]}
                  className="flex flex-col gap-1.5 rounded-[9px] border border-border p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className={CHIP}>{block.kind}</span>
                    {editable && (
                      <span className="ml-auto flex items-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`Move stem block ${n} up`}
                          disabled={at === 0}
                          onClick={() => move(-1)}
                          className={TOOL}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move stem block ${n} down`}
                          disabled={at === question.stem.length - 1}
                          onClick={() => move(1)}
                          className={TOOL}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete stem block ${n}`}
                          onClick={() => {
                            addStem.current?.focus();
                            setStem(
                              question.stem.filter((_, i) => i !== at),
                              keys.filter((_, i) => i !== at),
                            );
                          }}
                          className={TOOL}
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                  {block.kind === "sequence" ? (
                    <LettersField
                      label={label}
                      value={block.letters ?? ""}
                      onChange={(letters) => put({ ...block, letters })}
                    />
                  ) : block.kind === "math" ? (
                    <MathField
                      label={label}
                      value={block.tex ?? ""}
                      onChange={(tex) => put({ ...block, tex })}
                    />
                  ) : (
                    <MarkdownField
                      label={label}
                      value={block.markdown ?? ""}
                      onChange={(markdown) => put({ ...block, markdown })}
                    />
                  )}
                </div>
              );
            })}
            {editable && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-[9px] border border-dashed border-border-2 px-2 py-1.5">
                <span className="pr-1 text-[12px] text-ink-3">Add to stem</span>
                {(["text", "sequence", "math"] as const).map((kind) => (
                  <button
                    key={kind}
                    ref={kind === "text" ? addStem : undefined}
                    type="button"
                    aria-label={`Add a ${{ text: "text block", sequence: "sequence", math: "math block" }[kind]} to the stem`}
                    onClick={() => {
                      made.current += 1;
                      setStem(
                        [
                          ...question.stem,
                          kind === "text"
                            ? { kind, markdown: "" }
                            : kind === "math"
                              ? { kind, tex: "" }
                              : { kind, letters: "" },
                        ],
                        [...keys, made.current],
                      );
                    }}
                    className="rounded-[6px] border border-border-2 px-2 py-0.5 font-mono text-[11px]"
                  >
                    {kind}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={PANEL}>
          <div className={`${HEAD} justify-between py-1.5`}>
            <h3 className="text-[12.5px] font-semibold">Answer</h3>
            <KindSwitch
              value={question as ExamQuestionIn & AnswerFields}
              exam
              onChange={(next) => setQuestion(next)}
            />
          </div>
          <div className="flex flex-col gap-2.5 p-3">
            <AnswerEditor
              value={question as ExamQuestionIn & AnswerFields}
              exam
              kinds={false}
              onChange={(next) => setQuestion(next)}
            />
          </div>
        </section>

        <section className={`${PANEL} gap-1.5 p-3`}>
          <label className={LABEL}>
            <span>
              Rationale <span className="font-normal text-ink-3">· shown only in results</span>
            </span>
            <textarea
              aria-label="Rationale"
              value={question.rationale}
              rows={2}
              onChange={(e) => set({ rationale: e.target.value })}
              className={BOX}
            />
          </label>
        </section>
      </fieldset>

      {refusal !== null && (
        <RefusalNotice
          refusal={refusal}
          onReload={() => {
            edit.reset();
            void reloadDraft(client, draftId);
          }}
        />
      )}

      {editable && (
        <div className="flex items-center justify-end gap-2 text-[12.5px]">
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-open">Delete this question?</span>
              <button type="button" className="font-semibold text-open" onClick={remove}>
                Delete
              </button>
              <button
                ref={cancel}
                type="button"
                className="text-ink-2"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              ref={ask}
              type="button"
              className="text-ink-2 hover:text-open"
              onClick={() => setConfirming(true)}
            >
              {base === null ? "Discard question" : "Delete question"}
            </button>
          )}
        </div>
      )}
    </LeaveToSave>
  );
}
