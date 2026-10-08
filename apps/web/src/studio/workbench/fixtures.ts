// One draft for the workbench's tests (M4.8b): open, revision 3, one text block.
import type { DraftNodeOut, DraftOut } from "../../api/schema";

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
