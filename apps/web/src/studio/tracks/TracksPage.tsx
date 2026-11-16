import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { getJson, sendJson } from "../../api/client";
import type { RouteBundleOut, WeaveReviewOut } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { RouteMap } from "../../route/RouteMap";

const FIELD = "w-full rounded-control border border-border-2 bg-bg p-2 text-sm";
export function TracksPage() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const id = params.get("bundle") ?? "";
  const key = params.get("text") ?? "";
  const bundles = useQuery({
    queryKey: ["weave-review"],
    queryFn: () => getJson<RouteBundleOut[]>("/api/studio/tracks"),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["weave-review", id],
    queryFn: () => getJson<WeaveReviewOut>(`/api/studio/tracks/${id}`),
    enabled: id !== "",
    retry: false,
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.bundle.state ?? "") ? 1500 : false,
  });
  const items = detail.data?.bundle.texts ?? [];
  const item = items.find((text) => text.key === key) ?? items[0];
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [published, setPublished] = useState(false);
  useEffect(() => {
    setText(item?.text ?? "");
    setNote("");
  }, [item]);
  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      )
        return;
      if (event.key !== "j" && event.key !== "k") return;
      const at = items.findIndex((text) => text.key === item?.key);
      const next =
        items[Math.max(0, Math.min(items.length - 1, at + (event.key === "j" ? 1 : -1)))];
      if (next) {
        event.preventDefault();
        setParams({ bundle: id, text: next.key });
      }
    }
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [id, item?.key, items, setParams]);
  async function act(action: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPublished(false);
    try {
      if (action === "publish") {
        await sendJson("POST", `/api/studio/tracks/${id}/publish`, { name });
        setPublished(true);
      } else {
        const answer = await sendJson<WeaveReviewOut>(
          "POST",
          `/api/studio/tracks/${id}/${action === "refresh" ? "refresh" : "review"}`,
          action === "refresh"
            ? {}
            : { key: item?.key, version: item?.version, action, text, note },
        );
        if (answer.bundle.public_id !== id) setParams({ bundle: answer.bundle.public_id });
        client.setQueryData(["weave-review", answer.bundle.public_id], answer);
      }
      await client.invalidateQueries({ queryKey: ["weave-review"] });
      await client.invalidateQueries({ queryKey: ["tracks"] });
    } catch (caught) {
      setError(caught as Error);
      await client.invalidateQueries({ queryKey: ["weave-review", id] });
    } finally {
      setBusy(false);
    }
  }
  const stale = detail.data?.bundle.state === "flagged";
  const generating = ["queued", "running"].includes(detail.data?.bundle.state ?? "");
  return (
    <>
      <header>
        <h1 className="text-[26px] font-semibold">Tracks · weave review</h1>
        <p className="text-sm text-ink-2">
          Review each explanation against its claims and goal before naming the track.
        </p>
      </header>
      {bundles.isError && <ErrorNotice error={bundles.error} />}
      <label className="text-sm">
        Route
        <select
          className={FIELD}
          value={id}
          onChange={(e) => {
            setParams({ bundle: e.target.value });
            setPublished(false);
          }}
        >
          <option value="">Choose a route</option>
          {(bundles.data ?? []).map((bundle) => (
            <option key={bundle.public_id} value={bundle.public_id}>
              {bundle.goals.join(", ")} · {bundle.state} ·{" "}
              {bundle.texts.filter((text) => text.state === "approved").length}/
              {bundle.texts.length} checked
            </option>
          ))}
        </select>
      </label>
      {bundles.data?.length === 0 && (
        <p>No woven routes to review yet. Open a learner route to prepare its explanations.</p>
      )}
      {detail.isError && <ErrorNotice error={detail.error} />}
      {error && <ErrorNotice error={error} />}
      {stale && (
        <div role="alert" className="text-open">
          The graph or claims changed. These old texts need fresh generation and review.
          <button
            type="button"
            className={SECONDARY}
            disabled={busy}
            onClick={() => void act("refresh")}
          >
            Prepare current route
          </button>
        </div>
      )}
      {generating && <p>Preparing connecting text…</p>}
      {detail.data?.route && (
        <RouteMap
          route={detail.data.route}
          selected={item?.context.claims?.[0]?.id ?? null}
          onSelect={(node) => {
            const next = items.find((text) => text.key === `why/${node}`);
            if (next) setParams({ bundle: id, text: next.key });
          }}
        />
      )}
      {item && (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          <ol className="flex flex-col gap-2">
            {items.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className={`${SECONDARY} w-full justify-start`}
                  aria-pressed={entry.key === item.key}
                  onClick={() => setParams({ bundle: id, text: entry.key })}
                >
                  {entry.key} · {entry.state}
                </button>
              </li>
            ))}
          </ol>
          <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
            <h2 className="font-semibold">{item.kind}</h2>
            <p className="text-xs text-ink-3">
              J/K moves between items · {items.filter((text) => text.state === "approved").length}{" "}
              of {items.length} checked
            </p>
            <label>
              Connecting text
              <textarea
                className={FIELD}
                rows={7}
                maxLength={1000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={stale || generating || busy}
              />
            </label>
            {item.flags.map((flag) => (
              <p className="text-sm text-open" key={flag}>
                {flag}
              </p>
            ))}
            <label>
              Review note
              <textarea
                className={FIELD}
                rows={3}
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY}
                disabled={
                  busy ||
                  stale ||
                  generating ||
                  !item.text ||
                  item.state === "rewriting" ||
                  text !== item.text ||
                  (item.flags.length > 0 && !note.trim())
                }
                onClick={() => void act("approve")}
              >
                Approve
              </button>
              <button
                type="button"
                className={SECONDARY}
                disabled={busy || stale || generating || !text.trim()}
                onClick={() => void act("edit")}
              >
                Save edit for review
              </button>
              <button
                type="button"
                className={SECONDARY}
                disabled={busy || stale || generating || item.state === "rewriting"}
                onClick={() => void act("rewrite")}
              >
                Ask for rewrite
              </button>
            </div>
          </section>
          <aside className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
            <h2 className="font-semibold">Permitted claims and goal</h2>
            <ul className="flex flex-col gap-3">
              {item.context.claims.map((claim) => (
                <li key={claim.id} className="text-sm">
                  <h3 className="font-medium">{claim.title}</h3>
                  <p>{claim.claim}</p>
                </li>
              ))}
            </ul>
            <h3 className="font-medium">Goal</h3>
            {item.context.goals.map((goal) => (
              <p key={goal.id} className="text-sm">
                {goal.title}: {goal.claim}
              </p>
            ))}
            <h3 className="font-medium">Review history</h3>
            {detail.data?.history
              .filter((event) => event.key === item.key)
              .map((event) => (
                <p className="text-xs" key={`${String(event.key)}:${String(event.version)}`}>
                  {String(event.actor)} · {String(event.action)} · {String(event.note)}
                </p>
              ))}
          </aside>
        </div>
      )}
      {detail.data && (
        <form
          className="flex max-w-xl flex-col gap-3 rounded-panel border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void act("publish");
          }}
        >
          <label>
            Track name
            <input
              className={FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <button
            type="submit"
            className={PRIMARY}
            disabled={busy || !detail.data.eligible || !name.trim()}
          >
            Publish as a named track
          </button>
          {!detail.data.eligible && (
            <p className="text-xs text-ink-3">
              Review every text on a current full route before publication.
            </p>
          )}
          {published && <p role="status">Track published to the catalogue.</p>}
        </form>
      )}
    </>
  );
}
