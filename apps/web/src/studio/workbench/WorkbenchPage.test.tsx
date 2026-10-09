import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftOut } from "../../api/schema";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { DraftsPage } from "../drafts/DraftsPage";
import { DRAFT } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const bench = (draft: DraftOut = DRAFT, path = "/studio/drafts/d-1") => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: draft },
    "POST /api/studio/drafts/d-1/withdraw": { body: { ...draft, state: "open" } },
  });
  renderAt(path, <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};
const urls = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith("/api/studio"));

describe("WorkbenchPage", () => {
  it("opens with one request and draws the preview from it", async () => {
    const fake = bench();
    expect(await screen.findByRole("heading", { level: 1, name: "k-mers" })).toBeInTheDocument();
    expect(
      screen.getAllByText("The trick is to stop treating reads as units.").length,
    ).toBeGreaterThan(0);
    expect(urls(fake)).toEqual(["/api/studio/drafts/d-1"]);
  });

  it("keeps the tab in the address", async () => {
    bench(DRAFT, "/studio/drafts/d-1?tab=exam");
    expect(await screen.findByText(/The exam pool's builder is not built yet/)).toBeInTheDocument();
    expect(screen.getByText("0 of 4")).toBeInTheDocument();
  });

  it("reads as submitted, offers Withdraw to a contributor, and no editor", async () => {
    const fake = bench({ ...DRAFT, state: "submitted", submitted_revision: 3 });
    expect(await screen.findByText(/Submitted for review/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a text block" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    expect(
      fake.mock.calls.some(
        ([url, init]) => String(url).endsWith("/withdraw") && init?.method === "POST",
      ),
    ).toBe(true);
  });

  it("asks for the Drafts list again after a withdraw (#255)", async () => {
    const submitted = { ...DRAFT, state: "submitted", submitted_revision: 3 };
    const fake = answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts?state=open": { body: [] },
      "GET /api/studio/index": { body: { regions: [] } },
      "GET /api/studio/drafts/d-1": { body: submitted },
      "POST /api/studio/drafts/d-1/withdraw": { body: { ...submitted, state: "open" } },
    });
    renderAt(
      "/studio/drafts",
      <>
        <Route
          path="/studio/drafts"
          element={
            <>
              <Link to="/studio/drafts/d-1">The draft</Link>
              <DraftsPage />
            </>
          }
        />
        <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />
      </>,
    );
    const lists = () => fake.mock.calls.filter(([url]) => url === "/api/studio/drafts?state=open");
    await vi.waitFor(() => expect(lists()).toHaveLength(1));
    await userEvent.click(screen.getByRole("link", { name: "The draft" }));
    await userEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    await screen.findByRole("button", { name: "Submit for review" });
    await userEvent.click(screen.getByRole("link", { name: "Drafts" }));
    await vi.waitFor(() => expect(lists()).toHaveLength(2));
  });

  it("names the problems of a draft whose files no longer read", async () => {
    bench({
      ...DRAFT,
      node: null,
      problems: [
        {
          code: "CS0101",
          field: "region",
          file: "node.yaml",
          line: 3,
          message: "unknown region",
          text: "The region 'algorithms' is not known.",
        },
      ],
    });
    expect(await screen.findByText("The region 'algorithms' is not known.")).toBeInTheDocument();
    expect(screen.queryByTestId("preview")).toBeNull();
  });

  it("switches the preview to phone width", async () => {
    bench();
    await userEvent.click(await screen.findByRole("button", { name: "Phone" }));
    expect(screen.getByTestId("preview")).toHaveClass("max-w-[390px]");
  });
});
