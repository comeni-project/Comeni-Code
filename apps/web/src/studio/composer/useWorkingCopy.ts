// The figure's working copy, in the browser (M6.5 spec, M6CO.2): the file's text, which every
// edit changes and nothing sends until Save. The sheets, the form and Edit as YAML all edit this
// one text; the checks and the preview follow it with no request. While a check fails, the
// preview keeps the last drawing that checked.
import { useMemo, useRef, useState } from "react";
import type { FigureOut } from "../../api/schema";
import { derive } from "../../figures/kits";
import { readFigure } from "../../figures/read";
import type { Component } from "../../figures/schemas";
import { apply, type Op, openFile } from "../../yaml/document";

export function useWorkingCopy(stem: string, initial: string | null) {
  const [text, setTyped] = useState(initial ?? "");
  const [note, setNote] = useState<string | null>(null);
  const fd = useMemo(() => openFile(text), [text]);
  const read = useMemo(() => readFigure(text), [text]);
  const good = useRef<FigureOut | null>(null);
  // A figure that asks a question, drawn in every state once its data and task check, whatever
  // its alt text or source still need (M6FA.6): Describe does not change what is asked.
  const asking = useMemo((): FigureOut | null => {
    const written = fd.doc.toJS() as Record<string, unknown> | null;
    const blocking = read.problems.filter((p) => !["CS1024", "CS1026"].includes(p.code));
    if (written === null || blocking.length > 0 || written.interact == null) return null;
    const component = written.component as Component;
    const data = written.data as Record<string, unknown>;
    return {
      stem,
      component,
      alt: String(written.alt ?? ""),
      data: data as FigureOut["data"],
      derived: derive(component, data, written.interact),
      source: null,
      interact: written.interact as FigureOut["data"],
    };
  }, [fd, read, stem]);
  if (read.figure !== null) {
    const { component, alt, source, interact } = read.figure;
    // While the data reads the same (only the alt text or source changed), the last good data and
    // what was derived from it are kept as they were, so the preview has nothing to redraw (#399).
    const last = good.current;
    const same =
      last !== null &&
      last.component === component &&
      JSON.stringify(last.data) === JSON.stringify(read.figure.data) &&
      JSON.stringify(last.interact ?? null) === JSON.stringify(interact);
    const data = same ? last.data : read.figure.data;
    const derived = same ? last.derived : derive(component, data, interact);
    good.current = { stem, component, alt, data, source, derived, interact };
  }
  return {
    text,
    fd,
    figure: read.figure,
    problems: read.problems,
    lastGood: good.current,
    asking,
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
