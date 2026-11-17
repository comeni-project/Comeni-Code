import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { expect, it } from "vitest";
import { answering, renderAt } from "../../test-kit";
import { RequestsPage } from "./RequestsPage";

it("shows request details and sends an explicit version-bound decision", async () => {
  const row = {
    public_id: "r-1",
    title: "DNA",
    description: "Explain base pairing.",
    state: "requested",
    version: 4,
    asked: 2,
    created_at: "2026-11-16T10:00:00Z",
    updated_at: "2026-11-16T10:00:00Z",
    snoozed_until: null,
    merged_node_id: "",
    decisions: [],
  };
  const fake = answering({
    "GET /api/studio/requests?state=requested&q=&offset=0": { body: [row] },
    "GET /api/studio/index/nodes": { body: [] },
    "POST /api/studio/requests/decisions": { body: [{ ...row, state: "accepted", version: 5 }] },
  });
  renderAt("/studio/requests", <Route path="/studio/requests" element={<RequestsPage />} />);
  await userEvent.click(await screen.findByRole("button", { name: "DNA" }));
  expect(screen.getByText("Explain base pairing.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Accept" }));
  const call = fake.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(call?.[1]?.body)).decisions[0]).toMatchObject({
    identity: "r-1",
    version: 4,
    action: "accept",
  });
});
