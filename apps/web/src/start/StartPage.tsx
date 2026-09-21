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

/** A candidate target: a ticked card once chosen, as on the Start board. */
function Target({
  result,
  chosen,
  onToggle,
}: {
  result: ResultOut;
  chosen: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={chosen}
        aria-label={`${chosen ? "Remove" : "Choose"} ${result.title}`}
        className={`flex w-full items-center gap-3.5 rounded-[10px] px-4 py-3 text-left ${
          chosen
            ? "border-2 border-sel bg-sel-soft"
            : "border border-border bg-surface hover:border-sel"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex size-5 shrink-0 items-center justify-center rounded-[5px] ${
            chosen ? "bg-sel" : "border-[1.5px] border-border-2 bg-surface"
          }`}
        >
          {chosen ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              className="stroke-surface"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 6.5 L5 9 L10 3" strokeWidth={2} strokeLinecap="round" />
            </svg>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">{result.title}</span>
          <span className="text-[13px] text-ink-2">{result.claim}</span>
        </span>
        <span className="shrink-0 font-mono text-[12px] text-ink-3">
          {result.region.name} · {result.minutes}m
        </span>
      </button>
    </li>
  );
}

export function StartPage() {
  const [params, setParams] = useSearchParams();
  const words = params.get("q") ?? "";
  const goals = params.getAll("goal");
  const [typed, setTyped] = useState(words);
  // Once a target is chosen the other candidates fold away, as on the board, until asked for.
  const [adding, setAdding] = useState(false);

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
    setAdding(false);
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

  const results = search.data?.results ?? [];
  const offered = [
    ...results.filter((result) => goals.includes(result.id)),
    ...(goals.length >= MAX_GOALS || (goals.length > 0 && !adding)
      ? []
      : results.filter((result) => !goals.includes(result.id))),
  ];

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="flex flex-col items-center gap-[26px] px-7 py-12">
        <section className="flex w-full max-w-[760px] flex-col items-center gap-3">
          <div className="mb-3.5 flex flex-col items-center gap-2.5 text-center">
            <h1 className="text-[40px] leading-tight font-semibold tracking-[-0.02em] text-balance">
              What do you want to learn?
            </h1>
            <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
              Name a tool, a topic or a problem. We build a route from pages that already exist —
              every stop says why it's there.
            </p>
          </div>

          <form
            className="flex h-[58px] w-full items-center gap-3 rounded-panel border-2 border-ink bg-surface pr-2.5 pl-5 focus-within:border-sel"
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
              className="min-w-0 flex-1 bg-transparent text-[19px] outline-none placeholder:text-ink-3"
            />
            <button
              type="submit"
              className="shrink-0 rounded-control bg-btn px-[26px] py-2.5 text-[14.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110"
            >
              Build my route
            </button>
          </form>

          <ul className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => ask(example)}
                  className="rounded-pill border border-border-2 bg-surface px-3 py-[5px] text-[13px] text-ink-2 hover:border-sel hover:text-ink"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {words.trim() === "" ? null : (
          <div
            aria-live="polite"
            className="flex w-full max-w-[1240px] flex-col gap-[18px] rounded-panel border border-border bg-surface px-[26px] py-[22px]"
          >
            <section className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[12px] font-medium text-ink-3">1 · Is this what you mean?</h2>
                <span className="text-[12px] text-ink-3">
                  Suggested from your words · you decide
                </span>
              </div>
              {search.isPending ? (
                <p className="text-[15px] text-ink-2">Searching…</p>
              ) : search.isError ? (
                <p className="rounded-control bg-open-soft px-4 py-3 text-[15px] text-open">
                  {sentenceOf(search.error)}
                </p>
              ) : results.length === 0 ? (
                <p className="text-[15px] text-ink-2">
                  Nothing here is about “{search.data.unmatched.join("”, “") || words}” yet. Try
                  another word, or a tool's name.
                </p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2">
                    {offered.map((result) => {
                      const chosen = goals.includes(result.id);
                      return (
                        <Target
                          key={result.id}
                          result={result}
                          chosen={chosen}
                          onToggle={() => (chosen ? drop(result.id) : choose(result.id))}
                        />
                      );
                    })}
                  </ul>
                  {goals.length >= MAX_GOALS ? (
                    <p className="text-[13px] text-ink-3">
                      Three targets is the most a route takes.
                    </p>
                  ) : goals.length > 0 && !adding && results.length > goals.length ? (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      className="self-start text-[13px] font-medium text-sel hover:underline"
                    >
                      + Add another target (up to {MAX_GOALS})
                    </button>
                  ) : null}
                </>
              )}
            </section>

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
        )}
      </main>
    </div>
  );
}
