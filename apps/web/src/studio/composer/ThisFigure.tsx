// This figure (M6.5 spec, M6CO.6): its file and every place the node shows it, so an author knows
// a change reaches all of them. A figure belongs to one node's folder; it is never shared.
import type { DraftNodeOut } from "../../api/schema";

export function placesOf(node: DraftNodeOut, stem: string): string[] {
  const blocks = node.blocks.flatMap((block, at) =>
    block.kind === "figure" && block.file === stem ? [`block ${at + 1} on the page`] : [],
  );
  const asked = node.questions.flatMap((q) =>
    q.figure === stem ? [`the try question ${q.id}`] : [],
  );
  const stems = node.exam.flatMap((q) =>
    q.stem.some((block) => block.kind === "figure" && block.file === stem)
      ? [`the exam question ${q.id}`]
      : [],
  );
  return [...blocks, ...asked, ...stems];
}

const TIMES = ["", "once", "twice"];

export function ThisFigure({ node, stem }: { node: DraftNodeOut; stem: string | null }) {
  let said: string;
  if (stem === null) {
    said = "Saved in figures/ under its component's name and placed there, in one save.";
  } else {
    const places = placesOf(node, stem);
    const times = TIMES[places.length] ?? `${places.length} times`;
    said = `figures/${stem}.yaml is placed ${times} in this node: ${places.join(", ")}.`;
    if (places.length > 1) said += " A change here changes every one.";
  }
  return (
    <section
      aria-label="This figure"
      className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3.5"
    >
      <h2 className="text-[14px] font-semibold">This figure</h2>
      <p className="text-[12.5px] leading-[1.5] text-ink-2">{said}</p>
    </section>
  );
}
