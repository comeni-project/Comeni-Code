import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioExamQuestionOut } from "../../api/schema";
import { type Answer, type answering, holding } from "../../test-kit";
import { renderPool } from "./examKit";
import { DRAFT, examQuestion, NODE } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

const savedWith = (exam: StudioExamQuestionOut[]): Answer => ({
  body: { draft: { ...DRAFT, revision: 4, node: { ...NODE, exam } }, warnings: [] },
});
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
const bodyOf = async (fake: ReturnType<typeof answering>, method: string) => {
  await vi.waitFor(() => expect(writes(fake).some(([, i]) => i?.method === method)).toBe(true));
  const call = writes(fake).find(([, i]) => i?.method === method);
  return JSON.parse(String(call?.[1]?.body));
};
/** Focus leaves the editor for the page's heading, as a person clicking away does. */
const leave = () => userEvent.click(screen.getByRole("heading", { level: 1 }));
const row = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title},`) });

describe("ExamEditor", () => {
  it("leaving a changed question saves it with PUT (M4P.5)", async () => {
    const a = examQuestion("a", "draft");
    const fake = renderPool([a], {
      "PUT /api/studio/drafts/d-1/exam/a": savedWith([{ ...a, title: "Count the edges" }]),
    });
    const title = await screen.findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Count the edges");
    await leave();
    const body = await bodyOf(fake, "PUT");
    expect(body.revision).toBe(3);
    expect(body.question).toMatchObject({
      id: "a",
      title: "Count the edges",
      stem: [{ kind: "text", markdown: "What is a?\n" }],
    });
  });

  it("choosing another question saves this one even with no blur, as Safari gives none (#268)", async () => {
    const a = examQuestion("a", "draft");
    const fake = renderPool([a, examQuestion("b", "draft")], {
      "PUT /api/studio/drafts/d-1/exam/a": savedWith([
        { ...a, title: "Kept" },
        examQuestion("b", "draft"),
      ]),
    });
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Kept" } });
    fireEvent.click(row("Question b"));
    expect((await bodyOf(fake, "PUT")).question.title).toBe("Kept");
    await vi.waitFor(() => expect(row("Question b")).toHaveAttribute("aria-current", "true"));
  });

  it("leaving an unchanged question sends nothing", async () => {
    const fake = renderPool([examQuestion("a", "draft")]);
    await userEvent.click(await screen.findByLabelText("Title"));
    await leave();
    expect(writes(fake)).toEqual([]);
  });

  it("a new question is sent with POST, then selected by its id", async () => {
    const made = { ...examQuestion("k-mers-q1", "draft", "choice"), title: "Which mark?" };
    const fake = renderPool([], {
      "POST /api/studio/drafts/d-1/exam": savedWith([made]),
    });
    await userEvent.click(await screen.findByRole("button", { name: "+ New" }));
    await userEvent.type(screen.getByLabelText("Title"), "Which mark?");
    await userEvent.type(screen.getByLabelText("Stem block 1"), "Which mark does it leave?");
    await userEvent.type(screen.getByLabelText("Option A"), "A bubble");
    await userEvent.type(screen.getByLabelText("Option B"), "A tip");
    await userEvent.type(screen.getByLabelText("Misconception of option B"), "an end");
    await userEvent.type(screen.getByLabelText("Option C"), "A clean path");
    await userEvent.click(screen.getByLabelText("Option C is plain on purpose"));
    await userEvent.type(screen.getByLabelText("Rationale"), "A bubble.");
    await leave();
    const body = await bodyOf(fake, "POST");
    expect(body.question).toMatchObject({
      id: "k-mers-q1",
      kind: "choice",
      title: "Which mark?",
      stem: [{ kind: "text", markdown: "Which mark does it leave?\n" }],
      rationale: "A bubble.",
    });
    expect(body.question.options[2]).toMatchObject({ text: "A clean path", plain: true });
    await vi.waitFor(() => expect(row("Which mark\\?")).toHaveAttribute("aria-current", "true"));
    expect(screen.getByText("Q1 · choice")).toBeInTheDocument();
  });

  it("+ New while the last new question is saving names the next one after it (#268)", async () => {
    const made = { ...examQuestion("k-mers-q1", "draft", "choice"), title: "First" };
    const fake = renderPool([]);
    const release = holding(fake, "POST /api/studio/drafts/d-1/exam");
    await userEvent.click(await screen.findByRole("button", { name: "+ New" }));
    await userEvent.type(screen.getByLabelText("Title"), "First");
    await userEvent.click(screen.getByRole("button", { name: "+ New" }));
    release(savedWith([made]));
    expect(await screen.findByRole("button", { name: /^First,/ })).toHaveAttribute(
      "aria-current",
      "false",
    );
    expect(row("New question")).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByText("Q2 · choice")).toBeInTheDocument();
  });

  it("an untouched new question is dropped (Review Focus 3)", async () => {
    const fake = renderPool([examQuestion("a", "draft")]);
    await userEvent.click(await screen.findByRole("button", { name: "+ New" }));
    expect(screen.getByText("Q2 · choice")).toBeInTheDocument();
    await userEvent.click(row("Question a"));
    await vi.waitFor(() => expect(row("Question a")).toHaveAttribute("aria-current", "true"));
    expect(screen.queryByText("Q2 · choice")).toBeNull();
    expect(writes(fake)).toEqual([]);
  });

  it("a refused save keeps the question selected and the text typed (Review Focus 2)", async () => {
    renderPool([examQuestion("a", "draft"), examQuestion("b", "draft")], {
      "PUT /api/studio/drafts/d-1/exam/a": {
        status: 422,
        body: {
          detail: "The draft would not read.",
          code: "CA0208",
          problems: [
            {
              code: "CS0815",
              field: "exam",
              file: "exam.yaml",
              line: 2,
              message: "x",
              text: "The exam question a has no title.",
              question: "a",
            },
          ],
        },
      },
    });
    await userEvent.clear(await screen.findByLabelText("Title"));
    await userEvent.click(row("Question b"));
    expect(await screen.findByText("The exam question a has no title.")).toBeInTheDocument();
    expect(row("Question a")).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("edits the stem as blocks: add a sequence, move it up, delete the text", async () => {
    const a = examQuestion("a", "draft");
    const fake = renderPool([a], { "PUT /api/studio/drafts/d-1/exam/a": savedWith([a]) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Add a sequence to the stem" }),
    );
    await userEvent.type(screen.getByLabelText("Stem block 2"), "ACGT");
    await userEvent.click(screen.getByRole("button", { name: "Move stem block 2 up" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete stem block 2" }));
    await leave();
    expect((await bodyOf(fake, "PUT")).question.stem).toEqual([
      { kind: "sequence", letters: "ACGT\n" },
    ]);
  });

  it("delete question asks first, sends DELETE and opens the first left", async () => {
    const b = examQuestion("b", "draft");
    const fake = renderPool([examQuestion("a", "draft"), b], {
      "DELETE /api/studio/drafts/d-1/exam/a?revision=3": savedWith([b]),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Delete question" }));
    const confirm = screen.getByText("Delete this question?").parentElement as HTMLElement;
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    await vi.waitFor(() => expect(row("Question b")).toHaveAttribute("aria-current", "true"));
  });

  it("asking to delete keeps focus in the editor, so leaving afterwards still saves (#268)", async () => {
    renderPool([examQuestion("a", "draft")]);
    await userEvent.click(await screen.findByRole("button", { name: "Delete question" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete question" })).toHaveFocus();
  });

  it("a draft not open shows the question and edits nothing", async () => {
    renderPool([examQuestion("a", "draft")], {}, { state: "submitted" });
    expect(await screen.findByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Rationale")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete question" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a text block to the stem" })).toBeNull();
  });
});
