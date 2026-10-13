// The Exam pool's side panel (M4.8d spec, M4P.7): the question as a test asks it, drawn from what
// the editor holds — Desktop, Phone or Dark — and its checks as last saved, from the one checklist
// GET Checks already asks.
import { useState } from "react";
import { useDraftChecks } from "../../api/queries";
import type { ExamQuestionIn } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { TestQuestion } from "../../node/TestQuestion";
import { CheckItems } from "./CheckItems";
import { testAskOf } from "./exam";

type Look = "Desktop" | "Phone" | "Dark";
const LOOKS: readonly Look[] = ["Desktop", "Phone", "Dark"];
const TAB = "flex items-center gap-1.5 px-3 py-2.5 text-[13px]";

export function ExamSidePanel({
  draftId,
  question,
  changed,
  saved,
  number,
  of,
}: {
  draftId: string;
  question: ExamQuestionIn;
  changed: boolean;
  saved: boolean;
  number: number;
  of: number;
}) {
  const [checks, setChecks] = useState(false);
  const [look, setLook] = useState<Look>("Desktop");
  const asked = useDraftChecks(draftId, true);
  const items = saved
    ? (asked.data?.questions?.find((q) => q.id === question.id)?.items ?? [])
    : [];
  const failed = items.filter((item) => !item.passed).length;
  const tab = (on: boolean) =>
    `${TAB} ${on ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-ink-2"}`;
  return (
    <aside className="flex min-w-0 flex-col rounded-panel border border-border bg-surface">
      <div role="tablist" aria-label="Question side panel" className="flex border-b border-border">
        <button
          type="button"
          role="tab"
          aria-selected={!checks}
          onClick={() => setChecks(false)}
          className={tab(!checks)}
        >
          Preview as in a test
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={checks}
          onClick={() => setChecks(true)}
          className={tab(checks)}
        >
          Checks
          {failed > 0 && " "}
          {failed > 0 && (
            <span className="rounded-full bg-open-soft px-1.5 text-[11px] text-open">{failed}</span>
          )}
        </button>
      </div>
      {checks ? (
        <div className="flex flex-col gap-3 p-3.5">
          {!saved ? (
            <p className="text-[13px] text-ink-2">Checked once saved.</p>
          ) : (
            <>
              {changed && (
                <p className="text-[12.5px] text-ink-3">
                  As last saved; leave the question to check again.
                </p>
              )}
              {asked.isPending && <p className="text-[13px] text-ink-2">Checking…</p>}
              {asked.isError && <ErrorNotice error={asked.error} />}
              <CheckItems items={items} />
            </>
          )}
        </div>
      ) : (
        <section aria-label="Preview as in a test" className="flex flex-col gap-3 p-3.5">
          <div className="flex self-start rounded-control border border-border bg-bg p-[3px]">
            {LOOKS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={look === name}
                onClick={() => setLook(name)}
                className={`rounded-[7px] px-[13px] py-[5px] text-[12.5px] ${
                  look === name ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            data-theme={look === "Dark" ? "dark" : undefined}
            className={`mx-auto w-full rounded-[10px] border border-border bg-bg p-3.5 ${
              look === "Phone" ? "max-w-[390px]" : ""
            }`}
          >
            <TestQuestion
              key={look}
              ask={testAskOf(question)}
              number={number}
              of={of}
              phone={look === "Phone"}
            />
          </div>
        </section>
      )}
    </aside>
  );
}
