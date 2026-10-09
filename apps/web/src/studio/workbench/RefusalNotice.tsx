// A refused save, in the API's words (M4K.3): someone else saving first offers Reload; a 422 lists
// the problems the files would have had. What you typed stays where it was.
import type { Refusal } from "./refusal";

export function RefusalNotice({ refusal, onReload }: { refusal: Refusal; onReload: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1.5 rounded-control bg-open-soft px-4 py-3 text-[13.5px] text-open"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">
          {refusal.stale
            ? "Someone else saved this draft; reload to see their change."
            : refusal.sentence}
        </span>
        {refusal.stale && (
          <button type="button" onClick={onReload} className="font-semibold underline">
            Reload
          </button>
        )}
      </div>
      {refusal.problems.length > 0 && (
        <ul className="flex list-disc flex-col gap-0.5 pl-5">
          {refusal.problems.map((problem) => (
            <li key={`${problem.code}:${problem.file}:${problem.line}:${problem.text}`}>
              {problem.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
