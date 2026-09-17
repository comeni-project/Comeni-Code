// @vitest-environment node
// The committed API types are exactly what openapi.json generates (M0 part 7 spec, P7.4).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_TYPES, readOpenApi, renderApiTypes } from "../../scripts/generate-api-types.ts";

describe("src/api/schema.ts", () => {
  it("matches apps/api/openapi.json", async () => {
    expect(
      readFileSync(API_TYPES, "utf8"),
      "src/api/schema.ts is stale: run npm run api-types",
    ).toBe(await renderApiTypes(readOpenApi()));
  });
});
