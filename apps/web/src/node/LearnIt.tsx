// Learn it: the outside resources a reviewer picked for this node (L5, M3P5.3, tutor spec T4.1).
//
// A resource holds our sentence and a link, never the resource's own text. An embedded video
// plays in the page from the video the content names; everything else links out. A resource has
// no title of its own, so it is named by its provider and the part it points at.
import type { ResourceOut } from "../api/schema";
import { playerSrc } from "./embed";
import { LevelTag, Tag } from "./tags";

const KIND: Record<string, string> = {
  video: "Video",
  reading: "Reading",
  tutorial: "Tutorial",
  exercise: "Exercise",
};

const kindOf = (resource: ResourceOut) => KIND[resource.kind] ?? resource.kind;

/** "OpenStax · §17.3", or "Galaxy Training tutorial" when there is no part to name. */
function nameOf(resource: ResourceOut): string {
  const provider = resource.provider.name;
  return resource.part !== "" && resource.kind !== "video"
    ? `${provider} · ${resource.part}`
    : `${provider} ${kindOf(resource).toLowerCase()}`;
}

function Played({ resource, src }: { resource: ResourceOut; src: string }) {
  const name = nameOf(resource);
  return (
    <article
      aria-label={name}
      className="grid overflow-hidden rounded-[14px] border border-border bg-surface md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
    >
      <div className="aspect-video bg-ink">
        <iframe
          title={`${resource.provider.name}: ${resource.covers}`}
          src={src}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full border-0"
        />
      </div>
      <div className="flex flex-col gap-2.5 px-[18px] py-4">
        <div className="flex flex-wrap gap-1.5">
          <Tag>{kindOf(resource)}</Tag>
          <LevelTag level={resource.level} />
        </div>
        <h3 className="text-[16px] leading-[1.3] font-semibold">{name}</h3>
        <p className="text-[13px] leading-normal text-ink-2">
          <b className="font-semibold text-ink">Covers:</b> <span>{resource.covers}</span>
        </p>
        <div className="mt-auto flex flex-col gap-1 border-border border-t pt-2.5 text-[12px] text-ink-3">
          <span>
            {resource.provider.name} · {resource.licence}
          </span>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-sel hover:text-ink"
          >
            Open on {resource.provider.name}
          </a>
        </div>
      </div>
    </article>
  );
}

function Linked({ resource }: { resource: ResourceOut }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-3 hover:border-sel"
    >
      <span className="flex flex-wrap justify-between gap-2">
        <span className="flex gap-1.5">
          <Tag>{kindOf(resource)}</Tag>
          <LevelTag level={resource.level} />
        </span>
        <span className="text-[11.5px] text-ink-3">
          {resource.licence} · {resource.display === "embed" ? "shown here" : "link"}
        </span>
      </span>
      <span className="text-[14px] font-semibold">{nameOf(resource)}</span>
      <span className="text-[12.5px] leading-[1.45] text-ink-2">{resource.covers}</span>
    </a>
  );
}

export function LearnIt({ resources }: { resources: ResourceOut[] }) {
  if (resources.length === 0) return null;
  const played = resources.flatMap((resource) => {
    const src =
      resource.display === "embed" && resource.video
        ? playerSrc(resource.video, resource.part)
        : null;
    return src === null ? [] : [{ resource, src }];
  });
  const linked = resources.filter((resource) => !played.some((one) => one.resource === resource));
  return (
    <section aria-labelledby="learn-it" className="flex flex-col gap-3">
      <h2
        id="learn-it"
        className="mt-2.5 scroll-mt-20 text-[23px] font-semibold tracking-[-0.01em]"
      >
        Learn it
      </h2>
      <p className="max-w-[52ch] text-[15px] leading-[1.65] text-ink-2">
        Read our explanation below, or watch first. Each outside resource was picked by a reviewer
        for the part of this page it covers.
      </p>
      {played.map(({ resource, src }) => (
        <Played key={resource.url} resource={resource} src={src} />
      ))}
      {linked.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {linked.map((resource) => (
            <Linked key={resource.url} resource={resource} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
