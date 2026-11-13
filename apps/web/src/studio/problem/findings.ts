// What the browser can check of a problem as it is typed (M6.8b spec, M6PB.3), each finding under
// the field the server would name (M6PB.5): params and the sample's against the kit's schema, the
// words, one to three hints, and each mapping to a mistake the kit declares and a callout the body
// has. A kit's cross-param rules and the 20-seed self-test are the server's.
import type { ProblemKitOut } from "../../api/schema";
import { type Finding, validate } from "../../figures/validate";

const TEXTS = ["title", "statement", "given", "return", "rationale"] as const;

export function problemFindings(
  file: Record<string, unknown>,
  kit: ProblemKitOut,
  callouts: readonly string[],
): Finding[] {
  const found: Finding[] = [];
  const recode = (list: Finding[]) => list.map((f) => ({ ...f, code: "CS1101" }));
  found.push(...recode(validate(kit.params_schema, file.params, "params")));
  const sample = file.sample as { params?: unknown } | undefined;
  found.push(...recode(validate(kit.params_schema, sample?.params, "sample.params")));
  for (const key of TEXTS) {
    const value = file[key];
    if (typeof value !== "string" || value.trim() === "") {
      found.push({
        code: "CS1107",
        path: key,
        message: `${key === "return" ? "Return" : key} is needed`,
      });
    }
  }
  const hints = Array.isArray(file.hints) ? file.hints : [];
  if (hints.length < 1 || hints.length > 3 || hints.some((h) => String(h).trim() === "")) {
    found.push({ code: "CS1107", path: "hints", message: "one to three hints, none empty" });
  }
  const declared = kit.mistakes.map((m) => m.name);
  const mistakes = (file.mistakes ?? {}) as Record<string, string>;
  for (const [name, title] of Object.entries(mistakes)) {
    if (!declared.includes(name)) {
      found.push({
        code: "CS1110",
        path: `mistakes.${name}`,
        message: `${kit.name} names no mistake ${name}`,
      });
    } else if (!callouts.includes(title)) {
      found.push({
        code: "CS1110",
        path: `mistakes.${name}`,
        message: `no misconception callout in the body is titled ${title}`,
      });
    }
  }
  return found;
}
