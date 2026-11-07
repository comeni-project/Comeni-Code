// Every state a figure that asks a question can be in (M6.6b spec, M6FA.6), each drawn by the
// page's own component from what it computed: start, midway, a wrong answer, answered. A state that
// throws or cannot be drawn is counted, so the composer's *Every state draws* check can fail.
import { Component as ReactComponent, type ReactNode, useEffect, useRef } from "react";
import type { FigureOut } from "../../api/schema";
import { FigureAnswer, type Outcome } from "../../figures/answer/FigureAnswer";
import { accepted } from "../../node/grading";

class Boundary extends ReactComponent<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <span className="text-[12px] text-open">This state could not be drawn.</span>
    ) : (
      this.props.children
    );
  }
}

interface State {
  name: string;
  selection: string[];
  outcome: Outcome;
}

/** The four states, from the figure's computed answer (M6FA.6). */
export function statesOf(record: FigureOut): State[] {
  const right = accepted(record)[0] ?? [];
  const wrong = ((record.derived.answer as { wrong?: string[] } | undefined)?.wrong ??
    []) as string[];
  const midway =
    record.interact?.task === "pick" ? right : right.slice(0, Math.ceil(right.length / 2));
  return [
    { name: "start", selection: [], outcome: null },
    { name: "midway", selection: midway, outcome: null },
    { name: "wrong answer", selection: wrong, outcome: "wrong" },
    { name: "answered", selection: right, outcome: "right" },
  ];
}

export function StateStrip({
  record,
  onDrawn,
}: {
  record: FigureOut;
  /** How many of the four drew: a drawing, not an error or "could not be drawn". */
  onDrawn?: (count: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const states = statesOf(record);
  // biome-ignore lint/correctness/useExhaustiveDependencies: counted again whenever the figure changes
  useEffect(() => {
    const drawn = [...(strip.current?.querySelectorAll("figure") ?? [])].filter(
      (f) => f.querySelector("svg[role=img]") !== null,
    );
    onDrawn?.(drawn.length);
  }, [record]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">Every state</span>
        <span className="text-[12px] text-ink-3">
          what the learner sees, each drawn by the component
        </span>
      </div>
      <div ref={strip} className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        {states.map((state) => (
          <figure
            key={state.name}
            aria-label={state.name}
            className="m-0 flex min-w-0 flex-col gap-1"
          >
            <div className="pointer-events-none overflow-hidden rounded-lg border border-border bg-surface text-[0px] [&_p]:hidden">
              <Boundary>
                <FigureAnswer
                  record={record}
                  selection={state.selection}
                  onSelect={() => {}}
                  outcome={state.outcome}
                  still
                />
              </Boundary>
            </div>
            <figcaption className="text-center text-[12px] text-ink-2">{state.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
