// A figure on the page (M6.4 spec, M6FG.6): a library component drawn from its data, then its
// number, its caption and, when its data came from elsewhere, where from. The data is checked in
// the browser against the schema the API checked it with (M6FG.4); a figure that fails is never
// half-drawn, and its alt text stands in.
import type { ComponentType } from "react";
import type { Components } from "react-markdown";
import type { FigureOut } from "../api/schema";
import { componentsFor, Prose } from "../node/prose";
import { type KitProps, RENDERERS } from "./registry";
import { type Component, SCHEMAS } from "./schemas";
import { validate } from "./validate";

const LINK = "text-sel hover:text-ink";

const isComponent = (name: string): name is Component => Object.hasOwn(SCHEMAS, name);

/** Whether a record can be drawn: a known component whose data its schema accepts. */
export function drawable(
  record: FigureOut | undefined,
): record is FigureOut & { component: Component } {
  return (
    record !== undefined &&
    isComponent(record.component) &&
    validate(SCHEMAS[record.component], record.data).length === 0
  );
}

function Fallback({ alt }: { alt: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-dashed border-border-2 bg-surface px-5 py-4">
      <span className="text-[13.5px] font-semibold">This figure could not be drawn.</span>
      <span className="text-[13.5px] leading-[1.55] text-ink-2">{alt}</span>
    </div>
  );
}

export function Figure({
  record,
  caption,
  number,
  stem,
  components = componentsFor(false),
}: {
  record: FigureOut | undefined;
  caption: string;
  number: number | null;
  stem?: string;
  components?: Components;
}) {
  let body = <Fallback alt={record?.alt || stem || "A figure."} />;
  if (drawable(record)) {
    const Kit = RENDERERS[record.component] as ComponentType<KitProps<Component>>;
    const framed = record.component !== "table";
    body = (
      <div
        className={
          framed
            ? "rounded-xl border border-border bg-canvas px-4 py-3"
            : "overflow-x-auto rounded-xl border border-border bg-surface"
        }
      >
        <Kit data={record.data as never} derived={record.derived} alt={record.alt} />
      </div>
    );
  }
  const source = record?.source;
  const captioned = number !== null || caption.trim() !== "" || Boolean(source);
  return (
    <figure className="m-0 flex flex-col gap-2" data-block="figure">
      {body}
      {captioned && (
        <figcaption className="flex flex-col gap-1 text-[13px] leading-[1.5] text-ink-2">
          <div className="flex gap-1 [&_p]:text-[13px] [&_p]:text-ink-2">
            {number !== null && (
              <b className="flex-none font-semibold text-ink">{`Figure ${number}.`}</b>
            )}
            <div className="min-w-0">
              <Prose markdown={caption} components={components} />
            </div>
          </div>
          {source && (
            <span className="text-[12.5px] text-ink-3">
              {"Data: "}
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
