// Checks (M6.5 spec, M6CO.5): every problem with its code and path, and a button that goes to the
// field to fix; the server's, when it refused a save, beside the browser's.
import type { Finding } from "../../figures/validate";

export function ChecksList({
  problems,
  onGo,
}: {
  problems: Finding[];
  onGo: (path: string) => void;
}) {
  return (
    <section
      aria-label="Checks"
      className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-3.5"
    >
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-[14px] font-semibold">Checks</h2>
        {problems.length === 0 ? (
          <span className="rounded-pill bg-line-soft px-[9px] text-[11.5px] font-semibold text-btn">
            all pass
          </span>
        ) : (
          <span className="rounded-pill bg-open-soft px-[9px] text-[11.5px] font-semibold text-open">
            {`${problems.length} to fix`}
          </span>
        )}
      </div>
      {problems.length === 0 ? (
        <p className="px-2 text-[12.5px] text-ink-2">
          The file reads one way, its data fits its component, and it is described.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {problems.map((problem, n) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: problems have no identity of their own
              key={n}
              className="flex flex-col gap-1 rounded-[8px] bg-open-soft px-2.5 py-[7px] text-[12.5px]"
            >
              <span className="flex flex-wrap gap-x-1.5">
                <span className="font-mono text-open">{problem.code}</span>
                {problem.path !== "" && <span className="font-mono">{problem.path}</span>}
                <span className="text-ink-2">{problem.message}</span>
              </span>
              <button
                type="button"
                aria-label={`Go to ${problem.path === "" ? "the file" : problem.path}`}
                onClick={() => onGo(problem.path)}
                className="self-start text-[12px] font-medium text-sel hover:text-ink"
              >
                Go to it
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
