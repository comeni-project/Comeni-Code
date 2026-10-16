// A worked example (M6.2 spec, M6MX.2): a titled panel of Markdown, read step by step, its code in
// the mono face, as the Node board draws it. It spends no colour of its own (invariant 11).
import type { Components } from "react-markdown";
import { componentsFor, Prose } from "./prose";
import { Tag } from "./tags";

export function Example({
  title,
  markdown,
  components = componentsFor(false),
}: {
  title: string;
  markdown: string;
  components?: Components;
}) {
  return (
    <section
      aria-label={`Worked example: ${title}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3.5"
    >
      <span className="flex flex-wrap items-center gap-2">
        <Tag>Worked example</Tag>
        <span className="text-[15px] font-semibold text-ink">{title}</span>
      </span>
      <Prose markdown={markdown} components={components} />
    </section>
  );
}
