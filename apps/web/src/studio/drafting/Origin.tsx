/** Public receipts survive reindexing; private proposal history is optional. */
export function Origin({
  provenance,
  target,
  reviewed = false,
}: {
  provenance: unknown;
  target?: string;
  reviewed?: boolean;
}) {
  const p = provenance as {
    receipts?: Record<
      string,
      {
        model: string;
        prompt_id: string;
        sources?: { hash: string; title?: string; url?: string; licence?: string }[];
      }
    >;
    items?: Record<string, { receipts: string[] }>;
  } | null;
  const ids =
    target === undefined ? Object.keys(p?.receipts ?? {}) : (p?.items?.[target]?.receipts ?? []);
  if (ids.length === 0) return null;
  return (
    <details className="rounded-control border border-border bg-bg px-3 py-2 text-[12px] text-ink-2">
      <summary className="cursor-pointer">
        AI origin · {reviewed ? "reviewed" : "not yet reviewed"}
      </summary>
      {ids.map((id) => {
        const receipt = p?.receipts?.[id];
        return (
          <div key={id} className="mt-2 flex flex-col gap-1">
            <span>
              {receipt?.model} · {receipt?.prompt_id}
            </span>
            {receipt?.sources?.map((source) => (
              <span key={source.hash}>
                {source.url && /^https?:\/\//.test(source.url) ? (
                  <a
                    className="text-sel underline"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title ?? source.url}
                  </a>
                ) : (
                  (source.title ?? "Private source · reference retained")
                )}
                {source.licence && ` · ${source.licence}`}
              </span>
            ))}
          </div>
        );
      })}
    </details>
  );
}
