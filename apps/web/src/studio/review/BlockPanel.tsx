// The open block (M4.9b spec, M4RS.4): as a learner reads it, or what changed since it landed
// (M4RS.2); a question asked before its key shows; the judge's place, empty until M5.
import { useState } from "react";
import type {
  QueuedDraftOut,
  ReviewContentOut,
  ReviewItemOut,
  ReviewQuestionOut,
} from "../../api/schema";
import { Body } from "../../node/Body";
import { wordDiff } from "./diff";
import { ReviewQuestion, shownGiven, theKey } from "./ReviewQuestion";

function Links({ name, list }: { name: string; list: { node: string; reason: string }[] }) {
  if (list.length === 0) return null;
  return (
    <p>
      <b className="font-semibold">{name}:</b>{" "}
      {list.map((link) => `${link.node} (${link.reason})`).join("; ")}
    </p>
  );
}

function Content({ content }: { content: ReviewContentOut }) {
  if (content.fields !== null) {
    const f = content.fields;
    return (
      <div className="flex flex-col gap-1.5 text-[14px] leading-[1.6]">
        <p className="text-[17px] font-semibold">{f.title}</p>
        <p>{f.claim}</p>
        <p className="text-[13px] text-ink-2">{`${f.region} · ${f.level} · ${f.minutes} minutes`}</p>
        <Links name="Needs" list={f.needs} />
        <Links name="Goes deeper" list={f.goes_deeper} />
        <Links name="Related" list={f.related} />
      </div>
    );
  }
  if (content.block !== null) {
    return (
      <div className="flex flex-col gap-2 text-[14px] leading-[1.65]">
        <Body blocks={[content.block]} questions={[]} />
      </div>
    );
  }
  if (content.resource !== null) {
    const r = content.resource;
    return (
      <div className="flex flex-col gap-1 rounded-[10px] bg-bg px-3.5 py-3 text-[13.5px]">
        <span className="font-semibold">{`${r.provider} · ${r.kind}`}</span>
        <a href={r.url} className="break-all text-sel">
          {r.url}
        </a>
        <span className="text-ink-2">{r.covers}</span>
        <span className="text-[12.5px] text-ink-3">{`${r.licence} · ${r.display} · ${r.level}`}</span>
      </div>
    );
  }
  if (content.question !== null) return <Asked question={content.question} />;
  return null;
}

/** A question as it reads, for Changes: its stem, options or steps; its key once answered. */
function Asked({ question }: { question: ReviewQuestionOut }) {
  const stem =
    question.pool === "exam" ? question.stem : [{ kind: "text" as const, markdown: question.ask }];
  return (
    <div className="flex flex-col gap-1.5 text-[14px]">
      <div className="font-semibold">
        <Body blocks={stem} questions={[]} />
      </div>
      {(question.options ?? []).map((option, at) => (
        <span key={option}>{`${"ABCDE"[at] ?? at + 1} · ${option}`}</span>
      ))}
      {(question.steps ?? []).map((step) => (
        <span key={step}>{`· ${step}`}</span>
      ))}
      {question.kind === "number" && question.unit && (
        <span className="text-ink-2">{`in ${question.unit}`}</span>
      )}
      {question.given !== null && (
        <span className="text-[13px] text-ink-2">
          {`Right answer · ${theKey(question)} · yours ${shownGiven(question)}`}
        </span>
      )}
    </div>
  );
}

function Changes({ item }: { item: ReviewItemOut }) {
  if (item.change === "new") return <p className="text-[14px] text-ink-2">New in this draft.</p>;
  if (item.change === "same" || item.before === null)
    return <p className="text-[14px] text-ink-2">Unchanged since it landed.</p>;
  const was = item.before.block;
  const is = item.block;
  if (was?.kind === "text" && is?.kind === "text") {
    return (
      <p className="whitespace-pre-wrap text-[14px] leading-[1.65]">
        {wordDiff(was.markdown, is.markdown).map((piece, at) => {
          const key = `${at}:${piece.kind}`;
          if (piece.kind === "gone")
            return (
              <del key={key} className="text-ink-3">
                {piece.text}
              </del>
            );
          if (piece.kind === "new")
            return (
              <ins
                key={key}
                className="font-semibold text-ink underline decoration-ink-3 underline-offset-2"
              >
                {piece.text}
              </ins>
            );
          return <span key={key}>{piece.text}</span>;
        })}
      </p>
    );
  }
  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-ink-3">Before</span>
        <Content content={item.before} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-ink-3">Now</span>
        <Content content={item} />
      </div>
    </div>
  );
}

export function BlockPanel({ draft, item }: { draft: QueuedDraftOut; item: ReviewItemOut }) {
  const [changes, setChanges] = useState(false);
  const label = draft.keys.find((k) => k.key === item.key)?.label ?? item.key;
  const by = draft.contributors.map((c) => c.name || c.email).join(", ");
  return (
    <section
      aria-label="Open block"
      className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-border bg-surface px-5 py-[18px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-ink-3">{`${draft.title} · ${item.kind} · written by ${by}`}</span>
          <span className="text-[19px] font-semibold">{label}</span>
        </div>
        <div
          role="tablist"
          aria-label="Show"
          className="flex rounded-[10px] border border-border bg-bg p-[3px]"
        >
          {(["Standalone", "Changes"] as const).map((name) => {
            const on = (name === "Changes") === changes;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setChanges(name === "Changes")}
                className={`rounded-[7px] px-3 py-1 text-[12.5px] ${on ? "bg-surface font-semibold shadow-sm" : "text-ink-2"}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
      {changes ? (
        <Changes item={item} />
      ) : item.question !== null ? (
        <ReviewQuestion
          draftId={draft.public_id}
          question={item.question}
          changed={item.change === "changed"}
        />
      ) : (
        <Content content={item} />
      )}
      <div className="flex flex-col gap-1 rounded-[10px] border-[1.5px] border-dashed border-border-2 px-3.5 py-3 text-[12.5px] text-ink-3">
        <span className="font-semibold text-ink-2">Judge’s score · arrives with M5</span>
        <span>
          A model from another family scores each block against its rubric; its named parts, reasons
          and redraft history go here.
        </span>
      </div>
    </section>
  );
}
