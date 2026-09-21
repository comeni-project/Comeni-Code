// A node's body in the identity, with its try questions where the author put them (M3P5.5).
//
// react-markdown renders to React elements and skips raw HTML, so nothing an author writes
// reaches the page as markup (invariant 6). The page's title is the only h1: a `#` in a body is
// drawn as a section heading.
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { QuestionOut } from "../api/schema";
import { slugOf, splitBody } from "./body";
import { TryQuestion } from "./TryQuestion";

function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children !== null && typeof children === "object" && "props" in children) {
    return textOf((children.props as { children?: ReactNode }).children);
  }
  return "";
}

function Section({ children }: { children?: ReactNode }) {
  return (
    <h2
      id={slugOf(textOf(children))}
      className="mt-2.5 scroll-mt-20 text-[23px] font-semibold tracking-[-0.01em] text-ink"
    >
      {children}
    </h2>
  );
}

const COMPONENTS: Components = {
  h1: ({ children }) => <Section>{children}</Section>,
  h2: ({ children }) => <Section>{children}</Section>,
  h3: ({ children }) => <h3 className="text-[18px] font-semibold text-ink">{children}</h3>,
  p: ({ children }) => (
    <p className="max-w-[66ch] text-[15px] leading-[1.65] text-ink-2">{children}</p>
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
    <ul className="flex max-w-[66ch] list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.6] text-ink-2">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="flex max-w-[66ch] list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-[1.6] text-ink-2">
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

export function Body({ body, questions }: { body: string; questions: QuestionOut[] }) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  let asked = 0;
  return (
    <>
      {splitBody(body).map((piece, index) => {
        if (piece.kind === "text") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: pieces have no identity beyond their place
            <Markdown key={index} skipHtml remarkPlugins={[remarkGfm]} components={COMPONENTS}>
              {piece.markdown}
            </Markdown>
          );
        }
        const question = byId.get(piece.id);
        if (question === undefined) return null;
        asked += 1;
        return <TryQuestion key={question.id} question={question} number={asked} />;
      })}
    </>
  );
}
