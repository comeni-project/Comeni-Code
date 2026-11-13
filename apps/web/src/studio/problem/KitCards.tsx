// A node with no problem (M6.8b spec, M6PB.1; the WorkbenchProblemNew board): each kit with its
// rung, what the learner returns and its sample, and Start from this kit.
import type { ProblemKitOut } from "../../api/schema";
import { RUNGS } from "../../node/rungs";
import { Tag } from "../../node/tags";

export function KitCards({
  kits,
  onStart,
  editable,
}: {
  kits: readonly ProblemKitOut[];
  onStart: (kit: ProblemKitOut) => void;
  editable: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 text-[16px] font-semibold">This node has no problem yet</h2>
        <p className="m-0 max-w-[66ch] text-[14px] leading-relaxed text-ink-2">
          A problem proves a node: each learner downloads a dataset of their own, made from a seed,
          and sends one answer, which a kit checks. Pick the kit that computes what the problem
          asks; you fill in the words and the parameters next.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {kits.map((kit) => (
          <section
            key={kit.name}
            aria-label={kit.name}
            className="flex flex-col gap-3 rounded-panel border border-border bg-surface px-5 py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[14px] font-semibold">{kit.name}</span>
              <Tag>{`Rung ${kit.rung} · ${RUNGS[kit.rung] ?? ""}`}</Tag>
            </div>
            <p className="m-0 text-[13.5px] leading-normal text-ink-2">{kit.about}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Sample title="Sample dataset" text={kit.sample_dataset} />
              <Sample title="Sample output" text={kit.sample_output} />
            </div>
            {editable && (
              <button
                type="button"
                onClick={() => onStart(kit)}
                className="self-start rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-sel"
              >
                Start from this kit
              </button>
            )}
          </section>
        ))}
      </div>
      <p className="m-0 text-[12.5px] text-ink-3">
        A new kit is a reviewed change to code-problems, never code in a problem file. The problem’s
        block goes at the body’s end; move it in Content.
      </p>
    </section>
  );
}

function Sample({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[12.5px] font-semibold">{title}</span>
      <pre className="m-0 max-h-40 overflow-auto rounded-[9px] border border-border bg-bg px-3 py-2 font-mono text-[12px] leading-[1.6]">
        {text}
      </pre>
    </div>
  );
}
