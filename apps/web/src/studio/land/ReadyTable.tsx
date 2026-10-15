// Ready to land (M4.9c spec, M4LS.3): approved drafts no landing holds; the picked ones land as
// one pull request. A refusal is said in the API's words, each problem under its draft.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { ApiUnreachable } from "../../api/client";
import { startLanding } from "../../api/landing";
import { landingMoved } from "../../api/queries";
import type { LandingOut, ProblemOut, ReadyDraftOut } from "../../api/schema";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { fileLabel, who } from "./words";

function problemsOf(error: Error | null): ProblemOut[] {
  if (!(error instanceof ApiUnreachable)) return [];
  const body = error.body as { problems?: ProblemOut[] } | undefined;
  return body?.problems ?? [];
}

export function ReadyTable({
  rows,
  loaded,
  onLanded,
}: {
  rows: ReadyDraftOut[];
  loaded: boolean;
  onLanded: (made: LandingOut) => void;
}) {
  const client = useQueryClient();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  // Only rows still listed are counted and sent (Review Focus 4).
  const picked = rows.filter((row) => ticked.has(row.public_id)).map((row) => row.public_id);
  const land = useMutation({
    mutationFn: () => startLanding(picked),
    onSuccess: (made) => {
      setTicked(new Set());
      landingMoved(client, made);
      onLanded(made);
    },
  });
  const problems = problemsOf(land.error);
  const under = (row: ReadyDraftOut) => problems.filter((p) => p.file.startsWith(`${row.folder}/`));
  const elsewhere = problems.filter((p) => !rows.some((row) => under(row).includes(p)));
  const tick = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (loaded && rows.length === 0)
    return <p className="text-[14px] text-ink-2">No approved drafts are waiting to land.</p>;
  return (
    <>
      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <table aria-label="Ready to land" className="w-full table-fixed text-[13.5px]">
          <colgroup>
            <col className="w-[40px]" />
            <col />
            <col className="w-[132px]" />
            <col className="w-[76px]" />
            <col />
            <col className="w-[164px]" />
          </colgroup>
          <thead>
            <tr className="text-left text-[11.5px] text-ink-3">
              <th className="py-2.5 pl-3.5 font-normal">
                <span className="sr-only">Pick</span>
              </th>
              <th className="font-normal">Node</th>
              <th className="font-normal">Region</th>
              <th className="font-normal">Revision</th>
              <th className="font-normal">Approved by</th>
              <th className="pr-3.5 text-right font-normal">Files</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.public_id}>
                <tr
                  className={`h-[52px] border-t border-border ${ticked.has(row.public_id) ? "bg-bg" : ""}`}
                >
                  <td className="pl-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Pick ${row.node_id}`}
                      checked={ticked.has(row.public_id)}
                      onChange={() => tick(row.public_id)}
                      className="size-[15px] align-middle accent-sel"
                    />
                  </td>
                  <td className="truncate pr-3">
                    <Link
                      to={`/studio/drafts/${row.public_id}`}
                      className="font-mono text-[13px] font-medium text-sel"
                    >
                      {row.node_id}
                    </Link>
                  </td>
                  <td className="truncate pr-3 text-ink-2">{row.region}</td>
                  <td className="pr-3 text-ink-3 tabular-nums">{`rev ${row.revision}`}</td>
                  <td className="truncate pr-3 text-ink-2">
                    {row.self_approved
                      ? `${who(row.approved_by)} · self-approved`
                      : who(row.approved_by)}
                  </td>
                  <td className="pr-3.5 text-right font-mono text-[12px] text-ink-2">
                    {row.files.map(fileLabel).join(" ")}
                  </td>
                </tr>
                {under(row).map((p) => (
                  <tr key={`${p.file}:${p.text}`}>
                    <td />
                    <td colSpan={5} className="pb-2 pr-3.5 text-[12px] text-open">
                      {p.text}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <span className="text-[12.5px] text-ink-3">
        The batch is checked in place against the index before anything is sent; a draft whose
        folder changed on main is dropped, with the reason.
      </span>
      {land.error !== null && <ErrorNotice error={land.error} />}
      {elsewhere.map((p) => (
        <p key={`${p.file}:${p.text}`} className="text-[12px] text-open">
          {p.text}
        </p>
      ))}
      {picked.length > 0 && (
        <section
          aria-label="Picked drafts"
          className="flex items-center gap-3 self-start rounded-[12px] bg-ink px-3.5 py-2.5 text-[13px] text-bg shadow-float"
        >
          <span className="font-semibold">{`${picked.length} selected`}</span>
          <button
            type="button"
            disabled={land.isPending}
            onClick={() => land.mutate()}
            className="rounded-[8px] bg-surface px-[11px] py-[5px] font-semibold text-ink disabled:opacity-60"
          >
            {`Land ${picked.length} ${picked.length === 1 ? "draft" : "drafts"} as one pull request`}
          </button>
          <button type="button" onClick={() => setTicked(new Set())} className="opacity-75">
            Clear
          </button>
        </section>
      )}
    </>
  );
}
