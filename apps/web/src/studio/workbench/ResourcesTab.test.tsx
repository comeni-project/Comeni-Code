import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioResourceOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

const KHAN: StudioResourceOut = {
  kind: "video",
  provider: "khan-academy",
  url: "https://www.khanacademy.org/science/dna",
  video: "youtube:abc123",
  part: "2:10–7:45",
  covers: "Why reads are cut into k-mers.",
  licence: "Khan Academy terms",
  display: "link",
  level: "introductory",
};
const OPENSTAX = {
  kind: "reading",
  provider: "openstax",
  url: "https://openstax.org/books/biology-2e/pages/17-1",
  covers: "How genomes are sequenced.",
  licence: "CC BY 4.0",
  display: "embed",
  level: "introductory",
};
const savedAs: Answer = { body: { draft: { ...DRAFT, revision: 4 }, warnings: [] } };
const bench = (put: Answer = savedAs) => {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: { ...NODE, resources: [KHAN] } } },
    "PUT /api/studio/drafts/d-1/resources": put,
  });
  renderAt(
    "/studio/drafts/d-1?tab=resources",
    <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />,
  );
  return fake;
};
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
const leave = () => userEvent.click(screen.getByRole("heading", { level: 1 }));
const fill = async () => {
  const card = screen.getByRole("group", { name: "New resource" });
  const w = within(card);
  await userEvent.selectOptions(w.getByLabelText("Kind"), "reading");
  await userEvent.type(w.getByLabelText("Provider"), OPENSTAX.provider);
  await userEvent.type(w.getByLabelText("URL"), OPENSTAX.url);
  await userEvent.type(w.getByLabelText("Covers"), OPENSTAX.covers);
  await userEvent.type(w.getByLabelText("Licence"), OPENSTAX.licence);
  await userEvent.selectOptions(w.getByLabelText("Display"), "embed");
  await userEvent.selectOptions(w.getByLabelText("Level"), "introductory");
};

describe("ResourcesTab", () => {
  it("adds a resource when you leave its card, sending the whole list", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "+ Resource" }));
    await fill();
    await leave();
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    const body = JSON.parse(String(writes(fake)[0]?.[1]?.body));
    expect(body.resources).toEqual([KHAN, { ...OPENSTAX, video: "", part: "" }]);
    expect(body.revision).toBe(3);
  });

  it("sends nothing for a new card left empty", async () => {
    const fake = bench();
    await userEvent.click(await screen.findByRole("button", { name: "+ Resource" }));
    await userEvent.click(
      within(screen.getByRole("group", { name: "New resource" })).getByLabelText("URL"),
    );
    await leave();
    expect(writes(fake)).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "New resource" })).toBeNull();
  });

  it("shows a video's id and part only for a video", async () => {
    bench();
    await userEvent.click(await screen.findByRole("button", { name: "Edit Video · khan-academy" }));
    expect(screen.getByLabelText("Video id")).toHaveValue("youtube:abc123");
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "reading");
    expect(screen.queryByLabelText("Video id")).toBeNull();
  });

  it("removes a resource with one request", async () => {
    const fake = bench();
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove Video · khan-academy" }),
    );
    await vi.waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(JSON.parse(String(writes(fake)[0]?.[1]?.body)).resources).toEqual([]);
  });

  it("keeps the card's values and names the problems of a refused save", async () => {
    bench({
      status: 422,
      body: {
        detail: "The draft would not read.",
        code: "CA0208",
        problems: [
          {
            code: "CS0310",
            field: "resources",
            file: "node.yaml",
            line: 9,
            message: "x",
            text: "OpenStax is not a provider this index knows.",
          },
        ],
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "+ Resource" }));
    await fill();
    await leave();
    expect(
      await screen.findByText("OpenStax is not a provider this index knows."),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "New resource" })).getByLabelText("URL"),
    ).toHaveValue(OPENSTAX.url);
  });
});
