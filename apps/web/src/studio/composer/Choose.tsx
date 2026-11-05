// Choose (M6.5 spec, M6CO.4; the Choose board): the four general kits, each drawn by its own
// renderer from its starter data, with a line on what it is for.
import type { ComponentType } from "react";
import { derive, STARTERS } from "../../figures/kits";
import { type KitProps, RENDERERS } from "../../figures/registry";
import type { Component } from "../../figures/schemas";

export const KITS: { component: Component; what: string }[] = [
  { component: "table", what: "Rows of numbers or words, a unit per column" },
  { component: "chart", what: "A Vega-Lite chart: bars, lines, points, areas" },
  { component: "flow", what: "Boxes joined by arrows, laid out from the data" },
  { component: "sequence-track", what: "A sequence and its features, in lanes" },
];

/** A kit drawn small from its starter data, as the board's tiles are: no frame of its own. */
function Thumb({ component, what }: { component: Component; what: string }) {
  const Kit = RENDERERS[component] as ComponentType<KitProps<Component>>;
  return (
    <span className="pointer-events-none flex h-[170px] items-center justify-center overflow-hidden rounded-[9px] border border-border bg-canvas p-2.5 [&_svg]:max-h-[148px] [&_svg]:max-w-full [&_table]:text-[12px]">
      <Kit
        data={STARTERS[component] as never}
        derived={derive(component, STARTERS[component])}
        alt={what}
      />
    </span>
  );
}

export function Choose({
  chosen,
  onChoose,
}: {
  chosen: Component | null;
  onChoose: (component: Component) => void;
}) {
  return (
    <section
      aria-label="Choose a component"
      className="flex flex-col gap-3.5 rounded-panel border border-border bg-surface p-[18px]"
    >
      <h2 className="text-[14px] font-semibold">Choose a component</h2>
      <div className="grid gap-3.5 md:grid-cols-2">
        {KITS.map(({ component, what }) => (
          <button
            key={component}
            type="button"
            aria-pressed={chosen === component}
            aria-label={`${component}: ${what}`}
            onClick={() => onChoose(component)}
            className={`flex flex-col gap-2.5 rounded-xl bg-surface p-3.5 text-left ${
              chosen === component
                ? "border-2 border-sel shadow-[0_0_0_4px_var(--sel-soft)]"
                : "border border-border"
            }`}
          >
            <Thumb component={component} what={what} />
            <span className="font-mono text-[14px] font-semibold">{component}</span>
            <span className="text-[12.5px] text-ink-2">{what}</span>
          </button>
        ))}
      </div>
      <p className="text-[12.5px] text-ink-3">
        Each starts from sample data, which you replace in the next step. The component is fixed
        once the figure is saved.
      </p>
    </section>
  );
}
