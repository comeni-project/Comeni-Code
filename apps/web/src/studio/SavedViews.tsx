import { useState } from "react";
import { SECONDARY } from "../layout/buttons";

type Saved = { name: string; query: string };
export function SavedViews({
  scope,
  params,
  onApply,
}: {
  scope: string;
  params: URLSearchParams;
  onApply: (params: URLSearchParams) => void;
}) {
  const storage = `code:${scope}:views`;
  const [name, setName] = useState("");
  const [views, setViews] = useState<Saved[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storage) ?? "[]");
      return Array.isArray(value)
        ? value
            .filter(
              (row): row is Saved =>
                typeof row?.name === "string" && typeof row?.query === "string",
            )
            .slice(0, 20)
        : [];
    } catch {
      return [];
    }
  });
  function keep(next: Saved[]) {
    setViews(next);
    try {
      localStorage.setItem(storage, JSON.stringify(next));
    } catch {
      /* Views still work for this session when storage is unavailable. */
    }
  }
  return (
    <section aria-label="Saved views" className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <span key={view.name} className="flex items-center gap-1">
          <button
            type="button"
            className={SECONDARY}
            onClick={() => onApply(new URLSearchParams(view.query))}
          >
            {view.name}
          </button>
          <button
            type="button"
            aria-label={`Remove view ${view.name}`}
            className="px-1 text-ink-3"
            onClick={() => keep(views.filter((row) => row.name !== view.name))}
          >
            ×
          </button>
        </span>
      ))}
      <label className="text-sm">
        View name{" "}
        <input
          className="rounded-control border border-border-2 bg-bg p-2"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        type="button"
        className={SECONDARY}
        disabled={
          !name.trim() || (views.length >= 20 && !views.some((view) => view.name === name.trim()))
        }
        onClick={() => {
          const query = new URLSearchParams(params);
          query.delete("id");
          query.delete("offset");
          keep([
            ...views.filter((view) => view.name !== name.trim()),
            { name: name.trim(), query: query.toString() },
          ]);
          setName("");
        }}
      >
        Save view
      </button>
    </section>
  );
}
