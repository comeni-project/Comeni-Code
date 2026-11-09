// A problem as a reviewer judges it (M6.8b spec, M6PB.6; the ReviewProblem board): drawn as the page
// will draw it, then what the learner doesn't see until they answer (the rationale, which mistake
// names which callout, the kit and its params, the self-test), then the file itself.
import { useId } from "react";
import { useProblemKits } from "../../api/queries";
import type { NodeProblemOut } from "../../api/schema";
import { Problem } from "../../node/Problem";

const ROW = "grid grid-cols-1 gap-1 text-[13px] leading-normal md:grid-cols-[150px_minmax(0,1fr)]";

export function ProblemReview({ problem }: { problem: NodeProblemOut }) {
  const heading = useId();
  const kits = useProblemKits();
  const kit = kits.data?.find((k) => k.name === problem.kit);
  const mapped = new Set(problem.mistakes.map((m) => m.name));
  const others = (kit?.mistakes ?? []).map((m) => m.name).filter((name) => !mapped.has(name));
  const params = /^params:\s*(.*)$/m.exec(problem.text)?.[1];
  return (
    <div className="flex flex-col gap-3.5">
      <Problem problem={problem} />
      <section
        aria-labelledby={heading}
        className="flex flex-col gap-2 rounded-[10px] bg-bg px-3.5 py-3"
      >
        <h3 id={heading} className="m-0 text-[13px] font-semibold">
          What the learner doesn’t see until they answer
        </h3>
        <div className={ROW}>
          <span className="text-ink-3">Rationale</span>
          <span>{problem.rationale}</span>
        </div>
        <div className={ROW}>
          <span className="text-ink-3">Mistakes named</span>
          <span className="flex flex-col gap-0.5">
            {problem.mistakes.map((m) => (
              <span key={m.name}>{`${m.name} → the callout ${m.callout}`}</span>
            ))}
            {others.length > 0 && (
              <span>{`${others.join(", ")} → the checker’s sentence only`}</span>
            )}
          </span>
        </div>
        <div className={ROW}>
          <span className="text-ink-3">Dataset</span>
          <span>
            <span className="font-mono text-[12px]">{problem.kit}</span>
            {params ? ` · ${params}` : ""}
          </span>
        </div>
        <div className={ROW}>
          <span className="text-ink-3">Self-test</span>
          <span>passed on the sample and seeds 0–19</span>
        </div>
      </section>
      <details open className="flex flex-col gap-1.5">
        <summary className="cursor-pointer text-[13px] font-semibold">problem.yaml</summary>
        <pre className="m-0 mt-1.5 overflow-x-auto rounded-[9px] border border-border bg-bg px-3 py-2.5 font-mono text-[12px] leading-[1.6]">
          {problem.text}
        </pre>
      </details>
    </div>
  );
}
