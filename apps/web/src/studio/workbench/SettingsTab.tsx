// Settings (the WorkbenchSettings board, M4K.3): the node's fields, each saved when you leave it,
// with Verify's problem about a field under it; Discard at the foot, confirmed in place.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { discardDraft } from "../../api/drafts";
import { draftMoved, useMe, useRegions } from "../../api/queries";
import type { DraftNodeOut, DraftOut, FieldsIn, Level } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { shownLevel } from "../../start/format";
import { LEVELS } from "../drafts/NewNodeForm";
import { CARD, HINT, INPUT, NOTE } from "./bench";
import { fields } from "./edits";
import { LeaveToSave } from "./LeaveToSave";
import { refusalOf } from "./refusal";
import { useLeaveEdit } from "./useLeaveEdit";
import { mayTakeBack } from "./who";

type Name = "title" | "claim" | "region" | "level" | "minutes";
type Input = (props: {
  id: string;
  value: string;
  set: (value: string) => void;
  locked: boolean;
}) => ReactNode;

const SELECT = `${INPUT} px-2.5`;

export function SettingsTab({
  draft,
  node,
  editable,
}: {
  draft: DraftOut;
  node: DraftNodeOut;
  editable: boolean;
}) {
  const regions = useRegions().data ?? [{ id: node.region, name: node.region }];
  const one = (name: Name, label: string, input: Input, hint?: string) => (
    <SettingField
      draft={draft}
      name={name}
      label={label}
      saved={String(node[name])}
      locked={!editable}
      input={input}
      hint={hint}
    />
  );
  return (
    <>
      <form className={CARD} onSubmit={(e) => e.preventDefault()}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[14.5px] font-semibold">The node</h2>
          <span className={HINT}>Each field saves when you leave it.</span>
        </div>
        {one("title", "Title", ({ id, value, set, locked }) => (
          <input
            id={id}
            value={value}
            disabled={locked}
            onChange={(e) => set(e.target.value)}
            className={INPUT}
          />
        ))}
        {one("claim", "Claim", ({ id, value, set, locked }) => (
          <textarea
            id={id}
            rows={2}
            value={value}
            disabled={locked}
            onChange={(e) => set(e.target.value)}
            className={`${INPUT} h-auto py-[9px] leading-[1.45]`}
          />
        ))}
        <div className="grid gap-3 sm:grid-cols-3">
          {one("region", "Region", ({ id, value, set, locked }) => (
            <select
              id={id}
              value={value}
              disabled={locked}
              onChange={(e) => set(e.target.value)}
              className={SELECT}
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ))}
          {one(
            "level",
            "Level",
            ({ id, value, set, locked }) => (
              <select
                id={id}
                value={value}
                disabled={locked}
                onChange={(e) => set(e.target.value)}
                className={SELECT}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {shownLevel(level)}
                  </option>
                ))}
              </select>
            ),
            "Describes the node, never the learner.",
          )}
          {one(
            "minutes",
            "Minutes",
            ({ id, value, set, locked }) => (
              <input
                id={id}
                inputMode="numeric"
                value={value}
                disabled={locked}
                onChange={(e) => set(e.target.value)}
                className={INPUT}
              />
            ),
            "1 to 600.",
          )}
        </div>
      </form>
      <Discard draft={draft} />
    </>
  );
}

/** What a field's edit sends: minutes as a number, the rest as typed. */
function change(name: Name, value: string): Omit<FieldsIn, "revision"> {
  if (name === "minutes") return { minutes: Number(value) };
  if (name === "level") return { level: value as Level };
  return { [name]: value };
}

function SettingField(props: {
  draft: DraftOut;
  name: Name;
  label: string;
  saved: string;
  locked: boolean;
  input: Input;
  hint?: string | undefined;
}) {
  const { draft, name, label, saved, locked, input, hint } = props;
  const id = useId();
  const field = useLeaveEdit(draft.public_id, saved, (value) => fields(change(name, value)));
  const refusal = refusalOf(field.edit.error);
  const problems = [
    ...draft.problems.filter((p) => p.field === name).map((p) => p.text),
    ...(refusal === null ? [] : [refusal.sentence, ...refusal.problems.map((p) => p.text)]),
  ];
  return (
    <LeaveToSave onLeave={field.leave}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {input({ id, value: field.shown, set: field.set, locked })}
        {hint !== undefined && <span className={HINT}>{hint}</span>}
        {problems.map((text) => (
          <span key={text} className="text-[12.5px] text-open">
            {text}
          </span>
        ))}
      </div>
    </LeaveToSave>
  );
}

function Discard({ draft }: { draft: DraftOut }) {
  const client = useQueryClient();
  const may = mayTakeBack(useMe().data?.user, draft);
  const [asking, setAsking] = useState(false);
  const discard = useMutation({
    mutationFn: () => discardDraft(draft.public_id),
    onSuccess: (gone) => draftMoved(client, gone),
  });
  if (draft.state !== "open") return null;
  return (
    <section className={`${CARD} gap-2.5`}>
      <h2 className="text-[14.5px] font-semibold">Discard this draft</h2>
      <p className={NOTE}>
        The draft and its revisions stay in the log, but it cannot be reopened. To keep writing
        later, leave it open instead.
      </p>
      {asking ? (
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <span className="text-open">Discard this draft? It cannot be reopened.</span>
          <button
            type="button"
            className={`${SECONDARY} text-open`}
            disabled={discard.isPending}
            onClick={() => discard.mutate()}
          >
            Discard
          </button>
          <button type="button" className={SECONDARY} onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          {may && (
            <button
              type="button"
              className={`${SECONDARY} text-open`}
              onClick={() => setAsking(true)}
            >
              Discard this draft
            </button>
          )}
          <span className={HINT}>You, someone who saved it, or an operator.</span>
        </div>
      )}
      {discard.error !== null && <ErrorNotice error={discard.error} />}
    </section>
  );
}
