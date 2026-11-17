import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getJson, sendJson } from "../api/client";
import type { ReceiptOut } from "../api/schema";
import { PRIMARY } from "../layout/buttons";
import { ErrorNotice } from "../layout/ErrorNotice";
import { TopBar } from "../layout/TopBar";

export function RequestPage() {
  const [params, setParams] = useSearchParams();
  const receipt = params.get("receipt") ?? "";
  const [title, setTitle] = useState(params.get("goal") ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const status = useQuery({
    queryKey: ["request-receipt", receipt],
    queryFn: () => getJson<ReceiptOut>(`/api/requests/${receipt}`),
    enabled: receipt !== "",
    retry: false,
  });
  return (
    <>
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-5 p-8">
        <h1 className="text-2xl font-semibold">Request a topic</h1>
        {receipt ? (
          <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5">
            {status.isPending && <p>Loading request…</p>}
            {status.isError && <ErrorNotice error={status.error} />}
            {status.data && (
              <>
                <h2>{status.data.title}</h2>
                <p>Status: {status.data.state}</p>
                {status.data.reason && <p>{status.data.reason}</p>}
                {status.data.node_id && (
                  <Link to={`/node/${status.data.node_id}`}>Open the existing topic</Link>
                )}
                <p>Bookmark this page to check what the team decides.</p>
              </>
            )}
          </section>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError(null);
              const text = JSON.stringify([title, description]);
              if (pending.current?.text !== text)
                pending.current = { text, id: crypto.randomUUID() };
              try {
                const made = await sendJson<ReceiptOut>("POST", "/api/requests", {
                  request_id: pending.current.id,
                  title,
                  description,
                });
                setParams({ receipt: made.receipt });
              } catch (caught) {
                setError(caught as Error);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Describe what you want to understand. A person will review your request before writing
              begins.
            </p>
            <label>
              Topic
              <input
                className="block w-full rounded-control border border-border-2 bg-bg p-2"
                required
                maxLength={240}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              What would you like to learn?
              <textarea
                className="block w-full rounded-control border border-border-2 bg-bg p-2"
                required
                maxLength={4000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <p className="text-sm text-ink-2">Keep personal information out of your request.</p>
            {error && <ErrorNotice error={error} />}
            <button
              type="submit"
              className={PRIMARY}
              disabled={busy || !title.trim() || !description.trim()}
            >
              {busy ? "Sending…" : "Send request"}
            </button>
          </form>
        )}
        <Link to="/" className="text-sel">
          Back to Start
        </Link>
      </main>
    </>
  );
}
