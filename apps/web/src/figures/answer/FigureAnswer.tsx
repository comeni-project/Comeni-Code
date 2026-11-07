// Answering by the figure (M6.6b spec, M6FA.4): the figure a question names, drawn by its kit with
// the learner's selection, each k-mer a real button over it; a line reading the selection back,
// and Undo, Clear and Check. Asked, it gives nothing away; answered, it draws what its component
// computed. One component for the try, the test question, Review and the composer's states.
import { type ComponentType, useState } from "react";
import type { FigureOut } from "../../api/schema";
import { accepted } from "../../node/grading";
import { spells } from "../domain/kmers";
import { type FigureView, type KitProps, RENDERERS } from "../registry";
import type { Component } from "../schemas";
import { nextOf, pick, refused, said, type TaskName } from "./selection";

/** How a checked answer came out: wrong keeps the selection, red, to fix; right draws the answer;
 * revealed draws it too, shown rather than found, and says so (#413). */
export type Outcome = "wrong" | "right" | "revealed" | null;

const BUTTON =
  "inline-flex min-h-9 items-center rounded-[9px] border border-border-2 bg-surface px-3.5 text-[13.5px] font-medium text-ink disabled:text-ink-3";

export function FigureAnswer({
  record,
  selection,
  onSelect,
  outcome = null,
  onCheck,
  again = false,
  still = false,
}: {
  record: FigureOut;
  selection: string[];
  onSelect: (selection: string[]) => void;
  outcome?: Outcome;
  /** Check, beside Undo and Clear: a try's; a test question has none. */
  onCheck?: () => void;
  /** Checked before and wrong: Check says Check again, as the board's wrong answer does. */
  again?: boolean;
  /** Drawn as a state, to look at: no buttons and no controls (the composer's strip). */
  still?: boolean;
}) {
  const [notTaken, setNotTaken] = useState<string | null>(null);
  const task = String(record.interact?.task ?? "trace") as TaskName;
  const edges = (record.derived.edges ?? []) as [string, string][];
  const revealed = outcome === "revealed";
  const answered = outcome === "right" || revealed;
  const shown =
    revealed || (answered && (task === "trace" || selection.length === 0))
      ? (accepted(record)[0] ?? selection)
      : selection;
  const choose = (kmer: string) => {
    const next = pick(task, edges, selection, kmer);
    setNotTaken(null);
    if (next === null) {
      const why = refused(edges, selection, kmer);
      // Cleared first, then said, so the same refusal twice is announced twice (#412).
      queueMicrotask(() => setNotTaken(why));
    }
    if (next !== null) onSelect(next);
  };
  const view: FigureView = {
    selection: shown,
    tone: answered ? "line" : outcome === "wrong" ? "open" : "sel",
    next: task === "trace" && !answered ? nextOf(edges, selection) : [],
    marks: answered,
    order: task === "trace",
    ...(still || answered ? {} : { onPick: choose }),
  };
  const Kit = RENDERERS[record.component as Component] as ComponentType<KitProps<Component>>;
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-canvas px-4 py-3">
        <Kit
          data={record.data as unknown as KitProps<Component>["data"]}
          derived={record.derived}
          alt={record.alt}
          view={view}
        />
      </div>
      <p
        aria-live="polite"
        data-testid="figure-answer-said"
        className="m-0 font-mono text-[13.5px] text-ink-2"
      >
        {revealed
          ? task === "trace"
            ? `The path ${shown.join(" → ")} spells ${spells(shown)}`
            : `Any k-mer of the run is right: ${accepted(record).flat().join(", ")}`
          : said(task, shown)}
      </p>
      {/* Always there, so each refusal is announced, the same one again too (#412). */}
      {!still && (
        <p role="status" className="m-0 min-h-[1em] text-[12.5px] text-ink-2">
          {notTaken}
        </p>
      )}
      {!still && !answered && (
        <div className="flex items-center gap-2">
          {task === "trace" && (
            <button
              type="button"
              className={BUTTON}
              disabled={selection.length === 0}
              onClick={() => {
                setNotTaken(null);
                onSelect(selection.slice(0, -1));
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            className={BUTTON}
            disabled={selection.length === 0}
            onClick={() => {
              setNotTaken(null);
              onSelect([]);
            }}
          >
            Clear
          </button>
          <span className="flex-1" />
          {onCheck !== undefined && (
            <button
              type="button"
              disabled={selection.length === 0}
              onClick={onCheck}
              className="inline-flex min-h-10 items-center rounded-[10px] bg-btn px-[18px] text-[14px] font-semibold text-btn-ink shadow-[0_3px_0_var(--btn-sh)] disabled:bg-border-2 disabled:text-ink-3 disabled:shadow-none"
            >
              {again || outcome === "wrong" ? "Check again" : "Check"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
