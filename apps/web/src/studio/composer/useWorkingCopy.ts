// The figure's working copy, in the browser (M6.5 spec, M6CO.2): the file's text, which every
// edit changes and nothing sends until Save. The sheets, the form and Edit as YAML all edit this
// one text; the checks and the preview follow it with no request. While a check fails, the
// preview keeps the last drawing that checked.
import { useMemo, useRef, useState } from "react";
import type { FigureOut } from "../../api/schema";
import { apply, type Op, openFile } from "../../figures/document";
import { derive } from "../../figures/kits";
import { readFigure } from "../../figures/read";

export function useWorkingCopy(stem: string, initial: string | null) {
  const [text, setTyped] = useState(initial ?? "");
  const [note, setNote] = useState<string | null>(null);
  const fd = useMemo(() => openFile(text), [text]);
  const read = useMemo(() => readFigure(text), [text]);
  const good = useRef<FigureOut | null>(null);
  if (read.figure !== null) {
    const { component, alt, source } = read.figure;
    // While the data reads the same (only the alt text or source changed), the last good data and
    // what was derived from it are kept as they were, so the preview has nothing to redraw (#399).
    const last = good.current;
    const same =
      last !== null &&
      last.component === component &&
      JSON.stringify(last.data) === JSON.stringify(read.figure.data);
    const data = same ? last.data : read.figure.data;
    const derived = same ? last.derived : derive(component, data);
    good.current = { stem, component, alt, data, source, derived };
  }
  return {
    text,
    fd,
    figure: read.figure,
    problems: read.problems,
    lastGood: good.current,
    changed: text !== (initial ?? ""),
    note,
    setText: (next: string) => {
      setNote(null);
      setTyped(next);
    },
    edit: (ops: Op[], said?: string) => {
      setNote(said ?? null);
      setTyped(apply(fd, ops));
    },
  };
}

export type WorkingCopy = ReturnType<typeof useWorkingCopy>;
