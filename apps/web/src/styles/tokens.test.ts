// @vitest-environment node
// The committed tokens.css is exactly what .design/tokens.json generates; Tailwind resolves it
// (M0 part 6 spec, P6.4).
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";
import { readTokens, TOKENS_CSS } from "../../scripts/generate-tokens.ts";
import { renderTokensCss, type Tokens, validate } from "./renderTokens.ts";

describe("tokens.css", () => {
  it("matches .design/tokens.json", () => {
    const committed = readFileSync(TOKENS_CSS, "utf8");
    expect(committed, "src/styles/tokens.css is stale: run npm run tokens").toBe(
      renderTokensCss(readTokens()),
    );
  });

  it("refuses a token missing from one theme", () => {
    const tokens = readTokens();
    const { exon: _dropped, ...dark } = tokens.dark;
    expect(() => validate({ ...tokens, dark })).toThrow("only light: exon");
  });

  it("refuses a value that is not a colour", () => {
    const tokens = readTokens();
    const broken: Tokens = { ...tokens, light: { ...tokens.light, ink: "black" } };
    expect(() => validate(broken)).toThrow("light.ink is not a #RRGGBB or rgba() colour: black");
  });
});

describe("the Tailwind theme", () => {
  const base = dirname(fileURLToPath(import.meta.url));
  const build = async (candidates: string[]) => {
    const css = `@import "tailwindcss";\n${readFileSync(TOKENS_CSS, "utf8")}`;
    const compiler = await compile(css, { base, onDependency: () => {} });
    return compiler.build(candidates);
  };

  it("resolves our classes to the runtime variables", async () => {
    const css = await build([
      "bg-surface",
      "text-ink-2",
      "border-border-2",
      "shadow-float",
      "rounded-panel",
      "font-mono",
    ]);
    expect(css).toContain("background-color: var(--surface)");
    expect(css).toContain("color: var(--ink-2)");
    expect(css).toContain("border-color: var(--border-2)");
    expect(css).toMatch(/--tw-shadow: var\(--float\)|box-shadow:[^;]*var\(--float\)/);
    expect(css).toContain("border-radius: 14px");
    expect(css).toContain('"Geist Mono Variable"');
  });

  it("has no colours outside the law", async () => {
    const css = await build(["bg-red-500", "text-blue-600"]);
    expect(css).not.toContain("bg-red-500");
    expect(css).not.toContain("text-blue-600");
  });
});
