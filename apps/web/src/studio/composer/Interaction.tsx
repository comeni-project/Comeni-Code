// The Interaction step (M6.6b spec, M6FA.6): what a learner does with the figure, written into its
// file as `interact`, its fields a form from the task's schema, and what is computed from it named,
// never typed: the right answer, a wrong one, and how it is drawn while asked.
import { useId } from "react";
import { TASKS } from "../../figures/kits";
import type { Component } from "../../figures/schemas";
import type { Task } from "../../figures/tasks";
import type { Op } from "../../yaml/document";
import type { WorkingCopy } from "./useWorkingCopy";

const LABELS: Record<string, string> = { spells: "The path spells", artifact: "A k-mer of a" };
const HINTS: Record<string, string> = {
  spells: "Its k-mers must each be in the graph, each step an arrow a read holds.",
  artifact: "Any k-mer of a run of this kind is right.",
};
const FIELD =
  "rounded-control border border-border-2 bg-surface px-2.5 py-1.5 font-mono text-[13px] focus:border-sel focus:outline-none";

type Written = { data?: Record<string, unknown>; interact?: Record<string, unknown> } | null;

const path = (selection: readonly string[]) => selection.join(" → ");

/** A new task's fields, so it starts from something the data fits. */
function starting(name: string, data: Record<string, unknown>, derived: Record<string, unknown>) {
  if (name === "trace") {
    const reads = (data.reads ?? []) as { sequence?: string }[];
    return { task: name, spells: reads[0]?.sequence ?? "" };
  }
  const artifacts = (derived.artifacts ?? []) as { kind: string }[];
  return { task: name, artifact: artifacts[0]?.kind ?? "bubble" };
}

export function Interaction({ copy, component }: { copy: WorkingCopy; component: Component }) {
  const group = useId();
  const tasks = TASKS[component] ?? {};
  const written = copy.fd.doc.toJS() as Written;
  const interact = written?.interact;
  const current = typeof interact?.task === "string" ? interact.task : null;
  const task: Task | undefined = current === null ? undefined : tasks[current];
  const findings = copy.problems.filter((p) => p.path.startsWith("interact"));
  const answer = copy.asking?.derived.answer;
  const { accept = [], wrong = [] } = (answer ?? {}) as { accept?: string[][]; wrong?: string[] };

  const choose = (name: string | null) => {
    if (name === null) return copy.edit([{ op: "remove", path: ["interact"] }]);
    const data = written?.data ?? {};
    const ops: Op[] = [
      { op: "set", path: ["interact"], value: starting(name, data, copy.lastGood?.derived ?? {}) },
    ];
    // A trace on a highlighted path would draw its answer (CS1031): the highlight goes.
    if (name === "trace" && data.highlight === "path") {
      ops.push({ op: "set", path: ["data", "highlight"], value: "none" });
      return copy.edit(ops, "The highlight set to none: a trace must not draw its answer.");
    }
    copy.edit(ops);
  };
  const fields = Object.entries(
    (task?.schema.properties ?? {}) as Record<string, { enum?: readonly string[] }>,
  ).filter(([key]) => key !== "task");

  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-border bg-surface p-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-semibold">What the learner does</legend>
        {[
          [null, "Nothing", "the figure is read, not answered; it may sit on the page"] as const,
          ...Object.entries(tasks).map(([name, t]) => [name, t.label, t.says] as const),
        ].map(([name, label, says]) => (
          <label
            key={label}
            className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] px-3 py-2.5 ${
              current === name ? "border-2 border-sel bg-sel-soft" : "border border-border-2"
            }`}
          >
            <input
              type="radio"
              name={group}
              checked={current === name}
              onChange={() => choose(name)}
              className="mt-1 accent-sel"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{label}</span>
              <span className="text-[12px] text-ink-2">{says}</span>
            </span>
          </label>
        ))}
        <span className="text-[11.5px] text-ink-3">
          The tasks are the component’s own. A figure with a task is placed only in a question.
        </span>
      </fieldset>
      {copy.note && <p className="text-[12px] text-ink-2">{copy.note}</p>}
      {fields.map(([key, schema]) => {
        const value = String(interact?.[key] ?? "");
        const set = (next: string) =>
          copy.edit([{ op: "set", path: ["interact", key], value: next }]);
        const id = `${group}-${key}`;
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[12.5px] font-semibold">
              {LABELS[key] ?? key}
            </label>
            {schema.enum ? (
              <select id={id} value={value} onChange={(e) => set(e.target.value)} className={FIELD}>
                {schema.enum.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                value={value}
                spellCheck={false}
                onChange={(e) => set(e.target.value.toUpperCase())}
                className={FIELD}
              />
            )}
            <span className="text-[11.5px] text-ink-3">{HINTS[key] ?? ""}</span>
          </div>
        );
      })}
      {findings.map((finding) => (
        <p key={`${finding.code} ${finding.path}`} className="text-[12.5px] text-open">
          <span className="font-mono">{finding.code}</span> {finding.message}
        </p>
      ))}
      {task !== undefined && findings.length === 0 && answer !== undefined && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold">Computed</span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[9px] bg-bg px-3 py-2.5 text-[12.5px]">
            <dt className="text-ink-3">right</dt>
            <dd data-testid="computed-right" className="font-mono">
              {accept.map(path).join(" or ")}
            </dd>
            <dt className="text-ink-3">a wrong one</dt>
            <dd data-testid="computed-wrong" className="font-mono">
              {path(wrong)}
            </dd>
            <dt className="text-ink-3">asked as</dt>
            <dd>no highlight, nothing spelled, no marks, until answered</dd>
          </dl>
          <span className="text-[11.5px] text-ink-3">
            Worked out from the data and the task; shown, never written.
          </span>
        </div>
      )}
    </section>
  );
}
