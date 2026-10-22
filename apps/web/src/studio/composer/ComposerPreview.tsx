// The preview (M6.5 spec, M6CO.6): the working copy drawn by the page's own Figure, with its
// caption, at desktop, phone (390 px) and dark. While a check fails it keeps the last drawing
// that checked, and says so.
import { useState } from "react";
import type { FigureOut } from "../../api/schema";
import { Figure } from "../../figures/Figure";

const LOOKS = ["Desktop", "Phone", "Dark"] as const;

export function ComposerPreview({
  record,
  caption,
  waiting,
}: {
  record: FigureOut | null;
  caption: string;
  waiting: number;
}) {
  const [look, setLook] = useState<(typeof LOOKS)[number]>("Desktop");
  return (
    <section
      aria-label="Preview"
      className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-panel border border-border bg-surface px-4 py-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Preview</h2>
        <div className="flex rounded-control border border-border bg-bg p-[3px]">
          {LOOKS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={look === name}
              onClick={() => setLook(name)}
              className={`rounded-[7px] px-[13px] py-[5px] text-[12.5px] ${
                look === name ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      {waiting > 0 && record !== null && (
        <p className="rounded-[8px] bg-open-soft px-2.5 py-[7px] text-[12.5px] text-open">
          {`The last drawing that checks; fix ${waiting} ${waiting === 1 ? "problem" : "problems"} to see your change.`}
        </p>
      )}
      <div
        data-theme={look === "Dark" ? "dark" : undefined}
        className="flex flex-1 items-center rounded-[10px] border border-border bg-bg px-6 py-[18px]"
      >
        <div className={`mx-auto w-full ${look === "Phone" ? "max-w-[390px]" : ""}`}>
          {record === null ? (
            <p className="text-[13px] text-ink-3">Nothing to draw yet: fix the checks first.</p>
          ) : (
            <Figure record={record} caption={caption} number={null} />
          )}
        </div>
      </div>
      <p className="text-[12px] text-ink-3">
        Drawn in your browser by the page's own component, from the data as you edit it.
      </p>
    </section>
  );
}
