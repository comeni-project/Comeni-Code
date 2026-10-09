// An order try (M4.8c spec, M4Q.6): the steps shuffled, each moved with its own Move up and Move
// down — the keyboard's way, no drag needed — and checked in the order they stand. Focus follows
// the moved step, and a status line says where it now stands (#264).
import { useEffect, useRef, useState } from "react";
import { CHECK } from "./SequenceAnswer";

/** A shuffle that never hands the steps back in their right order. */
export function shuffled(steps: string[]): string[] {
  if (steps.length < 2) return steps;
  for (;;) {
    const out = [...steps];
    for (let at = out.length - 1; at > 0; at -= 1) {
      const other = Math.floor(Math.random() * (at + 1));
      [out[at], out[other]] = [out[other] as string, out[at] as string];
    }
    if (out.some((step, at) => step !== steps[at])) return out;
  }
}

export function OrderAnswer({
  steps,
  disabled,
  onCheck,
}: {
  steps: string[];
  disabled: boolean;
  onCheck: (order: string[]) => void;
}) {
  const [order, setOrder] = useState(steps);
  const [moved, setMoved] = useState<{ step: string; by: number } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const move = (at: number, by: number) => {
    const next = [...order];
    [next[at], next[at + by]] = [next[at + by] as string, next[at] as string];
    setOrder(next);
    setMoved({ step: next[at + by] as string, by });
  };
  // A step moved to an end disables the button pressed; focus goes to its other one.
  useEffect(() => {
    if (moved === null) return;
    const at = order.indexOf(moved.step);
    const edge = moved.by < 0 ? at === 0 : at === order.length - 1;
    const by = edge ? -moved.by : moved.by;
    buttons.current.get(`${moved.step}:${by < 0 ? "up" : "down"}`)?.focus();
  }, [moved, order]);
  const keep = (key: string) => (button: HTMLButtonElement | null) => {
    if (button === null) buttons.current.delete(key);
    else buttons.current.set(key, button);
  };
  return (
    <div className="flex flex-col gap-2.5">
      <ol className="flex flex-col gap-1.5">
        {order.map((step, at) => (
          <li
            key={step}
            className="flex items-center gap-2.5 rounded-[10px] border border-border-2 bg-surface px-3.5 py-2 text-[14.5px]"
          >
            <span className="min-w-0 flex-1">{step}</span>
            <button
              type="button"
              ref={keep(`${step}:up`)}
              aria-label={`Move ${step} up`}
              disabled={disabled || at === 0}
              onClick={() => move(at, -1)}
              className="px-1.5 text-ink-2 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              ref={keep(`${step}:down`)}
              aria-label={`Move ${step} down`}
              disabled={disabled || at === order.length - 1}
              onClick={() => move(at, 1)}
              className="px-1.5 text-ink-2 disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {moved === null
          ? ""
          : `${moved.step}, step ${order.indexOf(moved.step) + 1} of ${order.length}`}
      </p>
      <button
        type="button"
        disabled={disabled}
        className={`${CHECK} self-start`}
        onClick={() => onCheck(order)}
      >
        Check
      </button>
    </div>
  );
}
