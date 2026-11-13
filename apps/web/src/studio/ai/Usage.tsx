// The AI page's Usage (M5.1 spec, M5G.7; the AIUsageM5 board): what the call sites used, from the
// call record. Cost only where a key is billed; a plan or a local server shows as such.
import { useState } from "react";
import type { UsageRange } from "../../api/ai";
import { useAIUsage } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { Segmented } from "./Segmented";

const RANGES: { key: UsageRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];
const PANEL = "flex flex-col overflow-hidden rounded-panel border border-border bg-surface";
const count = (n: number) => n.toLocaleString("en");

export function Usage() {
  const [range, setRange] = useState<UsageRange>("month");
  const usage = useAIUsage(range);
  return (
    <>
      <div className="self-end">
        <Segmented label="Range" options={RANGES} value={range} onChange={setRange} />
      </div>
      {usage.isPending ? (
        <p className="text-[14px] text-ink-2">Loading the usage…</p>
      ) : usage.isError ? (
        <ErrorNotice error={usage.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              [count(usage.data.calls), "calls"],
              [count(usage.data.tokens), "tokens"],
              [
                usage.data.cost === null ? "—" : `$${usage.data.cost}`,
                "cost where a key is billed",
              ],
              [count(usage.data.plan_calls), "calls on the ChatGPT plan"],
              [count(usage.data.refused), "refused, capped or failed"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="flex flex-col gap-0.5 rounded-panel border border-border bg-surface px-4 py-3"
              >
                <span className="font-mono text-[22px] font-semibold">{value}</span>
                <span className="text-[12.5px] text-ink-2">{label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={PANEL} aria-label="By call site">
              <h2 className="m-0 px-4 py-3 text-[15px] font-semibold">By call site</h2>
              <table className="w-full text-[13px]">
                <tbody>
                  {usage.data.by_site.map((s) => (
                    <tr key={s.site} className="border-t border-border">
                      <td className="px-4 py-2">{s.label}</td>
                      <td className="px-2 py-2 text-right font-mono">{count(s.calls)} calls</td>
                      <td className="px-4 py-2 text-right font-mono text-ink-3">
                        {s.cost === null ? "plan" : `$${s.cost}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className={PANEL} aria-label="By person">
              <h2 className="m-0 px-4 py-3 text-[15px] font-semibold">By person</h2>
              <table className="w-full text-[13px]">
                <tbody>
                  {usage.data.by_person.map((p) => (
                    <tr key={p.name} className="border-t border-border">
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2 text-right font-mono">{count(p.calls)} calls</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <span className="px-4 pb-3 text-[12px] text-ink-3">
                Learners are counted together: a learner’s call keeps no identity.
              </span>
            </section>
          </div>
          <section className={PANEL} aria-label="Recent calls">
            <h2 className="m-0 px-4 py-3 text-[15px] font-semibold">Recent calls</h2>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-t border-border text-[11.5px] text-ink-3">
                  <th className="px-4 py-2 text-left font-normal">When</th>
                  <th className="px-2 py-2 text-left font-normal">Call site</th>
                  <th className="px-2 py-2 text-left font-normal">Who</th>
                  <th className="px-2 py-2 text-left font-normal">Model</th>
                  <th className="px-2 py-2 text-right font-normal">Tokens</th>
                  <th className="px-2 py-2 text-right font-normal">Time</th>
                  <th className="px-4 py-2 text-left font-normal">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {usage.data.recent.map((c, at) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: calls have no identity on the page
                  <tr key={`${c.at}:${at}`} className="border-t border-border">
                    <td className="px-4 py-2 text-ink-3">{new Date(c.at).toLocaleString("en")}</td>
                    <td className="px-2 py-2 font-semibold">{c.site}</td>
                    <td className="px-2 py-2 text-ink-2">{c.who}</td>
                    <td className="px-2 py-2 font-mono text-ink-2">{c.model}</td>
                    <td className="px-2 py-2 text-right font-mono">{count(c.tokens)}</td>
                    <td className="px-2 py-2 text-right font-mono text-ink-3">
                      {(c.duration_ms / 1000).toFixed(1)} s
                    </td>
                    <td className="px-4 py-2">{c.code ? `${c.outcome} · ${c.code}` : c.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
