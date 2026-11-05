// Data (M6.5 spec, M6CO.4; the Data boards): the kit, its sheets, the form for everything else,
// and Edit as YAML beneath, all over the one working copy. A file the form cannot hold opens as
// YAML with a line saying why.
import { type RefObject, useMemo } from "react";
import type { Component } from "../../figures/schemas";
import { KITS } from "./Choose";
import { formable } from "./formable";
import { hasSettings, SchemaForm } from "./SchemaForm";
import { Sheet } from "./Sheet";
import { sheetsOf } from "./sheets";
import { summary } from "./summary";
import type { WorkingCopy } from "./useWorkingCopy";

export function DataPanel({
  copy,
  component,
  stem,
  yamlOpen,
  onYamlOpen,
  yamlRef,
}: {
  copy: WorkingCopy;
  component: Component | null;
  stem: string | null;
  yamlOpen: boolean;
  onYamlOpen: (open: boolean) => void;
  yamlRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const why = useMemo(() => formable(copy.fd), [copy.fd]);
  const file = why === null ? (copy.fd.doc.toJS() as { data: Record<string, unknown> }) : null;
  const what = KITS.find((kit) => kit.component === component)?.what ?? "";
  const sheets = file !== null && component !== null ? sheetsOf(component, file.data) : [];
  const counts = sheets
    .map((sheet) => {
      const noun = sheet.title === "Values" ? "rows" : sheet.title.toLowerCase();
      return `${sheet.rows.length} ${sheet.rows.length === 1 ? noun.replace(/s$/, "") : noun}`;
    })
    .concat(typeof file?.data.k === "number" ? [`k = ${file.data.k}`] : [])
    .join(" · ");
  // What a domain component worked out from the data, while the data checks (M6DC.5).
  const said = file !== null && component !== null ? summary(component, file.data) : [];
  const fasta = sheets.some((sheet) => sheet.columns.some((column) => column.dna));
  const form = file !== null && component !== null && hasSettings(component, file.data);
  return (
    <section
      aria-label="Data"
      className="flex min-h-0 flex-col gap-3.5 overflow-auto rounded-panel border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-3 rounded-[10px] bg-bg p-2.5">
        <div className="flex flex-1 flex-col">
          <span className="font-mono text-[13px] font-medium">{component ?? "figure"}</span>
          <span className="text-[12px] text-ink-2">
            {stem === null ? what : `${stem} · ${what}`}
          </span>
        </div>
        <span className="text-[12px] text-ink-3">fixed once added</span>
      </div>
      {why !== null && (
        <p className="rounded-[8px] bg-bg px-2.5 py-[7px] text-[12.5px] text-ink-2">{why}</p>
      )}
      {file !== null && component !== null && (
        <>
          {sheets.map((sheet) => (
            <div key={sheet.title} className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">{sheet.title}</span>
              <Sheet sheet={sheet} problems={copy.problems} onOps={copy.edit} />
            </div>
          ))}
          {sheets.length > 0 && (
            <span className="-mt-2 text-[11.5px] text-ink-3">
              {fasta
                ? "Paste from a FASTA or a spreadsheet. Only A, C, G, T are accepted."
                : "Paste from a spreadsheet: tab- or comma-separated, the first row names the columns."}
            </span>
          )}
          {form && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Settings</span>
              <SchemaForm
                component={component}
                data={file.data}
                problems={copy.problems}
                onOps={copy.edit}
              />
              <span className="text-[11.5px] text-ink-3">
                Made from the {component}'s schema: only what it takes is offered.
              </span>
            </div>
          )}
          {said.length > 0 && (
            <section aria-label="Computed" className="flex flex-col gap-1.5">
              <h3 className="text-[12.5px] font-semibold">Computed</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[9px] bg-bg px-3 py-2.5 text-[12.5px]">
                {said.map((line) => (
                  <div key={line.label} className="contents">
                    <dt className="text-ink-3">{line.label}</dt>
                    <dd className="font-mono">{line.value}</dd>
                  </div>
                ))}
              </dl>
              <span className="text-[11.5px] text-ink-3">
                Worked out from the reads and k; shown, never written.
              </span>
            </section>
          )}
        </>
      )}
      {copy.note !== null && <p className="text-[12.5px] text-ink-2">{copy.note}</p>}
      <details
        open={yamlOpen || why !== null}
        onToggle={(e) => onYamlOpen(e.currentTarget.open)}
        className="mt-auto border-t border-border pt-2.5"
      >
        <summary className="flex cursor-pointer justify-between text-[12.5px] text-ink-2">
          Edit as YAML
          <span className="text-ink-3">{counts}</span>
        </summary>
        <textarea
          ref={yamlRef}
          aria-label="Edit as YAML"
          spellCheck={false}
          rows={16}
          value={copy.text}
          onChange={(e) => copy.setText(e.target.value)}
          className="mt-2 w-full rounded-control border border-border-2 bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus:border-sel"
        />
      </details>
    </section>
  );
}
