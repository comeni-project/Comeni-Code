/** Proposals remain private working material until an explicit, revision-checked Keep. */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiUnreachable } from "../../api/client";
import { createProposal, discardProposal } from "../../api/drafting";
import { queryKeys, useDraft, useDraftProposal, useDraftProposals } from "../../api/queries";
import type { CreateProposalIn, ProposalOut } from "../../api/schema";
import { PRIMARY, SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { follow, useAfterSaves, useDraftEdit } from "../workbench/useDraftEdit";

export type FigureUse = {
  proposal_id: string;
  copy_digest: string;
  resolutions: Record<string, unknown>;
};
type Props = {
  draftId: string;
  target: string;
  kind?: "block" | "resource" | "figure";
  copyText?: string;
  figureAt?: number;
  figureQuestion?: string;
  onUse?: (value: Record<string, unknown>, receipt: FigureUse) => void;
  disabled?: boolean;
};
const FIELD = "w-full rounded-control border border-border-2 bg-bg px-3 py-2 text-[13px]";
export async function copyDigest(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}
export function DraftAI(props: Props) {
  const [opened, setOpened] = useState<{ revision: number; target: string } | null>(null);
  const after = useAfterSaves(props.draftId);
  return (
    <div className="min-w-0">
      <button
        type="button"
        className={SECONDARY}
        disabled={props.disabled}
        onClick={() =>
          after((draft, landed) => {
            const at = props.target.startsWith("block/")
              ? follow(Number(props.target.slice(6)), landed)
              : undefined;
            if (at === null) return;
            setOpened({
              revision: draft.revision,
              target: at === undefined ? props.target : `block/${at}`,
            });
          })
        }
      >
        {props.kind === "figure"
          ? "Ask AI"
          : props.kind === "resource"
            ? "Suggest a resource"
            : "Draft with AI"}
      </button>
      {opened && (
        <Panel
          key={`${opened.target}:${opened.revision}`}
          {...props}
          target={opened.target}
          revision={opened.revision}
          close={() => setOpened(null)}
        />
      )}
    </div>
  );
}
function readable(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "markdown" in value) return String(value.markdown);
  if (value && typeof value === "object" && "tex" in value) return String(value.tex);
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(
        ([key, v]) => `${key}: ${typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}`,
      )
      .join("\n\n");
  return String(value);
}
function Panel({
  draftId,
  target,
  revision,
  kind = "block",
  copyText,
  figureAt,
  figureQuestion,
  onUse,
  close,
}: Props & { revision: number; close: () => void }) {
  const client = useQueryClient();
  const draft = useDraft(draftId);
  const history = useDraftProposals(draftId, target);
  const [identity, setIdentity] = useState<string | null>(null);
  const poll = useDraftProposal(draftId, identity);
  const [instruction, setInstruction] = useState("");
  const [source, setSource] = useState({
    title: "",
    url: "",
    licence: "",
    excerpt: "",
    public: false,
  });
  const [candidate, setCandidate] = useState({ url: "", provider: "", covers: "", licence: "" });
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, unknown>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const edit = useDraftEdit(draftId);
  const proposal = poll.data;
  const [copyStale, setCopyStale] = useState(false);
  useEffect(() => {
    let active = true;
    if (copyText !== undefined && proposal?.copy_digest) {
      void copyDigest(copyText).then((d) => {
        if (active) setCopyStale(d !== proposal.copy_digest);
      });
    } else setCopyStale(false);
    return () => {
      active = false;
    };
  }, [copyText, proposal?.copy_digest]);
  const stale =
    draft.data?.revision !== revision ||
    (proposal !== undefined && proposal.base_revision !== draft.data?.revision);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const remember = (value: ProposalOut) => {
    client.setQueryData(queryKeys.proposal(draftId, value.public_id), value);
    void client.invalidateQueries({ queryKey: queryKeys.proposals(draftId, target) });
  };
  const ask = async () => {
    if (guard.current || !instruction.trim() || stale) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      const body: CreateProposalIn = {
        request_id: crypto.randomUUID(),
        based_on: revision,
        kind,
        target,
        instruction,
        sources: source.excerpt ? [{ id: "source-1", ...source }] : [],
        candidates:
          kind === "resource" && candidate.url
            ? [
                {
                  id: "candidate-1",
                  ...candidate,
                  level: draft.data?.node?.level ?? "introductory",
                  kind: "reading",
                  display: "link",
                  part: "",
                },
              ]
            : [],
        copy_text: copyText ?? null,
        copy_digest: copyText === undefined ? "" : await copyDigest(copyText),
        figure_at: figureAt ?? null,
        figure_question: figureQuestion ?? null,
      };
      const value = await createProposal(draftId, body);
      if (alive.current) {
        remember(value);
        setIdentity(value.public_id);
        setResolutions({});
        setCustom({});
      }
    } catch (e) {
      if (alive.current) setError(e as Error);
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const keep = async () => {
    if (!proposal || stale || copyStale || guard.current) return;
    guard.current = true;
    setError(null);
    try {
      const chosen = { ...resolutions };
      for (const [path, text] of Object.entries(custom)) chosen[path] = { value: JSON.parse(text) };
      if (onUse) {
        if (copyText === undefined || (await copyDigest(copyText)) !== proposal.copy_digest)
          throw new Error("The working copy changed. Ask again before using these data.");
        const value = resolved(proposal, chosen);
        onUse(value, {
          proposal_id: proposal.public_id,
          copy_digest: proposal.copy_digest,
          resolutions: chosen,
        });
        close();
      } else {
        await edit.mutateAsync({
          method: "POST",
          path: `ai/proposals/${proposal.public_id}/accept`,
          body: { based_on: proposal.base_revision, resolutions: chosen },
        });
        await client.invalidateQueries({
          queryKey: queryKeys.proposal(draftId, proposal.public_id),
        });
        close();
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      guard.current = false;
    }
  };
  const failure =
    error instanceof ApiUnreachable
      ? (error.body as { code?: string; findings?: Record<string, unknown>[] })
      : undefined;
  const complete =
    proposal?.conflicts.every(
      (c) => Object.hasOwn(resolutions, String(c.path)) || Object.hasOwn(custom, String(c.path)),
    ) ?? false;
  return (
    <section
      aria-label="AI drafting"
      className="my-3 flex flex-col gap-3 rounded-panel border border-border-2 bg-surface p-5 shadow-sm"
    >
      <header className="flex justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold">
            {kind === "figure"
              ? "Ask for figure data"
              : kind === "resource"
                ? "Suggest a resource"
                : "Draft with AI"}
          </h3>
          <p className="text-[12px] text-ink-2">
            Compare, edit and keep. AI origin stays visible through human review.
          </p>
        </div>
        <button className={SECONDARY} type="button" onClick={close}>
          Close
        </button>
      </header>
      {stale && (
        <p role="alert" className="text-open">
          The draft changed. Close this panel and reopen it before asking or keeping.
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              void client.refetchQueries({ queryKey: queryKeys.draft(draftId), exact: true });
              close();
            }}
          >
            Reload draft
          </button>
        </p>
      )}
      <label className="text-[13px]">
        What should change?
        <textarea
          className={FIELD}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </label>
      <details>
        <summary className="cursor-pointer text-[13px] text-sel">
          Supply a source or teaching note
        </summary>
        <div className="mt-2 grid gap-2">
          {(["title", "url", "licence", "excerpt"] as const).map((key) => (
            <label key={key} className="text-[12px]">
              Source {key}
              <textarea
                className={FIELD}
                value={source[key]}
                onChange={(e) => setSource({ ...source, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="text-[12px]">
            <input
              type="checkbox"
              checked={source.public}
              onChange={(e) => setSource({ ...source, public: e.target.checked })}
            />{" "}
            Publish the source reference (excerpt stays private)
          </label>
        </div>
      </details>
      {kind === "resource" && (
        <details>
          <summary className="cursor-pointer text-[13px] text-sel">
            Supply a resource candidate
          </summary>
          <p className="text-[12px] text-ink-2">
            Leave blank to choose from indexed resources. Only declared candidates can be selected.
          </p>
          {(["url", "provider", "covers", "licence"] as const).map((key) => (
            <label key={key} className="text-[12px]">
              Candidate {key}
              <input
                className={FIELD}
                value={candidate[key]}
                onChange={(e) => setCandidate({ ...candidate, [key]: e.target.value })}
              />
            </label>
          ))}
        </details>
      )}
      <div>
        <button
          className={PRIMARY}
          type="button"
          disabled={
            busy ||
            stale ||
            !instruction.trim() ||
            ["queued", "running"].includes(proposal?.state ?? "")
          }
          onClick={() => void ask()}
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </div>
      {history.isError && <ErrorNotice error={history.error} />}
      {(history.data?.length ?? 0) > 0 && (
        <label className="text-[12px]">
          Previous proposals
          <select
            className={FIELD}
            value={identity ?? ""}
            onChange={(e) => {
              setIdentity(e.target.value || null);
              setResolutions({});
              setCustom({});
            }}
          >
            <option value="">Choose a proposal</option>
            {history.data?.map((p) => (
              <option key={p.public_id} value={p.public_id}>
                {p.state} · {p.instruction}
              </option>
            ))}
          </select>
        </label>
      )}
      {copyStale && (
        <p role="alert" className="text-open">
          The working copy changed. Ask again before using these data.
        </p>
      )}
      {poll.isError && <ErrorNotice error={poll.error} />}
      {proposal && (
        <>
          <p role="status" className="text-[13px]">
            {proposal.state === "queued"
              ? "Waiting for the worker…"
              : proposal.state === "running"
                ? "Drafting…"
                : proposal.state}
            {proposal.code && ` · ${proposal.code}`} {proposal.detail}
          </p>
          {proposal.state === "ready" && (
            <>
              <div
                className="grid min-w-0 gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
              >
                {[
                  ["Your current version", proposal.current],
                  [
                    "Proposed version",
                    kind === "resource"
                      ? proposal.candidates.find((c) => c.id === proposal.candidate?.candidate_id)
                      : proposal.candidate,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="min-w-0 rounded-control border border-border bg-bg p-3"
                  >
                    <h4 className="mb-2 text-[13px] font-semibold">{String(label)}</h4>
                    <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">
                      {readable(value)}
                    </pre>
                  </div>
                ))}
              </div>
              {proposal.conflicts.map((c) => (
                <fieldset key={String(c.path)} className="rounded-control border border-open p-3">
                  <legend className="text-[13px]">Resolve {String(c.path) || "this item"}</legend>
                  <p className="text-[12px] text-ink-2">
                    {String(c.reason ?? "Overlapping changes")}
                  </p>
                  {(["human", "model", "base"] as const).map((choice) => (
                    <label key={choice} className="my-2 block text-[13px]">
                      <input
                        type="radio"
                        name={`conflict-${String(c.path)}`}
                        checked={
                          (resolutions[String(c.path)] as { choice?: string })?.choice === choice
                        }
                        onChange={() => {
                          setResolutions({ ...resolutions, [String(c.path)]: { choice } });
                          setCustom(
                            Object.fromEntries(
                              Object.entries(custom).filter(([k]) => k !== c.path),
                            ),
                          );
                        }}
                      />{" "}
                      {choice === "human"
                        ? "Keep your version"
                        : choice === "model"
                          ? "Use model version"
                          : "Use baseline"}
                      <pre className="whitespace-pre-wrap font-sans text-[12px]">
                        {readable(c[choice])}
                      </pre>
                    </label>
                  ))}
                  <label className="text-[12px]">
                    Custom value (JSON)
                    <textarea
                      className={FIELD}
                      value={custom[String(c.path)] ?? ""}
                      onChange={(e) => {
                        setCustom({ ...custom, [String(c.path)]: e.target.value });
                        setResolutions(
                          Object.fromEntries(
                            Object.entries(resolutions).filter(([k]) => k !== c.path),
                          ),
                        );
                      }}
                    />
                  </label>
                </fieldset>
              ))}
              <button
                className={PRIMARY}
                type="button"
                disabled={stale || copyStale || edit.isPending || !complete}
                onClick={() => void keep()}
              >
                {onUse ? "Use these data" : "Keep in draft"}
              </button>
            </>
          )}
          {proposal.findings.map((f) => (
            <p key={`${String(f.code)}:${String(f.message)}`} className="text-[12px] text-open">
              {String(f.code)} {String(f.message)}
            </p>
          ))}
          {proposal.sources.length > 0 && (
            <details className="text-[12px] text-ink-2">
              <summary className="cursor-pointer">Supplied sources</summary>
              {proposal.sources.map((source) => (
                <div key={String(source.id)} className="mt-2">
                  <p>
                    {String(source.title)} · {String(source.licence)}
                  </p>
                  <p>{String(source.url)}</p>
                  <p className="whitespace-pre-wrap">{String(source.excerpt)}</p>
                  <p>{source.public ? "Public reference" : "Private reference"}</p>
                </div>
              ))}
            </details>
          )}
          {proposal.receipt && (
            <details className="text-[12px] text-ink-2">
              <summary className="cursor-pointer">Call receipt</summary>
              <pre className="whitespace-pre-wrap">{readable(proposal.receipt)}</pre>
            </details>
          )}
          {!["accepted", "discarded"].includes(proposal.state) && (
            <button
              className={SECONDARY}
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  remember(await discardProposal(draftId, proposal.public_id));
                } catch (e) {
                  setError(e as Error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Discard proposal
            </button>
          )}
        </>
      )}
      {error && <ErrorNotice error={error} />}
      {failure?.findings?.map((f) => (
        <p key={`${String(f.code)}:${String(f.message)}`} className="text-[12px] text-open">
          {String(f.code)} {String(f.message)}
        </p>
      ))}
    </section>
  );
}
/** Browser preview of explicit resolutions; the server validates the same choices on Save. */
export function resolved(
  proposal: ProposalOut,
  choices: Record<string, unknown>,
): Record<string, unknown> {
  let value = structuredClone(proposal.candidate ?? {});
  for (const c of proposal.conflicts) {
    const choice = choices[String(c.path)] as { choice?: string; value?: unknown } | undefined;
    if (!choice) throw new Error("Resolve every conflict before using these data.");
    const selected = Object.hasOwn(choice, "value") ? choice.value : c[String(choice.choice)];
    if (c.path === "") {
      value = selected as Record<string, unknown>;
      continue;
    }
    const path = String(c.path)
      .split("/")
      .slice(1)
      .map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"));
    let parent = value;
    for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    const key = path.at(-1) as string;
    if (choice.choice && c[`${choice.choice}_present`] === false) delete parent[key];
    else parent[key] = selected;
  }
  return value;
}
