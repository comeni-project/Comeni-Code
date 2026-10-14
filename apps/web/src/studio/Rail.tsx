// The rail (M4S.4): the pages a role can open, from STUDIO_PAGES; on a phone it is a row.
import { NavLink } from "react-router";
import { useReviewQueue } from "../api/queries";
import { pagesFor, type StudioPage } from "./pages";

/** The keys still without your verdict, from the one queue GET the review page shares. */
function ToReview() {
  const queue = useReviewQueue();
  const left = (queue.data ?? []).flatMap((d) => d.keys).filter((k) => k.verdict === null).length;
  if (left === 0) return null;
  return (
    <span className="ml-auto rounded-pill bg-bg px-[7px] text-[11.5px] text-ink-3 tabular-nums">
      {left}
    </span>
  );
}

function Item({ page }: { page: StudioPage }) {
  return (
    <NavLink
      to={page.path}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-[8px] border px-2.5 py-[7px] text-[14px] ${
          isActive
            ? "border-border bg-surface font-semibold text-ink"
            : "border-transparent text-ink-2"
        }`
      }
    >
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d={page.icon}
          className="fill-none stroke-current"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {page.label}
      {page.count === "review" && <ToReview />}
    </NavLink>
  );
}

export function Rail({ role }: { role: string }) {
  const pages = pagesFor(role);
  const top = pages.filter((page) => page.place === "top");
  const foot = pages.filter((page) => page.place === "foot");
  return (
    <nav
      aria-label="Studio"
      className="flex shrink-0 flex-row flex-wrap gap-0.5 border-border p-3.5 md:w-[210px] md:flex-col md:border-r"
    >
      {top.map((page) => (
        <Item key={page.path} page={page} />
      ))}
      <div className="flex flex-row gap-0.5 md:mt-auto md:flex-col">
        {foot.map((page) => (
          <Item key={page.path} page={page} />
        ))}
      </div>
    </nav>
  );
}
