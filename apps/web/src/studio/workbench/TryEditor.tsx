// A try block's question (M4K.3): the ask, its answer through the editor both pools share
// (M4P.6; a try option has no misconception, #257), the hints and the rationale. It edits the
// question BlockEditor holds, which sends it with the block. It may show one of the node's figures
// above its ask (M6FG.1).
import { useId } from "react";
import type { FigureOut, TryQuestionIn } from "../../api/schema";
import { AnswerEditor, type AnswerFields } from "./AnswerEditor";
import { BOX, LABEL } from "./bench";

export function TryEditor({
  question,
  onChange,
  figures = [],
  onCompose,
  onNewFigure,
}: {
  question: TryQuestionIn;
  onChange: (question: TryQuestionIn) => void;
  /** The node's figures, which the question may show, be answered by, or offer as options. */
  figures?: FigureOut[];
  /** Opens the chosen figure in the composer (M6CO.1). */
  onCompose?: (stem: string) => void;
  /** Makes a figure for this question in the composer (M6FA.7); absent for an unsaved one. */
  onNewFigure?: () => void;
}) {
  const id = useId();
  // A figure with a task answers a figure question and nothing else (CS1029, M6FA.1).
  const tasked = figures.filter((f) => f.interact);
  const plain = figures.filter((f) => !f.interact).map((f) => f.stem);
  return (
    <>
      <label className={LABEL}>
        Question
        <textarea
          value={question.ask}
          rows={2}
          onChange={(e) => onChange({ ...question, ask: e.target.value })}
          className={BOX}
        />
      </label>
      {question.kind !== "figure" && (
        <label className={LABEL}>
          Figure
          <select
            value={question.figure ?? ""}
            onChange={(e) => onChange({ ...question, figure: e.target.value || null })}
            className={`${BOX} h-10 font-mono text-[13px]`}
          >
            <option value="">No figure</option>
            {plain.map((stem) => (
              <option key={stem} value={stem}>
                {stem}
              </option>
            ))}
          </select>
        </label>
      )}
      {question.figure && question.kind !== "figure" && onCompose && (
        <button
          type="button"
          className="self-start text-[12.5px] font-medium text-sel hover:text-ink"
          onClick={() => onCompose(question.figure as string)}
        >
          Edit in the composer
        </button>
      )}
      <AnswerEditor
        value={question as TryQuestionIn & AnswerFields}
        onChange={(next) =>
          // A figure question keeps no figure that lacks a task; another kind none that has one.
          onChange(
            next.kind !== question.kind
              ? {
                  ...next,
                  figure:
                    next.kind !== "figure" && plain.includes(question.figure ?? "")
                      ? (question.figure ?? null)
                      : null,
                }
              : next,
          )
        }
        figures={{
          tasked,
          plain,
          chosen: question.kind === "figure" ? (question.figure ?? null) : null,
          onChoose: (stem) => onChange({ ...question, figure: stem || null }),
          ...(onNewFigure ? { onNew: onNewFigure } : {}),
          ...(onCompose ? { onOpen: onCompose } : {}),
        }}
      />
      <div className={LABEL}>
        <label htmlFor={`${id}-hints`}>Hints</label>
        <textarea
          id={`${id}-hints`}
          aria-describedby={`${id}-hints-hint`}
          value={question.hints.join("\n")}
          rows={2}
          onChange={(e) => onChange({ ...question, hints: e.target.value.split("\n") })}
          className={BOX}
        />
        <span id={`${id}-hints-hint`} className="text-[12.5px] font-normal text-ink-3">
          One per line, gentlest first.
        </span>
      </div>
      <label className={LABEL}>
        Rationale
        <textarea
          value={question.rationale}
          rows={2}
          onChange={(e) => onChange({ ...question, rationale: e.target.value })}
          className={BOX}
        />
      </label>
    </>
  );
}
