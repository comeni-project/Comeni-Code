// S4 · The figure composer (M6.5 spec): one figure's file edited in the browser as a working copy
// (Choose, Data, Describe), drawn as you type, checked as the server checks it, and saved once:
// `/studio/drafts/:id/figures/:stem?block=<n>` to edit, `/figures/new?at=<n>` to add.
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useDraft } from "../../api/queries";
import type { DraftOut } from "../../api/schema";
import { lineOf, pathParts, writeFile } from "../../figures/document";
import { STARTERS } from "../../figures/kits";
import type { Component } from "../../figures/schemas";
import type { Finding } from "../../figures/validate";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { addFigureFile, type Edit, setFigure, updateBlock } from "../workbench/edits";
import { refusalOf } from "../workbench/refusal";
import { useDraftEdit } from "../workbench/useDraftEdit";
import { ChecksList } from "./ChecksList";
import { Choose } from "./Choose";
import { ComposerPreview } from "./ComposerPreview";
import { DataPanel } from "./DataPanel";
import { Describe } from "./Describe";
import { focusPath, serverPath } from "./goTo";
import { headline } from "./summary";
import { ThisFigure } from "./ThisFigure";
import { useLeaveGuard } from "./useLeaveGuard";
import { useWorkingCopy } from "./useWorkingCopy";

const ended = (text: string) => (text.endsWith("\n") ? text : `${text}\n`);

function Steps({ choosing, described }: { choosing: boolean; described: boolean }) {
  const steps: [string, "done" | "on" | ""][] = choosing
    ? [
        ["Choose", "on"],
        ["Data", ""],
        ["Describe", ""],
      ]
    : [
        ["Choose", "done"],
        ["Data", "on"],
        ["Describe", described ? "done" : ""],
      ];
  return (
    <ol aria-label="Steps" className="flex items-center gap-1.5">
      {steps.map(([name, state], n) => (
        <li key={name} className="flex items-center gap-1.5">
          {n > 0 && <span className="h-px w-7 bg-border-2" />}
          <span
            aria-current={state === "on" ? "step" : undefined}
            className={`flex items-center gap-2 rounded-pill px-3 py-1.5 text-[13px] ${
              state === "on"
                ? "bg-ink font-semibold text-bg"
                : state === "done"
                  ? "bg-line-soft font-medium text-btn"
                  : "border border-border-2 text-ink-2"
            }`}
          >
            <span aria-hidden="true" className="text-[11.5px]">
              {state === "done" ? "✓" : n + 1}
            </span>
            {name}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** What Checks says passes, beside what fails: the file, its data, and its description. */
function checkLines(
  problems: Finding[],
  component: string | null,
  captionMissing: boolean,
  computed: string | null,
): { ok: boolean; title: string; detail: string }[] {
  const has = (codes: string[]) => problems.some((p) => codes.includes(p.code));
  const FILE = ["CS1023", "CS1025", "CS1027"];
  const DESCRIBED = ["CS1024", "CS1026"];
  const data = problems.some((p) => ![...FILE, ...DESCRIBED].includes(p.code));
  return [
    {
      ok: !has(FILE),
      title: "The file reads one way",
      detail: "YAML a person and the server read alike",
    },
    {
      ok: !data,
      title: `The data fits ${component === null ? "its component" : `a ${component}`}`,
      detail: "every key allowed, every check passed",
    },
    ...(computed === null
      ? []
      : [{ ok: !data, title: "Computed from the reads", detail: computed }]),
    {
      ok: !has(DESCRIBED) && !captionMissing,
      title: "Described",
      detail: captionMissing ? "it needs a caption" : "a caption and alt text",
    },
  ];
}

function Composer({
  draft,
  stem,
  block,
  at,
}: {
  draft: DraftOut;
  stem: string | null;
  block: number | null;
  at: number;
}) {
  const node = draft.node;
  const navigate = useNavigate();
  const client = useQueryClient();
  const edit = useDraftEdit(draft.public_id);
  const record = stem === null ? undefined : node?.figures?.find((f) => f.stem === stem);
  const placed = block === null ? undefined : node?.blocks[block];
  const initialCaption =
    placed?.kind === "figure" && placed.file === stem ? placed.caption.replace(/\n$/, "") : null;
  const [caption, setCaption] = useState(stem === null ? "" : initialCaption);
  const copy = useWorkingCopy(stem ?? "new", record?.text ?? null);
  const [choosing, setChoosing] = useState(stem === null);
  const [chosen, setChosen] = useState<Component | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);
  const yamlRef = useRef<HTMLTextAreaElement>(null);
  void client;

  const captionChanged = caption !== null && caption !== (initialCaption ?? "");
  const changed = copy.changed || (stem !== null && captionChanged);
  const allow = useLeaveGuard(changed || edit.isPending);
  const component = (copy.figure?.component ?? record?.component ?? chosen) as Component | null;

  const refusal = refusalOf(edit.error);
  const server: Finding[] = (refusal?.problems ?? []).map((p) => ({
    code: p.code,
    ...serverPath(p.message),
  }));
  const problems = [...copy.problems, ...server];
  const needsCaption = caption !== null && caption.trim() === "";
  const ready = !choosing && copy.problems.length === 0 && changed && !needsCaption;
  const back = () => {
    allow();
    navigate(`/studio/drafts/${draft.public_id}`);
  };

  const save = () => {
    if (!ready || edit.isPending) return;
    edit.reset();
    if (stem === null) {
      edit.mutate(addFigureFile(at, copy.text, ended(caption ?? "")), { onSuccess: back });
      return;
    }
    // One after another, each sent only once the one before it is saved: a refused file keeps
    // the composer open, its caption unsent (#390).
    const saves: Edit[] = [];
    if (copy.changed) saves.push(setFigure(stem, copy.text));
    if (block !== null && captionChanged) {
      saves.push(updateBlock(block, { kind: "figure", file: stem, caption: ended(caption ?? "") }));
    }
    const send = (n: number) => {
      const one = saves[n];
      if (one === undefined) return back();
      edit.mutate(one, { onSuccess: () => send(n + 1) });
    };
    send(0);
  };
  const go = (path: string) =>
    focusPath(path, () => {
      setYamlOpen(true);
      const line = path === "" ? 1 : (lineOf(copy.fd, pathParts(path)) ?? 1);
      requestAnimationFrame(() => {
        const area = yamlRef.current;
        if (area === null) return;
        const start =
          copy.text
            .split("\n")
            .slice(0, line - 1)
            .join("\n").length + (line > 1 ? 1 : 0);
        area.focus();
        area.setSelectionRange(start, start);
      });
    });

  if (node === null)
    return <p className="text-[15px] text-ink-2">This draft's files do not read.</p>;
  if (stem !== null && record === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] text-ink-2">{`This draft has no figure ${stem}.`}</p>
        <Link to={`/studio/drafts/${draft.public_id}`} className="text-sel">
          Back to the draft
        </Link>
      </div>
    );
  }
  const crumb = `${node.title} › ${stem === null ? "new figure" : `figure ${stem}`}`;
  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[12.5px] text-ink-3">{crumb}</span>
          <h1 className="text-[22px] font-semibold">Figure composer</h1>
        </div>
        <Steps
          choosing={choosing}
          described={copy.figure !== null && (caption === null || caption.trim() !== "")}
        />
        <div className="flex gap-2">
          <button type="button" className={SECONDARY} onClick={back}>
            Cancel
          </button>
          {choosing ? (
            <button
              type="button"
              className={PRIMARY}
              disabled={chosen === null}
              onClick={() => setChoosing(false)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className={PRIMARY}
              disabled={!ready || edit.isPending}
              onClick={save}
            >
              Save to the page
            </button>
          )}
        </div>
      </header>
      {refusal !== null && server.length === 0 && <ErrorNotice error={edit.error as Error} />}
      {choosing ? (
        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <Choose
            chosen={chosen}
            onChoose={(picked) => {
              setChosen(picked);
              copy.setText(writeFile({ component: picked, alt: "", data: STARTERS[picked] }));
            }}
          />
          <aside className="flex flex-col gap-3.5">
            <section className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3.5">
              <h2 className="text-[14px] font-semibold">Where it goes</h2>
              <p className="text-[12.5px] leading-[1.5] text-ink-2">
                {`After block ${at}. Saved in figures/ under its component's name and placed there, in one save.`}
              </p>
            </section>
            <section className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3.5">
              <h2 className="text-[14px] font-semibold">Computed, never typed</h2>
              <p className="text-[12.5px] leading-[1.5] text-ink-2">
                A domain component works out the k-mers, edges, paths, counts, tips and bubbles from
                the reads, so a drawing cannot disagree with its data.
              </p>
            </section>
            <section className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3.5">
              <h2 className="text-[14px] font-semibold">Answering by the figure</h2>
              <p className="text-[12.5px] leading-[1.5] text-ink-2">
                Tracing a path or picking a bubble as a question’s answer comes next (M6.6b). Until
                then a figure sits above a choice, as it does today.
              </p>
            </section>
          </aside>
        </div>
      ) : (
        <div className="grid gap-[18px] lg:grid-cols-[420px_minmax(0,1fr)_320px]">
          <DataPanel
            copy={copy}
            component={component}
            stem={stem}
            yamlOpen={yamlOpen}
            onYamlOpen={setYamlOpen}
            yamlRef={yamlRef}
          />
          <div className="flex min-w-0 flex-col gap-3">
            <ComposerPreview
              record={copy.lastGood}
              caption={caption ?? ""}
              waiting={copy.problems.length}
            />
            <Describe
              copy={copy}
              caption={caption}
              onCaption={(next) => {
                edit.reset();
                setCaption(next);
              }}
            />
          </div>
          <aside className="flex flex-col gap-3.5">
            <ChecksList
              problems={problems}
              lines={checkLines(
                problems,
                component,
                needsCaption,
                component === null || copy.fd.errors.length > 0
                  ? null
                  : headline(component, (copy.fd.doc.toJS() as { data?: unknown } | null)?.data),
              )}
              onGo={go}
            />
            <ThisFigure node={node} stem={stem} />
          </aside>
        </div>
      )}
    </div>
  );
}

export function ComposerPage() {
  const { id = "", stem = "" } = useParams();
  const [params] = useSearchParams();
  const draft = useDraft(id);
  if (draft.isError) return <ErrorNotice error={draft.error} />;
  if (draft.data === undefined) return null;
  const block = params.get("block");
  return (
    <Composer
      key={stem}
      draft={draft.data}
      stem={stem === "new" ? null : stem}
      block={block === null ? null : Number(block)}
      at={Number(params.get("at") ?? draft.data.node?.blocks.length ?? 0)}
    />
  );
}
