// The top bar every page shares: the transit-line mark, and search (W6.1, M3 part 3 spec).
// The account menu waits for M4, so the bar does not draw one.
import { type ReactNode, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";

export const SEARCH_LABEL = "Search topics, tools and goals";

/** The board's shortcut: `/` puts the cursor in the field, unless a field already has it. */
function useSlashFocuses(field: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      const typing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (typing) return;
      event.preventDefault();
      field.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [field]);
}

export function TopBar({ children }: { children?: ReactNode }) {
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useSlashFocuses(field);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = field.current?.value.trim() ?? "";
    if (words === "") return;
    navigate(`/?${new URLSearchParams({ q: words })}`);
  }

  return (
    <header className="flex h-15 items-center gap-6 border-b border-border px-7">
      <Link to="/" className="flex shrink-0 items-center gap-2.5">
        <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">
          <line
            x1="3"
            y1="8"
            x2="27"
            y2="8"
            className="stroke-line"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {[4, 15, 26].map((cx) => (
            <circle
              key={cx}
              cx={cx}
              cy="8"
              r="3.5"
              className="fill-surface stroke-ink"
              strokeWidth="2"
            />
          ))}
        </svg>
        <span className="text-[17px] font-bold tracking-[-0.01em]">Comeni Code</span>
      </Link>

      <form role="search" onSubmit={onSubmit} className="flex max-w-md flex-1 items-center">
        <label htmlFor="top-search" className="sr-only">
          {SEARCH_LABEL}
        </label>
        <div className="flex w-full items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 focus-within:border-sel">
          <input
            id="top-search"
            ref={field}
            type="search"
            name="q"
            placeholder={SEARCH_LABEL}
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd
            aria-hidden="true"
            className="rounded-control border border-border px-1.5 py-0.5 font-mono text-[11px] text-ink-3"
          >
            /
          </kbd>
        </div>
      </form>

      {children}
    </header>
  );
}
