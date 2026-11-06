// `kmer-window`: the twin of code_figures/kmer_window.py (M6.6a spec, M6DC.1).
import type { Finding } from "../validate";
import { type Data, kmersOf, lettersFindings, SHORT } from "./kmers";

export function check(data: Data): Finding[] {
  const read = String(data.read);
  const found = lettersFindings(read, "data.read");
  if (found.length > 0) return found;
  const [low, high] = data.range as [number, number];
  if (low > high) return [{ code: "CS1003", path: "data.range", message: "starts after it ends" }];
  if (high >= read.length) {
    return [
      {
        code: SHORT,
        path: "data.range",
        message: `reaches ${high}; k must stay shorter than the read`,
      },
    ];
  }
  const k = data.k;
  if (typeof k !== "number" || k < low || k > high) {
    return [{ code: "CS1003", path: "data.k", message: `is outside its range, ${low} to ${high}` }];
  }
  return [];
}

export function derive(data: Data): Record<string, unknown> {
  const read = String(data.read);
  const [low, high] = data.range as [number, number];
  const byK: Record<string, unknown> = {};
  for (let k = low; k <= high; k++) {
    const windows = kmersOf(read, k).map((kmer, at) => [at + 1, kmer]);
    byK[String(k)] = { windows, count: windows.length };
  }
  return { by_k: byK };
}
