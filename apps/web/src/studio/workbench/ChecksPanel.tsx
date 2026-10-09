// Checks (M4K.6): the checklist and Verify's problems, asked with one GET while this panel is
// shown, and again after a save while it stays shown.
import { useDraftChecks } from "../../api/queries";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { CheckItems } from "./CheckItems";

export function ChecksPanel({ draftId }: { draftId: string }) {
  const checks = useDraftChecks(draftId, true);
  if (checks.isPending) return <p className="text-[13px] text-ink-2">Checking the draft…</p>;
  if (checks.isError) return <ErrorNotice error={checks.error} />;
  const problems = checks.data.problems ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] font-semibold">
        {checks.data.passed ? "Ready to submit." : "Not ready to submit yet."}
      </p>
      <CheckItems items={checks.data.items} />
      {problems.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[13px] font-semibold">Problems</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[12.5px]">
            {problems.map((p) => (
              <li key={`${p.code}:${p.file}:${p.line}:${p.text}`}>{p.text}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
