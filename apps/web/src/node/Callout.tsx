// A callout (M4.1.2): a misconception, caveat or convention, boxed in the page's panel style. It
// spends no colour of its own (invariant 11); its kind is a grey tag, as a resource's kind is.
import type { Components } from "react-markdown";
import { componentsFor, Prose } from "./prose";
import { Tag } from "./tags";

export function Callout({
  kind,
  title,
  markdown,
  components = componentsFor(false),
}: {
  kind: string;
  title: string;
  markdown: string;
  components?: Components;
}) {
  const named = kind.charAt(0).toUpperCase() + kind.slice(1);
  return (
    <aside
      role="note"
      aria-label={title === "" ? named : `${named}: ${title}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3.5"
    >
      <span className="flex flex-wrap items-center gap-2">
        <Tag>{named}</Tag>
        {title === "" ? null : <span className="text-[15px] font-semibold text-ink">{title}</span>}
      </span>
      <Prose markdown={markdown} components={components} />
    </aside>
  );
}
