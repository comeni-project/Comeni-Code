// npm run api-types: regenerate src/api/schema.ts from apps/api/openapi.json (M0 part 7 spec, P7.2).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile, type JSONSchema } from "json-schema-to-typescript";

export const OPENAPI_JSON = fileURLToPath(new URL("../../api/openapi.json", import.meta.url));
export const API_TYPES = fileURLToPath(new URL("../src/api/schema.ts", import.meta.url));

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// Pydantic gives every property a title; json-schema-to-typescript would turn each into a type
// alias (DurationMs, Status1, …). Refs move from the OpenAPI location to $defs.
function prepare(value: Json): Json {
  if (Array.isArray(value)) return value.map(prepare);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "title")
      .map(([key, v]) => [
        key,
        key === "$ref" && typeof v === "string"
          ? v.replace("#/components/schemas/", "#/$defs/")
          : prepare(v),
      ]),
  );
}

export async function renderApiTypes(openapi: {
  components: { schemas: Record<string, Json> };
}): Promise<string> {
  const defs = prepare(openapi.components.schemas) as Record<string, Json>;
  const names = Object.keys(defs);
  const root = {
    type: "object",
    additionalProperties: false,
    required: names,
    properties: Object.fromEntries(names.map((name) => [name, { $ref: `#/$defs/${name}` }])),
    $defs: defs,
  } as JSONSchema;
  const body = await compile(root, "ApiSchemas", {
    bannerComment: "",
    additionalProperties: false,
    style: { printWidth: 100, trailingComma: "all" },
  });
  return `// Generated from apps/api/openapi.json by \`npm run api-types\`. Do not edit (M0 part 7 spec, P7.2).\n${body}`;
}

export const readOpenApi = () => JSON.parse(readFileSync(OPENAPI_JSON, "utf8"));

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(API_TYPES, await renderApiTypes(readOpenApi()));
  console.log("wrote src/api/schema.ts");
}
