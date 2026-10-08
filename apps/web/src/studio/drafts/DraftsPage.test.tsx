import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DraftsPage } from "./DraftsPage";

afterEach(() => vi.unstubAllGlobals());

const ME = signedInAs("author");
const mine = {
  public_id: "d-1",
  node_id: "k-mers",
  folder: "algorithms/k-mers",
  state: "open",
  base_digest: "",
  revision: 6,
  submitted_revision: null,
  contributors: [{ public_id: "u-1", email: "ada@example.org", name: "Ada", role: "author" }],
};
const theirs = {
  ...mine,
  public_id: "d-2",
  node_id: "tpm",
  folder: "quantification/tpm",
  contributors: [{ public_id: "u-9", email: "bo@example.org", name: "Bo", role: "author" }],
};
const REGIONS: Answer = {
  body: {
    live: null,
    latest: null,
    main_head: null,
    checked_at: null,
    behind: false,
    regions: [{ id: "algorithms", name: "Algorithms" }],
  },
};
const page = () =>
  renderAt("/studio/drafts", <Route path="/studio/drafts" element={<DraftsPage />} />);
const asked = (fake: ReturnType<typeof answering>, key: string) =>
  fake.mock.calls.some(([url, init]) => `${init?.method ?? "GET"} ${url}` === key);

describe("DraftsPage", () => {
  it("shows my drafts first, and all open ones on asking", async () => {
    answering({
      "GET /api/me": ME,
      "GET /api/studio/drafts?state=open": { body: [mine, theirs] },
      "GET /api/studio/index": REGIONS,
    });
    page();
    expect(await screen.findByRole("link", { name: "k-mers" })).toHaveAttribute(
      "href",
      "/studio/drafts/d-1",
    );
    expect(screen.queryByText("tpm")).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: /All open/ }));
    expect(screen.getByText("tpm")).toBeInTheDocument();
  });

  it("asks for drafts in review only when that view is chosen", async () => {
    const fake = answering({
      "GET /api/me": ME,
      "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": REGIONS,
      "GET /api/studio/drafts?state=submitted": { body: [] },
    });
    page();
    await screen.findByRole("tab", { name: /In review/ });
    expect(asked(fake, "GET /api/studio/drafts?state=submitted")).toBe(false);
    await userEvent.click(screen.getByRole("tab", { name: /In review/ }));
    expect(asked(fake, "GET /api/studio/drafts?state=submitted")).toBe(true);
  });

  it("creates a new node and opens its workbench", async () => {
    const fake = answering({
      "GET /api/me": ME,
      "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": REGIONS,
      "POST /api/studio/drafts": { status: 201, body: { ...mine, public_id: "d-7" } },
    });
    page();
    await userEvent.type(await screen.findByLabelText("Node id"), "k-mer-counting");
    await userEvent.type(screen.getByLabelText("Title"), "Counting k-mers");
    await userEvent.type(screen.getByLabelText("Claim"), "Count every k-mer in a read set.");
    await screen.findByRole("option", { name: "Algorithms" });
    await userEvent.click(screen.getByRole("button", { name: "Create the draft" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts/d-7");
    const post = fake.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      node_id: "k-mer-counting",
      new: {
        title: "Counting k-mers",
        claim: "Count every k-mer in a read set.",
        region: "algorithms",
        level: "introductory",
        minutes: 20,
      },
    });
  });

  it("says in the API's words when a node already has a draft", async () => {
    answering({
      "GET /api/me": ME,
      "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": REGIONS,
      "GET /api/search?q=tpm&limit=10": {
        body: {
          query: "tpm",
          unmatched: [],
          results: [
            {
              id: "tpm",
              title: "TPM",
              claim: "",
              level: "intermediate",
              minutes: 5,
              region: { id: "quantification", name: "Quantification" },
            },
          ],
        },
      },
      "POST /api/studio/drafts": {
        status: 409,
        body: { detail: "tpm already has a draft (open), d-2, by bo@example.org.", code: "CA0202" },
      },
    });
    page();
    await userEvent.type(await screen.findByLabelText("Find a node by name or id"), "tpm");
    await userEvent.click(await screen.findByRole("button", { name: /TPM/ }));
    expect(
      await screen.findByText("tpm already has a draft (open), d-2, by bo@example.org."),
    ).toBeInTheDocument();
  });
});
