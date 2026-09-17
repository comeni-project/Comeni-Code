// npm run tokens: regenerate src/styles/tokens.css from .design/tokens.json (M0 part 6 spec, P6.2).
import { readFileSync, writeFileSync } from "node:fs";
import { renderTokensCss, type Tokens } from "../src/styles/renderTokens.ts";

export const TOKENS_JSON = new URL("../../../.design/tokens.json", import.meta.url);
export const TOKENS_CSS = new URL("../src/styles/tokens.css", import.meta.url);

export const readTokens = (): Tokens => JSON.parse(readFileSync(TOKENS_JSON, "utf8")) as Tokens;

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(TOKENS_CSS, renderTokensCss(readTokens()));
  console.log("wrote src/styles/tokens.css");
}
