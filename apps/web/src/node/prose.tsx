// Markdown in the identity, shared by the body's text and its callouts (M3P5.5, M4.1.2).
//
// react-markdown renders to React elements and skips raw HTML, so nothing an author writes
// reaches the page as markup (invariant 6). The page's title is the only h1: a `#` in a body is
// drawn as a section heading.
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugOf } from "./body";

function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children !== null && typeof children === "object" && "props" in children) {
    return textOf((children.props as { children?: ReactNode }).children);
  }
  return "";
}

/** First steps numbers its sections, as its own board does: "1 · The instructions are inside". */
function section(big: boolean, count: { n: number }) {
  return function Section({ children }: { children?: ReactNode }) {
    count.n += 1;
    return (
      <h2
        id={slugOf(textOf(children))}
        className={`scroll-mt-20 font-semibold tracking-[-0.01em] text-ink ${
          big ? "mt-3 text-[30px]" : "mt-2.5 text-[23px]"
        }`}
      >
        {big ? `${count.n} · ` : ""}
        {children}
      </h2>
    );
  };
}

export const componentsFor = (big: boolean): Components => {
  const Section = section(big, { n: 0 });
  return {
    h1: ({ children }) => <Section>{children}</Section>,
    h2: ({ children }) => <Section>{children}</Section>,
    h3: ({ children }) => <h3 className="text-[18px] font-semibold text-ink">{children}</h3>,
    p: ({ children }) => (
      <p className={`leading-[1.65] text-ink-2 ${big ? "text-[20px]" : "text-[15px]"}`}>
        {children}
      </p>
    ),
    strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
    a: ({ href, children }) => {
      const outside = href?.startsWith("http") ?? false;
      return (
        <a
          href={href}
          className="text-sel hover:text-ink"
          {...(outside ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.65] text-ink-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[1.65] text-ink-2">
        {children}
      </ol>
    ),
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-[9px] border border-border bg-bg px-3.5 py-3 font-mono text-[13px] leading-[1.7] text-ink">
        {children}
      </pre>
    ),
    code: ({ children, className }) => (
      <code
        className={
          className === undefined
            ? "rounded-[5px] border border-border bg-surface px-1 py-px font-mono text-[0.9em] text-ink [pre_&]:border-0 [pre_&]:bg-transparent [pre_&]:p-0 [pre_&]:text-[1em]"
            : "font-mono"
        }
      >
        {children}
      </code>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-border-2 border-l-2 pl-4 text-ink-2">{children}</blockquote>
    ),
  };
};

export function Prose({ markdown, components }: { markdown: string; components: Components }) {
  return (
    <Markdown skipHtml remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </Markdown>
  );
}
