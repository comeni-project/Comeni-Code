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

describe("the generator", () => {
  // A property named `title` is a field, not the schema keyword Pydantic adds everywhere.
  // Stripping both lost NodeOut.title, StopOut.title and ResultOut.title until M3 part 3.
  it("keeps a property called title", async () => {
    const rendered = await renderApiTypes({
      components: {
        schemas: {
          StopOut: {
            type: "object",
            title: "StopOut",
            required: ["id", "title"],
            properties: {
              id: { type: "string", title: "Id" },
              title: { type: "string", title: "Title" },
            },
          },
        },
      },
    });
    expect(rendered).toContain("title: string;");
  });
});
