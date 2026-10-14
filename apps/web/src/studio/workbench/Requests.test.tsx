import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs, Where } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const REQUESTS = {
  by: { public_id: "u-3", email: "grace@example.org", name: "Grace", role: "reviewer" },
  at: "2026-10-14T10:00:00Z",
  reason: "Two small things.",
  items: [
    { key: "block/0", kind: "text", note: "Say it shorter.", now: "block/0" },
    { key: "block/4", kind: "text", note: "Drop this.", now: null },
  ],
};

function bench(tab = "") {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: NODE, requests: REQUESTS } },
  });
  renderAt(
    `/studio/drafts/d-1${tab}`,
    <Route
      path="/studio/drafts/:id"
      element={
        <>
          <WorkbenchPage />
          <Where />
        </>
      }
    />,
  );
  return fake;
}

describe("Requests in the workbench (M4RS.5)", () => {
  it("lists the send back in a banner, a removed block marked", async () => {
    bench();
    expect(await screen.findByText(/Sent back by Grace · 2 requests/)).toBeInTheDocument();
    expect(screen.getByText("Two small things.")).toBeInTheDocument();
    // Review Focus 5.
    expect(screen.getByText("Drop this. · block removed")).toBeInTheDocument();
  });

  it("shows a note beside its block, with no more requests", async () => {
    const fake = bench();
    expect(await screen.findAllByText("Say it shorter.")).toHaveLength(2); // banner and block
    expect(fake.mock.calls.filter(([url]) => url === "/api/studio/drafts/d-1")).toHaveLength(1);
  });

  it("opens the tab a request is in", async () => {
    bench("?tab=settings");
    await userEvent.click(await screen.findByRole("button", { name: "Say it shorter." }));
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/studio\/drafts\/d-1$/);
  });
});
