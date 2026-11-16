import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { answering } from "../../test-kit";
import { Origin } from "./Origin";

afterEach(() => vi.unstubAllGlobals());
it("can inspect a private source from the draft receipt while public history remains separate", async () => {
  answering({
    "GET /api/studio/drafts/d-1/ai/proposals/p-1": {
      body: {
        state: "accepted",
        instruction: "Clarify",
        sources: [
          {
            id: "private",
            title: "Teaching note",
            excerpt: "A private correction.",
            licence: "Author permission",
          },
        ],
        receipt: { model: "local/test" },
      },
    },
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Origin
        draftId="d-1"
        target="block/0"
        provenance={{
          receipts: { "p-1": { model: "local/test", prompt_id: "draft-block@1", sources: [] } },
          items: { "block/0": { receipts: ["p-1"] } },
        }}
      />
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByText(/AI origin/));
  await userEvent.click(screen.getByRole("button", { name: "View full drafting receipt" }));
  expect(await screen.findByText("A private correction.")).toBeTruthy();
});
