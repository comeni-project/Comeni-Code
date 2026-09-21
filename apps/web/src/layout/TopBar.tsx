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
    <header className="grid h-15 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 border-b border-border bg-bg px-7 md:grid-cols-[1fr_minmax(0,460px)_1fr]">
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

      <search className="flex min-w-0 items-center">
        <form onSubmit={onSubmit} className="w-full">
          <label htmlFor="top-search" className="sr-only">
            {SEARCH_LABEL}
          </label>
          <div className="flex h-[38px] w-full items-center gap-2.5 rounded-control border border-border-2 bg-surface px-3.5 text-ink-3 focus-within:border-sel">
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
              <circle cx="7" cy="7" r="5" className="fill-none stroke-current" strokeWidth={1.6} />
              <path
                d="M11 11l3.5 3.5"
                className="stroke-current"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </svg>
            <input
              id="top-search"
              ref={field}
              type="search"
              name="q"
              placeholder={SEARCH_LABEL}
              className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
            />
            <kbd className="rounded-[5px] border border-border px-1.5 py-px font-mono text-[11px] text-ink-3">
              /
            </kbd>
          </div>
        </form>
      </search>

      {/* The account menu waits for M4; the cell keeps the search in the middle. */}
      <div className="flex justify-end">{children}</div>
    </header>
  );
}
