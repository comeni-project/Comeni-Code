import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChecklistOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const FAILING: ChecklistOut = {
  passed: false,
  items: [
    { rule: "verifies clean", passed: false, detail: "1 problem" },
    { rule: "a level", passed: true, detail: "introductory" },
    { rule: "a resource", passed: false, detail: "0 resource(s)" },
    { rule: "four exam questions", passed: false, detail: "0 of 4" },
  ],
  problems: [
    {
      code: "CS0201",
      field: "needs",
      file: "node.yaml",
      line: 4,
      message: "x",
      text: "The node 'reads' does not exist.",
    },
  ],
};
const PASSING: ChecklistOut = {
  passed: true,
  items: [
    { rule: "verifies clean", passed: true, detail: "" },
    { rule: "a level", passed: true, detail: "introductory" },
    { rule: "a resource", passed: true, detail: "1 resource(s)" },
    { rule: "four exam questions", passed: true, detail: "4 of 4" },
  ],
  problems: [],
};
const CHECKS = "GET /api/studio/drafts/d-1/checklist";
const bench = (checks: ChecklistOut = FAILING, extra: Record<string, Answer> = {}) => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: DRAFT },
    [CHECKS]: { body: checks },
    "PUT /api/studio/drafts/d-1/blocks/0": {
      body: { draft: { ...DRAFT, revision: 4 }, warnings: [] },
    },
    ...extra,
  });
  renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};
const asked = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(
    ([url, init]) => url.endsWith("/checklist") && (init?.method ?? "GET") === "GET",
  ).length;
const saveBlock = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Edit block 1" }));
  await userEvent.type(screen.getByLabelText("Markdown"), " More.");
  await userEvent.click(screen.getByRole("button", { name: "Done" }));
};

describe("Checks", () => {
  it("asks nothing while hidden, even after a save", async () => {
    const fake = bench();
    await screen.findByRole("heading", { level: 1 });
    await saveBlock();
    await vi.waitFor(() => expect(fake.mock.calls.some(([, i]) => i?.method === "PUT")).toBe(true));
    expect(asked(fake)).toBe(0);
  });

  it("asks nothing on Reload once hidden again (#255)", async () => {
    const fake = bench(FAILING, {
      "PUT /api/studio/drafts/d-1/blocks/0": {
        status: 409,
        body: { detail: "This draft has moved on to revision 4.", code: "CA0203" },
      },
    });
    await userEvent.click(await screen.findByRole("tab", { name: "Checks" }));
    await vi.waitFor(() => expect(asked(fake)).toBe(1));
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));
    await saveBlock();
    await userEvent.click(await screen.findByRole("button", { name: "Reload" }));
    await vi.waitFor(() =>
      expect(fake.mock.calls.filter(([url]) => url === "/api/studio/drafts/d-1")).toHaveLength(2),
    );
    expect(asked(fake)).toBe(1);
  });

  it("asks once when shown, and lists the items and problems", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("tab", { name: "Checks" }));
    expect(await screen.findByText("four exam questions")).toBeInTheDocument();
    expect(screen.getByText("0 of 4")).toBeInTheDocument();
    expect(screen.getByText("The node 'reads' does not exist.")).toBeInTheDocument();
    expect(asked(fake)).toBe(1);
  });

  it("asks again after a save while shown", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("tab", { name: "Checks" }));
    await screen.findByText("four exam questions");
    await saveBlock();
    await vi.waitFor(() => expect(asked(fake)).toBe(2));
  });
});

describe("Submit for review", () => {
  it("says how many items are left and will not submit", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "Submit for review" }));
    const box = await screen.findByRole("dialog", { name: "Before you submit" });
    expect(await within(box).findByText("a resource")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Fix 3 items to submit" })).toBeDisabled();
    expect(asked(fake)).toBe(1);
  });

  it("submits the revision when the checklist passes", async () => {
    const fake = bench(PASSING, {
      "POST /api/studio/drafts/d-1/submit": {
        body: { ...DRAFT, state: "submitted", submitted_revision: 3 },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Submit for review" }));
    const box = await screen.findByRole("dialog", { name: "Before you submit" });
    await userEvent.click(await within(box).findByRole("button", { name: "Submit" }));
    expect(await screen.findByText(/Submitted for review — read only/)).toBeInTheDocument();
    const post = fake.mock.calls.find(([url]) => url.endsWith("/submit"));
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ revision: 3 });
  });

  it("lists the items a refused submit names", async () => {
    bench(PASSING, {
      "POST /api/studio/drafts/d-1/submit": {
        status: 422,
        body: {
          detail: "The checklist does not pass.",
          code: "CA0212",
          problems: [],
          items: [{ rule: "a resource", passed: false, detail: "0 resource(s)" }],
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Submit for review" }));
    const box = await screen.findByRole("dialog", { name: "Before you submit" });
    await userEvent.click(await within(box).findByRole("button", { name: "Submit" }));
    expect(await within(box).findByText("The checklist does not pass.")).toBeInTheDocument();
    expect(within(box).getByText("0 resource(s)")).toBeInTheDocument();
  });

  it("is not offered on a draft that is not open", async () => {
    answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts/d-1": { body: { ...DRAFT, state: "approved", node: NODE } },
    });
    renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
    await screen.findByText(/Approved — read only/);
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  });
});
