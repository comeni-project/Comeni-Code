import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftNodeOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const WITH_TRY: DraftNodeOut = {
  ...NODE,
  blocks: [...NODE.blocks, { kind: "try", question: "k-mers-q1" }],
  questions: [
    {
      id: "k-mers-q1",
      kind: "choice",
      ask: "How many 5-mers does a 100-base read contain?",
      options: [
        { text: "96", right: true, misconception: "", plain: false },
        { text: "100", right: false, misconception: "", plain: false },
      ],
      answer: null,
      unit: "",
      tolerance: null,
      accept: [],
      exact: false,
      steps: null,
      hints: ["A window needs five bases."],
      rationale: "One window starts at each of the first 96 bases.",
    },
  ],
};
const saved: Answer = { body: { draft: { ...DRAFT, revision: 4, node: WITH_TRY }, warnings: [] } };
const bench = () => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: WITH_TRY } },
    "PUT /api/studio/drafts/d-1/blocks/1": saved,
    "POST /api/studio/drafts/d-1/blocks": saved,
  });
  renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};
const sent = async (fake: ReturnType<typeof answering>) => {
  const writes = () => fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
  await vi.waitFor(() => expect(writes()).toHaveLength(1));
  return JSON.parse(String(writes()[0]?.[1]?.body));
};

describe("TryEditor", () => {
  it("saves the block and its question when you leave it", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    await userEvent.type(screen.getByLabelText("Question"), " Count them.");
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    const body = await sent(fake);
    expect(body.block).toEqual({ kind: "try", question: "k-mers-q1" });
    expect(body.question.ask).toBe("How many 5-mers does a 100-base read contain? Count them.");
    expect(body.question.options[1]).toEqual({ text: "100", right: false, misconception: "" });
  });

  it("offers no misconception on a try option: those belong to the exam pool (#257)", async () => {
    bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.queryByLabelText(/misconception/i)).toBeNull();
  });

  it("adds a try block with a new choice question", async () => {
    const fake = bench();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Add a try block" })[0] as HTMLElement,
    );
    await userEvent.type(screen.getByLabelText("Question"), "Which is a 3-mer of ACGTA?");
    await userEvent.type(screen.getByLabelText("Option 1"), "ACGT");
    await userEvent.type(screen.getByLabelText("Option 2"), "CGT");
    await userEvent.click(screen.getByLabelText("Option 2 is the right answer"));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    const body = await sent(fake);
    expect(body.at).toBe(0);
    expect(body.block).toEqual({ kind: "try", question: "k-mers-q2" });
    expect(body.question.id).toBe("k-mers-q2");
    expect(body.question.options.map((o: { right: boolean }) => o.right)).toEqual([false, true]);
  });

  it("adds and removes options", async () => {
    bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    await userEvent.click(screen.getByRole("button", { name: "+ Option" }));
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove option 3" }));
    expect(screen.queryByLabelText("Option 3")).toBeNull();
  });

  it("saves a removed option when you then leave the block", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    await userEvent.click(screen.getByRole("button", { name: "+ Option" }));
    await userEvent.type(screen.getByLabelText("Option 3"), "95");
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    await vi.waitFor(() =>
      expect(fake.mock.calls.filter(([, i]) => i?.method === "PUT")).toHaveLength(1),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    await userEvent.click(screen.getByRole("button", { name: "+ Option" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove option 1" }));
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    await vi.waitFor(() =>
      expect(fake.mock.calls.filter(([, i]) => i?.method === "PUT")).toHaveLength(2),
    );
  });

  it("switches to a number, and sends the answer as a number", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    await userEvent.click(screen.getByLabelText("Number"));
    expect(screen.queryByLabelText("Option 1")).toBeNull();
    await userEvent.type(screen.getByLabelText("Answer"), "96");
    await userEvent.type(screen.getByLabelText("Unit"), "k-mers");
    await userEvent.type(screen.getByLabelText("Tolerance"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    const body = await sent(fake);
    expect(body.question).toMatchObject({
      kind: "number",
      answer: 96,
      unit: "k-mers",
      tolerance: 0,
      options: null,
    });
  });

  it("keeps hints one per line", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    await userEvent.type(screen.getByLabelText("Hints"), "{enter}Count the windows.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect((await sent(fake)).question.hints).toEqual([
      "A window needs five bases.",
      "Count the windows.",
    ]);
  });

  it("shows a sequence or order try without an editor until the builder arrives (M4.8d)", async () => {
    const order: DraftNodeOut = {
      ...WITH_TRY,
      questions: [
        {
          id: "k-mers-q1",
          kind: "order",
          ask: "Put the steps in order.",
          options: null,
          answer: null,
          unit: "",
          tolerance: null,
          accept: [],
          exact: false,
          steps: ["Cut", "Build", "Walk"],
          hints: [],
          rationale: "Each needs the one before.",
        },
      ],
    };
    answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: order } },
    });
    renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit block 2" }));
    expect(screen.getByText(/Edited in the exam pool's builder \(M4\.8d\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Question")).toBeNull();
  });
});
