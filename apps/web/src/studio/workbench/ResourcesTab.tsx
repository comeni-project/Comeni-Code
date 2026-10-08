// Resources (the WorkbenchResources board, M4K.3): + Resource above the cards; one card open with
// every field, the others closed with Edit and Remove. Every change sends the whole list.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../api/queries";
import type { DraftNodeOut, Level, ResourceIn, StudioResourceOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { NOTE } from "./bench";
import { resources } from "./edits";
import { RefusalNotice } from "./RefusalNotice";
import { ResourceCard, titleOf } from "./ResourceCard";
import { refusalOf } from "./refusal";
import { useDraftEdit } from "./useDraftEdit";

const toIn = (r: StudioResourceOut): ResourceIn => ({ ...r, level: r.level as Level });

export function ResourcesTab({
  draftId,
  node,
  editable,
}: {
  draftId: string;
  node: DraftNodeOut;
  editable: boolean;
}) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [open, setOpen] = useState<number | "new" | null>(null);
  const list = node.resources.map(toIn);
  const reload = () => void client.refetchQueries({ queryKey: queryKeys.draft(draftId) });
  const remove = (at: number) => {
    setOpen(null);
    edit.mutate(resources(list.filter((_, i) => i !== at)));
  };
  const close = (which: number | "new") => () => setOpen((now) => (now === which ? null : now));
  const refusal = refusalOf(edit.error);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={NOTE}>
          Outside videos and readings that teach this node, each with its provider, the part that
          covers it, and its licence.
        </p>
        {editable && (
          <button
            type="button"
            className={`${SECONDARY} text-sel`}
            disabled={open === "new"}
            onClick={() => setOpen("new")}
          >
            + Resource
          </button>
        )}
      </div>
      {refusal !== null && (
        <RefusalNotice
          refusal={refusal}
          onReload={() => {
            edit.reset();
            reload();
          }}
        />
      )}
      {list.map((r, at) =>
        open === at ? (
          <ResourceCard
            key={`open:${r.url}`}
            draftId={draftId}
            list={list}
            at={at}
            onClose={close(at)}
            onRemove={() => remove(at)}
            onReload={reload}
          />
        ) : (
          <section
            key={r.url}
            className="flex items-center justify-between gap-3 rounded-panel border border-border bg-surface px-5 py-3.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[14px] font-semibold">{titleOf(r)}</span>
              <span className="truncate text-[12.5px] text-ink-2">{r.covers}</span>
            </div>
            {editable && (
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Edit ${titleOf(r)}`}
                  className={SECONDARY}
                  onClick={() => setOpen(at)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${titleOf(r)}`}
                  className={SECONDARY}
                  disabled={edit.isPending}
                  onClick={() => remove(at)}
                >
                  Remove
                </button>
              </div>
            )}
          </section>
        ),
      )}
      {open === "new" && (
        <ResourceCard
          draftId={draftId}
          list={list}
          at={null}
          onClose={close("new")}
          onReload={reload}
        />
      )}
      {list.length === 0 && open !== "new" && <p className={NOTE}>No resources yet.</p>}
    </>
  );
}
