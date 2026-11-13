// The workbench's Problem tab (M6.8b spec, M6PB.1–M6PB.5): the kit cards for a node with none, else
// problem.yaml as a form or as YAML, checked in the browser as you type, saved whole by one explicit
// Save that the server's 20-seed self-test accepts or refuses. The working text lives here until
// it is saved; a refused save keeps it, with each problem under the field it names.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { queryKeys, useProblemKits } from "../../api/queries";
import type { DraftNodeOut, ProblemKitOut, ProblemOut } from "../../api/schema";
import type { Finding } from "../../figures/validate";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { openFile, writeFile } from "../../yaml/document";
import { useLeaveGuard } from "../composer/useLeaveGuard";
import { removeProblem, setProblem } from "../workbench/edits";
import { RefusalNotice } from "../workbench/RefusalNotice";
import { refusalOf } from "../workbench/refusal";
import { useHoldTab } from "../workbench/tabHold";
import { useDraftEdit } from "../workbench/useDraftEdit";
import { problemFindings } from "./findings";
import { problemFormable } from "./formable";
import { KitCards } from "./KitCards";
import { ProblemForm } from "./ProblemForm";

const BUTTON =
  "rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-sel";
export const LEAVE_PROBLEM = "Leave the problem? What you changed here is not saved.";
/** Whether the form draws a finding at `path`: a field of its own, or a param of the kit's (#437). */
export function onForm(path: string, kit: ProblemKitOut | undefined): boolean {
  const fields = ["title", "rung", "statement", "given", "return", "rationale", "hints", "sample"];
  fields.push("params", "sample.params", "mistakes");
  const names = Object.keys((kit?.params_schema.properties ?? {}) as Record<string, unknown>);
  for (const name of names) fields.push(`params.${name}`, `sample.params.${name}`);
  for (const mistake of kit?.mistakes ?? []) fields.push(`mistakes.${mistake.name}`);
  return fields.some((field) => path === field || path.startsWith(`${field}[`));
}

/** The first file of a problem started from a kit: empty words, the kit's example (M6PB.2). */
export const starterText = (kit: ProblemKitOut): string =>
  writeFile({
    title: "",
    rung: kit.rung,
    statement: "",
    given: "",
    return: "",
    kit: kit.name,
    params: kit.example.params,
    sample: kit.example.sample,
    hints: [""],
    rationale: "",
  });

/** A server problem as a finding under its field; its message without the `field: ` it begins with. */
const placed = (problem: ProblemOut): Finding => ({
  code: problem.code,
  path: problem.field ?? "",
  message: problem.message.replace(`${problem.field}: `, ""),
});

export function ProblemTab({
  draftId,
  node,
  editable,
}: {
  draftId: string;
  node: DraftNodeOut;
  editable: boolean;
}) {
  const kits = useProblemKits();
  if (kits.isPending) return <p className="text-[14px] text-ink-2">Loading the kits…</p>;
  if (kits.isError) return <ErrorNotice error={kits.error} />;
  return <Builder draftId={draftId} node={node} editable={editable} kits={kits.data} />;
}

function Builder({
  draftId,
  node,
  editable,
  kits,
}: {
  draftId: string;
  node: DraftNodeOut;
  editable: boolean;
  kits: ProblemKitOut[];
}) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const yamlId = useId();
  const saved = node.problem?.text ?? null;
  const [text, setText] = useState<string | null>(saved);
  // The saved text this text began from: a save made elsewhere is taken when nothing was changed
  // here, else said, and Save held until it is taken (#439).
  const [base, setBase] = useState<string | null>(saved);
  useEffect(() => {
    if (saved === base) return;
    if (text === base || text === saved) {
      setBase(saved);
      setText(saved);
    }
  }, [saved, base, text]);
  const theirs = saved !== base && text !== base && text !== saved;
  const [asYaml, setAsYaml] = useState(false);
  const [removing, setRemoving] = useState(false);
  const callouts = useMemo(
    () =>
      node.blocks.flatMap((block) =>
        block.kind === "callout" && block.callout === "misconception" ? [block.title] : [],
      ),
    [node.blocks],
  );
  const fd = useMemo(() => (text === null ? null : openFile(text)), [text]);
  const unsaved = text !== saved && !theirs;
  // Unsaved work holds the tab bar and asks before leaving the draft (M6PB.5).
  const hold = useMemo(
    () =>
      unsaved && text !== null && editable
        ? {
            save: () =>
              edit
                .mutateAsync(setProblem(text))
                .then(() => true)
                .catch(() => false),
          }
        : null,
    [unsaved, text, editable, edit.mutateAsync],
  );
  useHoldTab(hold);
  useLeaveGuard(unsaved && editable, LEAVE_PROBLEM);

  if (text === null || fd === null) {
    return (
      <KitCards kits={kits} editable={editable} onStart={(kit) => setText(starterText(kit))} />
    );
  }
  const why = problemFormable(fd, kits);
  const file = why === null ? (fd.doc.toJS() as Record<string, unknown>) : null;
  const kit = file === null ? undefined : kits.find((k) => k.name === file.kit);
  const found = file !== null && kit !== undefined ? problemFindings(file, kit, callouts) : [];
  const refusal = refusalOf(edit.error);
  const showForm = why === null && !asYaml && file !== null && kit !== undefined;
  // A problem goes under the field that draws it; any other, the server's or the browser's, above.
  const drawn = (path: string | null | undefined) => showForm && !!path && onForm(path, kit);
  const fromServer = (refusal?.problems ?? []).filter((p) => drawn(p.field));
  const elsewhere = [
    ...(refusal?.problems ?? []).filter((p) => !fromServer.includes(p)).map((p) => p.message),
    ...found.filter((f) => showForm && !drawn(f.path)).map((f) => `${f.path}: ${f.message}`),
  ];
  const save = () => edit.mutate(setProblem(text));
  const remove = () =>
    edit.mutate(removeProblem(), {
      onSuccess: () => {
        setText(null);
        setAsYaml(false);
        setRemoving(false);
      },
    });

  return (
    <section className="flex flex-col gap-4">
      {theirs && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-control bg-open-soft px-4 py-3 text-[13.5px] text-open"
        >
          <span>
            This problem was saved elsewhere since you began editing it. Take the saved one to go
            on; your changes here are dropped.
          </span>
          <button
            type="button"
            onClick={() => {
              setBase(saved);
              setText(saved);
            }}
            className="rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-medium text-ink"
          >
            Take the saved one
          </button>
        </div>
      )}
      {refusal === null && elsewhere.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-control bg-open-soft px-4 py-3 text-[13.5px] text-open"
        >
          {elsewhere.map((said) => (
            <span key={said}>{said}</span>
          ))}
        </div>
      )}
      {refusal !== null &&
        (refusal.stale ? (
          <RefusalNotice
            refusal={refusal}
            onReload={() => client.invalidateQueries({ queryKey: queryKeys.draft(draftId) })}
          />
        ) : (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-control bg-open-soft px-4 py-3 text-[13.5px] text-open"
          >
            <span className="font-semibold">{refusal.sentence}</span>
            {elsewhere.map((said) => (
              <span key={said}>{said}</span>
            ))}
          </div>
        ))}
      {showForm ? (
        <ProblemForm
          fd={fd}
          file={file}
          kit={kit}
          kits={kits}
          callouts={callouts}
          findings={[...found, ...fromServer.map(placed)]}
          disabled={!editable || edit.isPending}
          onText={setText}
        />
      ) : (
        <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface px-5 py-4">
          {why !== null && <p className="m-0 text-[13px] text-open">{why}</p>}
          <label htmlFor={yamlId} className="text-[13px] font-medium">
            problem.yaml
          </label>
          <textarea
            id={yamlId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!editable}
            rows={22}
            spellCheck={false}
            className="rounded-control border border-border-2 bg-surface px-3 py-2 font-mono text-[12.5px] leading-[1.6] outline-none focus:border-sel"
          />
          {why === null && (
            <button
              type="button"
              onClick={() => setAsYaml(false)}
              className={`${BUTTON} self-start`}
            >
              Back to the form
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 pb-2">
        {showForm && (
          <button
            type="button"
            onClick={() => setAsYaml(true)}
            className="text-[13px] font-medium text-sel"
          >
            Edit as YAML
          </button>
        )}
        {editable &&
          (removing ? (
            <span role="status" className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-open">
                Remove the problem and its block? This can’t be undone in the draft.
              </span>
              <button type="button" onClick={remove} className={BUTTON}>
                Remove
              </button>
              <button
                type="button"
                onClick={() => setRemoving(false)}
                className="text-ink-2 underline"
              >
                Keep it
              </button>
            </span>
          ) : (
            saved !== null && (
              <button
                type="button"
                onClick={() => setRemoving(true)}
                className="text-[13px] font-medium text-open"
              >
                Remove the problem
              </button>
            )
          ))}
        <span className="flex-1" />
        {!unsaved &&
          edit.isSuccess &&
          edit.variables?.method === "PUT" &&
          edit.variables.path === "problem" && (
            <span role="status" className="text-[12.5px] font-medium text-ink-2">
              Self-test · passed on the sample and seeds 0–19.
            </span>
          )}
        {editable && (
          <>
            <span className="text-[12.5px] text-ink-3">
              Saved files are checked by the server, with 20 seeds.
            </span>
            <button
              type="button"
              onClick={save}
              disabled={
                edit.isPending || theirs || (why === null && found.length > 0) || text === saved
              }
              className="rounded-control bg-btn px-5 py-2.5 text-[14px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110 disabled:opacity-60"
            >
              {edit.isPending ? "Checking with 20 seeds…" : "Save problem"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
