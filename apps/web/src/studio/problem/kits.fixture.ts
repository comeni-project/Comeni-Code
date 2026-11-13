// The two kits as GET /api/studio/problem-kits serves them (M6.8b spec, M6PB.4), for tests.
import type { ProblemKitOut } from "../../api/schema";

const READS = {
  k: { type: "integer", minimum: 3, maximum: 12 },
  read: { type: "integer", minimum: 4, maximum: 150 },
  coverage: { type: "integer", minimum: 1, maximum: 30 },
  errors: { type: "number", minimum: 0, maximum: 0.02 },
};

export const DE_BRUIJN_KIT: ProblemKitOut = {
  name: "de-bruijn-edges",
  rung: 3,
  about: "k and some reads; the learner returns every edge of their de Bruijn graph, once each.",
  params_schema: {
    type: "object",
    additionalProperties: false,
    properties: { ...READS, genome: { type: "integer", minimum: 7, maximum: 5000 } },
    required: ["k", "genome", "read", "coverage", "errors"],
  },
  mistakes: [
    { name: "duplicates", says: "an edge listed more than once" },
    { name: "missing", says: "edges left out" },
    { name: "extra", says: "an edge no read holds" },
    { name: "unsorted", says: "the right edges, out of order" },
    { name: "reversed", says: "B -> A for A -> B" },
  ],
  example: {
    params: { k: 4, genome: 300, read: 30, coverage: 8, errors: 0 },
    sample: { seed: 1, params: { k: 3, genome: 7, read: 5, coverage: 2, errors: 0 } },
  },
  sample_dataset: "3\nACGTT\nCGTTA\nGTTAG\n",
  sample_output: "ACG -> CGT\nCGT -> GTT\nGTT -> TTA\nTTA -> TAG\n",
};

export const COUNT_KIT: ProblemKitOut = {
  name: "count-kmers",
  rung: 1,
  about: "k and some reads; the learner returns how many distinct k-mers the reads hold.",
  params_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...READS,
      k: { type: "integer", minimum: 2, maximum: 12 },
      genome: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: { type: "integer", minimum: 7, maximum: 5000 },
      },
    },
    required: ["k", "genome", "read", "coverage", "errors"],
  },
  mistakes: [
    { name: "counted-all", says: "every read's k-mers summed, not the distinct ones" },
    { name: "off-by-one", says: "L - k k-mers in a read of length L, not L - k + 1" },
  ],
  example: {
    params: { k: 8, genome: [300, 400], read: 30, coverage: 8, errors: 0 },
    sample: { seed: 1, params: { k: 3, genome: [7, 9], read: 5, coverage: 2, errors: 0 } },
  },
  sample_dataset: "3\nACGTT\n",
  sample_output: "5",
};

export const KITS = [DE_BRUIJN_KIT, COUNT_KIT];

export const PROBLEM_TEXT = `title: Construct a de Bruijn graph
rung: 3
# the words a learner reads
statement: |
  Given a set of reads and an integer k, return the edges.
given: k on the first line, then the reads, one per line
return: edges as "A -> B", one per line, sorted, no duplicates
kit: de-bruijn-edges
params: {k: 4, genome: 300, read: 30, coverage: 8, errors: 0}
sample: {seed: 1, params: {k: 3, genome: 7, read: 5, coverage: 2, errors: 0}}
hints:
  - The same k-mer can come from many reads.
mistakes:
  duplicates: Every edge appears once
rationale: Each read adds the edges between its consecutive k-mers.
`;
