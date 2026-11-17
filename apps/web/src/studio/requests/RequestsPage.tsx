import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { getJson, sendJson } from "../../api/client";
import { useLinkTargets } from "../../api/queries";
import type { ContentRequestOut, DecisionIn, RequestFacetsOut } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { SavedViews } from "../SavedViews";
import { ProposalDetails } from "./ProposalDetails";

const FIELD = "rounded-control border border-border-2 bg-bg p-2 text-sm";
const STATES = ["requested", "snoozed", "accepted", "merged", "declined"];
export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const state = params.get("state") ?? "requested";
  const q = params.get("q") ?? "";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const query = new URLSearchParams({ state, q, offset: String(offset) });
  for (const key of ["region", "kind", "view", "older_days", "min_asked"])
    if (params.get(key)) query.set(key, params.get(key) ?? "");
  const client = useQueryClient();
  const data = useQuery({
    queryKey: ["requests", query.toString()],
    queryFn: ({ signal }) => getJson<ContentRequestOut[]>(`/api/studio/requests?${query}`, signal),
    retry: false,
    refetchInterval: (current) =>
      current.state.data?.some((row) => ["pending", "running"].includes(row.grouping_state))
        ? 1500
        : false,
  });
  const facets = useQuery({
    queryKey: ["request-facets"],
    queryFn: () => getJson<RequestFacetsOut>("/api/studio/requests/facets"),
    retry: false,
  });
  const others = useQuery({
    queryKey: ["request-targets"],
    queryFn: () => getJson<ContentRequestOut[]>("/api/studio/requests?state=&q=&offset=0"),
    retry: false,
  });
  const targets = useLinkTargets();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [until, setUntil] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const rows = data.data ?? [];
  const picked = rows.filter((row) => selected.includes(row.public_id));
  const active = rows.find((row) => row.public_id === params.get("id"));
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "offset") next.delete("offset");
    next.delete("id");
    setSelected([]);
    setParams(next);
  }
  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["requests"] }),
      client.invalidateQueries({ queryKey: ["request-facets"] }),
      client.invalidateQueries({ queryKey: ["request-targets"] }),
      client.invalidateQueries({ queryKey: ["implementing"] }),
    ]);
  }
  async function decide(action: DecisionIn["action"] | "region") {
    if (busy || picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson(
        "POST",
        `/api/studio/requests/${action === "region" ? "region" : "decisions"}`,
        action === "region"
          ? {
              region,
              items: picked.map((row) => ({ identity: row.public_id, version: row.version })),
            }
          : {
              decisions: picked.map((row) => ({
                identity: row.public_id,
                version: row.version,
                action,
                reason,
                node_id: action === "merge" && target.startsWith("node/") ? target.slice(5) : "",
                target_request:
                  action === "merge" && target.startsWith("request/") ? target.slice(8) : null,
                until: action === "snooze" && until ? new Date(until).toISOString() : null,
              })),
            },
      );
      setSelected([]);
      setReason("");
    } catch (caught) {
      setError(caught as Error);
    } finally {
      await invalidate();
      setBusy(false);
    }
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      )
        return;
      const ids: Record<string, string> = {
        "1": "request-accept",
        "2": "request-merge",
        "3": "request-decline",
        h: "request-snooze",
      };
      const button = document.getElementById(ids[event.key] ?? "");
      if (button instanceof HTMLButtonElement && !button.disabled) {
        event.preventDefault();
        button.click();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
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
            aria-pressed={state === value && !params.get("view")}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("view");
              next.set("state", value);
              next.delete("offset");
              next.delete("id");
              setParams(next);
              setSelected([]);
            }}
          >
            {value === "requested" ? "Needs triage" : value}
            {facets.data?.states[value] !== undefined && ` (${facets.data.states[value]})`}
          </button>
        ))}
        {[
          ["blocking", "Blocking routes"],
          ["duplicates", "Duplicates to merge"],
          ["decided", "Decided this week"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={SECONDARY}
            aria-pressed={params.get("view") === value}
            onClick={() => {
              setParams({ state: value === "decided" ? "" : "requested", view: value ?? "" });
              setSelected([]);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <SavedViews
        scope="requests"
        params={params}
        onApply={(next) => {
          setParams(next);
          setSelected([]);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Find a request{" "}
          <input
            className={FIELD}
            value={q}
            onChange={(event) => filter("q", event.target.value)}
          />
        </label>
        <label className="text-sm">
          Type{" "}
          <select
            className={FIELD}
            value={params.get("kind") ?? ""}
            onChange={(event) => filter("kind", event.target.value)}
          >
            <option value="">All</option>
            <option value="goal">Goals</option>
            <option value="node">Nodes</option>
          </select>
        </label>
        <label className="text-sm">
          Region{" "}
          <select
            className={FIELD}
            value={params.get("region") ?? ""}
            onChange={(event) => filter("region", event.target.value)}
          >
            <option value="">All regions</option>
            {facets.data?.regions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Waiting at least{" "}
          <input
            type="number"
            className={`${FIELD} w-20`}
            min={0}
            max={3650}
            value={params.get("older_days") ?? 0}
            onChange={(event) => filter("older_days", event.target.value)}
          />{" "}
          days
        </label>
        <label className="text-sm">
          Asked at least{" "}
          <input
            type="number"
            className={`${FIELD} w-20`}
            min={0}
            max={10000}
            value={params.get("min_asked") ?? 0}
            onChange={(event) => filter("min_asked", event.target.value)}
          />
        </label>
      </div>
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
                <th>Routes blocked</th>
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
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
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
                        const next = new URLSearchParams(params);
                        next.set("id", row.public_id);
                        setParams(next);
                        setSelected([row.public_id]);
                      }}
                    >
                      {row.title}
                    </button>
                    <p className="text-xs text-ink-3">
                      {row.request_type} · {row.region || "No region"}
                    </p>
                  </td>
                  <td>{row.asked}</td>
                  <td>{row.blocked_routes?.length ?? 0}</td>
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
              <ProposalDetails proposal={active.proposal} />
              {[...new Set(active.submission_notes ?? [])]
                .filter((description) => description !== active.description)
                .map((description) => (
                  <p key={description} className="text-sm text-ink-2">
                    {description}
                  </p>
                ))}
              <h3 className="text-sm font-medium">Model suggestions · you decide</h3>
              {active.grouping_state === "unavailable" && (
                <p className="text-xs text-ink-3">
                  Suggestions unavailable. You can triage by hand.
                </p>
              )}
              <ul>
                {(active.suggestions ?? []).map((suggestion) => (
                  <li
                    className="my-2 text-sm"
                    key={`${String(suggestion.kind)}:${String(suggestion.target)}`}
                  >
                    <p className="font-medium">{String(suggestion.title ?? suggestion.target)}</p>
                    <p>{String(suggestion.reason)}</p>
                    <button
                      type="button"
                      className={SECONDARY}
                      onClick={() => {
                        setTarget(`${String(suggestion.kind)}/${String(suggestion.target)}`);
                        setReason(String(suggestion.reason));
                      }}
                    >
                      Use as merge target
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={SECONDARY}
                disabled={
                  busy ||
                  ["pending", "running"].includes(active.grouping_state) ||
                  !["requested", "snoozed"].includes(active.state)
                }
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await sendJson("POST", `/api/studio/requests/${active.public_id}/grouping`, {});
                    await invalidate();
                  } catch (caught) {
                    setError(caught as Error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh suggestions
              </button>
              <h3 className="text-sm font-medium">Blocked route attempts</h3>
              <ul>
                {(active.blocked_routes ?? []).map((goals) => (
                  <li key={goals.join(",")} className="text-xs">
                    {goals.join(" → ")}
                  </li>
                ))}
              </ul>
              <h3 className="text-sm font-medium">Decision history</h3>
              <ol className="flex flex-col gap-2">
                {active.decisions.map((decision) => (
                  <li key={decision.version} className="text-xs text-ink-2">
                    {decision.actor} · {decision.action}
                    <p>{decision.reason}</p>
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
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <label className="text-sm">
                Merge into
                <select
                  className={`${FIELD} block w-full`}
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Choose existing node or request</option>
                  <optgroup label="Nodes">
                    {(targets.data ?? [])
                      .filter((node) => !node.draft)
                      .map((node) => (
                        <option key={node.id} value={`node/${node.id}`}>
                          {node.title}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Requests">
                    {(active?.suggestions ?? [])
                      .filter(
                        (suggestion) =>
                          suggestion.kind === "request" &&
                          !(others.data ?? []).some((row) => row.public_id === suggestion.target),
                      )
                      .map((suggestion) => (
                        <option
                          key={String(suggestion.target)}
                          value={`request/${String(suggestion.target)}`}
                        >
                          {String(suggestion.title ?? suggestion.target)}
                        </option>
                      ))}
                    {(others.data ?? rows)
                      .filter(
                        (row) =>
                          !selected.includes(row.public_id) &&
                          ["requested", "snoozed", "accepted", "implementing"].includes(row.state),
                      )
                      .map((row) => (
                        <option key={row.public_id} value={`request/${row.public_id}`}>
                          {row.title}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </label>
              <label className="text-sm">
                Snooze until
                <input
                  className={`${FIELD} block w-full`}
                  type="datetime-local"
                  value={until}
                  onChange={(event) => setUntil(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  id="request-accept"
                  type="button"
                  className={PRIMARY}
                  disabled={busy}
                  onClick={() => void decide("accept")}
                >
                  Accept
                </button>
                <button
                  id="request-merge"
                  type="button"
                  className={SECONDARY}
                  disabled={busy || !reason.trim() || !target}
                  onClick={() => void decide("merge")}
                >
                  Merge
                </button>
                <button
                  id="request-decline"
                  type="button"
                  className={SECONDARY}
                  disabled={busy || !reason.trim()}
                  onClick={() => void decide("decline")}
                >
                  Decline
                </button>
                <button
                  id="request-snooze"
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
              <p className="text-xs text-ink-3">
                Shortcuts: 1 accept · 2 merge · 3 decline · H snooze. Required fields still apply.
              </p>
              <label className="text-sm">
                Assign region
                <select
                  className={`${FIELD} block w-full`}
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="">No region</option>
                  {facets.data?.regions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={SECONDARY}
                disabled={busy}
                onClick={() => void decide("region")}
              >
                Assign region
              </button>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
