import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { describe, expect, it } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { AssistantPage } from "./AssistantPage";

const draft = {
  public_id: "d-1",
  node_id: "k-mers",
  folder: "algorithms/k-mers",
  state: "open",
  base_digest: "",
  revision: 6,
  submitted_revision: null,
  contributors: [],
};
const session = {
  public_id: "s-1",
  draft_id: "d-1",
  node_id: "k-mers",
  revision: 6,
  created_at: "2026-11-16T10:00:00Z",
  turns: [],
};

describe("AssistantPage", () => {
  it("opens an author conversation and shows assistant proposals as review cards", async () => {
    const created = { ...session };
    const answered = {
      ...session,
      turns: [
        {
          number: 1,
          request_id: "r-1",
          user_text: "Make the explanation clearer.",
          answer: "I can clarify that block.",
          code: "",
          state: "ready",
          created_at: "2026-11-16T10:01:00Z",
          actions: [
            {
              number: 1,
              target: "block/0",
              instruction: "Use shorter sentences.",
              proposal_id: null,
              proposal_state: "queued",
              code: "",
              detail: "",
            },
          ],
        },
      ],
    };
    answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts?state=open": { body: [draft] },
      "GET /api/studio/assistant/sessions": { body: [] },
      "POST /api/studio/assistant/sessions": { body: created },
      "GET /api/studio/assistant/sessions/s-1": { body: created },
      "POST /api/studio/assistant/sessions/s-1/turns": { body: answered },
    });
    renderAt("/studio/assistant", <Route path="/studio/assistant" element={<AssistantPage />} />);

    await userEvent.click(await screen.findByRole("button", { name: "k-mers · r6" }));
    const message = await screen.findByLabelText("Your message");
    await userEvent.type(message, "Make the explanation clearer.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("I can clarify that block.")).toBeInTheDocument();
    expect(screen.getByText("Use shorter sentences.")).toBeInTheDocument();
    expect(screen.getByText("Waiting for the drafting worker…")).toBeInTheDocument();
    expect(screen.getByText("Proposals stay here until you keep them.")).toBeInTheDocument();
  });
});
