// One landing (M4.9c spec, M4LS.3): its five steps from its state, what it holds and what was
// dropped. Asked again every 15 s while it moves (useLanding); keyed by id by its caller.
import { moving } from "../../api/landing";
import { useLanding } from "../../api/queries";
import type { LandingOut } from "../../api/schema";
import { StateTag } from "./StateTag";
import { STEPS, stepsOf } from "./views";
import { ago, who } from "./words";

function Mark({ step }: { step: string }) {
  if (step === "done")
    return (
      <span className="flex size-5 flex-none items-center justify-center rounded-full border border-border-2 bg-bg text-[11px] text-ink-2">
        ✓
      </span>
    );
  if (step === "on") return <span className="size-5 flex-none rounded-full border-2 border-sel" />;
  return (
    <span className="size-5 flex-none rounded-full border-[1.5px] border-dashed border-border-2" />
  );
}

/** A refused landing opened no pull request; a closed one's was closed (#317). */
function titleOf(landing: LandingOut, kept: number): string {
  const nodes = `${kept} ${kept === 1 ? "node" : "nodes"}`;
  if (landing.state === "refused") return "No pull request was opened";
  if (landing.state === "closed") return `${nodes}; its pull request was closed`;
  return `${nodes} in one pull request`;
}

export function LandingCard({ landing: listed }: { landing: LandingOut }) {
  const { data } = useLanding(listed);
  const landing = data ?? listed;
  const kept = landing.entries.filter((e) => e.dropped_code === "");
  const dropped = landing.entries.filter((e) => e.dropped_code !== "");
  const ended = landing.state === "refused" || landing.state === "closed";
  const steps = stepsOf(landing);
  return (
    <section
      aria-label="The landing"
      className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-[18px]"
    >
      <div className="flex items-center justify-between">
        <StateTag landing={landing} />
        <span className="text-[12px] text-ink-3">
          {`started ${ago(landing.started_at)} by ${who(landing.started_by)}`}
        </span>
      </div>
      <span className="text-[16px] font-semibold">{titleOf(landing, kept.length)}</span>
      {landing.pull_number !== null && (
        <a href={landing.pull_url} className="font-mono text-[12.5px] text-sel">
          {`comeni-code-content#${landing.pull_number} · ${landing.branch}`}
        </a>
      )}
      {ended || landing.state === "failed" ? (
        <p className="text-[13px] leading-normal text-ink-2">{landing.reason}</p>
      ) : null}
      {!ended && (
        <ol className="flex flex-col gap-[9px] pt-1">
          {STEPS.map(([label, note], i) => (
            <li key={label} className="flex items-start gap-2.5 text-[13px]">
              <Mark step={steps[i] ?? "todo"} />
              <span className="flex flex-col gap-px">
                <span
                  aria-current={steps[i] === "on" && moving(landing) ? "step" : undefined}
                  className={
                    steps[i] === "on"
                      ? "font-semibold"
                      : steps[i] === "done"
                        ? "text-ink-2"
                        : "text-ink-3"
                  }
                >
                  {label}
                </span>
                {note !== "" && <span className="text-[12px] text-ink-3">{note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-[5px] border-t border-border pt-2.5">
        <span className="text-[12.5px] font-semibold">In this landing</span>
        <span className="flex flex-wrap gap-x-4 font-mono text-[12.5px] text-ink-2">
          {kept.map((e) => (
            <span key={e.draft}>{`${e.node_id} · rev ${e.revision}`}</span>
          ))}
        </span>
        {dropped.map((e) => (
          <span key={e.draft} className="text-[12px] text-open">
            <b className="font-mono font-medium">{e.node_id}</b>
            {` dropped: ${e.dropped_reason} (${e.dropped_code}). It stays approved; open a new draft.`}
          </span>
        ))}
      </div>
    </section>
  );
}
