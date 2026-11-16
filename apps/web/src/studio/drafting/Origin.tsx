import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchProposal } from "../../api/drafting";
/** Public receipts survive reindexing; private proposal history is optional. */
export function Origin({
  provenance,
  target,
  reviewed = false,
  draftId,
}: {
  provenance: unknown;
  target?: string;
  reviewed?: boolean;
  draftId?: string;
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
  const [selected, setSelected] = useState<string | null>(null);
  const privateReceipt = useQuery({
    queryKey: ["draft", draftId, "proposal", selected],
    queryFn: ({ signal }) => fetchProposal(draftId ?? "", selected ?? "", signal),
    enabled: draftId !== undefined && selected !== null,
    retry: false,
    staleTime: Infinity,
  });
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
            {draftId && (
              <button
                type="button"
                className="self-start text-sel underline"
                onClick={() => setSelected(id)}
              >
                View full drafting receipt
              </button>
            )}
          </div>
        );
      })}
      {privateReceipt.data && (
        <section
          aria-label="Full drafting receipt"
          className="mt-3 rounded-control border border-border p-3"
        >
          <h3 className="font-semibold">Private Studio receipt</h3>
          <p>{privateReceipt.data.instruction}</p>
          <p className="whitespace-pre-wrap">
            {privateReceipt.data.sources
              .map((s) => String(s.excerpt ?? ""))
              .filter(Boolean)
              .join("\n\n")}
          </p>
          <p>
            {privateReceipt.data.receipt
              ? JSON.stringify(privateReceipt.data.receipt)
              : "No call details are available."}
          </p>
        </section>
      )}
    </details>
  );
}
