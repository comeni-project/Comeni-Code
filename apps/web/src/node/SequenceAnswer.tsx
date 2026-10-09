// A typed answer for a sequence try (M4.8c spec, M4Q.6): letters or words, checked when the
// learner asks.
import { useId, useState } from "react";

export const CHECK =
  "rounded-control bg-btn px-4 py-2 text-[13.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110 disabled:opacity-60";

export function SequenceAnswer({
  disabled,
  onCheck,
}: {
  disabled: boolean;
  onCheck: (text: string) => void;
}) {
  const field = useId();
  const [text, setText] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        onCheck(text);
      }}
    >
      <label htmlFor={field} className="sr-only">
        Your answer
      </label>
      <input
        id={field}
        value={text}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        className="min-w-0 flex-1 rounded-control border-[1.5px] border-border-2 bg-surface px-3 py-2 font-mono text-[14px] focus:border-sel focus:outline-none"
      />
      <button type="submit" disabled={disabled} className={CHECK}>
        Check
      </button>
    </form>
  );
}
