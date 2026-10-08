// S3 · Workbench (M4.8b spec, M4K.1): one draft, opened with one GET. The header, the draft's state,
// the tabs (kept in the address as ?tab=) and the preview; each tab's editor is its own file.
import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { useDraft } from "../../api/queries";
import type { DraftNodeOut, DraftOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { ContentTab } from "./ContentTab";
import { ExamPoolTab } from "./ExamPoolTab";
import { Header } from "./Header";
import { LinksTab } from "./LinksTab";
import { PreviewPanel } from "./PreviewPanel";
import { ResourcesTab } from "./ResourcesTab";
import { SettingsTab } from "./SettingsTab";
import { StateLine } from "./StateLine";

/** A draft takes edits only while open and while its files read (M4K.1). */
export const editable = (draft: DraftOut): boolean => draft.state === "open" && draft.node !== null;

interface Tab {
  key: string;
  label: string;
  body: (draft: DraftOut, node: DraftNodeOut) => ReactNode;
}

// In the board's order.
const TABS: readonly Tab[] = [
  {
    key: "content",
    label: "Content",
    body: (draft, node) => (
      <ContentTab
        draftId={draft.public_id}
        nodeId={draft.node_id}
        node={node}
        editable={editable(draft)}
      />
    ),
  },
  {
    key: "resources",
    label: "Resources",
    body: (draft, node) => (
      <ResourcesTab draftId={draft.public_id} node={node} editable={editable(draft)} />
    ),
  },
  { key: "exam", label: "Exam pool", body: (_, node) => <ExamPoolTab node={node} /> },
  {
    key: "links",
    label: "Links",
    body: (draft, node) => (
      <LinksTab draftId={draft.public_id} node={node} editable={editable(draft)} />
    ),
  },
  {
    key: "settings",
    label: "Settings",
    body: (draft, node) => <SettingsTab draft={draft} node={node} editable={editable(draft)} />,
  },
];

export function WorkbenchPage() {
  const id = useParams().id ?? "";
  const draft = useDraft(id);
  if (draft.isPending) return <p className="text-[15px] text-ink-2">Loading the draft…</p>;
  if (draft.isError) return <ErrorNotice error={draft.error} />;
  const node = draft.data.node;
  if (node === null) return <Unreadable draft={draft.data} />;
  return <Bench draft={draft.data} node={node} />;
}

function Bench({ draft, node }: { draft: DraftOut; node: DraftNodeOut }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ?? (TABS[0] as Tab);
  return (
    <>
      <Header draft={draft} node={node} />
      <StateLine draft={draft} />
      <div role="tablist" aria-label="Workbench" className="flex gap-0.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t === tab}
            onClick={() => setParams(t.key === "content" ? {} : { tab: t.key }, { replace: true })}
            className={`px-4 py-2 text-[13.5px] ${
              t === tab ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-ink-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_520px]">
        <section role="tabpanel" aria-label={tab.label} className="flex min-w-0 flex-col gap-3">
          {tab.body(draft, node)}
        </section>
        <aside className="flex flex-col rounded-panel border border-border bg-surface">
          <div className="border-b border-border px-3.5 py-2.5 text-[13px] font-semibold">
            Preview
          </div>
          <div className="p-3.5">
            <PreviewPanel node={node} />
          </div>
        </aside>
      </div>
    </>
  );
}

/** A draft whose latest revision no longer reads: its problems, and nothing to edit (#173). */
function Unreadable({ draft }: { draft: DraftOut }) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">{draft.node_id}</h1>
      <p className="text-[13.5px] text-ink-2">This draft's files no longer read:</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[13.5px]">
        {draft.problems.map((problem) => (
          <li key={`${problem.code}:${problem.file}:${problem.line}`}>{problem.text}</li>
        ))}
      </ul>
    </section>
  );
}
