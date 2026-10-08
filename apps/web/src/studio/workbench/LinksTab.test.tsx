import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const NEEDS = [{ node: "sequencing-reads", reason: "k-mers are cut from reads." }];
const savedAs = { body: { draft: { ...DRAFT, revision: 4 }, warnings: [] } };
const bench = () => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: { ...NODE, needs: NEEDS } } },
    "PUT /api/studio/drafts/d-1/links/needs": savedAs,
    "PUT /api/studio/drafts/d-1/links/goes_deeper": savedAs,
    "PUT /api/studio/drafts/d-1/links/related": savedAs,
  });
  renderAt(
    "/studio/drafts/d-1?tab=links",
    <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />,
  );
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
const list = (name: string) => screen.getByRole("group", { name });
const leave = () => userEvent.click(screen.getByRole("heading", { level: 1 }));

describe("LinksTab", () => {
  it("saves the whole Needs list once when you leave it", async () => {
    const fake = bench();
    await screen.findByRole("group", { name: "Needs" });
    await userEvent.click(within(list("Needs")).getByRole("button", { name: "+ Link" }));
    const nodes = within(list("Needs")).getAllByLabelText("Node");
    await userEvent.type(nodes[1] as HTMLElement, "k-mer-counting");
    await userEvent.type(
      within(list("Needs")).getAllByLabelText("Reason")[1] as HTMLElement,
      "Counting comes first.",
    );
    await leave();
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(writes(fake)[0]?.[0]).toBe("/api/studio/drafts/d-1/links/needs");
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body))).toEqual({
      links: [...NEEDS, { node: "k-mer-counting", reason: "Counting comes first." }],
      revision: 3,
    });
  });

  it("saves a removal the same way, and nothing for an untouched list", async () => {
    const fake = bench();
    await userEvent.click(
      await within(await screen.findByRole("group", { name: "Needs" })).findByRole("button", {
        name: "Remove",
      }),
    );
    await leave();
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body)).links).toEqual([]);
  });

  it("drops a row left without a node", async () => {
    const fake = bench();
    await screen.findByRole("group", { name: "Needs" });
    await userEvent.click(within(list("Needs")).getByRole("button", { name: "+ Link" }));
    await leave();
    expect(writes(fake)).toHaveLength(0);
  });

  it("sends Goes deeper and Related to their own paths", async () => {
    const fake = bench();
    for (const [name, path] of [
      ["Goes deeper", "goes_deeper"],
      ["Related", "related"],
    ] as const) {
      await userEvent.click(
        within(await screen.findByRole("group", { name })).getByRole("button", { name: "+ Link" }),
      );
      await userEvent.type(within(list(name)).getByLabelText("Node"), "overlap-graphs");
      await leave();
      await vi.waitFor(() =>
        expect(writes(fake).map(([url]) => url)).toContain(`/api/studio/drafts/d-1/links/${path}`),
      );
    }
    expect(screen.getByText("At most four.")).toBeInTheDocument();
  });
});
