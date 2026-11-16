import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { queryKeys } from "../../api/queries";
import { answering } from "../../test-kit";
import { DRAFT } from "../workbench/fixtures";
import { copyDigest, DraftAI } from "./DraftAI";

afterEach(() => vi.unstubAllGlobals());
it("Use changes only the working copy, and a later copy makes the suggestion stale", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const text = "component: chart\nalt: Bars.\ndata: {}\n";
  const digest = await copyDigest(text);
  const proposal = {
    public_id: "p-figure",
    kind: "figure",
    target: "figure/new",
    base_revision: 3,
    state: "ready",
    instruction: "Fill",
    current: { component: "chart" },
    raw: { value: { component: "chart", alt: "New bars", data: {} } },
    candidate: { component: "chart", alt: "New bars", data: {} },
    sources: [],
    candidates: [],
    conflicts: [],
    findings: [],
    code: "",
    detail: "",
    receipt: null,
    copy_digest: digest,
    accepted_revision: null,
    created_at: "2026-11-15T12:00:00Z",
  };
  const fake = answering({
    "GET /api/studio/drafts/d-1/ai/proposals?target=figure%2Fnew": { body: [] },
    "POST /api/studio/drafts/d-1/ai/proposals": { body: proposal },
    "GET /api/studio/drafts/d-1/ai/proposals/p-figure": { body: proposal },
  });
  const client = new QueryClient();
  client.setQueryData(queryKeys.draft("d-1"), DRAFT);
  const use = vi.fn();
  const tree = (copyText: string) => (
    <QueryClientProvider client={client}>
      <DraftAI
        draftId="d-1"
        target="figure/new"
        kind="figure"
        copyText={copyText}
        figureAt={1}
        onUse={use}
      />
    </QueryClientProvider>
  );
  const shown = render(tree(text));
  await userEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  await userEvent.type(screen.getByLabelText("What should change?"), "Fill");
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  const button = await screen.findByRole("button", { name: "Use these data" });
  shown.rerender(tree(`${text}\n`));
  await vi.waitFor(() => expect(button).toBeDisabled());
  expect(use).not.toHaveBeenCalled();
  shown.rerender(tree(text));
  await vi.waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await vi.waitFor(() =>
    expect(use).toHaveBeenCalledWith(proposal.candidate, {
      proposal_id: "p-figure",
      copy_digest: digest,
      resolutions: {},
    }),
  );
  expect(client.getQueryData(queryKeys.draft("d-1"))).toEqual(DRAFT);
  const writes = fake.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0]?.[1]?.body))).toMatchObject({
    copy_text: text,
    copy_digest: digest,
    figure_at: 1,
  });
});
