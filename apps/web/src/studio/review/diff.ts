// A word diff for the review's Changes view (M4.9b spec, M4RS.2): the longest run of shared words
// kept, the rest marked gone or new, what went before what came. Blocks are short, so the table is
// small.
export interface Piece {
  text: string;
  kind: "same" | "gone" | "new";
}

const wordsOf = (text: string) => text.match(/\S+\s*/g) ?? [];

export function wordDiff(before: string, after: string): Piece[] {
  const a = wordsOf(before);
  const b = wordsOf(after);
  const sameAt = (i: number, j: number) => a[i]?.trim() === b[j]?.trim();
  // shared[i][j]: the longest run of words a[i…] and b[j…] share, in order
  const shared = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  const at = (i: number, j: number) => shared[i]?.[j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      (shared[i] as number[])[j] = sameAt(i, j)
        ? at(i + 1, j + 1) + 1
        : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const out: Piece[] = [];
  const push = (text: string, kind: Piece["kind"]) => {
    const last = out.at(-1);
    if (last?.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && sameAt(i, j)) {
      push(b[j] as string, "same");
      i += 1;
      j += 1;
    } else if (i < a.length && (j === b.length || at(i + 1, j) >= at(i, j + 1))) {
      push(a[i] as string, "gone");
      i += 1;
    } else {
      push(b[j] as string, "new");
      j += 1;
    }
  }
  return out;
}
