// The outline (S3, M4K.1): every block by kind and first words; a click opens its editor.
import type { DraftNodeOut } from "../../api/schema";
import type { Block } from "../../node/body";

/** What a block is called in lists: a text's first words, a callout's title, a try's ask, a
 * sequence's first ten letters. */
export function firstWords(block: Block, node: DraftNodeOut): string {
  if (block.kind === "sequence") {
    const letters = block.letters.replace(/\s+/g, "");
    return letters.length > 10 ? `${letters.slice(0, 10)}…` : letters || "(empty)";
  }
  const words =
    block.kind === "text"
      ? block.markdown
          .replace(/[#*_`>[\]]/g, "")
          .trim()
          .split("\n")[0]
      : block.kind === "callout"
        ? block.title
        : (node.questions.find((q) => q.id === block.question)?.ask ?? block.question);
  return words === undefined || words === "" ? "(empty)" : words;
}

export function Outline({
  node,
  onOpen,
}: {
  node: DraftNodeOut;
  onOpen: ((at: number) => void) | null;
}) {
  return (
    <nav aria-label="Outline" className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between pb-1.5">
        <span className="text-[13px] font-semibold">Outline</span>
        <span className="text-[11.5px] text-ink-3">{node.blocks.length} blocks</span>
      </div>
      {node.blocks.map((block, at) => {
        const inner = (
          <>
            <span className="w-[52px] flex-none font-mono text-[10.5px] text-ink-3">
              {block.kind}
            </span>
            <span className="truncate text-[12.5px]">{firstWords(block, node)}</span>
          </>
        );
        const key = `${at}:${block.kind}`;
        return onOpen === null ? (
          <div key={key} className="flex items-center gap-2 px-2 py-[5px]">
            {inner}
          </div>
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onOpen(at)}
            className="flex items-center gap-2 rounded-[7px] px-2 py-[5px] text-left hover:bg-sel-soft"
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
