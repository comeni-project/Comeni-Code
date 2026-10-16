// A formula drawn by KaTeX (M6.2 spec, M6MX.3): untrusted, so no links, images or markup; each with
// its own empty macros, so no formula changes another; and caught, so a formula KaTeX cannot read
// (a parse error or an unknown command) never breaks the page. Learners see such a formula as its source, plainly; Studio's
// preview marks it in the colour Studio gives a problem, with KaTeX's message.
import katex from "katex";
import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";

/** True inside Studio's preview: formulas KaTeX cannot read are marked there. */
export const InStudio = createContext(false);

/** KaTeX's markup, or why it cannot draw the formula: a parse error or an unknown command. */
function drawnOrError(tex: string, display: boolean): { html: string; error: string | null } {
  try {
    const options = {
      displayMode: display,
      // An untrusted command (\href, \url, \html…) throws rather than drawing in KaTeX's red,
      // so it takes the plain-source path below (#346).
      trust: () => {
        throw new Error("This command is not allowed in a formula.");
      },
      throwOnError: true,
      errorColor: "currentColor",
      maxSize: 20, // em: no formula outgrows the page (#346)
      macros: {},
    };
    return { html: katex.renderToString(tex, options), error: null };
  } catch (error) {
    return { html: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export function Formula({ tex, display }: { tex: string; display: boolean }) {
  const studio = useContext(InStudio);
  const source = tex.trim();
  const { html, error } = useMemo(() => drawnOrError(source, display), [source, display]);
  const drawn = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // KaTeX's own markup, from TeX it was told not to trust: no author markup reaches the page.
    if (drawn.current !== null) drawn.current.innerHTML = html;
  }, [html]);
  if (error !== null) {
    const marked = studio ? "text-open" : "text-ink-2";
    const shown = studio ? { title: error } : {};
    return display ? (
      <pre className={`overflow-x-auto font-mono text-[13px] ${marked}`} {...shown}>
        {source}
      </pre>
    ) : (
      <code className={`font-mono text-[0.9em] ${marked}`} {...shown}>
        {source}
      </code>
    );
  }
  return display ? (
    <div ref={drawn as React.RefObject<HTMLDivElement>} className="overflow-x-auto py-1 text-ink" />
  ) : (
    <span ref={drawn as React.RefObject<HTMLSpanElement>} />
  );
}
