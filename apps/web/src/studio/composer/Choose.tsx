// Choose (M6.5 spec, M6CO.4; M6.6a spec, M6DC.5; the Choose boards): the de Bruijn components
// above the general kits, each drawn by its own renderer from its starter data, with a line on what
// it is for.
import type { ComponentType } from "react";
import { derive, STARTERS } from "../../figures/kits";
import { type KitProps, RENDERERS } from "../../figures/registry";
import type { Component } from "../../figures/schemas";

interface Kit {
  component: Component;
  what: string;
}

const GROUPS: { title: string; note: string; columns: string; kits: Kit[] }[] = [
  {
    title: "de Bruijn graphs",
    note: "drawn from reads you write; what follows from them is computed",
    columns: "md:grid-cols-2 xl:grid-cols-3",
    kits: [
      { component: "read-tiling", what: "Reads placed on the genome they came from" },
      { component: "kmer-window", what: "A read cut into k-mers; the learner drags k" },
      {
        component: "kmer-graph",
        what: "Reads joined by their k-mers; paths and branches computed",
      },
      { component: "compare-graphs", what: "One set of reads under both conventions" },
      { component: "graph-artifacts", what: "Tips and bubbles found from the reads" },
    ],
  },
  {
    title: "General",
    note: "for the long tail",
    columns: "md:grid-cols-2 xl:grid-cols-4",
    kits: [
      { component: "table", what: "Rows of numbers or words, a unit per column" },
      { component: "chart", what: "A Vega-Lite chart: bars, lines, points, areas" },
      { component: "flow", what: "Boxes joined by arrows, laid out from the data" },
      { component: "sequence-track", what: "A sequence and its features, in lanes" },
    ],
  },
];

export const KITS: Kit[] = GROUPS.flatMap((group) => group.kits);

/** A kit drawn small from its starter data, as the board's tiles are: no frame of its own. */
function Thumb({ component, what }: { component: Component; what: string }) {
  const Kit = RENDERERS[component] as ComponentType<KitProps<Component>>;
  return (
    <span className="pointer-events-none flex h-[140px] items-center justify-center overflow-hidden rounded-[9px] border border-border bg-canvas p-2 [&_svg]:max-h-[122px] [&_svg]:max-w-full [&_svg]:min-w-0! [&_table]:text-[12px] [&_input]:hidden [&_p]:hidden">
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
  only,
}: {
  chosen: Component | null;
  onChoose: (component: Component) => void;
  /** The kits offered, when a figure is made for a question: those with tasks (M6FA.7). */
  only?: readonly Component[];
}) {
  const groups = GROUPS.map((group) => ({
    ...group,
    kits: group.kits.filter((kit) => only === undefined || only.includes(kit.component)),
  })).filter((group) => group.kits.length > 0);
  return (
    <section
      aria-label="Choose a component"
      className="flex flex-col gap-[18px] rounded-panel border border-border bg-surface p-[18px]"
    >
      <h2 className="text-[14px] font-semibold">Choose a component</h2>
      {groups.map((group) => (
        <fieldset key={group.title} className="flex min-w-0 flex-col gap-2.5">
          <legend className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[13px] font-semibold">{group.title}</span>
            <span className="text-[12px] text-ink-3">{group.note}</span>
          </legend>
          <div className={`grid gap-3 ${group.columns}`}>
            {group.kits.map(({ component, what }) => (
              <button
                key={component}
                type="button"
                aria-pressed={chosen === component}
                aria-label={`${component}: ${what}`}
                onClick={() => onChoose(component)}
                className={`flex flex-col gap-2 rounded-xl bg-surface p-3 text-left ${
                  chosen === component
                    ? "border-2 border-sel shadow-[0_0_0_4px_var(--sel-soft)]"
                    : "border border-border"
                }`}
              >
                <Thumb component={component} what={what} />
                <span className="font-mono text-[13.5px] font-semibold">{component}</span>
                <span className="text-[12px] text-ink-2">{what}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-[12.5px] text-ink-3">
        Each starts from sample data, which you replace in the next step. The component is fixed
        once the figure is saved.
      </p>
    </section>
  );
}
