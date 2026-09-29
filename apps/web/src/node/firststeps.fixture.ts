// DNA and genes as `GET /api/nodes/{id}` really answers it, captured from the fixtures' index:
//
//   uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon
//   curl -s "http://127.0.0.1:8090/api/nodes/dna-and-genes"
//
// The Salmon route's first stop, and a First steps node: a video to watch and one question.
import type { NodeOut } from "../api/schema";

export const DNA: NodeOut = {
  id: "dna-and-genes",
  title: "DNA and genes",
  claim:
    "DNA is a long molecule written in four letters, and a gene is a stretch of it that a cell reads to make something.",
  region: {
    id: "molecular-biology",
    name: "Molecular biology",
  },
  level: "first-steps",
  minutes: 10,
  body: "DNA is two strands of nucleotides, each carrying one of four bases — A, C, G and T. The strands\npair A with T and C with G, so either strand says what the other must be. What matters is the\norder of the letters: it is information, the way the order of letters in a sentence is.\n\n{% try base-pairing %}\n\nA gene is a region of DNA whose sequence a cell uses as instructions, most often to make a\nprotein. The human genome has about three billion letters and around 20,000 protein-coding genes.\n\nBecause DNA is text, much of bioinformatics is reading and comparing long strings of four letters.\nEvery later stop on the way to Salmon treats sequences that way.\n\n## Further reading\n\n- [DNA](https://en.wikipedia.org/wiki/DNA) — Wikipedia\n- [Gene](https://en.wikipedia.org/wiki/Gene) — Wikipedia\n",
  folder: "molecular-biology/dna-and-genes",
  needs: [],
  goes_deeper: [],
  related: [],
  needed_by: [
    {
      id: "gene-expression",
      title: "Gene expression",
      level: "first-steps",
      reason: "Expression is a gene being read, so it starts from what a gene is.",
      minutes: 10,
    },
    {
      id: "k-mers",
      title: "k-mers",
      level: "foundations",
      reason: "k-mers are words cut from DNA sequences.",
      minutes: 8,
    },
    {
      id: "sequence-alignment",
      title: "Sequence alignment and scores",
      level: "foundations",
      reason: "Alignment compares DNA sequences letter by letter.",
      minutes: 12,
    },
    {
      id: "short-read-sequencing",
      title: "Short-read sequencing",
      level: "first-steps",
      reason: "A sequencer reads DNA's letters, so it starts from what DNA is.",
      minutes: 10,
    },
  ],
  resources: [
    {
      kind: "video",
      provider: {
        id: "khan-academy",
        name: "Khan Academy",
      },
      url: "https://www.khanacademy.org/science/high-school-biology/hs-molecular-genetics/hs-discovery-and-structure-of-dna/v/dna-deoxyribonucleic-acid",
      video: "youtube:AmOO4j0E408",
      part: "0:00–13:01",
      covers: "What DNA is made of, and how its four bases pair along the two strands.",
      licence: "YouTube embed",
      display: "embed",
      level: "foundations",
    },
  ],
  questions: [
    {
      id: "base-pairing",
      kind: "choice",
      ask: "In DNA, which base pairs with A?",
      options: [
        {
          text: "T (thymine)",
          right: true,
        },
        {
          text: "C (cytosine)",
          right: false,
        },
        {
          text: "G (guanine)",
          right: false,
        },
        {
          text: "A (adenine)",
          right: false,
        },
      ],
      answer: null,
      unit: null,
      tolerance: null,
      hints: ["Each base has exactly one partner, and the first paragraph names both pairs."],
      rationale:
        "The strands pair A with T and C with G, so either strand says what the other must be.",
    },
  ],
};
