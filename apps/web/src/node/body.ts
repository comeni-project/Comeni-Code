// A node's body, cut into what the page draws (M3P5.5).
//
// The body is Markdown with one exception: `{% try <id> %}` on a line of its own says where a
// question is asked (M3P1.3). The page splits on those lines rather than teaching the Markdown
// renderer a new syntax, so the marker rule lives in one place: the validator, which refuses a
// marker naming a question the node does not have.

export type Piece = { kind: "text"; markdown: string } | { kind: "try"; id: string };

const TRY = /^\s*\{%\s*try\s+([a-z0-9-]+)\s*%\}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const SECOND = /^##\s+(.+?)\s*#*\s*$/;

/** Each line, with whether it sits inside a fenced block (where nothing is a marker or heading). */
function* scanned(body: string): Generator<{ line: string; fenced: boolean }> {
  let fence: string | null = null;
  for (const line of body.split("\n")) {
    const opens = FENCE.exec(line)?.[1];
    if (opens !== undefined && (fence === null || fence === opens)) {
      fence = fence === null ? opens : null;
      yield { line, fenced: true };
    } else {
      yield { line, fenced: fence !== null };
    }
  }
}

export function splitBody(body: string): Piece[] {
  const pieces: Piece[] = [];
  let text: string[] = [];
  const flush = () => {
    const markdown = text.join("\n");
    if (markdown.trim() !== "") pieces.push({ kind: "text", markdown });
    text = [];
  };
  for (const { line, fenced } of scanned(body)) {
    const marker = fenced ? null : TRY.exec(line);
    if (marker?.[1] !== undefined) {
      flush();
      pieces.push({ kind: "try", id: marker[1] });
    } else {
      text.push(line);
    }
  }
  flush();
  return pieces;
}

/** An id for a heading, the same one the page's `h2` carries, so *On this page* can link to it. */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

/** The body without its reading list, and that list: First steps moves it to the footer. */
export function splitReading(body: string): { body: string; reading: string } {
  const lines = body.split("\n");
  const at = lines.findIndex((line) => /^##\s+further reading\s*$/i.test(line));
  if (at === -1) return { body, reading: "" };
  return { body: lines.slice(0, at).join("\n"), reading: lines.slice(at + 1).join("\n") };
}

export function headingsOf(body: string): { id: string; text: string }[] {
  const found: { id: string; text: string }[] = [];
  for (const { line, fenced } of scanned(body)) {
    const text = fenced ? undefined : SECOND.exec(line)?.[1];
    if (text !== undefined) found.push({ id: slugOf(text.replace(/[`*_]/g, "")), text });
  }
  return found;
}
