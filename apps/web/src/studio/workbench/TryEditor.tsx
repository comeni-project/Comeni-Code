// A try block's question (M4K.3): the ask, its answer through the editor both pools share
// (M4P.6; a try option has no misconception, #257), the hints and the rationale. It edits the
// question BlockEditor holds, which sends it with the block. It may show one of the node's figures
// above its ask (M6FG.1).
import { useId } from "react";
import type { TryQuestionIn } from "../../api/schema";
import { AnswerEditor, type AnswerFields } from "./AnswerEditor";
import { BOX, LABEL } from "./bench";

export function TryEditor({
  question,
  onChange,
  figures = [],
}: {
  question: TryQuestionIn;
  onChange: (question: TryQuestionIn) => void;
  /** The node's figures by stem, which the question may show. */
  figures?: string[];
}) {
  const id = useId();
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
      <label className={LABEL}>
        Figure
        <select
          value={question.figure ?? ""}
          onChange={(e) => onChange({ ...question, figure: e.target.value || null })}
          className={`${BOX} h-10 font-mono text-[13px]`}
        >
          <option value="">No figure</option>
          {figures.map((stem) => (
            <option key={stem} value={stem}>
              {stem}
            </option>
          ))}
        </select>
      </label>
      <AnswerEditor
        value={question as TryQuestionIn & AnswerFields}
        onChange={(next) => onChange(next)}
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
