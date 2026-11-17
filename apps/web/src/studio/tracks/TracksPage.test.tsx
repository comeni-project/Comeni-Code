import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { expect, it } from "vitest";
import { answering, renderAt } from "../../test-kit";
import { TracksPage } from "./TracksPage";

it("disables publication until all prose is reviewed and sends the selected version", async () => {
  const item = {
    key: "introduction",
    kind: "introduction",
    text: "Connect these claims to the learning goal.",
    state: "ready",
    version: 2,
    flags: [],
    context: {
      key: "introduction",
      kind: "introduction",
      claims: [{ id: "dna", title: "DNA", claim: "Pair complementary bases." }],
      goals: [{ id: "dna", title: "DNA", claim: "Pair complementary bases." }],
    },
  };
  const bundle = {
    public_id: "b-1",
    state: "ready",
    code: "",
    goals: ["dna"],
    known: [],
    texts: [item],
  };
  const review = { bundle, route: null, snapshot: {}, eligible: false, history: [] };
  const fake = answering({
    "GET /api/studio/tracks": { body: [bundle] },
    "GET /api/studio/tracks/b-1": { body: review },
    "POST /api/studio/tracks/b-1/review": { body: review },
  });
  renderAt("/studio/tracks?bundle=b-1", <Route path="/studio/tracks" element={<TracksPage />} />);
  expect(await screen.findByRole("button", { name: "Publish as a named track" })).toBeDisabled();
  expect(screen.getAllByText("Pair complementary bases.").length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole("button", { name: "Approve" }));
  const request = fake.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
    key: "introduction",
    version: 2,
    action: "approve",
  });
});
