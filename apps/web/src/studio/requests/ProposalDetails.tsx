import type { ContentRequestOut, SkeletonScoreOut, StubProposal } from "../../api/schema";
export function ProposalDetails({ proposal }: { proposal: ContentRequestOut["proposal"] }) {
  const stub = proposal?.stub as StubProposal | undefined;
  if (!stub) return null;
  const scores = (proposal.scores ?? []) as SkeletonScoreOut[];
  const source = proposal.source as
    | { url?: string; version?: string; licence?: string }
    | undefined;
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3">
      <h3 className="font-medium">Proposed from an outline</h3>
      <p className="text-sm">{stub.claim}</p>
      <p className="text-xs text-ink-3">
        {stub.region} · {stub.level}
      </p>
      {source && (
        <p className="text-xs">
          {source.version} · {source.licence} ·{" "}
          <a className="text-sel" href={source.url} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      )}
      <ul>
        {(stub.needs ?? []).map((need) => (
          <li key={need.target} className="text-sm">
            Needs {need.target}
            <p className="text-ink-2">{need.reason}</p>
          </li>
        ))}
      </ul>
      {scores
        .filter(
          (score) => score.key === `stub/${stub.id}` || score.key.startsWith(`need/${stub.id}/`),
        )
        .map((score) => (
          <details key={score.key}>
            <summary className="cursor-pointer text-sm">
              {score.key.startsWith("stub/") ? "Stub" : "Need"} · {score.score}/5 · {score.reason}
            </summary>
            <ul>
              {Object.entries(score.parts ?? {}).map(([part, value]) => (
                <li key={part} className="text-xs text-ink-2">
                  {part}: {value.score}/5 · {value.reason}
                </li>
              ))}
            </ul>
          </details>
        ))}
      {scores.length === 0 && (
        <p className="text-sm text-open">Unscored · review the claim and needs by hand.</p>
      )}
    </section>
  );
}
