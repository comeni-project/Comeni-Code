// @vitest-environment node
// The committed figure schemas and types are exactly what code-figures' schemas generate
// (M6.4 spec, M6FG.2).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIGURE_TYPES,
  readSchemas,
  renderFigureTypes,
} from "../../scripts/generate-figure-types.ts";

describe("src/figures/schemas.ts", () => {
  it("matches packages/code-figures' schemas", async () => {
    expect(
      readFileSync(FIGURE_TYPES, "utf8"),
      "src/figures/schemas.ts is stale: run npm run figure-types",
    ).toBe(await renderFigureTypes(readSchemas()));
  });
});
