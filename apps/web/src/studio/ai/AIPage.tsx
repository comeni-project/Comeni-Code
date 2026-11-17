// S16–S17 · AI (M5.1 spec, M5G.7; the AISettings, AISignIn and AIUsageM5 boards): where models come
// from, which one each call site uses, and what they used. Operators only; the shell's gate and the
// API's studio(OPERATOR) both say so. Every write answers the page's whole state.
import { useSearchParams } from "react-router";
import { Models } from "./Models";
import { Usage } from "./Usage";

const TABS = [
  { key: "models", label: "Models" },
  { key: "usage", label: "Usage" },
] as const;

export function AIPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "usage" ? "usage" : "models";
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">AI</h1>
        <p className="text-[13.5px] text-ink-2">
          Where models come from, and which one each call site uses. Each change applies to the next
          call, with no restart.
        </p>
      </header>
      <div role="tablist" aria-label="AI" className="flex gap-0.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => setParams(t.key === "models" ? {} : { tab: t.key }, { replace: true })}
            className={`px-4 py-2 text-[13.5px] ${
              t.key === tab
                ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--ink)]"
                : "text-ink-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "models" ? <Models /> : <Usage />}
    </>
  );
}
