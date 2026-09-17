// The health page (M0 part 7 spec, P7.3): every state in words, colour only as the law allows.
import { useQuery } from "@tanstack/react-query";
import { fetchHealth, HealthUnreachable } from "../api/health";
import type { CheckOut } from "../api/schema";
import { TopBar } from "../layout/TopBar";

/** The beat heartbeat's interval (part 4); checking more often shows nothing new. */
export const HEALTH_POLL_MS = 10_000;

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour12: false });

const reasonOf = (error: Error) =>
  error instanceof HealthUnreachable ? error.reason : "unexpected error";

function summary(checks: CheckOut[]): { text: string; tone: "ok" | "down" } {
  const down = checks.filter((c) => c.status === "down").map((c) => c.name);
  if (down.length === 0) {
    return { text: `All ${checks.length} checks ok`, tone: "ok" };
  }
  return {
    text: `${down.length} ${down.length === 1 ? "needs" : "need"} you: ${down.join(", ")}`,
    tone: "down",
  };
}

function Dot({ tone }: { tone: "ok" | "down" | "stale" | "none" }) {
  const colour = { ok: "bg-line", down: "bg-open", stale: "bg-meas-bar", none: "bg-rail" }[tone];
  return <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-pill ${colour}`} />;
}

export function HealthPage({ pollMs = HEALTH_POLL_MS }: { pollMs?: number | false }) {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: pollMs,
    retry: false,
  });

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-7 py-8">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Health</h1>

        <div role="status" className="flex flex-col gap-3">
          {query.isPending ? (
            <p className="flex items-center gap-2.5 text-[17px] font-semibold text-ink-2">
              <Dot tone="none" />
              Checking…
            </p>
          ) : query.data === undefined ? (
            <p className="flex items-center gap-2.5 text-[17px] font-semibold text-open">
              <Dot tone="down" />
              Can't reach the API · {reasonOf(query.error)}
            </p>
          ) : (
            <>
              {query.isError ? (
                <p className="flex items-center gap-2.5 rounded-control bg-meas-soft px-3 py-2 text-[14px] font-medium text-meas">
                  <Dot tone="stale" />
                  Stale · last checked {time(query.dataUpdatedAt)} · can't reach the API ·{" "}
                  {reasonOf(query.error)}
                </p>
              ) : null}
              <p
                className={`flex items-center gap-2.5 text-[17px] font-semibold ${
                  summary(query.data.checks).tone === "ok" ? "text-ink" : "text-open"
                }`}
              >
                <Dot tone={summary(query.data.checks).tone} />
                {summary(query.data.checks).text}
              </p>
            </>
          )}
        </div>

        {query.data === undefined ? null : (
          <ul className="flex flex-col divide-y divide-border rounded-panel border border-border bg-surface">
            {query.data.checks.map((check) => (
              <li key={check.name} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                <span className="flex-1 font-mono text-[13px]">{check.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[12.5px] font-medium ${
                    check.status === "ok" ? "bg-line-soft text-btn" : "bg-open-soft text-open"
                  }`}
                >
                  <Dot tone={check.status} />
                  {check.status}
                </span>
                <span className="w-14 text-right font-mono text-[12px] text-ink-3">
                  {check.duration_ms} ms
                </span>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between text-[13px] text-ink-2">
          <span>{query.dataUpdatedAt > 0 ? `Checked at ${time(query.dataUpdatedAt)}` : ""}</span>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="rounded-[9px] border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-medium text-ink disabled:text-ink-3"
          >
            Check now
          </button>
        </footer>
      </main>
    </div>
  );
}
