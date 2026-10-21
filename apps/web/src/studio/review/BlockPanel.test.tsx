import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioFigureOut } from "../../api/schema";
import { QUEUE, REVIEW, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const openBlock = async (label: RegExp) =>
  userEvent.click(await screen.findByRole("button", { name: label }));

describe("ReviewPage — the open block", () => {
  it("draws a callout as a learner reads it", async () => {
    renderReview();
    await openBlock(/^TPM is not a count of reads/);
    expect(await screen.findByText("Equal reads, unequal TPM.")).toBeInTheDocument();
    expect(screen.getByText("Judge’s score · arrives with M5")).toBeInTheDocument();
  });

  it("shows a changed text block's words, gone and new", async () => {
    renderReview();
    await openBlock(/^A long transcript gives more fragments/);
    await userEvent.click(await screen.findByRole("tab", { name: "Changes" }));
    expect(screen.getByText("reads.", { selector: "del", exact: false })).toBeInTheDocument();
    expect(screen.getByText("fragments.", { selector: "ins", exact: false })).toBeInTheDocument();
  });

  it("marks gone and new words without spending a colour (#298, invariant 11)", async () => {
    renderReview();
    await openBlock(/^A long transcript gives more fragments/);
    await userEvent.click(await screen.findByRole("tab", { name: "Changes" }));
    const gone = screen.getByText("reads.", { selector: "del", exact: false });
    const added = screen.getByText("fragments.", { selector: "ins", exact: false });
    for (const mark of [gone, added]) expect(mark.className).not.toMatch(/open|btn|line-soft/);
  });

  it("says a block is unchanged since it landed", async () => {
    renderReview();
    await openBlock(/^TPM is not a count of reads/);
    await userEvent.click(await screen.findByRole("tab", { name: "Changes" }));
    expect(screen.getByText("Unchanged since it landed.")).toBeInTheDocument();
  });

  it("asks a question before it shows the key, then shows it", async () => {
    const graded = {
      ...(REVIEW.items[3]?.question as object),
      given: 1,
      right: false,
      right_option: 0,
      rationale: "TPM is a share of molecules.",
    };
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/answers/tpm-or-count": { body: graded },
    });
    await openBlock(/^What does TPM tell you\?/);
    expect(screen.queryByText("TPM is a share of molecules.")).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: /A count of reads/ }));
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(await screen.findByText("TPM is a share of molecules.")).toBeInTheDocument();
    expect(screen.getByText(/Your answer: B · wrong/)).toBeInTheDocument();
    const sent = fake.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ given: 1 });
  });
});

const TABLE_TEXT = `component: table
alt: Two transcripts, their lengths and reads.
data:
  columns:
    - {name: transcript, type: text}
    - {name: reads, type: number}
  rows:
    - [A, 300]
    - [B, 300]
`;
const TABLE: StudioFigureOut = {
  stem: "two-transcripts",
  component: "table",
  alt: "Two transcripts, their lengths and reads.",
  data: {
    columns: [
      { name: "transcript", type: "text" },
      { name: "reads", type: "number" },
    ],
    rows: [
      ["A", 300],
      ["B", 300],
    ],
  },
  derived: {},
  source: null,
  text: TABLE_TEXT,
};
const withItem = (key: string, kind: string, label: string, item: object) => ({
  "GET /api/studio/review": {
    body: [
      {
        ...QUEUE[0],
        keys: [...(QUEUE[0]?.keys ?? []), { key, kind, label, verdict: null, answered: null }],
      },
    ],
  },
  "GET /api/studio/drafts/d-1/review": {
    body: {
      ...REVIEW,
      items: [
        ...REVIEW.items,
        {
          fields: null,
          block: null,
          resource: null,
          question: null,
          key,
          kind,
          verdict: null,
          note: "",
          change: "new",
          before: null,
          ...item,
        },
      ],
    },
  },
});

describe("ReviewPage — figures (M6FG.5)", () => {
  it("draws a figure block, with its file beneath", async () => {
    renderReview(
      withItem("block/2", "figure", "two-transcripts", {
        block: { kind: "figure", file: "two-transcripts", caption: "Equal reads.\n" },
        figures: [TABLE],
      }),
    );
    await openBlock(/^two-transcripts/);
    expect(await screen.findByRole("table")).toHaveTextContent("transcript");
    expect(screen.getByText("Equal reads.")).toBeInTheDocument();
    expect(screen.getByText("figures/two-transcripts.yaml")).toBeInTheDocument();
    expect(screen.getByText(/component: table/)).toBeInTheDocument();
  });

  it("draws the figure an exam question's stem places", async () => {
    renderReview(
      withItem("exam/tpm-of-a", "exam", "TPM of A", {
        figures: [TABLE],
        question: {
          ...REVIEW.items[3]?.question,
          id: "tpm-of-a",
          stem: [
            { kind: "text", markdown: "Two transcripts:\n" },
            { kind: "figure", file: "two-transcripts", caption: "Equal reads.\n" },
          ],
        },
      }),
    );
    await openBlock(/^TPM of A/);
    expect(await screen.findByRole("table")).toHaveTextContent("transcript");
    expect(screen.queryByText("This figure could not be drawn.")).toBeNull();
  });
});

describe("ReviewPage — one open block at a time (#373)", () => {
  it("moving to another block shows it once, beside its verdict", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    renderReview();
    await openBlock(/^TPM is not a count of reads/);
    await screen.findByText("Equal reads, unequal TPM.");
    await openBlock(/^A long transcript gives more fragments/);
    await screen.findByText("A long transcript gives more fragments.");
    expect(screen.getAllByRole("region", { name: "Open block" })).toHaveLength(1);
    expect(screen.getAllByRole("complementary", { name: "Your verdict" })).toHaveLength(1);
    expect(screen.queryByText("Equal reads, unequal TPM.")).toBeNull();
    const duplicate = errors.mock.calls.some((call) => /same key/.test(String(call[0])));
    expect(duplicate).toBe(false);
  });
});
