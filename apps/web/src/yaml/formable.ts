// Whether a file reads one way and can be edited in place (M6.5 spec, M6CO.3; M6.8b spec, M6PB.2):
// it parses, holds no alias, reads one way on the server too, and its untouched lines would be
// written back as they are. Every form over a content file asks this first.
import { TWO_READINGS } from "../figures/schemas";
import { linesKept, type YamlDocument } from "./document";

const FORMS = TWO_READINGS.map((form) => new RegExp(form.pattern));
export const AS_YAML = "edit it as YAML.";

export function readsOneWay(fd: YamlDocument): string | null {
  const error = fd.errors[0];
  if (error !== undefined)
    return `It does not parse as YAML: ${error.message} (line ${error.line}).`;
  if (fd.aliased) return `It uses a YAML alias: write the data out in full, as YAML.`;
  if (fd.twice.length > 0 || fd.plain.some((p) => FORMS.some((form) => form.test(p.text)))) {
    return "It reads two ways: quote the values Checks names.";
  }
  if (!linesKept(fd)) return `The form would lay this file out anew: ${AS_YAML}`;
  return null;
}
