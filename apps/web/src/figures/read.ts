// A figure file read as the server reads it: the twin of read_figure in code_schema/figures.py
// (M6.4 spec, M6FG.1; M6.5 spec, M6CO.5), in the same order and with the same codes, held to the
// `files` of tests/fixtures/figures/cases.json by both suites. The composer runs it on every
// change, so Save waits until the server would take the file.
import { openFile, type Path, pathText } from "../yaml/document";
import { figureFindings } from "./kits";
import { CHARACTERS, type Component, TWO_READINGS } from "./schemas";
import type { Finding } from "./validate";

export interface FigureFile {
  component: Component;
  alt: string;
  data: Record<string, unknown>;
  source: { title: string; url: string | null } | null;
  /** What a learner does with it, when it asks a question (M6.6b spec, M6FA.1). */
  interact: Record<string, unknown> | null;
}

const MAX_BYTES = 64 * 1024;
const MAX_ALT = 300;
const MAX_TITLE = 160;
const KEYS = ["component", "alt", "data", "source", "interact"];
const SOURCE_KEYS = ["title", "url"];
const ODD = new RegExp(CHARACTERS.pattern);
const FORMS = TWO_READINGS.map((form) => ({ name: form.name, pattern: new RegExp(form.pattern) }));

const characters = (text: string) => [...text].length;
const isMapping = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function source(value: unknown): [FigureFile["source"], string | null] {
  if (!isMapping(value)) return [null, "source is a mapping: title, and a url if there is one"];
  const unknown = Object.keys(value).filter((key) => !SOURCE_KEYS.includes(key));
  if (unknown.length > 0) return [null, `source has an unknown key \`${unknown[0]}\` (title, url)`];
  const { title, url } = value;
  if (typeof title !== "string" || title.trim() === "" || characters(title) > MAX_TITLE) {
    return [null, `source needs a title, one line of at most ${MAX_TITLE} characters`];
  }
  if (
    url !== undefined &&
    url !== null &&
    (typeof url !== "string" || !url.startsWith("https://") || url.includes(" "))
  ) {
    return [null, "source's url is an https:// link"];
  }
  return [{ title, url: typeof url === "string" ? url : null }, null];
}

/** Where the file reads two ways, as the server says it: each a message with its path. */
function twoReadings(plain: { path: Path; text: string }[], twice: Path[]): Finding[] {
  const found: Finding[] = [];
  for (const { path, text } of plain) {
    const form = FORMS.find((f) => f.pattern.test(text));
    if (form !== undefined) {
      const where = pathText(path);
      found.push({
        code: "CS1023",
        path: where,
        message: `\`${text}\` reads two ways (${form.name}); quote it`,
      });
    }
  }
  for (const path of twice) {
    found.push({ code: "CS1023", path: pathText(path), message: "is written twice" });
  }
  return found;
}

export function readFigure(text: string): { figure: FigureFile | null; problems: Finding[] } {
  const refused = (problems: Finding[]) => ({ figure: null, problems });
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_BYTES) {
    const size = Math.floor(bytes / 1024);
    return refused([
      { code: "CS1027", path: "", message: `is ${size} KB; a figure is at most 64 KB` },
    ]);
  }
  const odd = ODD.exec(text);
  if (odd !== null) {
    const line = text.slice(0, odd.index).split("\n").length;
    const message = `line ${line}: holds ${CHARACTERS.name}; write it as an escape in double quotes`;
    return refused([{ code: "CS1023", path: "", message }]);
  }
  const fd = openFile(text);
  if (fd.errors.length > 0) {
    return refused(
      fd.errors.map((error) => ({
        code: "CS1023",
        path: "",
        message: `is not valid YAML (${error.message})`,
      })),
    );
  }
  if (fd.aliased) {
    const message = "is not valid YAML (uses a YAML alias; write the data out in full)";
    return refused([{ code: "CS1023", path: "", message }]);
  }
  if (fd.tagged !== null) {
    const message = `is not valid YAML (uses an explicit YAML tag (${fd.tagged}); write the value plainly)`;
    return refused([{ code: "CS1023", path: "", message }]);
  }
  const readings = twoReadings(fd.plain, fd.twice);
  if (readings.length > 0) return refused(readings);
  const written: unknown = fd.doc.toJS();
  if (!isMapping(written)) {
    return refused([
      { code: "CS1023", path: "", message: "must be a mapping: component, alt, data" },
    ]);
  }
  const problems: Finding[] = Object.keys(written)
    .filter((key) => !KEYS.includes(key))
    .map((key) => ({
      code: "CS1025",
      path: key,
      message: `unknown key \`${key}\` in a figure (${KEYS.join(", ")})`,
    }));
  const alt = written.alt;
  if (typeof alt !== "string" || alt.trim() === "") {
    problems.push({
      code: "CS1024",
      path: "alt",
      message: "has no alt text: the type, what it shows, the takeaway",
    });
  } else if (characters(alt) > MAX_ALT) {
    problems.push({
      code: "CS1024",
      path: "alt",
      message: `has alt text longer than ${MAX_ALT} characters`,
    });
  }
  let credit: FigureFile["source"] = null;
  if (Object.hasOwn(written, "source")) {
    const [read, wrong] = source(written.source);
    if (wrong !== null) problems.push({ code: "CS1026", path: "source", message: wrong });
    credit = read;
  }
  const component = written.component;
  if (typeof component !== "string") {
    problems.push({ code: "CS1001", path: "component", message: "names no component" });
  } else {
    problems.push(...figureFindings(component, written.data, written.interact));
  }
  if (problems.length > 0) return refused(problems);
  return {
    figure: {
      component: component as Component,
      alt: alt as string,
      data: written.data as Record<string, unknown>,
      source: credit,
      interact: (written.interact ?? null) as Record<string, unknown> | null,
    },
    problems: [],
  };
}
