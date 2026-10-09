// A callout's kind, title and Markdown (M4K.3), the three kinds the body format knows.
import { useId } from "react";
import { Field } from "../../account/Field";
import type { CalloutBlockOut } from "../../api/schema";
import { MarkdownField } from "./MarkdownField";

const KINDS = ["misconception", "caveat", "convention"] as const;

export function CalloutFields({
  block,
  onChange,
}: {
  block: CalloutBlockOut;
  onChange: (block: CalloutBlockOut) => void;
}) {
  const id = useId();
  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] font-medium">
            Kind
          </label>
          <select
            id={id}
            value={block.callout}
            onChange={(e) =>
              onChange({ ...block, callout: e.target.value as CalloutBlockOut["callout"] })
            }
            className="h-10 rounded-control border border-border-2 bg-surface px-2.5 text-[14px]"
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.charAt(0).toUpperCase() + kind.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Title"
          value={block.title}
          onChange={(title) => onChange({ ...block, title })}
        />
      </div>
      <MarkdownField
        value={block.markdown}
        onChange={(markdown) => onChange({ ...block, markdown })}
      />
    </>
  );
}
