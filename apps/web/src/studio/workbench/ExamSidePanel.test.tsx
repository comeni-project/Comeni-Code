import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChecklistOut } from "../../api/schema";
import { renderPool } from "./examKit";
import { examQuestion } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

const CHECKS: ChecklistOut = {
  passed: false,
  items: [],
  problems: [],
  questions: [
    {
      id: "a",
      items: [
        { rule: "No hints", passed: true, detail: "" },
        {
          rule: "Level within one step of the node's",
          passed: false,
          detail: "the question a is advanced, two from the node's introductory",
        },
      ],
    },
  ],
};
const checked = { "GET /api/studio/drafts/d-1/checklist": { body: CHECKS } };

describe("ExamSidePanel", () => {
  it("previews the editor's question as a test, unsaved changes included (M4P.7)", async () => {
    renderPool([examQuestion("a", "draft", "choice")], checked);
    const preview = await screen.findByRole("region", { name: "Preview as in a test" });
    expect(preview).toHaveTextContent("Question 1 of 1 · no hints in a test");
    expect(preview).toHaveTextContent("What is a?");
    await userEvent.type(screen.getByLabelText("Stem block 1"), " Say it.");
    expect(preview).toHaveTextContent("What is a? Say it.");
    expect(preview).toHaveTextContent("A tip");
    expect(preview).not.toHaveTextContent(/hint\b(?! in a test)/i);
  });

  it("an order's preview follows its steps as they are edited (#268)", async () => {
    const order = {
      ...examQuestion("a", "draft"),
      kind: "order",
      answer: null,
      steps: ["Cut", "Build", "Walk"],
    };
    renderPool([order], checked);
    const preview = await screen.findByRole("region", { name: "Preview as in a test" });
    expect(preview).toHaveTextContent("Build");
    await userEvent.type(screen.getByLabelText("Step 2"), " the graph");
    expect(preview).toHaveTextContent("Build the graph");
  });

  it("Phone narrows the preview and Dark marks its box dark", async () => {
    renderPool([examQuestion("a", "draft")], checked);
    const preview = await screen.findByRole("region", { name: "Preview as in a test" });
    await userEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(preview.querySelector(".max-w-\\[390px\\]")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(preview.querySelector('[data-theme="dark"]')).not.toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme", "dark");
  });

  it("lists the question's checks under the preview, as the board does", async () => {
    renderPool([examQuestion("a", "draft")], checked);
    const preview = await screen.findByRole("region", { name: "Preview as in a test" });
    expect(await screen.findByText("Level within one step of the node's")).toBeInTheDocument();
    expect(preview).not.toContainElement(screen.getByText("No hints"));
  });

  it("Checks lists the question's items, with the failed count on its tab", async () => {
    renderPool([examQuestion("a", "draft")], checked);
    const tab = await screen.findByRole("tab", { name: "Checks 1" });
    await userEvent.click(tab);
    expect(await screen.findByText("No hints")).toBeInTheDocument();
    expect(screen.getByText("Level within one step of the node's")).toBeInTheDocument();
    expect(screen.getByText(/advanced, two from the node's introductory/)).toBeInTheDocument();
  });

  it("says checks are the last save's while the question has unsaved changes", async () => {
    renderPool([examQuestion("a", "draft")], checked);
    await userEvent.type(await screen.findByLabelText("Title"), "!");
    await userEvent.click(screen.getByRole("tab", { name: /Checks/ }));
    expect(
      screen.getByText("As last saved; leave the question to check again."),
    ).toBeInTheDocument();
  });

  it("a question never saved is checked once saved", async () => {
    renderPool([], checked);
    await userEvent.click(await screen.findByRole("button", { name: "+ New" }));
    await userEvent.click(screen.getByRole("tab", { name: /Checks/ }));
    expect(screen.getByText("Checked once saved.")).toBeInTheDocument();
  });
});
