import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Origin } from "./Origin";

it("shows public history and source references even without the private proposal", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Origin
        provenance={{
          version: 1,
          receipts: {
            a: {
              model: "local/test",
              prompt_id: "draft-block@1",
              settings: {},
              sources: [
                {
                  hash: "abc",
                  title: "Public notes",
                  url: "https://example.org",
                  licence: "CC BY",
                },
              ],
            },
          },
          items: { "block/0": { fingerprint: "x", receipts: ["a"] } },
        }}
        target="block/0"
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText(/AI origin/)).toBeTruthy();
  expect(screen.getByText(/not yet reviewed/)).toBeTruthy();
  expect(screen.getByText("Public notes")).toHaveAttribute("href", "https://example.org");
});

import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { queryKeys } from "../../api/queries";
import type { ProposalOut } from "../../api/schema";
import { answering, holding } from "../../test-kit";
import { DRAFT } from "../workbench/fixtures";
import { DraftAI, resolved } from "./DraftAI";

afterEach(() => vi.unstubAllGlobals());
const proposal: ProposalOut = {
  public_id: "p-1",
  kind: "block",
  target: "block/0",
  base_revision: 3,
  state: "ready",
  instruction: "Clarify",
  current: { kind: "text", markdown: "Human" },
  raw: { value: { kind: "text", markdown: "Model" } },
  candidate: { kind: "text", markdown: "Model" },
  sources: [],
  candidates: [],
  conflicts: [],
  findings: [],
  code: "",
  detail: "",
  receipt: { model: "local/test" },
  copy_digest: "",
  accepted_revision: null,
  created_at: "2026-11-15T12:00:00Z",
  evaluations: [],
};
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.draft("d-1"), DRAFT);
  render(
    <QueryClientProvider client={client}>
      <DraftAI draftId="d-1" target="block/0" />
    </QueryClientProvider>,
  );
  return client;
}
it("requires an explicit Keep and sends the captured revision once", async () => {
  const fake = answering({
    "GET /api/studio/drafts/d-1/ai/proposals?target=block%2F0": { body: [] },
    "POST /api/studio/drafts/d-1/ai/proposals": { body: proposal },
    "GET /api/studio/drafts/d-1/ai/proposals/p-1": { body: proposal },
    "POST /api/studio/drafts/d-1/ai/proposals/p-1/accept": {
      body: { draft: { ...DRAFT, revision: 4 }, warnings: [] },
    },
  });
  const client = mount();
  await userEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
  await userEvent.type(screen.getByLabelText("What should change?"), "Clarify");
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByText("Proposed version");
  expect(client.getQueryData(queryKeys.draft("d-1"))).toEqual(DRAFT);
  await userEvent.click(screen.getByRole("button", { name: "Keep in draft" }));
  await vi.waitFor(() =>
    expect(client.getQueryData(queryKeys.draft("d-1"))).toMatchObject({ revision: 4 }),
  );
  const writes = fake.mock.calls.filter(([url]) => url.endsWith("/accept"));
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0]?.[1]?.body))).toMatchObject({ based_on: 3, resolutions: {} });
});
it("holds duplicate Ask while the creation request is pending and shows a refusal", async () => {
  const fake = answering({
    "GET /api/studio/drafts/d-1/ai/proposals?target=block%2F0": { body: [] },
  });
  const finish = holding(fake, "POST /api/studio/drafts/d-1/ai/proposals");
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
  await userEvent.type(screen.getByLabelText("What should change?"), "Clarify");
  await userEvent.dblClick(screen.getByRole("button", { name: "Ask" }));
  expect(fake.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  finish({ status: 422, body: { code: "CA0400", detail: "No model is configured." } });
  expect(await screen.findByText("No model is configured.")).toBeTruthy();
});
it("resolves escaped JSON pointer paths and requires every conflict", () => {
  const p = {
    ...proposal,
    candidate: { "a/b": { title: "Human" } },
    conflicts: [{ path: "/a~1b/title", human: "Human", model: "Model", base: "Base" }],
  };
  expect(() => resolved(p, {})).toThrow(/every conflict/);
  expect(resolved(p, { "/a~1b/title": { choice: "human" } })).toEqual({
    "a/b": { title: "Human" },
  });
});

it("keeps conflict choices after validation refuses Keep", async () => {
  const p = {
    ...proposal,
    conflicts: [{ path: "/markdown", human: "Human", model: "Model", base: "Base" }],
  };
  answering({
    "GET /api/studio/drafts/d-1/ai/proposals?target=block%2F0": { body: [] },
    "POST /api/studio/drafts/d-1/ai/proposals": { body: p },
    "GET /api/studio/drafts/d-1/ai/proposals/p-1": { body: p },
    "POST /api/studio/drafts/d-1/ai/proposals/p-1/accept": {
      status: 422,
      body: { detail: "The resolved edit does not validate." },
    },
  });
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
  await userEvent.type(screen.getByLabelText("What should change?"), "Clarify");
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  const keep = await screen.findByRole("button", { name: "Keep in draft" });
  expect(keep).toBeDisabled();
  const human = screen.getByRole("radio", { name: /Keep your version/ });
  await userEvent.click(human);
  await userEvent.click(keep);
  await screen.findByText("The resolved edit does not validate.");
  expect(human).toBeChecked();
  expect(screen.getByRole("region", { name: "AI drafting" })).toBeTruthy();
});
it("disables Keep when a manual save advances the draft", async () => {
  answering({
    "GET /api/studio/drafts/d-1/ai/proposals?target=block%2F0": { body: [] },
    "POST /api/studio/drafts/d-1/ai/proposals": { body: proposal },
    "GET /api/studio/drafts/d-1/ai/proposals/p-1": { body: proposal },
  });
  const client = mount();
  await userEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
  await userEvent.type(screen.getByLabelText("What should change?"), "Clarify");
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByText("Proposed version");
  client.setQueryData(queryKeys.draft("d-1"), { ...DRAFT, revision: 4 });
  await vi.waitFor(() =>
    expect(screen.getByRole("button", { name: "Keep in draft" })).toBeDisabled(),
  );
  expect(screen.getByRole("button", { name: "Reload draft" })).toBeTruthy();
});
it("aborts the active status read when the panel is closed", async () => {
  const fake = answering({
    "GET /api/studio/drafts/d-1/ai/proposals?target=block%2F0": { body: [] },
    "POST /api/studio/drafts/d-1/ai/proposals": { body: { ...proposal, state: "running" } },
  });
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
  await userEvent.type(screen.getByLabelText("What should change?"), "Clarify");
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await vi.waitFor(() => expect(fake.mock.calls.some(([url]) => url.endsWith("/p-1"))).toBe(true));
  const signal = fake.mock.calls.find(([url]) => url.endsWith("/p-1"))?.[1]?.signal;
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(signal?.aborted).toBe(true);
});
