import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REVIEW, renderReview } from "./reviewKit";

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
