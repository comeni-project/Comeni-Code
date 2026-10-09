import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftNodeOut } from "../../api/schema";
import { type Answer, answering, holding, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const saved = (revision: number, blocks: DraftNodeOut["blocks"] = NODE.blocks): Answer => ({
  body: { draft: { ...DRAFT, revision, node: { ...NODE, blocks } }, warnings: [] },
});
const bench = (extra: Record<string, Answer> = {}, blocks = NODE.blocks) => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: { ...NODE, blocks } } },
    ...extra,
  });
  renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
const sent = (fake: ReturnType<typeof answering>, n = 0) =>
  JSON.parse(String(writes(fake)[n]?.[1]?.body));

describe("ContentTab", () => {
  it("saves a changed block when you leave it, once", async () => {
    const fake = bench({
      "PUT /api/studio/drafts/d-1/blocks/0": saved(4, [
        { kind: "text", markdown: "Slide a window of width k." },
      ]),
    });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    const box = screen.getByLabelText("Markdown");
    await userEvent.clear(box);
    await userEvent.type(box, "Slide a window of width k.");
    await userEvent.click(screen.getByRole("heading", { level: 1 })); // focus leaves the block
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(sent(fake)).toEqual({
      block: { kind: "text", markdown: "Slide a window of width k.\n" }, // its last line ended (#256)
      question: null,
      revision: 3,
    });
    expect(await screen.findByText(/saved \d+s ago/)).toBeInTheDocument();
    expect(writes(fake)).toHaveLength(1);
  });

  it("sends nothing when you leave a block unchanged", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByLabelText("Markdown")).toBeNull();
    expect(writes(fake)).toHaveLength(0);
  });

  it("adds a text block on leaving it, and sends nothing for one closed empty", async () => {
    const fake = bench({ "POST /api/studio/drafts/d-1/blocks": saved(4) });
    const add = () => screen.getAllByRole("button", { name: "Add a text block" })[0] as HTMLElement;
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(add());
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(writes(fake)).toHaveLength(0);
    await userEvent.click(add());
    await userEvent.type(screen.getByLabelText("Markdown"), "First words.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(sent(fake)).toEqual({
      at: 0,
      block: { kind: "text", markdown: "First words.\n" },
      question: null,
      revision: 3,
    });
  });

  it("adds a callout with its kind and title", async () => {
    const fake = bench({ "POST /api/studio/drafts/d-1/blocks": saved(4) });
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Add a callout" })[1] as HTMLElement,
    );
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "caveat");
    await userEvent.type(screen.getByLabelText("Title"), "Not every k works");
    await userEvent.type(screen.getByLabelText("Markdown"), "Too small and k-mers repeat.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(sent(fake).at).toBe(1);
    expect(sent(fake).block).toEqual({
      kind: "callout",
      callout: "caveat",
      title: "Not every k works",
      markdown: "Too small and k-mers repeat.\n",
    });
  });

  it("opens the block you chose once an insert lands, and saves it in its new place (#255)", async () => {
    const alpha = { kind: "text", markdown: "Alpha." } as const;
    const beta = { kind: "text", markdown: "Beta." } as const;
    const added = { kind: "text", markdown: "New." } as const;
    const fake = bench({}, [alpha, beta]);
    const release = holding(fake, "POST /api/studio/drafts/d-1/blocks");
    const [top] = await screen.findAllByRole("button", { name: "Add a text block" });
    await userEvent.click(top as HTMLElement);
    await userEvent.type(screen.getByLabelText("Markdown"), "New.");
    await userEvent.click(screen.getByRole("button", { name: "Edit block 2" })); // Beta, mid-save
    release(saved(4, [added, alpha, beta]));
    await vi.waitFor(() => expect(screen.getByLabelText("Markdown")).toHaveValue("Beta."));
    await userEvent.type(screen.getByLabelText("Markdown"), " More.");
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(2));
    expect(writes(fake)[1]?.[0]).toBe("/api/studio/drafts/d-1/blocks/2");
  });

  it("stays on a block whose save was refused when you pick another tab (#255)", async () => {
    bench({
      "PUT /api/studio/drafts/d-1/blocks/0": {
        status: 409,
        body: { detail: "This draft has moved on to revision 4.", code: "CA0203" },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.type(screen.getByLabelText("Markdown"), " More.");
    await userEvent.click(screen.getByRole("tab", { name: "Resources" }));
    expect(await screen.findByText(/Someone else saved this draft/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Markdown")).toHaveValue(
      "The trick is to stop treating reads as units. More.",
    );
  });

  it("goes to the tab you picked once the block's save lands", async () => {
    bench({ "PUT /api/studio/drafts/d-1/blocks/0": saved(4) });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.type(screen.getByLabelText("Markdown"), " More.");
    await userEvent.click(screen.getByRole("tab", { name: "Resources" }));
    await vi.waitFor(() =>
      expect(screen.getByRole("tab", { name: "Resources" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("keeps the text and offers Reload when someone else saved first", async () => {
    bench({
      "PUT /api/studio/drafts/d-1/blocks/0": {
        status: 409,
        body: { detail: "This draft has moved on to revision 4.", code: "CA0203" },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.type(screen.getByLabelText("Markdown"), " More.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByText(/Someone else saved this draft/)).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown")).toHaveValue(
      "The trick is to stop treating reads as units. More.",
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("names the problems a refused save would have made", async () => {
    bench({
      "PUT /api/studio/drafts/d-1/blocks/0": {
        status: 422,
        body: {
          detail: "The draft would not read.",
          code: "CA0208",
          problems: [
            {
              code: "CS0415",
              field: null,
              file: "body.md",
              line: 1,
              message: "x",
              text: "A fence inside a text block is not allowed.",
            },
          ],
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: /Edit block 1/ }));
    await userEvent.type(screen.getByLabelText("Markdown"), " :::");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(
      await screen.findByText("A fence inside a text block is not allowed."),
    ).toBeInTheDocument();
  });

  it("moves a block with one request", async () => {
    const fake = bench({ "POST /api/studio/drafts/d-1/blocks/1/move": saved(4) }, [
      ...NODE.blocks,
      { kind: "text", markdown: "Second." },
    ]);
    expect(await screen.findByRole("button", { name: "Move block 1 up" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move block 2 up" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(writes(fake).map(([url]) => url)).toEqual(["/api/studio/drafts/d-1/blocks/1/move"]);
    expect(sent(fake)).toEqual({ to: 0, revision: 3 });
  });

  it("deletes a block after confirming in place", async () => {
    const fake = bench({ "DELETE /api/studio/drafts/d-1/blocks/0?revision=3": saved(4, []) });
    await userEvent.click(await screen.findByRole("button", { name: "Delete block 1" }));
    expect(screen.getByText("Delete this block?")).toBeInTheDocument();
    expect(writes(fake)).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
  });

  it("lists the blocks in the outline, and opens one from it", async () => {
    bench();
    const outline = await screen.findByRole("navigation", { name: "Outline" });
    await userEvent.click(
      screen.getByRole("button", { name: /The trick is to stop treating reads/ }),
    );
    expect(outline).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown")).toBeInTheDocument();
  });

  it("offers no editing on a draft that is not open", async () => {
    answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts/d-1": { body: { ...DRAFT, state: "approved" } },
    });
    renderAt("/studio/drafts/d-1", <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />);
    expect(await screen.findByText(/Approved — read only/)).toBeInTheDocument();
    expect(screen.getAllByText(/The trick is to stop/).length).toBeGreaterThan(0);
    for (const name of [/Edit block/, /Move block/, /Delete block/, /Add a/])
      expect(screen.queryByRole("button", { name })).toBeNull();
  });
});
