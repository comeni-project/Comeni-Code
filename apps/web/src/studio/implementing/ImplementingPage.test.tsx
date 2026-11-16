import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { expect, it } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { ImplementingPage } from "./ImplementingPage";

it("keeps accepted work separate from published content and opens its normal draft", async () => {
  answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/implementing": {
      body: [
        {
          public_id: "r-1",
          title: "DNA pairing",
          version: 3,
          stage: "writing",
          assignee_id: "u-1",
          assignee: "Ada",
          draft_id: "d-1",
          node_id: "dna-pairing",
          asked: 2,
          stalled: true,
          updated_at: "2026-11-16T10:00:00Z",
        },
      ],
    },
    "GET /api/studio/implementing/team": {
      body: [{ public_id: "u-1", name: "Ada", writing: 1, reviewing: 0 }],
    },
    "GET /api/studio/index": { body: { regions: [] } },
  });
  renderAt(
    "/studio/implementing",
    <Route path="/studio/implementing" element={<ImplementingPage />} />,
  );
  expect(await screen.findByRole("link", { name: "Open draft" })).toHaveAttribute(
    "href",
    "/studio/drafts/d-1",
  );
  expect(screen.getByText("Stalled · 14 days")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "waiting" }));
  expect(screen.getByText("No accepted requests in this view.")).toBeInTheDocument();
});
