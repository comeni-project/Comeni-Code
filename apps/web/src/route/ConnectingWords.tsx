import { useQuery } from "@tanstack/react-query";
import { getJson, sendJson } from "../api/client";
import type { RouteBundleOut, RouteTextOut } from "../api/schema";

export function useRouteWords(goals: string[], known: string[]) {
  const initial = useQuery({
    queryKey: ["route-words", [...goals].sort(), [...known].sort()],
    queryFn: () => sendJson<RouteBundleOut>("POST", "/api/routes/text", { goals, known }),
    enabled: goals.length > 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const identity = initial.data?.public_id;
  const current = useQuery({
    queryKey: ["route-words-bundle", identity],
    queryFn: () => getJson<RouteBundleOut>(`/api/routes/text/${identity}`),
    enabled: identity !== undefined,
    retry: false,
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.state ?? "queued") ? 1500 : false,
  });
  return current.data ?? initial.data;
}
function Words({ item }: { item: RouteTextOut }) {
  if (!item.text || !["ready", "approved"].includes(item.state)) return null;
  return (
    <div className="rounded-control border border-border bg-surface p-3 text-sm text-ink-2">
      <p className="whitespace-pre-wrap">{item.text}</p>
      {item.state !== "approved" && (
        <p className="mt-1 text-xs text-ink-3">AI connecting text · not yet reviewed</p>
      )}
    </div>
  );
}
export function GoalWords({
  goals,
  known,
  node,
}: {
  goals: string[];
  known: string[];
  node: string;
}) {
  const bundle = useRouteWords(goals, known);
  const item = bundle?.texts.find((text) => text.key === `why/${node}`);
  return !item || bundle?.state === "flagged" ? null : (
    <div className="mx-4 my-3 sm:mx-9">
      <Words item={item} />
    </div>
  );
}
export function RouteWords({ goals, known }: { goals: string[]; known: string[] }) {
  const bundle = useRouteWords(goals, known);
  if (bundle?.state !== "ready") return null;
  return (
    <section aria-label="How the route connects" className="flex flex-col gap-3">
      {bundle.texts
        .filter((item) => item.kind === "introduction")
        .map((item) => (
          <Words key={item.key} item={item} />
        ))}
      <details>
        <summary className="cursor-pointer text-sm text-ink-2">Between the stops</summary>
        <ol className="mt-3 flex flex-col gap-3">
          {bundle.texts
            .filter((item) => item.kind === "bridge")
            .map((item) => (
              <li key={item.key}>
                <p className="mb-1 text-xs text-ink-3">
                  {item.key.slice(7).replaceAll("/", " → ")}
                </p>
                <Words item={item} />
              </li>
            ))}
        </ol>
      </details>
    </section>
  );
}
