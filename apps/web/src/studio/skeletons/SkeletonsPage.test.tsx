import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { expect, it } from "vitest";
import { answering, renderAt } from "../../test-kit";
import { SkeletonsPage } from "./SkeletonsPage";

it("requires human mapping selection and a note before creating requested items", async () => {
  const made = {
    public_id: "i-1",
    state: "ready",
    version: 1,
    code: "",
    source_kind: "openstax",
    source_url: "https://openstax.org/books/biology-2e",
    source_version: "2e",
    licence: "CC BY",
    outline: "DNA pairing",
    result: {
      stubs: [
        {
          id: "pairing",
          title: "DNA pairing",
          claim: "Pair complementary bases.",
          region: "biology",
          level: "introductory",
          needs: [],
        },
      ],
    },
    scores: [],
    mappings: {},
    sent: {},
  };
  const fake = answering({
    "GET /api/studio/skeletons": { body: [made] },
    "GET /api/studio/skeletons/i-1": { body: made },
    "GET /api/studio/index/nodes": { body: [] },
    "POST /api/studio/skeletons/i-1/send": {
      body: { ...made, version: 2, sent: { pairing: "r-1" } },
    },
  });
  renderAt(
    "/studio/skeletons?import=i-1",
    <Route path="/studio/skeletons" element={<SkeletonsPage />} />,
  );
  await screen.findByRole("checkbox", { name: "Select DNA pairing" });
  expect(screen.getByRole("combobox", { name: "Previous outlines" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox", { name: "Select DNA pairing" }));
  expect(screen.getByRole("button", { name: "Send 1 selected to Requests" })).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Mapping review note"),
    "Reviewed the claim and needs.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Send 1 selected to Requests" }));
  const request = fake.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
    version: 1,
    mappings: { pairing: { action: "new" } },
    note: "Reviewed the claim and needs.",
  });
});
