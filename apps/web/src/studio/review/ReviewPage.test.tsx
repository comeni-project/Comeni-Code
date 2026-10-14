import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUEUE, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const row = (label: RegExp) => screen.getByRole("button", { name: label });

describe("ReviewPage — the queue", () => {
  it("groups each draft's blocks, with a placeholder score and nothing reviewed yet", async () => {
    renderReview();
    expect(await screen.findByText("What TPM measures", { selector: "b" })).toBeInTheDocument();
    expect(screen.getByText("0 of 4")).toBeInTheDocument();
    expect(row(/^TPM is not a count of reads, callout/)).toBeInTheDocument();
    expect(screen.getAllByTitle("Scores arrive with the judge in M5")).toHaveLength(4);
  });

  it("filters by your verdict", async () => {
    const queue = structuredClone(QUEUE);
    const third = queue[0]?.keys[2];
    if (third) third.verdict = "changes";
    renderReview({ "GET /api/studio/review": { body: queue } });
    await screen.findByText("What TPM measures", { selector: "b" });
    expect(screen.queryByRole("button", { name: /^TPM is not a count/ })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /Changes requested/ }));
    expect(row(/^TPM is not a count of reads/)).toBeInTheDocument();
  });

  it("filters by block type", async () => {
    renderReview();
    await screen.findByText("What TPM measures", { selector: "b" });
    await userEvent.selectOptions(screen.getByLabelText("Block type"), "callout");
    expect(row(/^TPM is not a count of reads/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Title, claim, level, links/ })).toBeNull();
  });

  it("opens a block and asks for its draft's review once", async () => {
    const fake = renderReview();
    await userEvent.click(
      await screen.findByRole("button", { name: /^Title, claim, level, links/ }),
    );
    await userEvent.click(row(/^TPM is not a count of reads/));
    const asked = fake.mock.calls.filter(([url]) => url === "/api/studio/drafts/d-1/review");
    expect(asked).toHaveLength(1);
    expect(row(/^TPM is not a count of reads/)).toHaveAttribute("aria-current", "true");
  });

  it("says when nothing is waiting", async () => {
    renderReview({ "GET /api/studio/review": { body: [] } });
    expect(await screen.findByText("Nothing is waiting for review.")).toBeInTheDocument();
  });
});
