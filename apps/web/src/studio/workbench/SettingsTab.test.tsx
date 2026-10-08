import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const REGIONS = {
  regions: [
    { id: "algorithms", name: "Algorithms" },
    { id: "biology", name: "Biology" },
  ],
};
const bench = (draft: DraftOut = DRAFT, extra: Record<string, Answer> = {}) => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: draft },
    "GET /api/studio/index": { body: REGIONS },
    ...extra,
  });
  renderAt(
    "/studio/drafts/d-1?tab=settings",
    <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />,
  );
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");

describe("SettingsTab", () => {
  it("saves a changed field when you leave it, and only that field", async () => {
    const fake = bench(DRAFT, {
      "PATCH /api/studio/drafts/d-1/fields": {
        body: {
          draft: { ...DRAFT, revision: 4, node: { ...NODE, title: "k-mers, counted" } },
          warnings: [],
        },
      },
    });
    const title = await screen.findByLabelText("Title");
    await userEvent.type(title, ", counted");
    await userEvent.click(screen.getByLabelText("Claim"));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(writes(fake)[0]?.[0]).toBe("/api/studio/drafts/d-1/fields");
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body))).toEqual({
      title: "k-mers, counted",
      revision: 3,
    });
  });

  it("sends nothing when you leave a field unchanged", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByLabelText("Title"));
    await userEvent.click(screen.getByLabelText("Claim"));
    await userEvent.click(screen.getByLabelText("Title"));
    expect(writes(fake)).toHaveLength(0);
  });

  it("sends minutes as a number and the region chosen", async () => {
    const fake = bench(DRAFT, {
      "PATCH /api/studio/drafts/d-1/fields": {
        body: { draft: { ...DRAFT, revision: 4 }, warnings: [] },
      },
    });
    await screen.findByRole("option", { name: "Biology" });
    await userEvent.selectOptions(screen.getByLabelText("Region"), "biology");
    await userEvent.click(screen.getByLabelText("Title"));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body))).toEqual({
      region: "biology",
      revision: 3,
    });
  });

  it("shows a problem about a field under it", async () => {
    bench({
      ...DRAFT,
      problems: [
        {
          code: "CS0020",
          field: "title",
          file: "node.yaml",
          line: 2,
          message: "x",
          text: "A title is at most 80 characters.",
        },
      ],
    });
    expect(await screen.findByText("A title is at most 80 characters.")).toBeInTheDocument();
  });

  it("discards the draft after asking once", async () => {
    const fake = bench(DRAFT, {
      "POST /api/studio/drafts/d-1/discard": { body: { ...DRAFT, state: "discarded" } },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Discard this draft" }));
    expect(screen.getByText("Discard this draft? It cannot be reopened.")).toBeInTheDocument();
    expect(writes(fake)).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByText(/Discarded\./)).toBeInTheDocument();
    expect(writes(fake).map(([url]) => url)).toEqual(["/api/studio/drafts/d-1/discard"]);
  });

  it("offers no Discard to a member who neither saved it nor operates", async () => {
    bench({ ...DRAFT, contributors: [] });
    await screen.findByLabelText("Title");
    expect(screen.queryByRole("button", { name: "Discard this draft" })).toBeNull();
  });
});
