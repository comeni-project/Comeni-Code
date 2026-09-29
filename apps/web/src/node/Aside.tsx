// Around this node (L5, M3P5.2): what goes deeper, what stands beside, and what needs it.
//
// On a wide screen it is a rail beside the body that folds to a slim strip, so the body can take
// the width; the page decides the grid from `open`. On a narrow screen it follows the body, open.
// Every row keeps the route in its link, so the strip follows the learner from node to node.
import { Link } from "react-router";
import type { SideCardOut } from "../api/schema";
import { shownLevel } from "../start/format";
import { withRoute } from "./embed";

export interface Around {
  deeper: SideCardOut[];
  related: SideCardOut[];
  neededBy: SideCardOut[];
}

export const aroundCount = (around: Around) =>
  around.deeper.length + around.related.length + around.neededBy.length;

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
  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-semibold">{label}</h3>
      <ul aria-label={label} className="flex flex-col gap-1.5">
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

const Chevron = ({ left }: { left: boolean }) => (
  <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden="true" className="shrink-0">
    <path
      d={left ? "M6 1L1 6l5 5" : "M1 1l5 5-5 5"}
      className="fill-none stroke-current"
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </svg>
);

export function Aside({
  around,
  goals,
  known,
  open,
  onToggle,
}: {
  around: Around;
  goals: string[];
  known: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const total = aroundCount(around);
  if (total === 0) return null;
  return (
    <aside aria-label="Around this node" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      {/* Folded on a wide screen: a slim strip that says how much is behind it. */}
      <button
        type="button"
        aria-expanded={false}
        onClick={onToggle}
        className={`${open ? "hidden" : "hidden lg:flex"} w-11 flex-col items-center gap-3 rounded-xl border border-border bg-surface py-3 text-ink-2 hover:border-sel hover:text-ink`}
      >
        <span className="sr-only">Around this node · {total}</span>
        <Chevron left={true} />
        <span
          aria-hidden="true"
          className="text-[12.5px] font-medium [writing-mode:vertical-rl] rotate-180"
        >
          Around this node · {total}
        </span>
      </button>
      <div className={`${open ? "flex" : "flex lg:hidden"} flex-col gap-[18px]`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink-3">Around this node</h2>
          <button
            type="button"
            aria-expanded={true}
            aria-label="Fold the rail"
            onClick={onToggle}
            className="hidden rounded-md p-1.5 text-ink-3 hover:text-ink lg:block"
          >
            <Chevron left={false} />
          </button>
        </div>
        <Group label="Goes deeper" cards={around.deeper} goals={goals} known={known} />
        <Group label="Related" cards={around.related} goals={goals} known={known} />
        <Group label="Needed by" cards={around.neededBy} goals={goals} known={known} />
      </div>
    </aside>
  );
}
