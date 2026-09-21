// de Bruijn graphs as `GET /api/nodes/{id}` really answers it, captured from the fixtures' index:
//
//   uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon
//   curl -s "http://127.0.0.1:8090/api/nodes/de-bruijn-graphs"
//
// The node the L5 board draws, with an embedded video, two linked resources and two questions.
import type { NodeOut } from "../api/schema";

export const DE_BRUIJN: NodeOut = {
  id: "de-bruijn-graphs",
  title: "de Bruijn graphs",
  claim:
    "A de Bruijn graph has a node for each k-mer and an edge wherever one k-mer overlaps the next by all but one letter, so shared sequence is stored once.",
  region: {
    id: "algorithms",
    name: "Algorithms",
  },
  level: "intermediate",
  minutes: 15,
  body: "Take two transcripts and cut them into 4-mers:\n\n```text\nA  ACGTTGCA   ACGT CGTT GTTG TTGC TGCA\nB  ACGTTGAA   ACGT CGTT GTTG TTGA TGAA\n```\n\n{% try kmers-per-read %}\n\nMake each distinct 4-mer a node, and draw an edge from `ACGT` to `CGTT` because the last three\nletters of one are the first three of the other. A and B share the path\n`ACGT → CGTT → GTTG`, stored once, and then it branches.\n\nA stretch with no branches can be merged into one piece, a **unitig**: here `ACGTTG`, then `TTGCA`\nor `TTGAA`. That is a **compacted** de Bruijn graph. Recording which sequences each unitig came from\nmakes it **coloured**. Genome assemblers use these graphs to rebuild a genome from reads; the\ntextbook form for assembly puts (k − 1)-mers on the nodes and k-mers on the edges, which is the\nsame idea.\n\n{% try shared-unitig %}\n\n## Further reading\n\n- [How to apply de Bruijn graphs to genome assembly](https://doi.org/10.1038/nbt.2023) — Compeau, Pevzner and Tesler, 2011\n- [De Bruijn graph](https://en.wikipedia.org/wiki/De_Bruijn_graph) — Wikipedia\n",
  folder: "algorithms/de-bruijn-graphs",
  needs: [
    {
      id: "k-mers",
      title: "k-mers",
      level: "foundations",
      reason: "A de Bruijn graph is built from k-mers.",
      minutes: 8,
    },
    {
      id: "graphs",
      title: "Graphs",
      level: "foundations",
      reason: "A de Bruijn graph is a graph, with k-mers as its nodes.",
      minutes: 10,
    },
  ],
  goes_deeper: [],
  related: [],
  needed_by: [
    {
      id: "pufferfish-index",
      title: "The pufferfish index",
      level: "advanced",
      reason: "Pufferfish stores the transcriptome as a compacted, coloured de Bruijn graph.",
      minutes: 15,
    },
  ],
  resources: [
    {
      kind: "video",
      provider: {
        id: "khan-academy",
        name: "Khan Academy",
      },
      url: "https://www.khanacademy.org/science/ap-biology/gene-expression-and-regulation/biotechnology/v/dna-sequencing",
      video: "youtube:Jnk_4Maf5Fk",
      part: "",
      covers:
        "How a sequencer returns short overlapping pieces, which is what these graphs put back together.",
      licence: "YouTube embed",
      display: "embed",
      level: "foundations",
    },
    {
      kind: "reading",
      provider: {
        id: "openstax",
        name: "OpenStax",
      },
      url: "https://openstax.org/books/biology-2e/pages/17-3-whole-genome-sequencing",
      video: null,
      part: "§17.3",
      covers: "Why a genome is sequenced in fragments and has to be assembled afterwards.",
      licence: "CC BY 4.0",
      display: "link",
      level: "foundations",
    },
    {
      kind: "tutorial",
      provider: {
        id: "galaxy-training",
        name: "Galaxy Training",
      },
      url: "https://training.galaxyproject.org/training-material/topics/assembly/tutorials/debruijn-graph-assembly/tutorial.html",
      video: null,
      part: "",
      covers: "Building a de Bruijn graph from a handful of reads by hand, one k at a time.",
      licence: "CC BY 4.0",
      display: "link",
      level: "intermediate",
    },
  ],
  questions: [
    {
      id: "kmers-per-read",
      kind: "number",
      ask: "How many 4-mers does an 8-letter transcript contain?",
      options: null,
      answer: 5.0,
      unit: null,
      tolerance: null,
      hints: [
        "Slide a window of width k along the sequence and count the places where it still fits.",
        "The first row above lists them for transcript A.",
      ],
      rationale: "A sequence of length L has L − k + 1 k-mers, so 8 − 4 + 1 = 5.",
    },
    {
      id: "shared-unitig",
      kind: "choice",
      ask: "Which stretch can be merged into one unitig for both transcripts?",
      options: [
        {
          text: "ACGTTG",
          right: true,
        },
        {
          text: "TTGCA",
          right: false,
        },
        {
          text: "ACGTTGCA",
          right: false,
        },
      ],
      answer: null,
      unit: null,
      tolerance: null,
      hints: [
        "A unitig is a stretch with no branch in it.",
        "The two transcripts part company at the letter after the shared path.",
      ],
      rationale:
        "Both transcripts share ACGT → CGTT → GTTG, which merges to ACGTTG; after it one goes to TTGCA and the other to TTGAA.",
    },
  ],
};
