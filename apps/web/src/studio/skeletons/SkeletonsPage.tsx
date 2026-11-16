import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getJson, sendJson } from "../../api/client";
import { useLinkTargets } from "../../api/queries";
import type { SkeletonOut, StubMapping } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";

const FIELD = "w-full rounded-control border border-border-2 bg-bg p-2 text-sm";
export function SkeletonsPage() {
  const [params, setParams] = useSearchParams();
  const identity = params.get("import") ?? "";
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["skeletons"],
    queryFn: () => getJson<SkeletonOut[]>("/api/studio/skeletons"),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["skeletons", identity],
    queryFn: () => getJson<SkeletonOut>(`/api/studio/skeletons/${identity}`),
    enabled: identity !== "",
    retry: false,
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.state ?? "") ? 1500 : false,
  });
  const targets = useLinkTargets();
  const [kind, setKind] = useState("openstax");
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [licence, setLicence] = useState("");
  const [outline, setOutline] = useState("");
  const [rights, setRights] = useState(false);
  const [note, setNote] = useState("");
  const [mappings, setMappings] = useState<Record<string, StubMapping>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const made = detail.data;
  async function change(sending: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await sendJson<SkeletonOut>(
        "POST",
        sending ? `/api/studio/skeletons/${identity}/send` : "/api/studio/skeletons",
        sending
          ? {
              version: made?.version,
              mappings: Object.fromEntries(
                selected.map((id) => [
                  id,
                  mappings[id] ?? made?.mappings[id] ?? { action: "new", target: "" },
                ]),
              ),
              note,
            }
          : { kind, url, version, licence, outline, rights },
      );
      client.setQueryData(["skeletons", answer.public_id], answer);
      setParams({ import: answer.public_id });
      setSelected([]);
      await client.invalidateQueries({ queryKey: ["skeletons"] });
      await client.invalidateQueries({ queryKey: ["requests"] });
    } catch (caught) {
      setError(caught as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <h1 className="text-[26px] font-semibold">Skeletons</h1>
        <p className="text-sm text-ink-2">
          Outline → proposed stubs and needs → human mapping → Requests.
        </p>
      </header>
      {error && <ErrorNotice error={error} />}
      {list.isError && <ErrorNotice error={list.error} />}
      <label className="text-sm">
        Previous outlines
        <select
          className={FIELD}
          value={identity}
          onChange={(e) => {
            setParams(e.target.value ? { import: e.target.value } : {});
            setMappings({});
            setSelected([]);
            setNote("");
          }}
        >
          <option value="">Import an outline</option>
          {(list.data ?? []).map((row) => (
            <option value={row.public_id} key={row.public_id}>
              {row.source_kind} · {row.source_version} · {row.state}
            </option>
          ))}
        </select>
      </label>
      {identity === "" ? (
        <form
          className="flex max-w-3xl flex-col gap-3 rounded-panel border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void change(false);
          }}
        >
          <label>
            Outline source
            <select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value)}>
              {["openstax", "college-board", "galaxy-training", "carpentries"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Source URL
            <input
              className={FIELD}
              type="url"
              required
              maxLength={1000}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Source version
              <input
                className={FIELD}
                required
                maxLength={240}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
            <label>
              Licence
              <input
                className={FIELD}
                required
                maxLength={240}
                value={licence}
                onChange={(e) => setLicence(e.target.value)}
              />
            </label>
          </div>
          <label>
            Paste the outline
            <textarea
              className={FIELD}
              rows={12}
              required
              maxLength={16000}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />{" "}
            I confirm this outline may be used for these proposals.
          </label>
          <p className="text-xs text-ink-3">
            Use public or openly licensed outlines from the listed sources. Khan Academy is a human
            reference and linked resource, not an import source.
          </p>
          <button type="submit" className={PRIMARY} disabled={busy || !rights}>
            {busy ? "Importing…" : "Propose stubs"}
          </button>
        </form>
      ) : (
        <>
          {detail.isPending && <p>Opening outline…</p>}
          {detail.isError && <ErrorNotice error={detail.error} />}
          {made && (
            <>
              <section className="rounded-panel border border-border bg-surface p-4">
                <h2 className="font-medium">
                  {made.source_kind} · {made.source_version}
                </h2>
                <p className="text-sm">
                  {made.licence} ·{" "}
                  <a href={made.source_url} target="_blank" rel="noreferrer" className="text-sel">
                    Source outline
                  </a>
                </p>
                <p className="mt-2 text-sm">
                  {made.state === "queued" || made.state === "running"
                    ? "Proposing and scoring stubs…"
                    : made.state}
                </p>
                {made.code && (
                  <p className="text-sm text-open">
                    Some generation or scoring was unavailable ({made.code}). Review the available
                    proposals by hand.
                  </p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm">Imported outline</summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{made.outline}</p>
                </details>
              </section>
              <ul className="flex flex-col gap-4">
                {made.result?.stubs.map((stub) => {
                  const mapping: StubMapping = mappings[stub.id] ??
                    made.mappings[stub.id] ?? { action: "new", target: "" };
                  const score = made.scores.find((score) => score.key === `stub/${stub.id}`);
                  return (
                    <li key={stub.id} className="rounded-panel border border-border bg-surface p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${stub.title}`}
                          disabled={Boolean(made.sent[stub.id])}
                          checked={selected.includes(stub.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, stub.id]
                                : ids.filter((id) => id !== stub.id),
                            )
                          }
                        />
                        <div className="flex-1">
                          <h2 className="font-semibold">{stub.title}</h2>
                          <p className="mt-1 text-sm">{stub.claim}</p>
                          <p className="mt-1 text-xs text-ink-3">
                            {stub.region} · {stub.level}
                          </p>
                        </div>
                        <span className="text-sm">{score ? `${score.score}/5` : "Unscored"}</span>
                      </div>
                      {score && <p className="mt-2 text-sm text-ink-2">{score.reason}</p>}
                      <ul className="my-3 flex flex-col gap-2">
                        {(stub.needs ?? []).map((need) => {
                          const scored = made.scores.find(
                            (score) => score.key === `need/${stub.id}/${need.target}`,
                          );
                          return (
                            <li key={need.target} className="text-sm">
                              Needs {need.target} · {scored ? `${scored.score}/5` : "Unscored"}
                              <p className="text-ink-2">{need.reason}</p>
                              {scored && <p className="text-xs text-ink-3">{scored.reason}</p>}
                            </li>
                          );
                        })}
                      </ul>
                      {made.sent[stub.id] ? (
                        <Link
                          to={`/studio/requests?state=requested&id=${made.sent[stub.id]}`}
                          className="text-sm text-sel"
                        >
                          Sent to Requests · awaiting human triage
                        </Link>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm">
                            Mapping
                            <select
                              className={FIELD}
                              value={mapping.action}
                              onChange={(e) =>
                                setMappings((values) => ({
                                  ...values,
                                  [stub.id]: {
                                    action: e.target.value as StubMapping["action"],
                                    target: mapping.target ?? "",
                                  },
                                }))
                              }
                            >
                              <option value="new">New request</option>
                              <option value="existing">Matches existing</option>
                              <option value="merge">Merge with existing</option>
                            </select>
                          </label>
                          {mapping.action !== "new" && (
                            <label className="text-sm">
                              Existing node
                              <select
                                className={FIELD}
                                value={mapping.target}
                                onChange={(e) =>
                                  setMappings((values) => ({
                                    ...values,
                                    [stub.id]: { ...mapping, target: e.target.value },
                                  }))
                                }
                              >
                                <option value="">Choose a node</option>
                                {(targets.data ?? [])
                                  .filter((node) => !node.draft)
                                  .map((node) => (
                                    <option key={node.id} value={node.id}>
                                      {node.title}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {made.state === "ready" && (
                <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
                  <label>
                    Mapping review note
                    <textarea
                      className={FIELD}
                      rows={3}
                      maxLength={4000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <p className="text-xs text-ink-3">
                    Include new prerequisites in the selection, or map them to existing nodes.
                    Sending creates requested items; it does not accept them.
                  </p>
                  <button
                    type="button"
                    className={PRIMARY}
                    disabled={busy || selected.length === 0 || !note.trim()}
                    onClick={() => void change(true)}
                  >
                    Send {selected.length} selected to Requests
                  </button>
                </section>
              )}
            </>
          )}
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              setParams({});
              setMappings({});
              setSelected([]);
            }}
          >
            Import another outline
          </button>
        </>
      )}
    </>
  );
}
