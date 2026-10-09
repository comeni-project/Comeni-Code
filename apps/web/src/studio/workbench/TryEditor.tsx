// A try block's question (M4K.3): the ask, a choice's options (one right; a misconception belongs
// to an exam option, never a try, #257) or a number's answer, unit and tolerance, the hints and
// the rationale. It edits the question BlockEditor holds, which sends it with the block.
import { useId, useRef, useState } from "react";
import { Field } from "../../account/Field";
import type { OptionIn, TryQuestionIn } from "../../api/schema";
import { blankOptions } from "./question";

const OPTION = "flex flex-col gap-1.5 rounded-control border border-border p-2.5";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium";
const BOX =
  "rounded-control border border-border-2 bg-surface px-3 py-2 text-[14px] font-normal outline-none focus:border-sel";

export function TryEditor({
  question,
  onChange,
}: {
  question: TryQuestionIn;
  onChange: (question: TryQuestionIn) => void;
}) {
  const kindName = useId();
  const options = question.options ?? [];
  const setOption = (at: number, option: OptionIn) =>
    onChange({ ...question, options: options.map((o, i) => (i === at ? option : o)) });
  const setKind = (kind: "choice" | "number") =>
    onChange(
      kind === "choice"
        ? { ...question, kind, options: blankOptions(), answer: null, tolerance: null, unit: "" }
        : { ...question, kind, options: null },
    );
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
      <fieldset className="flex w-fit rounded-control border border-border bg-bg p-[3px]">
        <legend className="sr-only">Answer kind</legend>
        {(["choice", "number"] as const).map((kind) => (
          <label
            key={kind}
            className={`cursor-pointer rounded-[7px] px-3 py-1 text-[12.5px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sel ${
              question.kind === kind ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
            }`}
          >
            <input
              type="radio"
              name={kindName}
              className="sr-only"
              checked={question.kind === kind}
              onChange={() => setKind(kind)}
            />
            {kind === "choice" ? "Choice" : "Number"}
          </label>
        ))}
      </fieldset>
      {question.kind === "choice" ? (
        <Options
          options={options}
          onChange={(next) => onChange({ ...question, options: next })}
          set={setOption}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <NumberField
            label="Answer"
            value={question.answer ?? null}
            onChange={(answer) => onChange({ ...question, answer })}
          />
          <Field
            label="Unit"
            value={question.unit ?? ""}
            onChange={(unit) => onChange({ ...question, unit })}
          />
          <NumberField
            label="Tolerance"
            value={question.tolerance ?? null}
            onChange={(tolerance) => onChange({ ...question, tolerance })}
          />
        </div>
      )}
      <div className={LABEL}>
        <label htmlFor={`${kindName}-hints`}>Hints</label>
        <textarea
          id={`${kindName}-hints`}
          aria-describedby={`${kindName}-hints-hint`}
          value={question.hints.join("\n")}
          rows={2}
          onChange={(e) => onChange({ ...question, hints: e.target.value.split("\n") })}
          className={BOX}
        />
        <span id={`${kindName}-hints-hint`} className="text-[12.5px] font-normal text-ink-3">
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

function Options({
  options,
  onChange,
  set,
}: {
  options: OptionIn[];
  onChange: (options: OptionIn[]) => void;
  set: (at: number, option: OptionIn) => void;
}) {
  const group = useId();
  // Focus stays in the editor when an option goes, so leaving the block afterwards still saves it.
  const add = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-2">
      {options.map((option, at) => {
        const n = at + 1;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: an option has no identity beyond its place
          <div key={at} className={OPTION}>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name={group}
                aria-label={`Option ${n} is the right answer`}
                checked={option.right === true}
                onChange={() => onChange(options.map((o, i) => ({ ...o, right: i === at })))}
              />
              <input
                aria-label={`Option ${n}`}
                value={option.text}
                onChange={(e) => set(at, { ...option, text: e.target.value })}
                className={`${BOX} h-9 flex-1`}
              />
              <button
                type="button"
                aria-label={`Remove option ${n}`}
                disabled={options.length <= 2}
                onClick={() => {
                  add.current?.focus();
                  onChange(options.filter((_, i) => i !== at));
                }}
                className="rounded-[6px] px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-bg disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
      <button
        ref={add}
        type="button"
        onClick={() => onChange([...options, { text: "", right: false, misconception: "" }])}
        className="self-start text-[13px] font-medium text-sel"
      >
        + Option
      </button>
    </div>
  );
}

/** A number typed as text, so "0." survives the keystroke; empty or unreadable is no number. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <label className={LABEL}>
      {label}
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const read = Number(e.target.value);
          onChange(e.target.value.trim() === "" || Number.isNaN(read) ? null : read);
        }}
        className={`${BOX} h-10`}
      />
    </label>
  );
}
