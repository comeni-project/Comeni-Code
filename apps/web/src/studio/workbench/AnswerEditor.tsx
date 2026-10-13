// A question's answer, for both pools (M4.8d spec, M4P.6): the kind switch and each kind's editor —
// a choice's options, a number with its unit and tolerance, a sequence with what else is accepted,
// an order's steps in their right order. In the exam pool a wrong option names a misconception or
// says it is plain on purpose; a try option has neither (#257).
import { useId, useRef, useState } from "react";
import { Field } from "../../account/Field";
import type { OptionIn } from "../../api/schema";
import { BOX, LABEL } from "./bench";
import { blankOptions } from "./question";

export type AnswerKind = "choice" | "number" | "sequence" | "order";

/** The answer fields both pools' inputs share (AnswerIn in the API). */
export interface AnswerFields {
  kind: AnswerKind;
  options?: OptionIn[] | null;
  answer?: number | string | null;
  unit?: string;
  tolerance?: number | null;
  accept?: string[];
  exact?: boolean;
  steps?: string[] | null;
}

const KINDS: readonly [AnswerKind, string][] = [
  ["choice", "Choice"],
  ["number", "Number"],
  ["sequence", "Sequence"],
  ["order", "Order"],
];
const LETTERS = "ABCDE";
const MIN_STEPS = 3;
const MAX_STEPS = 8;
const OPTION = "flex flex-col gap-1.5 rounded-control border border-border p-2.5";
const SMALL = "rounded-[6px] px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-bg disabled:opacity-40";

/** An exam's choice starts with three options, the first right (CS0818). */
export const blankExamOptions = (): OptionIn[] =>
  [0, 1, 2].map((at) => ({ text: "", right: at === 0, misconception: "", plain: false }));

/** The value as another kind: every other kind's fields cleared, so none is refused (CS0337). */
export function switchedKind<T extends AnswerFields>(value: T, kind: AnswerKind, exam: boolean): T {
  const none = {
    options: null,
    answer: null,
    unit: "",
    tolerance: null,
    accept: [],
    exact: false,
    steps: null,
  };
  switch (kind) {
    case "choice":
      return { ...value, ...none, kind, options: exam ? blankExamOptions() : blankOptions() };
    case "number":
      return { ...value, ...none, kind };
    case "sequence":
      return { ...value, ...none, kind, answer: "" };
    case "order":
      return { ...value, ...none, kind, steps: ["", "", ""] };
  }
}

export function AnswerEditor<T extends AnswerFields>({
  value,
  onChange,
  exam = false,
}: {
  value: T;
  onChange: (value: T) => void;
  exam?: boolean;
}) {
  const kindName = useId();
  return (
    <>
      <fieldset className="flex w-fit rounded-control border border-border bg-bg p-[3px]">
        <legend className="sr-only">Answer kind</legend>
        {KINDS.map(([kind, label]) => (
          <label
            key={kind}
            className={`cursor-pointer rounded-[7px] px-3 py-1 text-[12.5px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sel ${
              value.kind === kind ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
            }`}
          >
            <input
              type="radio"
              name={kindName}
              className="sr-only"
              checked={value.kind === kind}
              onChange={() => onChange(switchedKind(value, kind, exam))}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {value.kind === "choice" && (
        <Options
          options={value.options ?? []}
          exam={exam}
          onChange={(options) => onChange({ ...value, options })}
        />
      )}
      {value.kind === "number" && (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <NumberField
            label="Answer"
            value={typeof value.answer === "number" ? value.answer : null}
            onChange={(answer) => onChange({ ...value, answer })}
          />
          <Field
            label="Unit"
            value={value.unit ?? ""}
            onChange={(unit) => onChange({ ...value, unit })}
          />
          <NumberField
            label="Tolerance"
            value={value.tolerance ?? null}
            onChange={(tolerance) => onChange({ ...value, tolerance })}
          />
        </div>
      )}
      {value.kind === "sequence" && <SequenceFields value={value} onChange={onChange} />}
      {value.kind === "order" && (
        <Steps steps={value.steps ?? []} onChange={(steps) => onChange({ ...value, steps })} />
      )}
    </>
  );
}

function Options({
  options,
  exam,
  onChange,
}: {
  options: OptionIn[];
  exam: boolean;
  onChange: (options: OptionIn[]) => void;
}) {
  const group = useId();
  // Focus stays in the editor when an option goes, so leaving the block afterwards still saves it.
  const add = useRef<HTMLButtonElement>(null);
  const set = (at: number, option: OptionIn) =>
    onChange(options.map((o, i) => (i === at ? option : o)));
  const fewest = exam ? 3 : 2;
  return (
    <div className="flex flex-col gap-2">
      {options.map((option, at) => {
        const letter = LETTERS[at] ?? String(at + 1);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: an option has no identity beyond its place
          <div key={at} className={OPTION}>
            <div className="flex items-center gap-2">
              <span className="w-4 font-mono text-[12px] text-ink-3">{letter}</span>
              <input
                type="radio"
                name={group}
                aria-label={`Option ${letter} is the right answer`}
                checked={option.right === true}
                onChange={() =>
                  onChange(
                    options.map((o, i) =>
                      i === at
                        ? {
                            ...o,
                            right: true,
                            misconception: "",
                            ...(exam ? { plain: false } : {}),
                          }
                        : { ...o, right: false },
                    ),
                  )
                }
              />
              <input
                aria-label={`Option ${letter}`}
                value={option.text}
                onChange={(e) => set(at, { ...option, text: e.target.value })}
                className={`${BOX} h-9 flex-1`}
              />
              <button
                type="button"
                aria-label={`Remove option ${letter}`}
                disabled={options.length <= fewest}
                onClick={() => {
                  add.current?.focus();
                  onChange(options.filter((_, i) => i !== at));
                }}
                className={SMALL}
              >
                Remove
              </button>
            </div>
            {exam && !option.right && (
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <input
                  aria-label={`Misconception of option ${letter}`}
                  placeholder="the misconception this answer reveals"
                  value={option.misconception ?? ""}
                  onChange={(e) =>
                    set(at, { ...option, misconception: e.target.value, plain: false })
                  }
                  className={`${BOX} h-8 min-w-0 flex-1 text-[13px]`}
                />
                <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                  <input
                    type="checkbox"
                    aria-label={`Option ${letter} is plain on purpose`}
                    checked={option.plain === true}
                    onChange={(e) =>
                      set(at, { ...option, plain: e.target.checked, misconception: "" })
                    }
                  />
                  Plain on purpose
                </label>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-3 text-[12px] text-ink-2">
        {exam ? <span>Options are shuffled per learner.</span> : <span />}
        <button
          ref={add}
          type="button"
          disabled={options.length >= LETTERS.length}
          onClick={() =>
            onChange([
              ...options,
              { text: "", right: false, misconception: "", ...(exam ? { plain: false } : {}) },
            ])
          }
          className="text-[13px] font-medium text-sel disabled:opacity-40"
        >
          + Option
        </button>
      </div>
    </div>
  );
}

function SequenceFields<T extends AnswerFields>({
  value,
  onChange,
}: {
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <label className={LABEL}>
        Answer
        <input
          value={typeof value.answer === "string" ? value.answer : ""}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange({ ...value, answer: e.target.value })}
          className={`${BOX} h-10 font-mono`}
        />
      </label>
      <div className={LABEL}>
        <label htmlFor={`${id}-accept`}>Also accepted</label>
        <textarea
          id={`${id}-accept`}
          aria-describedby={`${id}-accept-hint`}
          value={(value.accept ?? []).join("\n")}
          rows={2}
          spellCheck={false}
          onChange={(e) => onChange({ ...value, accept: e.target.value.split("\n") })}
          className={`${BOX} font-mono`}
        />
        <span id={`${id}-accept-hint`} className="text-[12.5px] font-normal text-ink-3">
          One per line.
        </span>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={value.exact === true}
          onChange={(e) => onChange({ ...value, exact: e.target.checked })}
        />
        Exact: letter for letter
      </label>
    </div>
  );
}

function Steps({ steps, onChange }: { steps: string[]; onChange: (steps: string[]) => void }) {
  const add = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-ink-3">
        Write the steps in their right order; a learner gets them shuffled.
      </p>
      {steps.map((step, at) => {
        const n = at + 1;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a step has no identity beyond its place
          <div key={at} className="flex items-center gap-2">
            <span className="w-4 font-mono text-[12px] text-ink-3">{n}</span>
            <input
              aria-label={`Step ${n}`}
              value={step}
              onChange={(e) => onChange(steps.map((s, i) => (i === at ? e.target.value : s)))}
              className={`${BOX} h-9 flex-1`}
            />
            <button
              type="button"
              aria-label={`Remove step ${n}`}
              disabled={steps.length <= MIN_STEPS}
              onClick={() => {
                add.current?.focus();
                onChange(steps.filter((_, i) => i !== at));
              }}
              className={SMALL}
            >
              Remove
            </button>
          </div>
        );
      })}
      <button
        ref={add}
        type="button"
        disabled={steps.length >= MAX_STEPS}
        onClick={() => onChange([...steps, ""])}
        className="self-start text-[13px] font-medium text-sel disabled:opacity-40"
      >
        + Step
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
