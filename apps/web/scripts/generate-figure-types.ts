// npm run figure-types: regenerate src/figures/schemas.ts from code-figures' schemas (M6.4 spec,
// M6FG.2). The schemas are the one statement of what a figure's data may hold: the browser checks
// a figure against the same documents the API did, and its types come from them.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile, type JSONSchema } from "json-schema-to-typescript";

export const SCHEMA_FOLDER = fileURLToPath(
  new URL("../../../packages/code-figures/src/code_figures/schemas/", import.meta.url),
);
export const FIGURE_TYPES = fileURLToPath(new URL("../src/figures/schemas.ts", import.meta.url));

const typeName = (component: string) =>
  `${component
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("")}Data`;

export function readSchemas(): Record<string, JSONSchema> {
  const names = readdirSync(SCHEMA_FOLDER)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return Object.fromEntries(
    names.map((name) => [
      name.replace(/\.json$/, ""),
      JSON.parse(readFileSync(`${SCHEMA_FOLDER}${name}`, "utf8")),
    ]),
  );
}

export async function renderFigureTypes(schemas: Record<string, JSONSchema>): Promise<string> {
  const types: string[] = [];
  for (const [component, schema] of Object.entries(schemas)) {
    const { $comment: _comment, ...plain } = schema as JSONSchema & { $comment?: string };
    types.push(
      await compile(plain as JSONSchema, typeName(component), {
        bannerComment: "",
        additionalProperties: false,
        // A bound is checked by the schema; as a type it is just a list (no tuple per length).
        maxItems: -1,
        style: { printWidth: 100, trailingComma: "all" },
      }),
    );
  }
  const map = Object.keys(schemas)
    .map((component) => `  "${component}": ${typeName(component)};`)
    .join("\n");
  return [
    "// Generated from packages/code-figures/src/code_figures/schemas/ by `npm run figure-types`.",
    "// Do not edit (M6.4 spec, M6FG.2).",
    `export const SCHEMAS = ${JSON.stringify(schemas, null, 2)} as const;`,
    "",
    "export type Component = keyof typeof SCHEMAS;",
    "",
    `export interface FigureData {\n${map}\n}`,
    "",
    ...types,
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(FIGURE_TYPES, await renderFigureTypes(readSchemas()));
  console.log("wrote src/figures/schemas.ts");
}
