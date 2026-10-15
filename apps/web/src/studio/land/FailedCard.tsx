// A failed landing (M4.9c spec, M4LS.3): it holds its drafts until an operator closes it; closing
// closes its pull request and gives the drafts back to Ready.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { closeLanding } from "../../api/landing";
import { landingMoved } from "../../api/queries";
import type { LandingOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { StateTag } from "./StateTag";
import { ago } from "./words";

export function FailedCard({ landing }: { landing: LandingOut }) {
  const client = useQueryClient();
  const close = useMutation({
    mutationFn: () => closeLanding(landing.public_id),
    onSuccess: (made) => landingMoved(client, made),
  });
  const pull = landing.pull_number === null ? "" : ` · #${landing.pull_number}`;
  return (
    <section
      aria-label="A failed landing"
      className="flex flex-col gap-2.5 rounded-panel border border-border bg-surface p-[18px]"
    >
      <div className="flex items-center justify-between">
        <StateTag landing={landing} />
        <span className="text-[12px] text-ink-3">{`${ago(landing.started_at)}${pull}`}</span>
      </div>
      <span className="text-[13px] leading-normal text-ink-2">{landing.reason}</span>
      <span className="text-[12px] text-ink-3">Its drafts are held until you close it.</span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={close.isPending}
          onClick={() => close.mutate()}
          className={SECONDARY}
        >
          Close the landing
        </button>
        <span className="text-[12px] text-ink-3">
          {landing.pull_number === null
            ? "its drafts stay approved"
            : `closes #${landing.pull_number}; its drafts stay approved`}
        </span>
      </div>
      {close.error !== null && <ErrorNotice error={close.error} />}
    </section>
  );
}
