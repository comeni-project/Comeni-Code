import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { expect, it } from "vitest";
import { answering, renderAt } from "../test-kit";
import { RequestPage } from "./RequestPage";

it("sends only on explicit submission and opens a private receipt", async () => {
  const receipt = {
    receipt: "receipt-1",
    title: "DNA",
    state: "requested",
    reason: "",
    node_id: "",
  };
  const fake = answering({
    "POST /api/requests": { body: receipt },
    "GET /api/requests/receipt-1": { body: receipt },
  });
  renderAt("/request?goal=DNA", <Route path="/request" element={<RequestPage />} />);
  await userEvent.type(screen.getByLabelText("What would you like to learn?"), "Base pairing");
  expect(fake.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Send request" }));
  expect(await screen.findByText("Status: requested")).toBeInTheDocument();
  expect(screen.getByText(/Bookmark this page/)).toBeInTheDocument();
});
