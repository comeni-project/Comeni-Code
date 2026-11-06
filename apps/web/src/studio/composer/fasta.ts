// FASTA pasted into the composer (M6CO.4, M6DC.5): into a letters field (a track's sequence, a
// genome, a read), its letters, headers dropped and lines joined; into a sheet whose column is
// marked `format: dna`, its records, a row each.

export function fastaLetters(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(">"))
    .join("")
    .replace(/\s+/g, "");
}

export interface FastaRecord {
  header: string;
  letters: string;
}

/** Whether pasted text is FASTA records rather than spreadsheet rows. */
export const isFasta = (text: string) => text.trimStart().startsWith(">");

/** Each record: its header line without the `>`, and its lines joined. */
export function parseFasta(text: string): FastaRecord[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/^>/m)
    .slice(1)
    .map((chunk) => {
      const [header = "", ...lines] = chunk.split("\n");
      return { header: header.trim(), letters: lines.join("").replace(/\s+/g, "") };
    });
}
