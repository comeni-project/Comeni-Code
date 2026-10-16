// The app finds the formulas code-schema checks (M6.2 spec, M6MX.1; #345): every case in the
// shared table, drawn through the page's own prose, hands KaTeX exactly the formulas listed.
// pytest reads the same file (tests/schema/test_math.py).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import type { Components } from "react-markdown";
import { describe, expect, it } from "vitest";
import { componentsFor, Prose } from "./prose";

const table = JSON.parse(
  // Tests run from apps/web; the table sits with the repository's fixtures.
  readFileSync(resolve(process.cwd(), "../../tests/fixtures/math-cases.json"), "utf8"),
) as { cases: { markdown: string; formulas: string[] }[] };

function formulasOf(markdown: string): string[] {
  const found: string[] = [];
  const page = componentsFor(false);
  const components: Components = {
    ...page,
    code: (props) => {
      if (props.className?.includes("language-math")) found.push(String(props.children));
      return page.code ? (page.code as (p: typeof props) => React.ReactNode)(props) : null;
    },
  };
  render(<Prose markdown={markdown} components={components} />);
  return found;
}

describe("formulas in prose", () => {
  it.each(table.cases.map((c) => [JSON.stringify(c.markdown).slice(0, 40), c] as const))(
    "%s",
    (_, c) => {
      expect(formulasOf(c.markdown)).toEqual(c.formulas);
    },
  );
});
