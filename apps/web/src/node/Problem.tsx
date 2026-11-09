// A node's problem (M6.8a spec, M6LP.5), as the NodeProblem board draws it: the statement, Given and
// Return, the sample the kit computed, hints one at a time, and, on a learner's page only, a dataset
// made for this browser and one answer the server checks. Nothing about the learner is kept: after a
// reload the problem is unanswered again.
import { useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useId, useState } from "react";
import { ApiUnreachable, sentenceOf } from "../api/client";
import { ANSWER_BYTES, browserSeed, fetchDataset, sendAnswer, tooLong } from "../api/problem";
import { queryKeys } from "../api/queries";
import type { AnswerOut, CalloutBlockOut, LearnerProblemOut } from "../api/schema";
import { componentsFor, Prose } from "./prose";
import { RUNGS } from "./rungs";
import { Tag } from "./tags";

export type ProblemShown = Omit<LearnerProblemOut, "version">;
export interface ProblemLive {
  node: string;
  version: string;
}
/** A callout of the page a wrong answer may name, and where it sits. */
export interface NamedCallout {
  block: CalloutBlockOut;
  anchor: string;
}

const CHANGED = "This problem was updated after you downloaded your dataset. Download it again.";
const TOO_LONG = "Your answer is over 1 MB. A problem’s answer is at most 1 MB.";
const BOX =
  "m-0 overflow-x-auto rounded-[9px] border border-border bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-[1.65] text-ink";
const BUTTON =
  "rounded-control border border-border-2 bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:border-sel disabled:opacity-60";

const kilobytes = (bytes: number): string =>
  (bytes / 1000).toLocaleString("en", { maximumFractionDigits: 1 });

export function Problem({
  problem,
  live,
  named = new Map(),
}: {
  problem: ProblemShown;
  live?: ProblemLive | undefined;
  named?: Map<string, NamedCallout>;
}) {
  const heading = useId();
  const components = componentsFor(false);
  const [hints, setHints] = useState(0);
  return (
    <section
      aria-labelledby={heading}
      className="my-2 flex flex-col gap-3.5 rounded-[14px] border-[1.5px] border-ink bg-surface px-4 py-4 sm:px-[22px] sm:py-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium text-ink-2">Proves this node</span>
          <h3 id={heading} className="m-0 text-[19px] font-semibold">
            {problem.title}
          </h3>
        </div>
        <Tag>{`Rung ${problem.rung} · ${RUNGS[problem.rung] ?? ""}`}</Tag>
      </div>
      <Prose markdown={problem.statement} components={components} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Line title="Given" text={problem.given} />
        <Line title="Return" text={problem.returns} />
        <Sample title="Sample dataset" text={problem.sample_dataset} />
        <Sample title="Sample output" text={problem.sample_output} />
      </div>
      <Hints hints={problem.hints} shown={hints} onMore={() => setHints(hints + 1)} />
      {live === undefined ? (
        <div className="flex flex-col gap-0.5 rounded-[10px] border border-dashed border-border-2 bg-bg px-3.5 py-3">
          <span className="text-[14px] font-semibold">Your dataset</span>
          <span className="text-[12.5px] text-ink-2">
            {`Each learner downloads their own here: about ${kilobytes(problem.size)} KB at these params. Studio shows the sample only.`}
          </span>
        </div>
      ) : (
        <Answering problem={problem} live={live} named={named} />
      )}
    </section>
  );
}

function Line({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-semibold">{title}</span>
      <span className="text-[14px] leading-normal text-ink">{text}</span>
    </div>
  );
}

function Sample({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{title}</span>
      <pre className={BOX}>{text}</pre>
    </div>
  );
}

function Hints({ hints, shown, onMore }: { hints: string[]; shown: number; onMore: () => void }) {
  if (hints.length === 0) return null;
  if (shown === 0) {
    return (
      <button
        type="button"
        onClick={onMore}
        className="self-start text-[13px] font-medium text-sel"
      >{`Show a hint (${hints.length})`}</button>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-border px-3 py-2.5 text-[13.5px] leading-normal">
      {hints.slice(0, shown).map((hint, at) => (
        <span key={hint}>
          <b className="font-semibold">{`Hint ${at + 1} of ${hints.length}`}</b>
          {` · ${hint}`}
        </span>
      ))}
      {shown < hints.length ? (
        <button
          type="button"
          onClick={onMore}
          className="self-start text-[12.5px] font-medium text-sel"
        >
          Show the next hint
        </button>
      ) : null}
    </div>
  );
}

function Answering({
  problem,
  live,
  named,
}: {
  problem: ProblemShown;
  live: ProblemLive;
  named: Map<string, NamedCallout>;
}) {
  const client = useQueryClient();
  const field = useId();
  const seed = browserSeed();
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [found, setFound] = useState<AnswerOut | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const failed = (error: unknown) => {
    if (error instanceof ApiUnreachable && error.status === 409) {
      setTrouble(CHANGED);
      void client.invalidateQueries({ queryKey: queryKeys.node(live.node) });
      return;
    }
    setTrouble(error instanceof Error ? sentenceOf(error) : String(error));
  };

  const download = async () => {
    setTrouble(null);
    try {
      const text = await fetchDataset(live.node, seed, live.version);
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${problem.kit}-${seed}.txt`;
      // Attached while clicked, revoked on a later task: Safari cancels a download otherwise (#431).
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      failed(error);
    }
  };

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // the same file can be chosen again
    if (file === undefined) return;
    // Sized before it is read: a wrong large file would freeze the tab (#430).
    if (file.size > ANSWER_BYTES) {
      setTrouble(TOO_LONG);
      return;
    }
    setTrouble(null);
    setAnswer(await file.text());
  };

  const submit = async () => {
    if (sending) return;
    setTrouble(null);
    if (tooLong(answer)) {
      setTrouble(TOO_LONG);
      return;
    }
    setSending(true);
    try {
      setFound(await sendAnswer(live.node, { seed, version: live.version, answer }));
    } catch (error) {
      setFound(null);
      failed(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-bg px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[14px] font-semibold">Your dataset</span>
          <span className="font-mono text-[12px] break-all text-ink-2">{`${problem.kit}-${seed}.txt`}</span>
          <span className="text-[12.5px] text-ink-2">
            {`about ${kilobytes(problem.size)} KB · made for this browser, so its answer is yours alone`}
          </span>
        </div>
        <button type="button" onClick={download} className={`${BUTTON} self-start`}>
          Download
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={field} className="text-[13px] font-semibold">
          Your answer
        </label>
        <textarea
          id={field}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="Paste your answer here, or choose the file your code wrote."
          className="min-h-[84px] rounded-[10px] border-[1.5px] border-border-2 bg-surface px-3 py-2.5 font-mono text-[12.5px] leading-[1.6] focus:border-sel focus:outline-none"
        />
        <div aria-live="polite" className="flex flex-col gap-2">
          {trouble !== null ? <p className="m-0 text-[13.5px] text-open">{trouble}</p> : null}
          {found !== null ? <Verdict found={found} named={named} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* The input sits in its label, so the label shows the focus (#432). */}
          <label
            className={`${BUTTON} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sel`}
          >
            Choose a file
            <input type="file" onChange={choose} className="sr-only" />
          </label>
          <span className="min-w-0 flex-1 text-[12px] text-ink-3">
            Only your answer is sent. Your code stays on your computer.
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="rounded-control bg-btn px-4 py-2 text-[13.5px] font-semibold text-btn-ink shadow-[0_3px_0_0_var(--btn-sh)] hover:brightness-110 disabled:opacity-60"
          >
            {found !== null && !found.right ? "Submit again" : "Submit answer"}
          </button>
        </div>
      </div>
    </>
  );
}

function Verdict({ found, named }: { found: AnswerOut; named: Map<string, NamedCallout> }) {
  const components = componentsFor(false);
  if (found.right) {
    return (
      <div className="flex flex-col gap-1 rounded-[10px] bg-line-soft px-3.5 py-3">
        <span className="text-[14px] font-semibold text-btn">Right</span>
        <p className="m-0 text-[13.5px] leading-[1.55] text-ink">
          <span className="font-medium text-ink-2">Why: </span>
          {found.rationale}
        </p>
      </div>
    );
  }
  const quoted = found.callouts.flatMap((title) => {
    const one = named.get(title);
    return one === undefined ? [] : [one];
  });
  return (
    <>
      <div className="flex flex-col gap-1 rounded-[10px] bg-open-soft px-3.5 py-3">
        <span className="text-[14px] font-semibold text-open">Not yet</span>
        <span className="text-[13.5px] leading-[1.55]">{found.said}</span>
      </div>
      {quoted.map(({ block, anchor }) => (
        <div
          key={anchor}
          className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface px-3.5 py-3"
        >
          <span className="flex flex-wrap items-center gap-2">
            <Tag>Misconception</Tag>
            <span className="text-[14px] font-semibold">{block.title}</span>
            <button
              type="button"
              onClick={() =>
                document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" })
              }
              className="ml-auto text-[12.5px] font-medium text-sel"
            >
              Read it in the page ↑
            </button>
          </span>
          <Prose markdown={block.markdown} components={components} />
        </div>
      ))}
      <span className="text-[12.5px] text-ink-3">
        Your dataset stays the same: fix your answer and send it again.
      </span>
    </>
  );
}
