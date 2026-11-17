import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router";
import { createAssistantSession, sendAssistantTurn } from "../../api/assistant";
import {
  queryKeys,
  useAssistantSession,
  useAssistantSessions,
  useDraft,
  useDrafts,
} from "../../api/queries";
import type { AssistantActionOut, AssistantSessionListOut } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { DraftAI } from "../drafting/DraftAI";

const FIELD = "w-full rounded-control border border-border-2 bg-bg px-3 py-2 text-[14px]";

function ProposalReview({ draftId, action }: { draftId: string; action: AssistantActionOut }) {
  const draft = useDraft(draftId);
  const [key, setKey] = useState(0);
  if (action.proposal_id === null || draft.data === undefined) return null;
  return (
    <div className="mt-2">
      <button type="button" className={SECONDARY} onClick={() => setKey((value) => value + 1)}>
        Review proposal
      </button>
      {key > 0 && (
        <DraftAI
          key={`${action.proposal_id}:${key}`}
          draftId={draftId}
          target={action.target}
          openProposal={{ id: action.proposal_id, revision: draft.data.revision }}
        />
      )}
    </div>
  );
}

function ActionCard({ draftId, action }: { draftId: string; action: AssistantActionOut }) {
  return (
    <li className="rounded-control border border-border bg-bg p-3">
      <p className="text-[12px] font-medium text-ink-3">
        Block {Number(action.target.slice(6)) + 1}
      </p>
      <p className="mt-1 text-[13.5px]">{action.instruction}</p>
      <p className="mt-2 text-[12px] text-ink-2">
        {action.proposal_state === "queued"
          ? "Waiting for the drafting worker…"
          : action.proposal_state === "running"
            ? "Preparing a proposal…"
            : (action.proposal_state ?? action.code)}
      </p>
      {action.detail && <p className="mt-1 text-[12px] text-open">{action.detail}</p>}
      <ProposalReview draftId={draftId} action={action} />
    </li>
  );
}

function SessionList({
  sessions,
  selected,
  onChoose,
}: {
  sessions: AssistantSessionListOut[];
  selected: string;
  onChoose: (id: string) => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <section aria-label="Recent conversations" className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold">Recent conversations</h2>
      <ul className="flex flex-col gap-1.5">
        {sessions.map((session) => (
          <li key={session.public_id}>
            <button
              type="button"
              aria-pressed={selected === session.public_id}
              onClick={() => onChoose(session.public_id)}
              className={`w-full rounded-control border px-3 py-2 text-left text-[13px] ${
                selected === session.public_id
                  ? "border-sel bg-sel-soft"
                  : "border-border bg-surface hover:border-sel"
              }`}
            >
              {session.node_id} · {session.turn_count} {session.turn_count === 1 ? "turn" : "turns"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Conversation({ sessionId }: { sessionId: string }) {
  const client = useQueryClient();
  const session = useAssistantSession(sessionId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const draftId = session.data?.draft_id ?? "";

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (message === "" || sending) return;
    setSending(true);
    setError(null);
    try {
      const answer = await sendAssistantTurn(sessionId, {
        request_id: crypto.randomUUID(),
        text: message,
      });
      client.setQueryData(queryKeys.assistantSession(sessionId), answer);
      await client.invalidateQueries({ queryKey: queryKeys.assistantSessions });
      setText("");
    } catch (caught) {
      setError(caught as Error);
    } finally {
      setSending(false);
    }
  }

  if (session.isPending) return <p className="text-[14px] text-ink-2">Opening conversation…</p>;
  if (session.isError) return <ErrorNotice error={session.error} />;
  if (session.data === undefined) return null;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <header>
        <h2 className="text-[17px] font-semibold">{session.data.node_id}</h2>
        <p className="text-[12px] text-ink-3">Draft revision {session.data.revision}</p>
      </header>
      <ol aria-label="Conversation" className="flex flex-col gap-3">
        {session.data.turns.map((turn) => (
          <li
            key={turn.number}
            className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4"
          >
            <p className="whitespace-pre-wrap text-[13.5px]">
              <span className="font-semibold">You · </span>
              {turn.user_text}
            </p>
            {turn.answer && (
              <p className="whitespace-pre-wrap text-[13.5px] text-ink-2">
                <span className="font-semibold text-ink">Assistant · </span>
                {turn.answer}
              </p>
            )}
            {turn.state === "running" && <p className="text-[12px] text-ink-3">Thinking…</p>}
            {turn.code && <p className="text-[12px] text-open">{turn.code}</p>}
            {turn.actions.length > 0 && (
              <ul aria-label="Proposed changes" className="mt-1 flex flex-col gap-2">
                {turn.actions.map((action) => (
                  <ActionCard key={action.number} draftId={draftId} action={action} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {error && <ErrorNotice error={error} />}
      <form
        onSubmit={send}
        className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4"
      >
        <label htmlFor="assistant-message" className="text-[13px] font-medium">
          Your message
        </label>
        <textarea
          id="assistant-message"
          className={FIELD}
          maxLength={4000}
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask for a change to this draft…"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-ink-3">Proposals stay here until you keep them.</p>
          <button className={PRIMARY} type="submit" disabled={sending || text.trim() === ""}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const drafts = useDrafts("open");
  const sessions = useAssistantSessions();
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function start(draftId: string) {
    if (creating !== null) return;
    setCreating(draftId);
    setError(null);
    try {
      const session = await createAssistantSession(draftId);
      setParams({ session: session.public_id });
    } catch (caught) {
      setError(caught as Error);
    } finally {
      setCreating(null);
    }
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Assistant</h1>
        <p className="text-[13.5px] text-ink-2">
          Discuss one open draft. The assistant can prepare block proposals; you decide what to
          keep.
        </p>
      </header>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-semibold">Start with an open draft</h2>
            {drafts.isPending ? (
              <p className="text-[13px] text-ink-2">Loading drafts…</p>
            ) : drafts.isError ? (
              <ErrorNotice error={drafts.error} />
            ) : (drafts.data ?? []).length === 0 ? (
              <p className="text-[13px] text-ink-2">No open drafts yet.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {(drafts.data ?? []).map((draft) => (
                  <li key={draft.public_id}>
                    <button
                      type="button"
                      className={`${SECONDARY} w-full justify-start`}
                      disabled={creating !== null}
                      onClick={() => void start(draft.public_id)}
                    >
                      {creating === draft.public_id
                        ? "Opening…"
                        : `${draft.node_id} · r${draft.revision}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {sessions.isError ? (
            <ErrorNotice error={sessions.error} />
          ) : (
            <SessionList
              sessions={sessions.data ?? []}
              selected={sessionId}
              onChoose={(id) => setParams({ session: id })}
            />
          )}
          {error && <ErrorNotice error={error} />}
        </aside>
        {sessionId === "" ? (
          <section className="flex min-h-48 items-center justify-center rounded-panel border border-dashed border-border-2 p-6 text-center text-[14px] text-ink-2">
            Choose a draft or reopen a recent conversation.
          </section>
        ) : (
          <Conversation key={sessionId} sessionId={sessionId} />
        )}
      </div>
    </>
  );
}
