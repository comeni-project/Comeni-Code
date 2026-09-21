// A try question in the body, as the L5 board draws it (M3P5.5, tutor spec T6.2).
//
// It is formative: the answer came with the page (M3P1.4) and is checked here. Nothing is stored,
// so the board's "Answered · back in review in 3 days" waits for learner records (T7).
import { useId, useState } from "react";
import type { QuestionOut } from "../api/schema";

const KINDS: Record<string, string> = { number: "a count", choice: "a choice" };

/** How many wrong answers before the rationale shows anyway. */
const TRIES = 2;

function answerOf(question: QuestionOut): string {
  if (question.kind === "choice") {
    return question.options?.find((option) => option.right)?.text ?? "";
  }
  return [question.answer, question.unit].filter((part) => part !== null).join(" ");
}

function isRight(question: QuestionOut, given: string): boolean {
  if (question.kind === "choice") {
    return question.options?.some((option) => option.right && option.text === given) ?? false;
  }
  const value = Number(given.replace(",", "."));
  if (given.trim() === "" || Number.isNaN(value) || question.answer === null) return false;
  return Math.abs(value - question.answer) <= (question.tolerance ?? 0) + 1e-9;
}

export function TryQuestion({ question, number }: { question: QuestionOut; number: number }) {
  const [open, setOpen] = useState(false);
  const [given, setGiven] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState(0);
  const [right, setRight] = useState(false);
  const [shown, setShown] = useState(false);
  const [hints, setHints] = useState(0);
  const field = useId();

  const answer = answerOf(question);
  const done = right || shown || wrong >= TRIES;

  function check(value: string) {
    if (right) return;
    if (isRight(question, value)) setRight(true);
    else setWrong(wrong + 1);
  }

  const heading = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-sel font-mono text-[13px] text-sel">
        {number}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-[15px] font-semibold">{question.ask}</span>
        <span className="text-[12px] text-ink-3">
          1 min · {KINDS[question.kind] ?? "a question"}
        </span>
      </span>
    </>
  );

  if (!open) {
    return (
      <section className="my-5 rounded-panel border border-border bg-surface">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3.5 px-4 py-3 hover:bg-bg"
        >
          {heading}
          <span className="shrink-0 text-[13px] font-semibold text-sel">Try it ⌄</span>
        </button>
      </section>
    );
  }

  return (
    <section className="my-5 flex flex-col gap-3.5 rounded-panel border-[1.5px] border-sel bg-surface px-[18px] py-4">
      <div className="flex items-center gap-3.5">
        {heading}
        <button
          type="button"
          aria-expanded={true}
          onClick={() => setOpen(false)}
          className="shrink-0 text-[13px] font-semibold text-sel"
        >
          Try it ⌃
        </button>
      </div>

      {question.kind === "choice" ? (
        <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {(question.options ?? []).map((option) => {
            const chosen = picked === option.text;
            const tone =
              chosen && option.right
                ? "border-line bg-line-soft font-semibold"
                : chosen
                  ? "border-open bg-open-soft"
                  : "border-border-2 bg-surface hover:border-sel";
            return (
              <button
                key={option.text}
                type="button"
                aria-pressed={chosen}
                disabled={right}
                onClick={() => {
                  setPicked(option.text);
                  check(option.text);
                }}
                className={`rounded-control border-[1.5px] px-3.5 py-2.5 text-left font-mono text-[14px] ${tone}`}
              >
                {chosen && option.right ? <span aria-hidden="true">✓ </span> : null}
                {option.text}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            check(given);
          }}
        >
          <label htmlFor={field} className="sr-only">
            Your answer
          </label>
          <input
            id={field}
            type="number"
            step="any"
            inputMode="decimal"
            value={given}
            disabled={right}
            onChange={(event) => setGiven(event.target.value)}
            className="w-36 rounded-control border-[1.5px] border-border-2 bg-surface px-3 py-2 font-mono text-[14px] focus:border-sel focus:outline-none"
          />
          {question.unit ? <span className="text-[14px] text-ink-2">{question.unit}</span> : null}
          <button
            type="submit"
            disabled={right}
            className="rounded-control bg-btn px-4 py-2 text-[13.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110 disabled:opacity-60"
          >
            Check
          </button>
        </form>
      )}

      {wrong > 0 && !right ? (
        <p className="text-[13.5px] text-open">
          <b className="font-semibold">Not quite.</b>
          {done ? "" : " Try again, or take a hint."}
        </p>
      ) : null}

      {hints > 0 || !done ? (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          {hints < question.hints.length && !done ? (
            <button
              type="button"
              onClick={() => setHints(hints + 1)}
              className="rounded-control border border-border-2 px-2.5 py-1 text-[12.5px] font-medium hover:border-sel"
            >
              Show a hint
            </button>
          ) : null}
          {hints > 0 ? (
            <span className="rounded-control border border-border-2 px-2.5 py-1 text-[12.5px] text-ink-2">
              Hint {hints} of {question.hints.length} used
            </span>
          ) : null}
          {!done ? (
            <button
              type="button"
              onClick={() => setShown(true)}
              className="px-1 py-1 text-[12.5px] text-ink-3 underline hover:text-ink"
            >
              Show the answer
            </button>
          ) : null}
          {hints > 0 ? (
            <ol className="flex w-full flex-col gap-1 text-[13.5px] text-ink-2">
              {question.hints.slice(0, hints).map((hint) => (
                <li key={hint}>
                  “<span>{hint}</span>”
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {done ? (
        <div className="flex flex-col gap-1 rounded-control bg-line-soft px-3.5 py-3 text-[13.5px]">
          <p className="font-semibold">
            <span className="text-line">
              {right ? `Right — ${answer}.` : `The answer is ${answer}.`}
            </span>{" "}
            Why:
          </p>
          <p className="leading-normal text-ink">{question.rationale}</p>
        </div>
      ) : null}
    </section>
  );
}
