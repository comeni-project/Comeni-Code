// One draft for the workbench's tests (M4.8b): open, revision 3, one text block.
import type {
  DraftNodeOut,
  DraftOut,
  StudioExamQuestionOut,
  StudioFigureOut,
} from "../../api/schema";

export const NODE: DraftNodeOut = {
  title: "k-mers",
  claim: "A read's k-mers are its substrings of length k.",
  region: "algorithms",
  level: "introductory",
  minutes: 10,
  needs: [],
  goes_deeper: [],
  related: [],
  resources: [],
  exam: [],
  blocks: [{ kind: "text", markdown: "The trick is to stop treating reads as units." }],
  questions: [],
};

export const DRAFT: DraftOut = {
  public_id: "d-1",
  node_id: "k-mers",
  folder: "algorithms/k-mers",
  state: "open",
  base_digest: "",
  revision: 3,
  submitted_revision: null,
  contributors: [{ public_id: "u-1", email: "ada@example.org", name: "Ada", role: "author" }],
  node: NODE,
  problems: [],
};

/** An exam question as the API sends a draft's (M4Q.5), in either state: a number, or a choice
 * of three — one right, one naming a misconception, one plain. */
export const examQuestion = (
  id: string,
  state: "approved" | "draft",
  kind: "number" | "choice" = "number",
): StudioExamQuestionOut => ({
  id,
  kind,
  title: `Question ${id}`,
  claim: "",
  stem: [{ kind: "text", markdown: `What is ${id}?\n` }],
  stem_text: `What is ${id}?\n`,
  state,
  level: null,
  options:
    kind === "choice"
      ? [
          { text: "A bubble", right: true, misconception: "", plain: false },
          {
            text: "A tip",
            right: false,
            misconception: "confuses an end with a middle",
            plain: false,
          },
          { text: "A clean path", right: false, misconception: "", plain: true },
        ]
      : null,
  answer: kind === "number" ? 1 : null,
  unit: "",
  tolerance: null,
  accept: [],
  exact: false,
  steps: null,
  rationale: "Because.",
});

/** A flow figure as Studio sends a draft's (M6FG.5): read, with its file's text as written. */
export const FLOW_TEXT = `component: flow
alt: A flow. Reads become k-mers.
data:
  nodes:
    - {id: reads, label: reads}
    - {id: kmers, label: k-mers}
  edges:
    - {from: reads, to: kmers}
`;
export const FLOW: StudioFigureOut = {
  stem: "flow",
  component: "flow",
  alt: "A flow. Reads become k-mers.",
  data: {
    nodes: [
      { id: "reads", label: "reads" },
      { id: "kmers", label: "k-mers" },
    ],
    edges: [{ from: "reads", to: "kmers" }],
  },
  derived: {},
  source: null,
  text: FLOW_TEXT,
};
