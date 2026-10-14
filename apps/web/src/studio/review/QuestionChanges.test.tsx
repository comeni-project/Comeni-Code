import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewItemOut, ReviewQuestionOut } from "../../api/schema";
import { REVIEW, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const now = REVIEW.items[3]?.question as ReviewQuestionOut;
const was: ReviewQuestionOut = {
  ...now,
  options: ["A share of molecules", "A count of reads", "A transcript's length"],
};
const changed: ReviewItemOut = {
  ...(REVIEW.items[3] as ReviewItemOut),
  change: "changed",
  before: { fields: null, block: null, resource: null, question: was },
};
const review = { ...REVIEW, items: [...REVIEW.items.slice(0, 3), changed] };

describe("ReviewPage — a question's changes (#297)", () => {
  it("draws the question before and now, options and all, without their keys", async () => {
    renderReview({ "GET /api/studio/drafts/d-1/review": { body: review } });
    await userEvent.click(await screen.findByRole("button", { name: /^What does TPM tell you\?/ }));
    await userEvent.click(await screen.findByRole("tab", { name: "Changes" }));
    expect(screen.getByText("C · A transcript's length")).toBeInTheDocument();
    expect(screen.getByText("C · A length")).toBeInTheDocument();
    expect(screen.queryByText(/Right answer/)).toBeNull();
  });

  it("asks once more for a changed question's review after it is answered", async () => {
    const graded = { ...now, given: 0, right: true, right_option: 0, rationale: "A share." };
    const fake = renderReview({
      "GET /api/studio/drafts/d-1/review": { body: review },
      "PUT /api/studio/drafts/d-1/review/answers/tpm-or-count": { body: graded },
    });
    await userEvent.click(await screen.findByRole("button", { name: /^What does TPM tell you\?/ }));
    await userEvent.click(await screen.findByRole("button", { name: /A share of molecules/ }));
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    await vi.waitFor(() =>
      expect(
        fake.mock.calls.filter(([url]) => url === "/api/studio/drafts/d-1/review"),
      ).toHaveLength(2),
    );
  });
});
