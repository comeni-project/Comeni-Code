// A question as a self-test asks it (M4.8d spec, M4P.7): its place, the stem as the page draws
// blocks, and the kind's control — no hints, no feedback, no rationale. The builder previews it;
// the self-test (M8) asks it.
import { useId, useMemo, useState } from "react";
import { Body } from "./Body";
import type { Block } from "./body";
import { OrderAnswer, shuffled } from "./OrderAnswer";

export interface TestAsk {
  stem: Block[];
  kind: "choice" | "number" | "sequence" | "order";
  options: string[];
  unit: string;
  steps: string[];
}

const LETTERS = "ABCDE";
const FIELD =
  "rounded-control border-[1.5px] border-border-2 bg-surface px-3 py-2 font-mono text-[14px] focus:border-sel focus:outline-none";

export function TestQuestion({
  ask,
  number,
  of,
  phone = false,
  shuffle = shuffled,
  onAnswer,
  busy = false,
}: {
  ask: TestAsk;
  number: number;
  of: number;
  phone?: boolean;
  /** How an order's steps are dealt: shuffled, and fixed in tests. */
  shuffle?: (steps: string[]) => string[];
  /** Review asks for an answer (M4.9b spec, M4RS.4); without it, nothing is sent (the builder). */
  onAnswer?: (given: number | string | string[]) => void;
  busy?: boolean;
}) {
  const field = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const [given, setGiven] = useState("");
  // The steps are dealt by place, so an edited step keeps its place and shows its new words;
  // they are dealt again only when a step is added or removed (#268).
  const count = ask.steps.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: dealt again only when the count changes
  const places = useMemo(() => shuffle([...Array(count).keys()].map(String)).map(Number), [count]);
  const steps = places.map((at) => ask.steps[at] ?? "");
  const answerOf = (): number | string | null => {
    if (ask.kind === "choice") return picked;
    if (given.trim() === "") return null;
    if (ask.kind === "number") {
      const read = Number(given);
      return Number.isFinite(read) ? read : null;
    }
    return given.trim();
  };
  const ready = answerOf();
  return (
    <section className="flex flex-col gap-2.5 text-ink">
      <span className="text-[11px] text-ink-3">
        Question {number} of {of} ·{" "}
        {onAnswer === undefined ? "no hints in a test" : "answer before you see the key"}
      </span>
      <div className="flex flex-col gap-2 text-[15px] leading-[1.35] font-semibold">
        <Body blocks={ask.stem} questions={[]} />
      </div>
      {ask.kind === "choice" ? (
        <div className={`grid gap-1.5 ${phone ? "" : "grid-cols-2"}`}>
          {ask.options.map((text, at) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: two options may say the same while typed
              key={at}
              type="button"
              aria-pressed={picked === at}
              onClick={() => setPicked(at)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13.5px] ${
                picked === at ? "border-sel bg-sel-soft" : "border-border-2 bg-surface"
              }`}
            >
              <span className="font-mono text-[11px] text-ink-3">{LETTERS[at]}</span> {text}
            </button>
          ))}
        </div>
      ) : ask.kind === "order" ? (
        <OrderAnswer
          key={steps.join("\u0000")}
          steps={steps}
          disabled={busy}
          {...(onAnswer === undefined ? {} : { onCheck: (order: string[]) => onAnswer(order) })}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor={field} className="sr-only">
            Your answer
          </label>
          <input
            id={field}
            value={given}
            inputMode={ask.kind === "number" ? "decimal" : "text"}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setGiven(event.target.value)}
            className={`${FIELD} ${ask.kind === "number" ? "w-36" : "min-w-0 flex-1"}`}
          />
          {ask.kind === "number" && ask.unit ? (
            <span className="text-[14px] text-ink-2">{ask.unit}</span>
          ) : null}
        </div>
      )}
      {onAnswer !== undefined && ask.kind !== "order" && (
        <button
          type="button"
          disabled={busy || ready === null}
          onClick={() => {
            if (ready !== null) onAnswer(ready);
          }}
          className="self-start rounded-control border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-semibold disabled:text-ink-3"
        >
          Answer
        </button>
      )}
    </section>
  );
}
