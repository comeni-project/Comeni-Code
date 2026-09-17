// The identity specimen: every token in use, beside the Identity boards (M0 part 6 spec, P6.3).
import { useState } from "react";
import { TopBar } from "../layout/TopBar";

type Theme = "system" | "light" | "dark";

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

// The colour law (W10): one meaning per colour, always said in words too.
const ROLES = [
  { name: "Route · valid", token: "line", fill: "bg-line", soft: "bg-line-soft" },
  { name: "Next · selected", token: "sel", fill: "bg-sel", soft: "bg-sel-soft" },
  { name: "Measured · stale", token: "meas", fill: "bg-meas-bar", soft: "bg-meas-soft" },
  { name: "Needs you · wrong", token: "open", fill: "bg-open", soft: "bg-open-soft" },
  { name: "Settled · no colour", token: "settled", fill: "bg-settled", soft: "bg-exon" },
] as const;

const SURFACES = [
  ["bg", "bg-bg"],
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["border", "bg-border"],
  ["border-2", "bg-border-2"],
  ["rail", "bg-rail"],
] as const;

const INKS = [
  ["ink", "text-ink"],
  ["ink-2", "text-ink-2"],
  ["ink-3", "text-ink-3"],
] as const;

export function Specimen() {
  const [theme, setTheme] = useState<Theme>("system");
  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div className="min-h-screen">
      <TopBar>
        <fieldset className="flex gap-0.5 rounded-control border border-border bg-bg p-[3px]">
          <legend className="sr-only">Theme</legend>
          {(["system", "light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => choose(option)}
              className={`rounded-[7px] px-3 py-1 text-[12.5px] capitalize ${
                theme === option ? "bg-surface font-semibold text-ink shadow-sm" : "text-ink-2"
              }`}
            >
              {option}
            </button>
          ))}
        </fieldset>
      </TopBar>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-7 py-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Identity specimen</h1>
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            Every colour, type and control token in use, from{" "}
            <code className="font-mono text-[13px]">.design/tokens.json</code>. Compare with the
            Identity boards.
          </p>
        </div>

        <section aria-labelledby="roles" className="flex flex-col gap-3">
          <h2 id="roles" className="text-[13px] font-medium text-ink-3">
            Colour roles
          </h2>
          <ul className="grid grid-cols-5 gap-3">
            {ROLES.map((role) => (
              <li
                key={role.token}
                className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3"
              >
                <div className="flex h-12 overflow-hidden rounded-control">
                  <span className={`flex-1 ${role.fill}`} />
                  <span className={`flex-1 ${role.soft}`} />
                </div>
                <span className="text-[13px] font-semibold">{role.name}</span>
                <span className="font-mono text-[11px] text-ink-3">{role.token}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="surfaces" className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            <h2 id="surfaces" className="text-[13px] font-medium text-ink-3">
              Surfaces and lines
            </h2>
            <ul className="grid grid-cols-3 gap-2">
              {SURFACES.map(([name, cls]) => (
                <li key={name} className="flex items-center gap-2 text-[12.5px]">
                  <span className={`size-6 rounded-[6px] border border-border-2 ${cls}`} />
                  <span className="font-mono">{name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-[13px] font-medium text-ink-3">Ink</h2>
            <ul className="flex flex-col gap-1">
              {INKS.map(([name, cls]) => (
                <li key={name} className={`text-[15px] ${cls}`}>
                  <span className="font-mono text-[12px]">{name}</span> · The route is computed, not
                  generated.
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="controls" className="flex flex-col gap-3">
          <h2 id="controls" className="text-[13px] font-medium text-ink-3">
            Controls and states
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-control bg-btn px-6 py-2.5 text-[14.5px] font-semibold text-btn-ink shadow-[0_3px_0_var(--btn-sh)]"
            >
              Continue
            </button>
            <button
              type="button"
              className="rounded-[9px] border border-border-2 bg-surface px-3.5 py-2 text-[13px] font-medium"
            >
              Open route
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-meas-soft px-2.5 py-0.5 text-[12.5px] font-medium text-meas">
              <span className="size-[7px] rounded-pill bg-meas-bar" />
              measured
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-open-soft px-2.5 py-0.5 text-[12.5px] font-medium text-open">
              <span className="size-[7px] rounded-pill bg-open" />2 need you
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-sel-soft px-2.5 py-0.5 text-[12.5px] font-medium text-sel">
              <span className="size-[7px] rounded-pill bg-sel" />
              ready
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-line-soft px-2.5 py-0.5 text-[12.5px] font-medium text-btn">
              <span className="size-[7px] rounded-pill bg-line" />
              valid
            </span>
          </div>
        </section>

        <section aria-labelledby="type" className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-5 shadow-float">
            <h2 id="type" className="text-[13px] font-medium text-ink-3">
              Lexend · UI and prose
            </h2>
            <p className="text-[30px] font-semibold tracking-[-0.02em]">de Bruijn graphs</p>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Build a de Bruijn graph from a set of reads, and read sequences off it.
            </p>
            <p className="text-[11px] text-ink-3">11 px is the smallest text (W10).</p>
          </div>
          <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-5">
            <h2 className="text-[13px] font-medium text-ink-3">Geist Mono · data</h2>
            <pre className="font-mono text-[13px] leading-7">
              salmon quant -i index -l A{"\n"}ACGTTAGCCTAGGA 8M 240N 7M
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
