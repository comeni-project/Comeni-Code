// Checks (M6.5 spec, M6CO.5): every problem with its code and path, and a button that goes to the
// field to fix; the server's, when it refused a save, beside the browser's.
import type { Finding } from "../../figures/validate";

/** Where a check's button goes, in words: a sheet's row, the alt text, the source. */
export function goLabel(path: string): string {
  const row = /^data\.(?:.*\.)?([a-z]+)\[(\d+)\]/.exec(path);
  if (row) return `Go to ${row[1]}, row ${Number(row[2]) + 1}`;
  if (path === "alt") return "Go to the alt text";
  if (path.startsWith("source")) return "Go to the source";
  return "Go to it";
}

export function ChecksList({
  problems,
  lines,
  onGo,
}: {
  problems: Finding[];
  lines: { ok: boolean; title: string; detail: string }[];
  onGo: (path: string) => void;
}) {
  const failing =
    problems.length + lines.filter((line) => !line.ok && problems.length === 0).length;
  return (
    <section
      aria-label="Checks"
      className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-3.5"
    >
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-[14px] font-semibold">Checks</h2>
        {failing === 0 ? (
          <span className="rounded-pill bg-line-soft px-[9px] text-[11.5px] font-semibold text-btn">
            all pass
          </span>
        ) : (
          <span className="rounded-pill bg-open-soft px-[9px] text-[11.5px] font-semibold text-open">
            {`${failing} to fix`}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {problems.map((problem, n) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: problems have no identity of their own
            key={n}
            className="flex gap-2 rounded-[8px] bg-open-soft px-2.5 py-[7px] text-[12.5px]"
          >
            <span aria-hidden="true" className="text-open">
              ✕
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
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
                {goLabel(problem.path)}
              </button>
            </span>
          </li>
        ))}
        {lines
          .filter((line) => line.ok || problems.length === 0)
          .map((line) => (
            <li
              key={line.title}
              className={`flex gap-2 rounded-[8px] px-2.5 py-[7px] text-[12.5px] ${line.ok ? "" : "bg-open-soft"}`}
            >
              <span aria-hidden="true" className={line.ok ? "text-ink-2" : "text-open"}>
                {line.ok ? "✓" : "✕"}
              </span>
              <span className="flex flex-col">
                <span className={`font-semibold ${line.ok ? "text-ink" : "text-open"}`}>
                  {line.title}
                </span>
                <span className="text-ink-2">{line.detail}</span>
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}
