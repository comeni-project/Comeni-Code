// problem.yaml as a form (M6.8b spec, M6PB.3; the WorkbenchProblem board). Every field is one key of
// the file and every change one op on its YAML document, so the lines nobody touched stay as written.
import { useId, useState } from "react";
import type { ProblemKitOut } from "../../api/schema";
import type { Finding } from "../../figures/validate";
import { RUNGS } from "../../node/rungs";
import { apply, insertAt, type Op, removeAt, setAt, type YamlDocument } from "../../yaml/document";
import { TypedInput } from "../composer/TypedInput";
import { MarkdownField } from "../workbench/MarkdownField";
import { ParamsForm, typedNumber } from "./ParamsForm";

const CARD = "flex flex-col gap-3.5 rounded-panel border border-border bg-surface px-5 py-4";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium";
const INPUT =
  "h-10 rounded-control border border-border-2 bg-surface px-3 text-[14px] outline-none focus:border-sel disabled:bg-bg aria-[invalid=true]:border-open";
const HINT = "text-[12.5px] font-normal text-ink-3";
const BUTTON =
  "rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-sel";

type File = Record<string, unknown>;

function Said({ findings, path }: { findings: readonly Finding[]; path: string }) {
  const said = findings.filter((f) => f.path === path || f.path.startsWith(`${path}[`));
  return said.map((f) => (
    <span key={f.path + f.message} className="text-[12.5px] font-normal text-open">
      {f.message}
    </span>
  ));
}

export function ProblemForm({
  fd,
  file,
  kit,
  kits,
  callouts,
  findings,
  disabled,
  onText,
}: {
  fd: YamlDocument;
  file: File;
  kit: ProblemKitOut;
  kits: readonly ProblemKitOut[];
  callouts: readonly string[];
  findings: readonly Finding[];
  disabled: boolean;
  onText: (text: string) => void;
}) {
  const ids = useId();
  const [nextKit, setNextKit] = useState<ProblemKitOut | null>(null);
  const set = (path: (string | number)[], value: string | number) => onText(setAt(fd, path, value));
  const text = (key: string) => (typeof file[key] === "string" ? (file[key] as string) : "");
  const field = (key: string, label: string, hint?: string) => (
    <div className={LABEL}>
      {label}
      <TypedInput
        aria-label={label}
        value={text(key)}
        onType={(typed) => set([key], typed)}
        disabled={disabled}
        aria-invalid={findings.some((f) => f.path === key)}
        className={INPUT}
      />
      {hint && <span className={HINT}>{hint}</span>}
      <Said findings={findings} path={key} />
    </div>
  );
  const hints = Array.isArray(file.hints) ? (file.hints as string[]) : [];
  const mapped = (file.mistakes ?? {}) as Record<string, string>;
  const sample = file.sample as { seed?: unknown; params?: Record<string, unknown> };
  const changeKit = (to: ProblemKitOut) => {
    const ops: Op[] = [
      { op: "set", path: ["kit"], value: to.name },
      { op: "set", path: ["params"], value: to.example.params as Record<string, unknown> },
      { op: "set", path: ["sample"], value: to.example.sample as Record<string, unknown> },
    ];
    if ("mistakes" in file) ops.push({ op: "remove", path: ["mistakes"] });
    onText(apply(fd, ops));
    setNextKit(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className={CARD}>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1fr)_260px]">
          {field("title", "Title")}
          <label className={LABEL}>
            Rung
            <select
              aria-label="Rung"
              value={String(file.rung ?? kit.rung)}
              onChange={(e) => set(["rung"], Number(e.target.value))}
              disabled={disabled}
              className={INPUT}
            >
              {[1, 2, 3, 4].map((rung) => (
                <option key={rung} value={rung}>{`${rung} · ${RUNGS[rung]}`}</option>
              ))}
            </select>
            <span className={HINT}>the kit’s rung; change it only with a reason</span>
            <Said findings={findings} path="rung" />
          </label>
        </div>
        {disabled ? (
          <label className={LABEL}>
            Statement
            <textarea
              value={text("statement")}
              disabled
              rows={3}
              className={`${INPUT} h-auto py-2`}
            />
          </label>
        ) : (
          <MarkdownField
            label="Statement"
            value={text("statement")}
            onChange={(value) => set(["statement"], value)}
          />
        )}
        <Said findings={findings} path="statement" />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {field("given", "Given", "one line")}
          {field("return", "Return", "one line")}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold">The dataset</span>
          <span className={HINT}>
            each learner’s file is made from these, with a seed of their own
          </span>
        </div>
        <label className={LABEL}>
          Kit
          <select
            aria-label="Kit"
            value={kit.name}
            onChange={(e) => setNextKit(kits.find((k) => k.name === e.target.value) ?? null)}
            disabled={disabled}
            className={INPUT}
          >
            {kits.map((k) => (
              <option key={k.name} value={k.name}>
                {k.name}
              </option>
            ))}
          </select>
          <span className={HINT}>{kit.about}</span>
        </label>
        {nextKit !== null && nextKit.name !== kit.name && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-control bg-open-soft px-3.5 py-2.5 text-[13px]"
          >
            <span>
              Change the kit? Its params, sample and mistakes become {nextKit.name}’s example.
            </span>
            <button type="button" onClick={() => changeKit(nextKit)} className={BUTTON}>
              Change the kit
            </button>
            <button type="button" onClick={() => setNextKit(null)} className="text-ink-2 underline">
              {`Keep ${kit.name}`}
            </button>
          </div>
        )}
        <ParamsForm
          schema={kit.params_schema}
          root={["params"]}
          value={(file.params ?? {}) as Record<string, unknown>}
          onSet={(path, value) => onText(setAt(fd, path, value))}
          findings={findings}
          disabled={disabled}
        />
        <Said findings={findings} path="params" />
        <div className="flex items-baseline gap-3 border-t border-border pt-3">
          <span className="text-[13px] font-semibold">Sample</span>
          <span className={HINT}>smaller, so it reads on the page; computed, never typed</span>
        </div>
        <div className={`${LABEL} max-w-[200px]`}>
          seed
          <TypedInput
            aria-label="seed"
            value={sample?.seed === undefined ? "" : String(sample.seed)}
            onType={(typed) => onText(setAt(fd, ["sample", "seed"], typedNumber(typed)))}
            disabled={disabled}
            className={INPUT}
          />
        </div>
        <ParamsForm
          schema={kit.params_schema}
          root={["sample", "params"]}
          named="sample "
          value={sample?.params ?? {}}
          onSet={(path, value) => onText(setAt(fd, path, value))}
          findings={findings}
          disabled={disabled}
        />
        <Said findings={findings} path="sample" />
        <Said findings={findings} path="sample.params" />
      </div>

      <div className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold">Hints</span>
          <span className={HINT}>one to three; none may hold the sample’s answer</span>
        </div>
        {hints.map((hint, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a hint has no identity beyond its place
          <div key={`${ids}-hint-${at}`} className="flex items-end gap-2">
            <div className={`${LABEL} flex-1`}>
              {`Hint ${at + 1}`}
              <TypedInput
                aria-label={`Hint ${at + 1}`}
                value={hint}
                onType={(typed) => set(["hints", at], typed)}
                disabled={disabled}
                className={INPUT}
              />
            </div>
            {!disabled && hints.length > 1 && (
              <button
                type="button"
                onClick={() => onText(removeAt(fd, ["hints", at]))}
                className="pb-2.5 text-[12.5px] text-ink-3 hover:text-ink"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {!disabled && hints.length < 3 && (
          <button
            type="button"
            onClick={() =>
              onText(
                Array.isArray(file.hints)
                  ? insertAt(fd, ["hints"], hints.length, "")
                  : apply(fd, [
                      {
                        op: "set",
                        path: ["hints"],
                        value: [""] as unknown as Record<string, unknown>,
                      },
                    ]),
              )
            }
            className="self-start text-[12.5px] font-medium text-sel"
          >
            + Hint
          </button>
        )}
        <Said findings={findings} path="hints" />
      </div>

      <div className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold">Mistakes the checker names</span>
          <span className={HINT}>
            the kit declares them; you point one at a misconception callout in Content
          </span>
        </div>
        <div className="flex flex-col">
          {kit.mistakes.map((mistake) => (
            <fieldset
              key={mistake.name}
              aria-label={mistake.name}
              className="m-0 grid grid-cols-1 items-center gap-2 border-0 border-t border-border p-0 py-2 md:grid-cols-[110px_minmax(0,1fr)_250px]"
            >
              <span className="font-mono text-[12.5px] font-semibold">{mistake.name}</span>
              <span className="text-[12.5px] text-ink-2">{mistake.says}</span>
              {callouts.length === 0 ? (
                <span className="text-[12.5px] text-ink-3">
                  Add a misconception callout in Content
                </span>
              ) : (
                <select
                  aria-label={`What ${mistake.name} shows`}
                  value={mapped[mistake.name] ?? ""}
                  onChange={(e) =>
                    onText(
                      e.target.value === ""
                        ? removeAt(fd, ["mistakes", mistake.name])
                        : setAt(fd, ["mistakes", mistake.name], e.target.value),
                    )
                  }
                  disabled={disabled}
                  className={`${INPUT} h-9 text-[13px]`}
                >
                  <option value="">the checker’s sentence only</option>
                  {callouts.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                  {mapped[mistake.name] !== undefined &&
                    !callouts.includes(mapped[mistake.name] ?? "") && (
                      <option value={mapped[mistake.name]}>{mapped[mistake.name]}</option>
                    )}
                </select>
              )}
              <span className="md:col-span-3 flex flex-col">
                <Said findings={findings} path={`mistakes.${mistake.name}`} />
              </span>
            </fieldset>
          ))}
        </div>
        {findings
          .filter(
            (f) =>
              f.path.startsWith("mistakes.") &&
              !kit.mistakes.some((m) => f.path === `mistakes.${m.name}`),
          )
          .map((f) => (
            <span key={f.path + f.message} className="text-[12.5px] text-open">
              {f.message}
            </span>
          ))}
        <Said findings={findings} path="mistakes" />
        <span className={HINT}>
          A learner whose answer makes a mapped mistake is shown that callout. Only the body’s
          misconception callouts are offered; the self-test checks each mapped mistake is caught as
          itself.
        </span>
      </div>

      <div className={CARD}>
        <label className={LABEL}>
          Rationale
          <textarea
            aria-label="Rationale"
            value={text("rationale")}
            onChange={(e) => set(["rationale"], e.target.value)}
            disabled={disabled}
            rows={2}
            className={`${INPUT} h-auto py-2`}
          />
          <span className={HINT}>shown to a learner only once they are right</span>
          <Said findings={findings} path="rationale" />
        </label>
      </div>
    </div>
  );
}
