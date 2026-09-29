// A node's blocks, read for what the page draws around them (M3P5.5, M4.1.2).
//
// The API serves the body as blocks (text, try, callout) that the validator has already read, so
// the page never looks for directives in Markdown. It still scans text blocks for two things: the
// second-level headings *On this page* lists, and First steps' reading list.
import type { CalloutBlockOut, TextBlockOut, TryBlockOut } from "../api/schema";

export type Block = TextBlockOut | TryBlockOut | CalloutBlockOut;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const SECOND = /^##\s+(.+?)\s*#*\s*$/;
const READING = /^##\s+further reading\s*$/i;

/** Each line of some Markdown, with whether it sits inside a fence (where nothing is a heading). */
function* scanned(markdown: string): Generator<{ line: string; fenced: boolean }> {
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const run = FENCE.exec(line)?.[1];
    if (fence === null && run !== undefined) {
      fence = run;
      yield { line, fenced: true };
    } else if (fence !== null) {
      if (run !== undefined && run[0] === fence[0] && run.length >= fence.length) fence = null;
      yield { line, fenced: true };
    } else {
      yield { line, fenced: false };
    }
  }
}

/** An id for a heading, the same one the page's `h2` carries, so *On this page* can link to it. */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/** The blocks without their reading list, and that list: First steps moves it to the footer. */
export function splitReading(blocks: Block[]): { blocks: Block[]; reading: string } {
  for (const [at, block] of blocks.entries()) {
    if (block.kind !== "text") continue;
    const lines = [...scanned(block.markdown)];
    const heading = lines.findIndex(({ line, fenced }) => !fenced && READING.test(line));
    if (heading === -1) continue;
    const text = (from: number, to?: number) =>
      lines
        .slice(from, to)
        .map(({ line }) => line)
        .join("\n");
    const after = blocks
      .slice(at + 1)
      .flatMap((later) => (later.kind === "text" ? [later.markdown] : []));
    return {
      blocks: [...blocks.slice(0, at), { kind: "text", markdown: text(0, heading) }],
      reading: [text(heading + 1), ...after].join(""),
    };
  }
  return { blocks, reading: "" };
}

export function headingsOf(blocks: Block[]): { id: string; text: string }[] {
  const found: { id: string; text: string }[] = [];
  for (const block of blocks) {
    if (block.kind !== "text") continue;
    for (const { line, fenced } of scanned(block.markdown)) {
      const text = fenced ? undefined : SECOND.exec(line)?.[1];
      if (text !== undefined) found.push({ id: slugOf(text.replace(/[`*_]/g, "")), text });
    }
  }
  return found;
}
