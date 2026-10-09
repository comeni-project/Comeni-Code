// New node (S19): its id and fields; the API opens a draft of it and the workbench opens.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Field } from "../../account/Field";
import { openDraft } from "../../api/drafts";
import { draftMoved, useRegions } from "../../api/queries";
import type { Level } from "../../api/schema";
import { PRIMARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { shownLevel } from "../../start/format";
import { refusalOf } from "../workbench/refusal";

export const LEVELS: readonly Level[] = [
  "first-steps",
  "foundations",
  "introductory",
  "intermediate",
  "advanced",
];
const SELECT =
  "h-10 rounded-control border border-border-2 bg-surface px-2.5 text-[14px] font-normal text-ink";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium";

export function NewNodeForm() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const regions = useRegions().data ?? [];
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [claim, setClaim] = useState("");
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState<Level>("introductory");
  const [minutes, setMinutes] = useState("20");
  const chosen = region || regions[0]?.id || "";
  const create = useMutation({
    mutationFn: () =>
      openDraft({
        node_id: id,
        new: { title, claim, region: chosen, level, minutes: Number(minutes) },
      }),
    onSuccess: (draft) => {
      void draftMoved(client, draft);
      navigate(`/studio/drafts/${draft.public_id}`);
    },
  });
  const refusal = refusalOf(create.error);
  return (
    <form
      className="flex flex-col gap-3.5 rounded-panel border border-border bg-surface px-5 py-[18px]"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <h2 className="text-[14.5px] font-semibold">New node</h2>
      <Field
        label="Node id"
        value={id}
        onChange={setId}
        hint="Lowercase words joined by dashes; it names the folder."
      />
      <Field label="Title" value={title} onChange={setTitle} />
      <Field label="Claim" value={claim} onChange={setClaim} />
      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          Region
          <select className={SELECT} value={chosen} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Level
          <select
            className={SELECT}
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
          >
            {LEVELS.map((choice) => (
              <option key={choice} value={choice}>
                {shownLevel(choice)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={LABEL}>
        Minutes
        <input
          type="number"
          min={1}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className={`${SELECT} w-28 px-3`}
        />
      </label>
      {create.error !== null && <ErrorNotice error={create.error} />}
      {refusal?.problems.map((problem) => (
        <p key={problem.text} className="text-[12.5px] text-open">
          {problem.text}
        </p>
      ))}
      <button type="submit" className={PRIMARY} disabled={create.isPending}>
        Create the draft
      </button>
    </form>
  );
}
