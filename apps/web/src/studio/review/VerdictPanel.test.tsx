import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUEUE, REVIEW, renderReview } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

const allApproved = QUEUE.map((draft) => ({
  ...draft,
  keys: draft.keys.map((k) => ({
    ...k,
    verdict: "approved",
    answered: k.answered === null ? null : true,
  })),
}));
const withVerdict = (key: string, verdict: string, note = "") => ({
  body: {
    ...REVIEW,
    items: REVIEW.items.map((i) => (i.key === key ? { ...i, verdict, note } : i)),
  },
});
const puts = (fake: ReturnType<typeof renderReview>) =>
  fake.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => [url, JSON.parse(String(init?.body))]);
const open = async (label: RegExp) =>
  userEvent.click(await screen.findByRole("button", { name: label }));

describe("ReviewPage — verdicts", () => {
  it("approves the open block with one PUT and marks it in the queue", async () => {
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/verdicts": withVerdict("block/1", "approved"),
    });
    await open(/^TPM is not a count of reads/);
    await userEvent.click(await screen.findByRole("button", { name: "Approve this block" }));
    expect(puts(fake)).toEqual([
      [
        "/api/studio/drafts/d-1/review/verdicts",
        { revision: 2, verdicts: [{ key: "block/1", verdict: "approved" }] },
      ],
    ]);
    expect(await screen.findByText("1 of 4")).toBeInTheDocument();
  });

  it("requests a change with a note", async () => {
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/verdicts": withVerdict("block/1", "changes", "Shorter."),
    });
    await open(/^TPM is not a count of reads/);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes…" }));
    await userEvent.type(screen.getByLabelText("What to change"), "Shorter.");
    await userEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(puts(fake)[0]?.[1]).toEqual({
      revision: 2,
      verdicts: [{ key: "block/1", verdict: "changes", note: "Shorter." }],
    });
  });

  it("does not approve a question before it is answered", async () => {
    renderReview();
    await open(/^What does TPM tell you\?/);
    expect(await screen.findByRole("button", { name: "Approve this block" })).toBeDisabled();
  });

  it("approves ticked blocks together, leaving out an unanswered question", async () => {
    const fake = renderReview({ "PUT /api/studio/drafts/d-1/review/verdicts": { body: REVIEW } });
    await screen.findByText("What TPM measures", { selector: "b" });
    await userEvent.click(screen.getByLabelText("Tick Title, claim, level, links"));
    await userEvent.click(screen.getByLabelText("Tick TPM is not a count of reads"));
    await userEvent.click(screen.getByLabelText("Tick What does TPM tell you?"));
    expect(
      screen.getByText("What does TPM tell you? is skipped: answer it first."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve 2 blocks" }));
    expect(puts(fake)[0]?.[1]).toEqual({
      revision: 2,
      verdicts: [
        { key: "node", verdict: "approved" },
        { key: "block/1", verdict: "approved" },
      ],
    });
  });

  it("A approves the open block, but not while typing a note (Review Focus 4)", async () => {
    const fake = renderReview({
      "PUT /api/studio/drafts/d-1/review/verdicts": withVerdict("node", "approved"),
    });
    await open(/^Title, claim, level, links/);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes…" }));
    await userEvent.type(screen.getByLabelText("What to change"), "a");
    expect(puts(fake)).toEqual([]);
    await userEvent.click(screen.getByRole("heading", { name: "Review" }));
    await userEvent.keyboard("a");
    expect(puts(fake)).toHaveLength(1);
  });

  it("J opens the next block", async () => {
    renderReview();
    await open(/^Title, claim, level, links/);
    await userEvent.click(screen.getByRole("heading", { name: "Review" }));
    await userEvent.keyboard("j");
    expect(
      screen.getByRole("button", { name: /^A long transcript gives more fragments/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("approves the draft once every block is, and it leaves the queue", async () => {
    renderReview({
      "GET /api/studio/review": { body: allApproved },
      "GET /api/studio/drafts/d-1/review": {
        body: { ...REVIEW, items: REVIEW.items.map((i) => ({ ...i, verdict: "approved" })) },
      },
      "POST /api/studio/drafts/d-1/approve": { body: { public_id: "d-1", state: "approved" } },
    });
    await userEvent.click(await screen.findByRole("tab", { name: /Approved/ }));
    await open(/^Title, claim, level, links/);
    await userEvent.click(await screen.findByRole("button", { name: "Approve the draft" }));
    expect(await screen.findByText("Nothing is waiting for review.")).toBeInTheDocument();
  });

  it("sends back with the requests and a note", async () => {
    const fake = renderReview({
      "GET /api/studio/drafts/d-1/review": withVerdict("block/1", "changes", "Shorter."),
      "POST /api/studio/drafts/d-1/send-back": { body: { public_id: "d-1", state: "open" } },
    });
    await open(/^Title, claim, level, links/);
    await userEvent.type(await screen.findByLabelText("A note for the author"), "One thing.");
    await userEvent.click(screen.getByRole("button", { name: "Send back · 1 request" }));
    const sent = fake.mock.calls.find(([url]) => String(url).endsWith("/send-back"));
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ revision: 2, reason: "One thing." });
  });

  it("starts each block afresh: no note or answer carries over (#296)", async () => {
    renderReview();
    await open(/^TPM is not a count of reads/);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes…" }));
    await userEvent.type(screen.getByLabelText("What to change"), "Half a thought");
    await userEvent.type(screen.getByLabelText("A note for the author"), "For this draft");
    await open(/^Title, claim, level, links/);
    expect(screen.queryByLabelText("What to change")).toBeNull();
    expect(screen.getByLabelText("A note for the author")).toHaveValue("");
  });

  it("asks nothing again after a decision (#294)", async () => {
    const fake = renderReview({
      "GET /api/studio/drafts/d-1/review": withVerdict("block/1", "changes", "Shorter."),
      "POST /api/studio/drafts/d-1/send-back": { body: { public_id: "d-1", state: "open" } },
    });
    await open(/^Title, claim, level, links/);
    await userEvent.click(await screen.findByRole("button", { name: "Send back · 1 request" }));
    expect(await screen.findByText("Nothing is waiting for review.")).toBeInTheDocument();
    const reviews = fake.mock.calls.filter(([url]) => url === "/api/studio/drafts/d-1/review");
    expect(reviews).toHaveLength(1);
  });
});
