import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { getJson, sendJson } from "../../api/client";
import { useLinkTargets } from "../../api/queries";
import type { ContentRequestOut, DecisionIn } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";

const FIELD = "rounded-control border border-border-2 bg-bg p-2 text-sm";
const STATES = ["requested", "snoozed", "accepted", "merged", "declined"];
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const state = params.get("state") ?? "requested";
  const q = params.get("q") ?? "";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const client = useQueryClient();
  const data = useQuery({
    queryKey: ["requests", state, q, offset],
    queryFn: ({ signal }) =>
      getJson<ContentRequestOut[]>(
        `/api/studio/requests?${new URLSearchParams({ state, q, offset: String(offset) })}`,
        signal,
      ),
    retry: false,
  });
  const targets = useLinkTargets();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [node, setNode] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const rows = data.data ?? [];
  const picked = rows.filter((row) => selected.includes(row.public_id));
  const active = rows.find((row) => row.public_id === params.get("id"));
  function filter(key: string, value: string) {
    setSelected([]);
    setParams({ state, q, [key]: value });
  }
  async function decide(action: DecisionIn["action"]) {
    if (busy || picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson("POST", "/api/studio/requests/decisions", {
        decisions: picked.map((row) => ({
          identity: row.public_id,
          version: row.version,
          action,
          reason,
          node_id: node,
          until: action === "snooze" && until ? new Date(until).toISOString() : null,
        })),
      });
      setSelected([]);
      setReason("");
      await client.invalidateQueries({ queryKey: ["requests"] });
    } catch (caught) {
      setError(caught as Error);
      await client.invalidateQueries({ queryKey: ["requests"] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <h1 className="text-[26px] font-semibold">Requests</h1>
        <p className="text-sm text-ink-2">Nothing moves to Implementing until a person decides.</p>
      </header>
      <nav aria-label="Request views" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {STATES.map((value) => (
          <button
            key={value}
            type="button"
            className={SECONDARY}
            aria-pressed={state === value}
            onClick={() => filter("state", value)}
          >
            {value === "requested" ? "Needs triage" : value}
          </button>
        ))}
      </nav>
      <label className="text-sm">
        Find a request{" "}
        <input className={FIELD} value={q} onChange={(e) => filter("q", e.target.value)} />
      </label>
      {data.isPending && <p>Loading requests…</p>}
      {data.isError && <ErrorNotice error={data.error} />}
      {error && <ErrorNotice error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-auto rounded-panel border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-ink-3">
                <th className="p-3">Select</th>
                <th>Request</th>
                <th>Asked</th>
                <th>Waiting since</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.public_id} className="border-b border-border">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.title}`}
                      checked={selected.includes(row.public_id)}
                      disabled={
                        busy || (selected.length >= 50 && !selected.includes(row.public_id))
                      }
                      onChange={(e) =>
                        setSelected((current) =>
                          e.target.checked
                            ? [...current, row.public_id]
                            : current.filter((id) => id !== row.public_id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="py-3 font-medium text-sel"
                      onClick={() => {
                        setParams({ state, q, offset: String(offset), id: row.public_id });
                        setSelected([row.public_id]);
                      }}
                    >
                      {row.title}
                    </button>
                  </td>
                  <td>{row.asked}</td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.isPending && !data.isError && rows.length === 0 && (
            <p className="p-5 text-ink-2">No requests in this view.</p>
          )}
          <div className="flex gap-3 p-3">
            <button
              type="button"
              className={SECONDARY}
              disabled={offset === 0}
              onClick={() => filter("offset", String(Math.max(0, offset - 100)))}
            >
              Previous
            </button>
            <button
              type="button"
              className={SECONDARY}
              disabled={rows.length < 100}
              onClick={() => filter("offset", String(offset + 100))}
            >
              Next
            </button>
          </div>
        </section>
        <aside className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
          {active ? (
            <>
              <h2 className="font-semibold">{active.title}</h2>
              <p className="whitespace-pre-wrap text-sm">{active.description}</p>
              <p className="text-xs text-ink-3">
                {active.state} · revision {active.version}
              </p>
              <h3 className="text-sm font-medium">Decision history</h3>
              <ol className="flex flex-col gap-2">
                {active.decisions.map((d) => (
                  <li key={d.version} className="text-xs text-ink-2">
                    {d.actor} · {d.action}
                    <p>{d.reason}</p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-ink-2">Select a request to read its details.</p>
          )}
          {picked.length > 0 && ["requested", "snoozed"].includes(state) && (
            <>
              <h3 className="font-medium">Decide {picked.length} selected</h3>
              <label className="text-sm">
                Reason
                <textarea
                  className={`${FIELD} block w-full`}
                  maxLength={4000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Merge into
                <select
                  className={`${FIELD} block w-full`}
                  value={node}
                  onChange={(e) => setNode(e.target.value)}
                >
                  <option value="">Choose existing node</option>
                  {(targets.data ?? [])
                    .filter((n) => !n.draft)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm">
                Snooze until
                <input
                  className={`${FIELD} block w-full`}
                  type="datetime-local"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={busy}
                  onClick={() => void decide("accept")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={SECONDARY}
                  disabled={busy || !reason.trim() || !node}
                  onClick={() => void decide("merge")}
                >
                  Merge
                </button>
                <button
                  type="button"
                  className={SECONDARY}
                  disabled={busy || !reason.trim()}
                  onClick={() => void decide("decline")}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className={SECONDARY}
                  disabled={busy || !reason.trim() || !until}
                  onClick={() => void decide("snooze")}
                >
                  Snooze
                </button>
                {state === "snoozed" && (
                  <button
                    type="button"
                    className={SECONDARY}
                    disabled={busy}
                    onClick={() => void decide("resume")}
                  >
                    Return to triage
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
