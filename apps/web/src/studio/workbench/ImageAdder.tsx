// Adding an image (M6.3 spec, M6IM.4): from Wikimedia Commons, whose credit is read from Commons
// and shown as it is, or by upload, whose credit the author gives. Either way the author writes the
// alt text and the caption, and the file, its record and its block are one save.
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Field } from "../../account/Field";
import { lookUpCommons } from "../../api/drafts";
import type { CreditOut } from "../../api/schema";
import { SECONDARY } from "../../layout/buttons";
import { ErrorNotice } from "../../layout/ErrorNotice";
import { addImageFromCommons, addImageUpload } from "./edits";
import { MarkdownField } from "./MarkdownField";
import { RefusalNotice } from "./RefusalNotice";
import { refusalOf } from "./refusal";
import { reloadDraft, useDraftEdit } from "./useDraftEdit";

/** The licences an image may carry, in code-schema's written form (M6IM.2). */
export const LICENCES = ["CC BY 4.0", "CC BY-SA 4.0", "CC0 1.0", "Public domain"] as const;

/** A name the images/ folder takes, from what the file was called. */
export function nameFor(original: string, type: string): string {
  const extension = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
  const stem = original.replace(/\.[^.]*$/, "").toLowerCase();
  const slug = stem
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug.replace(/-+$/, "") || "image"}.${extension}`;
}

export function ImageAdder({
  draftId,
  at,
  onClose,
}: {
  draftId: string;
  at: number;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const edit = useDraftEdit(draftId);
  const [tab, setTab] = useState<"commons" | "upload">("commons");
  const [link, setLink] = useState("");
  const [credit, setCredit] = useState<CreditOut | null>(null);
  const [lookUp, setLookUp] = useState<Error | null>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("own work");
  const [licence, setLicence] = useState<string>(LICENCES[0]);
  const licenceId = useId();
  const fileId = useId();
  const refusal = refusalOf(edit.error);

  const find = async () => {
    setLookUp(null);
    setCredit(null);
    try {
      setCredit(await lookUpCommons(link.trim()));
    } catch (error) {
      setLookUp(error as Error);
    }
  };
  const ready =
    alt.trim() !== "" &&
    caption.trim() !== "" &&
    (tab === "commons" ? credit !== null : upload !== null && author.trim() !== "");
  const add = () => {
    if (!ready || edit.isPending) return;
    const made =
      tab === "commons"
        ? addImageFromCommons(at, link.trim(), alt.trim(), caption.trim())
        : addImageUpload(
            at,
            upload as File,
            {
              file: nameFor((upload as File).name, (upload as File).type),
              alt: alt.trim(),
              author: author.trim(),
              source: source.trim(),
              licence,
            },
            caption.trim(),
          );
    edit.mutate(made, { onSuccess: onClose });
  };

  return (
    <section
      aria-label="New image"
      className="flex flex-col gap-3 rounded-[10px] border-2 border-sel bg-surface p-3.5 shadow-[0_0_0_4px_var(--sel-soft)]"
    >
      <span className="font-mono text-[11px] text-ink-3">new image</span>
      <div role="tablist" aria-label="Where the image comes from" className="flex gap-1">
        {(
          [
            ["commons", "From Commons"],
            ["upload", "Upload"],
          ] as const
        ).map(([key, name]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-[7px] px-3 py-1 text-[12.5px] ${
              tab === key ? "bg-bg font-semibold text-ink" : "text-ink-2"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "commons" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Commons file link" value={link} onChange={setLink} />
            </div>
            <button type="button" className={SECONDARY} onClick={() => void find()}>
              Look up
            </button>
          </div>
          {lookUp !== null && <ErrorNotice error={lookUp} />}
          {credit !== null && (
            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
              <img
                src={credit.thumb_url}
                alt=""
                className="max-h-[140px] w-full rounded-[8px] bg-bg object-contain"
              />
              <p className="text-[12.5px] leading-[1.5] text-ink-2">
                {`Image: ${credit.author}, via Wikimedia Commons · ${credit.licence}`}
                <br />
                <span className="text-ink-3">
                  The credit comes from Commons and is kept as it is.
                </span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={fileId} className="text-[13px] font-medium">
              Image file
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
              className="text-[13px]"
            />
            <span className="text-[11.5px] text-ink-3">PNG, JPEG or WebP, at most 2 MB.</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Author" value={author} onChange={setAuthor} />
            <Field label="Source" value={source} onChange={setSource} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={licenceId} className="text-[13px] font-medium">
              Licence
            </label>
            <select
              id={licenceId}
              value={licence}
              onChange={(event) => setLicence(event.target.value)}
              className="h-10 rounded-control border border-border-2 bg-surface px-2.5 text-[14px]"
            >
              {LICENCES.map((each) => (
                <option key={each} value={each}>
                  {each}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <Field label="Alt text" value={alt} onChange={setAlt} />
      <MarkdownField label="Caption" value={caption} onChange={setCaption} />
      {refusal !== null && (
        <RefusalNotice
          refusal={refusal}
          onReload={() => {
            edit.reset();
            void reloadDraft(client, draftId);
          }}
        />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={SECONDARY}
          disabled={!ready || edit.isPending}
          onClick={add}
        >
          Add the image
        </button>
      </div>
    </section>
  );
}
