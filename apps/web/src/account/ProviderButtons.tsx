// One button per provider allauth reports; nothing here names a provider but the marks (M4S.2).
import { useState } from "react";
import { continueWith } from "../api/auth";
import { sentenceOf } from "../api/client";
import { useProviders } from "../api/queries";

const MARKS: Record<string, string> = {
  github:
    "M8 1.2a6.8 6.8 0 0 0-2.15 13.25c.34.06.46-.15.46-.33v-1.2c-1.9.41-2.3-.8-2.3-.8-.31-.79-.76-1-.76-1-.62-.42.05-.41.05-.41.68.05 1.04.7 1.04.7.61 1.04 1.6.74 1.99.57.06-.44.24-.74.43-.91-1.51-.17-3.1-.76-3.1-3.36 0-.74.27-1.35.7-1.83-.07-.17-.3-.86.07-1.8 0 0 .57-.18 1.87.7a6.5 6.5 0 0 1 3.4 0c1.3-.88 1.87-.7 1.87-.7.37.94.14 1.63.07 1.8.44.48.7 1.09.7 1.83 0 2.61-1.6 3.19-3.11 3.36.24.21.46.62.46 1.25v1.85c0 .18.12.4.47.33A6.8 6.8 0 0 0 8 1.2z",
};

function OrRule() {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

interface Props {
  next: string;
  /** Runs before leaving, such as holding an invite; a failure stays on the page. */
  prepare?: () => Promise<unknown>;
  /** Where the "or" rule goes, against the form beside the buttons. */
  rule: "before" | "after";
  /** A line under the buttons, shown only when there are buttons. */
  note?: string;
}

export function ProviderButtons({ next, prepare, rule, note }: Props) {
  const providers = useProviders().data ?? [];
  const [failed, setFailed] = useState<Error | null>(null);
  if (providers.length === 0) return null;

  async function choose(id: string) {
    try {
      await prepare?.();
      continueWith(id, next);
    } catch (error) {
      setFailed(error as Error);
    }
  }

  return (
    <>
      {rule === "before" && <OrRule />}
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void choose(provider.id)}
          className="flex h-11 items-center justify-center gap-2.5 rounded-control border border-border-2 bg-surface text-[14px] font-medium hover:border-sel"
        >
          {MARKS[provider.id] !== undefined && (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d={MARKS[provider.id]} className="fill-current" />
            </svg>
          )}
          Continue with {provider.name}
        </button>
      ))}
      {note !== undefined && <p className="text-[12.5px] text-ink-3">{note}</p>}
      {failed !== null && <p className="text-[13.5px] text-open">{sentenceOf(failed)}</p>}
      {rule === "after" && <OrRule />}
    </>
  );
}
