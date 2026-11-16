import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getJson, sendJson } from "../../api/client";
import { useMe, useRegions } from "../../api/queries";
import type { WorkerOut, WorkItemOut } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";

const FIELD = "rounded-control border border-border-2 bg-bg p-2 text-sm";
const STAGES = ["accepted", "writing", "waiting for review", "approved", "live", "discarded"];
export function ImplementingPage() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "all";
  const me = useMe();
  const work = useQuery({
    queryKey: ["implementing"],
    queryFn: () => getJson<WorkItemOut[]>("/api/studio/implementing"),
    retry: false,
  });
  const team = useQuery({
    queryKey: ["implementing-team"],
    queryFn: () => getJson<WorkerOut[]>("/api/studio/implementing/team"),
    retry: false,
  });
  const regions = useRegions();
  const [selected, setSelected] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [opening, setOpening] = useState<WorkItemOut | null>(null);
  const [nodeId, setNodeId] = useState("");
  const [claim, setClaim] = useState("");
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState("introductory");
  const [minutes, setMinutes] = useState(10);
  const rows = (work.data ?? []).filter((row) =>
    view === "unassigned"
      ? row.assignee_id === null
      : view === "mine"
        ? row.assignee_id === me.data?.user?.public_id
        : view === "waiting"
          ? row.stage === "waiting for review"
          : view === "stalled"
            ? row.stalled
            : true,
  );
  async function change(url: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendJson("POST", url, body);
      setOpening(null);
      setSelected([]);
    } catch (caught) {
      setError(caught as Error);
    } finally {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["implementing"] }),
        client.invalidateQueries({ queryKey: ["implementing-team"] }),
        client.invalidateQueries({ queryKey: ["requests"] }),
      ]);
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <h1 className="text-[26px] font-semibold">Implementing</h1>
        <p className="text-sm text-ink-2">Accepted requests, from writing to review.</p>
      </header>
      <nav aria-label="Work views" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {["all", "unassigned", "mine", "waiting", "stalled"].map((value) => (
          <button
            type="button"
            key={value}
            className={SECONDARY}
            aria-pressed={view === value}
            onClick={() => {
              setParams({ view: value });
              setSelected([]);
            }}
          >
            {value}
          </button>
        ))}
      </nav>
      {work.isPending && <p>Loading work…</p>}
      {work.isError && <ErrorNotice error={work.error} />}
      {error && <ErrorNotice error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex flex-col gap-4">
          {!work.isPending && !work.isError && rows.length === 0 && (
            <p>No accepted requests in this view.</p>
          )}
          {STAGES.map((stage) => {
            const group = rows.filter((row) => row.stage === stage);
            return group.length === 0 ? null : (
              <details
                key={stage}
                open
                className="rounded-panel border border-border bg-surface p-4"
              >
                <summary className="font-medium">
                  {stage} · {group.length}
                </summary>
                <ul>
                  {group.map((row) => (
                    <li
                      key={row.public_id}
                      className="flex flex-wrap items-center gap-3 border-b border-border py-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.title}`}
                        checked={selected.includes(row.public_id)}
                        disabled={
                          busy || (selected.length >= 50 && !selected.includes(row.public_id))
                        }
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, row.public_id]
                              : ids.filter((id) => id !== row.public_id),
                          )
                        }
                      />
                      <span className="min-w-40 flex-1 font-medium">{row.title}</span>
                      <span>{row.asked} asked</span>
                      <span>{row.assignee}</span>
                      {row.stalled && <span className="text-open">Stalled · 14 days</span>}
                      {row.draft_id ? (
                        <Link className="text-sel" to={`/studio/drafts/${row.draft_id}`}>
                          Open draft
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={SECONDARY}
                          onClick={() => {
                            setOpening(row);
                            setNodeId(row.stub?.id ?? "");
                            setClaim(row.stub?.claim ?? "");
                            setRegion(row.stub?.region ?? "");
                            setLevel(row.stub?.level ?? "introductory");
                          }}
                        >
                          Start writing
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </section>
        <aside className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-5">
          <h2 className="font-semibold">Team load</h2>
          {team.isError && <ErrorNotice error={team.error} />}
          <ul>
            {(team.data ?? []).map((person) => (
              <li key={person.public_id} className="py-2 text-sm">
                {person.name}
                <p className="text-xs text-ink-3">
                  {person.writing} writing · {person.reviewing} waiting for review
                </p>
              </li>
            ))}
          </ul>
          <label className="text-sm">
            Assign selected
            <select
              className={`${FIELD} block w-full`}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(team.data ?? []).map((person) => (
                <option key={person.public_id} value={person.public_id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={SECONDARY}
            disabled={busy || selected.length === 0}
            onClick={() =>
              void change("/api/studio/implementing/assign", {
                items: (work.data ?? [])
                  .filter((row) => selected.includes(row.public_id))
                  .map((row) => ({ identity: row.public_id, version: row.version })),
                assignee: assignee || null,
              })
            }
          >
            Assign {selected.length} selected
          </button>
        </aside>
      </div>
      {opening && (
        <form
          aria-label="Start writing"
          className="flex max-w-xl flex-col gap-3 rounded-panel border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void change(`/api/studio/implementing/${opening.public_id}/start`, {
              version: opening.version,
              node_id: nodeId,
              claim,
              region,
              level,
              minutes,
            });
          }}
        >
          <h2 className="font-semibold">Start writing · {opening.title}</h2>
          <label>
            Node id
            <input
              className={`${FIELD} block w-full`}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
            />
          </label>
          <label>
            Claim
            <textarea
              className={`${FIELD} block w-full`}
              required
              maxLength={1000}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
            />
          </label>
          <label>
            Region
            <select
              className={`${FIELD} block w-full`}
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">Choose a region</option>
              {(regions.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {regions.isError && <ErrorNotice error={regions.error} />}
          <label>
            Level
            <select
              className={`${FIELD} block w-full`}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {["first-steps", "foundations", "introductory", "intermediate", "advanced"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Minutes
            <input
              className={`${FIELD} block w-full`}
              type="number"
              min={1}
              max={480}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <div className="flex gap-3">
            <button type="submit" className={PRIMARY} disabled={busy}>
              Create draft
            </button>
            <button
              type="button"
              className={SECONDARY}
              disabled={busy}
              onClick={() => setOpening(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
}
