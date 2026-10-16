// An image's licence, in code-schema's canonical form, and its deed (M6.3 spec, M6IM.2): the same
// mapping as code_schema.images.deed_url.
export function deedOf(licence: string): string | null {
  if (licence === "CC0 1.0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (licence === "Public domain") return "https://creativecommons.org/publicdomain/mark/1.0/";
  const [cc, kind, version, port] = licence.split(" ");
  if (cc !== "CC" || kind === undefined || version === undefined) return null;
  const ported = port === undefined ? "" : `${port}/`;
  return `https://creativecommons.org/licenses/${kind.toLowerCase()}/${version}/${ported}`;
}

/** Where an image came from, said as a reader knows it. */
export function siteOf(source: string): string {
  try {
    const host = new URL(source).hostname;
    return host.endsWith("wikimedia.org") ? "Wikimedia Commons" : host.replace(/^www\./, "");
  } catch {
    return source;
  }
}
