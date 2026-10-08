// A block's Markdown (M4K.3): a labelled text box and the board's B, I and Link, each wrapping
// the selection.
import { useId, useRef } from "react";
import { wrap } from "./markdown";

const MARKS = [
  { label: "Bold", shown: <b>B</b>, before: "**", after: "**" },
  { label: "Italic", shown: <i>I</i>, before: "*", after: "*" },
  { label: "Link", shown: "Link", before: "[", after: "](https://)" },
] as const;

export function MarkdownField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const mark = (before: string, after: string) => {
    const area = box.current;
    if (area === null) return;
    const next = wrap(value, area.selectionStart, area.selectionEnd, before, after);
    onChange(next.text);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(next.start, next.end);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium">
          Markdown
        </label>
        <div className="flex gap-0.5">
          {MARKS.map((m) => (
            <button
              key={m.label}
              type="button"
              aria-label={m.label}
              onClick={() => mark(m.before, m.after)}
              className="rounded-[6px] px-2 py-0.5 text-[12.5px] text-ink-2 hover:bg-bg"
            >
              {m.shown}
            </button>
          ))}
        </div>
      </div>
      <textarea
        id={id}
        ref={box}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={Math.min(16, Math.max(4, value.split("\n").length + 1))}
        className="rounded-control border border-border-2 bg-surface px-3 py-2 text-[14.5px] leading-[1.6] outline-none focus:border-sel"
      />
    </div>
  );
}
