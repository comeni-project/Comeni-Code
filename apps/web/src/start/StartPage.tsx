// The Start page (L1, M3 part 3 spec): ask, confirm a target, see the route it would build.
//
// The stages live in the URL — ?q= for the words, ?goal= for each confirmed target — so the back
// button steps through them, a refresh keeps them, and a half-finished search is a link.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { ApiUnreachable } from "../api/client";
import { fetchRoute } from "../api/routes";
import type { ResultOut } from "../api/schema";
import { fetchSearch } from "../api/search";
import { TopBar } from "../layout/TopBar";
import { EXAMPLES } from "./examples";
import { RoutePreview } from "./RoutePreview";

export const MAX_GOALS = 3;

/** The Route page part 4 builds, in the vocabulary the API already speaks (M3P3.2). */
export const routePage = (goals: readonly string[]) =>
  `/route?${new URLSearchParams(goals.map((goal) => ["goal", goal]))}`;

const sentenceOf = (error: Error) =>
  error instanceof ApiUnreachable && error.status !== undefined
    ? error.reason
    : `Can't reach the API · ${error instanceof ApiUnreachable ? error.reason : "unexpected error"}`;

function Candidate({ result, onChoose }: { result: ResultOut; onChoose: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onChoose}
        aria-label={`Choose ${result.title}`}
        className="flex w-full flex-col gap-1 rounded-panel border border-border bg-surface p-4 text-left hover:border-sel"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold">{result.title}</span>
          <span className="font-mono text-[12px] text-ink-3">
            {result.region.name} · {result.minutes}m
          </span>
        </span>
        <span className="text-[14px] text-ink-2">{result.claim}</span>
      </button>
    </li>
  );
}

export function StartPage() {
  const [params, setParams] = useSearchParams();
  const words = params.get("q") ?? "";
  const goals = params.getAll("goal");
  const [typed, setTyped] = useState(words);

  const search = useQuery({
    queryKey: ["search", words],
    queryFn: ({ signal }) => fetchSearch(words, signal),
    enabled: words.trim() !== "",
    retry: false,
  });

  function ask(next: string) {
    setTyped(next);
    setParams(next.trim() === "" ? {} : { q: next });
  }

  function choose(id: string) {
    if (goals.includes(id) || goals.length >= MAX_GOALS) return;
    const next = new URLSearchParams(params);
    next.append("goal", id);
    setParams(next);
  }

  function drop(id: string) {
    const next = new URLSearchParams(params);
    next.delete("goal");
    for (const goal of goals.filter((other) => other !== id)) next.append("goal", goal);
    setParams(next);
  }

  const preview = useQuery({
    queryKey: ["route", ...goals],
    queryFn: ({ signal }) => fetchRoute(goals, [], signal),
    enabled: goals.length > 0,
    retry: false,
  });

  const chosen = (search.data?.results ?? []).filter((result) => goals.includes(result.id));

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-7 py-10">
        <section className="flex flex-col gap-4">
          <h1 className="text-[34px] font-semibold tracking-[-0.02em]">
            What do you want to learn?
          </h1>
          <p className="max-w-2xl text-[17px] text-ink-2">
            Name a tool, a topic or a problem. We build a route from pages that already exist —
            every stop says why it's there.
          </p>

          <form
            className="flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              ask(typed);
            }}
          >
            <label htmlFor="goal-words" className="sr-only">
              What do you want to learn?
            </label>
            <input
              id="goal-words"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="salmon"
              className="min-w-64 flex-1 rounded-control border border-border bg-surface px-4 py-3 text-[17px] outline-none focus:border-sel"
            />
            <button
              type="submit"
              className="rounded-control bg-btn px-5 py-3 text-[15px] font-semibold text-btn-ink shadow-[0_2px_0_0_var(--btn-sh)] hover:brightness-110"
            >
              Build my route
            </button>
          </form>

          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => ask(example)}
                  className="rounded-pill border border-border bg-surface px-3 py-1.5 text-[13px] text-ink-2 hover:border-sel hover:text-ink"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div aria-live="polite" className="flex flex-col gap-8">
          {words.trim() === "" ? null : search.isPending ? (
            <p className="text-[15px] text-ink-2">Searching…</p>
          ) : search.isError ? (
            <p className="rounded-control bg-open-soft px-4 py-3 text-[15px] text-open">
              {sentenceOf(search.error)}
            </p>
          ) : search.data.results.length === 0 ? (
            <p className="text-[15px] text-ink-2">
              Nothing here is about “{search.data.unmatched.join("”, “") || words}” yet. Try another
              word, or a tool's name.
            </p>
          ) : (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] font-semibold">Is this what you mean?</h2>
                <p className="text-[13px] text-ink-3">Suggested from your words · you decide</p>
              </div>

              {chosen.length === 0 ? null : (
                <ul className="flex flex-wrap gap-2">
                  {chosen.map((result) => (
                    <li key={result.id}>
                      <span className="flex items-center gap-2 rounded-pill border border-line bg-line-soft px-3 py-1.5 text-[13px] text-ink">
                        {result.title}
                        <button
                          type="button"
                          aria-label={`Remove ${result.title}`}
                          onClick={() => drop(result.id)}
                          className="text-ink-2 hover:text-ink"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {goals.length >= MAX_GOALS ? (
                <p className="text-[13px] text-ink-3">Three targets is the most a route takes.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {search.data.results
                    .filter((result) => !goals.includes(result.id))
                    .map((result) => (
                      <Candidate
                        key={result.id}
                        result={result}
                        onChoose={() => choose(result.id)}
                      />
                    ))}
                </ul>
              )}
            </section>
          )}

          {goals.length === 0 ? null : preview.isPending ? (
            <p className="text-[15px] text-ink-2">Weaving your route…</p>
          ) : preview.isError ? (
            <p className="rounded-control bg-open-soft px-4 py-3 text-[15px] text-open">
              {sentenceOf(preview.error)}
            </p>
          ) : (
            <RoutePreview route={preview.data} href={routePage(goals)} />
          )}
        </div>
      </main>
    </div>
  );
}
