// An image on the page (M6.3 spec, M6IM.5), drawn as the Node board's Figure 5: the image, then
// its number and caption, and its credit — the author, where it came from, the licence linking its
// deed and the source its page. Invariant 6: no image is drawn without its record.
import type { Components } from "react-markdown";
import type { ImageRecordOut } from "../api/schema";
import { deedOf, siteOf } from "./licence";
import { componentsFor, Prose } from "./prose";

export interface Pictures {
  records: ImageRecordOut[];
  url: (file: string) => string;
}

const LINK = "text-sel hover:text-ink";

/** A landed node's image, as the index serves it (M6IM.3). */
export const imageUrl = (node: string, file: string) =>
  `/api/nodes/${encodeURIComponent(node)}/images/${encodeURIComponent(file)}`;

function Credit({ record }: { record: ImageRecordOut }) {
  const { source } = record;
  const own = source === "own work";
  const deed = deedOf(record.licence);
  // A source is optional (#360): without one, the credit is the author and the licence.
  const from = source === null ? "" : `, ${own ? "own work" : `via ${siteOf(source)}`}`;
  return (
    <span className="text-[12.5px] text-ink-3">
      {`Image: ${record.author}${from} · `}
      {deed === null ? (
        record.licence
      ) : (
        <a href={deed} target="_blank" rel="noopener noreferrer" className={LINK}>
          {record.licence}
        </a>
      )}
      {source !== null && !own && (
        <>
          {" · "}
          <a href={source} target="_blank" rel="noopener noreferrer" className={LINK}>
            source
          </a>
        </>
      )}
    </span>
  );
}

export function Picture({
  record,
  src,
  caption,
  number,
  components = componentsFor(false),
}: {
  record: ImageRecordOut;
  src: string;
  caption: string;
  number: number | null;
  components?: Components;
}) {
  return (
    <figure className="m-0 grid gap-4 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[260px_minmax(0,1fr)] sm:items-center">
      <img
        src={src}
        alt={record.alt}
        loading="lazy"
        className="max-h-[360px] w-full rounded-[8px] bg-bg object-contain"
      />
      <figcaption className="flex flex-col gap-1.5 text-[13px] leading-[1.5] text-ink-2">
        <div className="flex gap-1 [&_p]:text-[13px] [&_p]:text-ink">
          {number !== null && (
            <b className="flex-none font-semibold text-ink">{`Figure ${number}.`}</b>
          )}
          <div className="min-w-0">
            <Prose markdown={caption} components={components} />
          </div>
        </div>
        <Credit record={record} />
      </figcaption>
    </figure>
  );
}
