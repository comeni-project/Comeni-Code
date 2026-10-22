// Describe (M6.5 spec, M6CO.4): the caption (the block's, when the figure was opened from one, or
// the new block's), and the file's alt text and optional source, which edit the working copy.
import { useId } from "react";
import { HINT, INPUT, LABEL } from "../workbench/bench";
import { MarkdownField } from "../workbench/MarkdownField";
import type { WorkingCopy } from "./useWorkingCopy";

const SMALL = "text-[12.5px] font-medium text-sel hover:text-ink";

function TextField({
  label,
  path,
  value,
  bad,
  onChange,
  hint,
}: {
  label: string;
  path: string;
  value: string;
  bad: boolean;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={LABEL}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        data-path={path}
        aria-invalid={bad}
        className={`${INPUT} aria-[invalid=true]:border-open`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className={HINT}>{hint}</span>}
    </div>
  );
}

export function Describe({
  copy,
  caption,
  onCaption,
}: {
  copy: WorkingCopy;
  /** null when the figure was opened from a try question or a stem: no caption here. */
  caption: string | null;
  onCaption: (caption: string) => void;
}) {
  const file = (copy.fd.errors.length === 0 ? copy.fd.doc.toJS() : null) as {
    alt?: unknown;
    source?: { title?: unknown; url?: unknown } | null;
  } | null;
  const bad = new Set(copy.problems.map((p) => p.path));
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const source = file?.source;
  return (
    <section
      aria-label="Describe"
      className="flex flex-col gap-3 rounded-panel border border-border bg-surface px-4 py-3"
    >
      <h2 className="text-[13.5px] font-semibold">Describe</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {caption !== null && <MarkdownField label="Caption" value={caption} onChange={onCaption} />}
        {file !== null && (
          <TextField
            label="Alt text"
            path="alt"
            value={text(file.alt)}
            bad={bad.has("alt")}
            hint="The figure's type, what it shows, and why it is here."
            onChange={(alt) => copy.edit([{ op: "set", path: ["alt"], value: alt }])}
          />
        )}
      </div>
      {file !== null &&
        (source === undefined ? (
          <p className="text-[12px] text-ink-3">
            {"Source (optional) · none: a figure we made · "}
            <button
              type="button"
              className={SMALL}
              onClick={() => copy.edit([{ op: "set", path: ["source"], value: { title: "" } }])}
            >
              Add a source
            </button>
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <TextField
              label="Source title"
              path="source.title"
              value={text(source?.title)}
              bad={bad.has("source") || bad.has("source.title")}
              onChange={(title) =>
                copy.edit([{ op: "set", path: ["source", "title"], value: title }])
              }
            />
            <TextField
              label="Source link (optional)"
              path="source.url"
              value={text(source?.url)}
              bad={bad.has("source.url")}
              onChange={(url) =>
                copy.edit([
                  url === ""
                    ? { op: "remove", path: ["source", "url"] }
                    : { op: "set", path: ["source", "url"], value: url },
                ])
              }
            />
            <button
              type="button"
              className={`${SMALL} h-10`}
              onClick={() => copy.edit([{ op: "remove", path: ["source"] }])}
            >
              Remove the source
            </button>
          </div>
        ))}
    </section>
  );
}
