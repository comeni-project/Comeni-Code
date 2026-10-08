// One resource, open (the WorkbenchResources board, M4K.3): every field ResourceIn has, a video's
// id and part only for a video. Leaving a changed card sends the whole list with it in place.
import { useId, useState } from "react";
import type { Level, ResourceIn } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { shownLevel } from "../../start/format";
import { LEVELS } from "../drafts/NewNodeForm";
import { CARD, HINT, INPUT } from "./bench";
import { resources } from "./edits";
import { LeaveToSave } from "./LeaveToSave";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { useDraftEdit } from "./useDraftEdit";

export const KINDS = ["video", "reading", "tutorial", "exercise"] as const;
const DISPLAYS = ["link", "embed"] as const;

export const BLANK: ResourceIn = {
  kind: "video",
  provider: "",
  url: "",
  video: "",
  part: "",
  covers: "",
  licence: "",
  display: "link",
  level: "introductory",
};

/** How a resource is named in its card: "Video · khan-academy". */
export const titleOf = (r: ResourceIn) =>
  `${r.kind.charAt(0).toUpperCase()}${r.kind.slice(1)} · ${r.provider}`;

const blank = (r: ResourceIn) =>
  [r.provider, r.url, r.covers, r.licence].every((v) => v.trim() === "");

export function ResourceCard(props: {
  draftId: string;
  list: ResourceIn[];
  at: number | null;
  onClose: () => void;
  onRemove?: (() => void) | undefined;
  onReload: () => void;
}) {
  const { draftId, list, at, onClose, onRemove, onReload } = props;
  const initial = at === null ? BLANK : (list[at] as ResourceIn);
  const [r, setR] = useState(initial);
  const edit = useDraftEdit(draftId);
  const put = <K extends keyof ResourceIn>(key: K, value: ResourceIn[K]) =>
    setR({ ...r, [key]: value });
  const leave = () => {
    if (edit.isPending) return;
    if (JSON.stringify(r) === JSON.stringify(initial) || (at === null && blank(r)))
      return onClose();
    const sent = {
      ...r,
      video: r.kind === "video" ? (r.video ?? "") : "",
      part: r.kind === "video" ? (r.part ?? "") : "",
    };
    const next = at === null ? [...list, sent] : list.map((x, i) => (i === at ? sent : x));
    edit.mutate(resources(next), { onSuccess: onClose });
  };
  const refusal = refusalOf(edit.error);
  return (
    <div className={CARD}>
      <LeaveToSave onLeave={leave}>
        <legend className="float-left flex w-full items-center justify-between gap-3 p-0">
          <span className="text-[14.5px] font-semibold">
            {at === null ? "New resource" : titleOf(initial)}
          </span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Choice label="Kind" value={r.kind} options={KINDS} onChange={(v) => put("kind", v)} />
          <Text
            label="Provider"
            value={r.provider}
            onChange={(v) => put("provider", v)}
            hint="Its id in providers.yaml."
            mono
          />
          <Choice
            label="Display"
            value={r.display}
            options={DISPLAYS}
            onChange={(v) => put("display", v)}
            hint="Embed only where the provider allows."
          />
        </div>
        <Text label="URL" value={r.url} onChange={(v) => put("url", v)} mono />
        {r.kind === "video" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              label="Video id"
              value={r.video ?? ""}
              onChange={(v) => put("video", v)}
              hint="youtube:<id>"
              mono
            />
            <Text
              label="Part"
              value={r.part ?? ""}
              onChange={(v) => put("part", v)}
              hint="The part that covers this node."
            />
          </div>
        )}
        <Text label="Covers" value={r.covers} onChange={(v) => put("covers", v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Licence" value={r.licence} onChange={(v) => put("licence", v)} />
          <Choice
            label="Level"
            value={r.level}
            options={LEVELS}
            shown={shownLevel}
            onChange={(v) => put("level", v as Level)}
          />
        </div>
        {refusal !== null && (
          <RefusalNotice
            refusal={refusal}
            onReload={() => {
              edit.reset();
              onReload();
            }}
          />
        )}
        <div className="flex justify-end gap-2">
          {onRemove !== undefined && (
            <button type="button" className={SECONDARY} onClick={onRemove}>
              Remove
            </button>
          )}
          <button type="button" className={SECONDARY} disabled={edit.isPending} onClick={leave}>
            Done
          </button>
        </div>
      </LeaveToSave>
    </div>
  );
}

function Text(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {props.label}
      </label>
      <input
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`${INPUT} ${props.mono ? "font-mono text-[13px]" : ""}`}
      />
      {props.hint !== undefined && <span className={HINT}>{props.hint}</span>}
    </div>
  );
}

function Choice<T extends string>(props: {
  label: string;
  value: string;
  options: readonly T[];
  onChange: (v: T) => void;
  shown?: (v: T) => string;
  hint?: string;
}) {
  const id = useId();
  const shown = props.shown ?? ((v: T) => v.charAt(0).toUpperCase() + v.slice(1));
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className={`${INPUT} px-2.5`}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {shown(o)}
          </option>
        ))}
      </select>
      {props.hint !== undefined && <span className={HINT}>{props.hint}</span>}
    </div>
  );
}
