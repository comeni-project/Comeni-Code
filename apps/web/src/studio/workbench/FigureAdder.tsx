// Adding a figure (M6.4 spec, M6FG.5): a component, the alt text and the caption, then one save
// that writes the component's starter file under a free stem and places it. Its data is written
// next, in the figure's own editor, which opens once the save lands.
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Field } from "../../account/Field";
import { type Component, SCHEMAS } from "../../figures/schemas";
import { SECONDARY } from "../../layout/buttons";
import { addFigure } from "./edits";
import { MarkdownField } from "./MarkdownField";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { reloadDraft, useDraftEdit } from "./useDraftEdit";

const COMPONENTS = Object.keys(SCHEMAS) as Component[];

export function FigureAdder({
  draftId,
  at,
  onClose,
  onAdded,
}: {
  draftId: string;
  at: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [component, setComponent] = useState<Component>(COMPONENTS[0] as Component);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const componentId = useId();
  const refusal = refusalOf(edit.error);
  const ready = alt.trim() !== "" && caption.trim() !== "";
  const add = () => {
    if (!ready || edit.isPending) return;
    edit.mutate(addFigure(at, component, alt.trim(), caption.trim()), { onSuccess: onAdded });
  };

  return (
    <section
      aria-label="New figure"
      className="flex flex-col gap-3 rounded-[10px] border-2 border-sel bg-surface p-3.5 shadow-[0_0_0_4px_var(--sel-soft)]"
    >
      <span className="font-mono text-[11px] text-ink-3">new figure</span>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={componentId} className="text-[13px] font-medium">
          Component
        </label>
        <select
          id={componentId}
          value={component}
          onChange={(event) => setComponent(event.target.value as Component)}
          className="h-10 rounded-control border border-border-2 bg-surface px-2.5 font-mono text-[13px]"
        >
          {COMPONENTS.map((each) => (
            <option key={each} value={each}>
              {each}
            </option>
          ))}
        </select>
        <span className="text-[11.5px] text-ink-3">
          It starts with sample data, which you replace in its file.
        </span>
      </div>
      <Field label="Alt text" value={alt} onChange={setAlt} />
      <MarkdownField label="Caption" value={caption} onChange={setCaption} />
      {refusal !== null && (
        <RefusalNotice
          refusal={refusal}
          onReload={() => {
            edit.reset();
            void reloadDraft(client, draftId);
          }}
        />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={SECONDARY}
          disabled={!ready || edit.isPending}
          onClick={add}
        >
          Add the figure
        </button>
      </div>
    </section>
  );
}
