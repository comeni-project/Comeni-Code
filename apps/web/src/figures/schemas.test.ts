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
import { CHARACTERS, TWO_READINGS } from "./schemas";

describe("src/figures/schemas.ts", () => {
  it("matches packages/code-figures' schemas", async () => {
    expect(
      readFileSync(FIGURE_TYPES, "utf8"),
      "src/figures/schemas.ts is stale: run npm run figure-types",
    ).toBe(await renderFigureTypes(readSchemas()));
  });

  it("carries the forms code-figures reads two ways (M6.5 spec, M6CO.3)", () => {
    const readings = JSON.parse(
      readFileSync(
        new URL(
          "../../../../packages/code-figures/src/code_figures/readings.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(TWO_READINGS).toEqual(readings.forms);
    expect(CHARACTERS).toEqual(readings.characters);
  });
});
