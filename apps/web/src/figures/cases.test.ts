// @vitest-environment node
// The shared cases, the schema alone: Python's tests/figures/test_cases.py runs the same file, so
// the browser and the API refuse the same data with the same codes (M6.4 spec, M6FG.2).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type Component, SCHEMAS } from "./schemas";
import { validate } from "./validate";

const CASES: { name: string; component: Component; data: unknown; codes: string[] }[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../../tests/fixtures/figures/cases.json", import.meta.url)),
    "utf8",
  ),
).cases;

describe("the shared cases", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_, c) => {
    const codes = validate(SCHEMAS[c.component], c.data).map((f) => f.code);
    expect([...new Set(codes)]).toEqual(c.codes);
  });

  it("names a path the way Python does", () => {
    const chart = CASES.find((c) => c.name === "a chart that links out");
    expect(validate(SCHEMAS.chart, chart?.data).map((f) => f.path)).toEqual(["data.encoding.href"]);
  });
});
