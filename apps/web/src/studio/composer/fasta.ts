// A track's sequence pasted as FASTA (M6CO.4): the header line dropped, the lines joined.
export function fastaLetters(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(">"))
    .join("")
    .replace(/\s+/g, "");
}
