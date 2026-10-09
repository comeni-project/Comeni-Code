// The preview (M4K.1): the node drawn in the browser from the saved draft by the learner page's own
// Body, at desktop or phone width; it changes with each save and asks the API nothing.
import { useState } from "react";
import type { DraftNodeOut } from "../../api/schema";
import { Body } from "../../node/Body";

export function PreviewPanel({ node }: { node: DraftNodeOut }) {
  const [phone, setPhone] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex self-start rounded-control border border-border bg-bg p-[3px]">
        {(["Desktop", "Phone"] as const).map((name) => {
          const on = (name === "Phone") === phone;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => setPhone(name === "Phone")}
              className={`rounded-[7px] px-[13px] py-[5px] text-[12.5px] ${
                on ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="rounded-[10px] border border-border bg-bg">
        <NodePreview node={node} phone={phone} />
      </div>
      <p className="text-[12px] leading-[1.45] text-ink-3">
        Drawn in your browser from the saved draft; it changes with each save.
      </p>
    </div>
  );
}

/** The node as a learner reads it: its title, its claim and its body. */
export function NodePreview({ node, phone = false }: { node: DraftNodeOut; phone?: boolean }) {
  return (
    <div
      data-testid="preview"
      className={`mx-auto flex flex-col gap-3 px-[18px] py-4 ${phone ? "max-w-[390px]" : ""}`}
    >
      <p className="text-[24px] font-semibold tracking-[-0.02em]">{node.title}</p>
      <p className="rounded-[9px] border-[1.5px] border-ink bg-surface px-3 py-2.5 text-[14px] leading-[1.45]">
        {node.claim}
      </p>
      <Body blocks={node.blocks} questions={node.questions} />
    </div>
  );
}
