// Studio's top bar, as on the S-boards: the mark with its tag, search (drawn, not yet working),
// Back to Learn, and the account cell.
import { Link } from "react-router";
import { AccountButton } from "../layout/AccountButton";
import { SECONDARY } from "../layout/buttons";
import { Mark } from "../layout/Mark";

export function StudioBar() {
  return (
    <header className="flex h-15 shrink-0 items-center justify-between gap-6 border-b border-border px-6">
      <Mark studio />
      <div
        aria-hidden="true"
        className="hidden h-9 w-[420px] items-center gap-2.5 rounded-control border border-border-2 bg-surface px-3.5 text-[13.5px] text-ink-3 md:flex"
      >
        Find a node, request or track
      </div>
      <div className="flex items-center gap-3">
        <Link to="/" className={SECONDARY}>
          Back to Learn
        </Link>
        <AccountButton />
      </div>
    </header>
  );
}
