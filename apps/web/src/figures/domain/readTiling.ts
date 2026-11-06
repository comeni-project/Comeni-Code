// `read-tiling`: the twin of code_figures/read_tiling.py (M6.6a spec, M6DC.1).
import type { Finding } from "../validate";
import { type Data, lettersFindings, sequences } from "./kmers";

const PLACE = "CS1012";

function startsOf(genome: string, read: string): number[] {
  const starts: number[] = [];
  for (let at = genome.indexOf(read); at !== -1; at = genome.indexOf(read, at + 1))
    starts.push(at + 1);
  return starts;
}

export function check(data: Data): Finding[] {
  const genome = String(data.genome);
  const reads = sequences(data);
  const found = [
    ...lettersFindings(genome, "data.genome"),
    ...reads.flatMap((read, at) => lettersFindings(read, `data.reads[${at}].sequence`)),
  ];
  if (found.length > 0) return found;
  reads.forEach((read, at) => {
    const starts = startsOf(genome, read);
    const where = `data.reads[${at}].sequence`;
    if (starts.length === 0)
      found.push({ code: PLACE, path: where, message: "is not in the genome" });
    else if (starts.length > 1) {
      const places = `${starts.slice(0, -1).join(", ")} and ${starts.at(-1)}`;
      found.push({ code: PLACE, path: where, message: `is in the genome twice, at ${places}` });
    }
  });
  return found;
}

export function derive(data: Data): Record<string, unknown> {
  const genome = String(data.genome);
  const reads = sequences(data);
  const starts = reads.map((read) => startsOf(genome, read)[0] as number);
  const order = reads
    .map((_, at) => at)
    .sort((a, b) => (starts[a] as number) - (starts[b] as number) || a - b);
  const ends: number[] = [];
  const lanes = reads.map(() => 0);
  for (const at of order) {
    const start = starts[at] as number;
    const end = start + (reads[at] as string).length - 1;
    let lane = ends.findIndex((last) => last < start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(end);
    } else ends[lane] = end;
    lanes[at] = lane;
  }
  return { starts, lanes };
}
