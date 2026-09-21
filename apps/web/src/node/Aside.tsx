// The side column (L5, M3P5.2): what goes deeper, what stands beside, and what needs this node.
// Every row keeps the route in its link, so the strip follows the learner from node to node.
// Each group starts folded, with its count, so the page opens on the node itself (M3P5.2).
import { useId, useState } from "react";
import { Link } from "react-router";
import type { SideCardOut } from "../api/schema";
import { shownLevel } from "../start/format";
import { withRoute } from "./embed";

function Group({
  label,
  cards,
  goals,
  known,
}: {
  label: string;
  cards: SideCardOut[];
  goals: string[];
  known: string[];
}) {
  const [open, setOpen] = useState(false);
  const list = useId();
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-[13px] font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={list}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left hover:text-sel"
        >
          <span>
            {label} <span className="font-normal text-ink-3">· {cards.length}</span>
          </span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            aria-hidden="true"
            className={`shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M1 1l4 4 4-4" className="fill-none stroke-current" strokeWidth={1.6} />
          </svg>
        </button>
      </h2>
      <ul id={list} aria-label={label} hidden={!open} className="flex flex-col gap-1.5">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              to={withRoute(`/node/${card.id}`, goals, known)}
              title={card.reason}
              className="flex justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-[7px] text-[13px] hover:border-sel"
            >
              <span>{card.title}</span>
              <span className="shrink-0 text-right text-[12px] text-ink-3">
                {goals.includes(card.id)
                  ? "your goal"
                  : `${shownLevel(card.level)} · ${card.minutes} min`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Aside({
  deeper,
  related,
  neededBy,
  goals,
  known,
}: {
  deeper: SideCardOut[];
  related: SideCardOut[];
  neededBy: SideCardOut[];
  goals: string[];
  known: string[];
}) {
  return (
    <aside className="flex flex-col gap-2.5 self-start lg:sticky lg:top-6">
      <Group label="Goes deeper" cards={deeper} goals={goals} known={known} />
      <Group label="Related" cards={related} goals={goals} known={known} />
      <Group label="Needed by" cards={neededBy} goals={goals} known={known} />
    </aside>
  );
}
