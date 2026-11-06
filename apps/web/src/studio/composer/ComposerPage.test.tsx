import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftNodeOut, StudioFigureOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, FLOW, FLOW_TEXT, NODE } from "../workbench/fixtures";
import { ComposerPage } from "./ComposerPage";

afterEach(() => vi.unstubAllGlobals());

const AT = NODE.blocks.length; // the figure's block
const PLACED = { kind: "figure", file: "flow", caption: "Reads become k-mers.\n" } as const;
const WITH_FLOW: DraftNodeOut = { ...NODE, blocks: [...NODE.blocks, PLACED], figures: [FLOW] };
const saved = (node: DraftNodeOut = WITH_FLOW): Answer => ({
  body: { draft: { ...DRAFT, revision: 4, node }, warnings: [] },
});

function composer(path: string, extra: Record<string, Answer> = {}, node = WITH_FLOW) {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node } },
    ...extra,
  });
  renderAt(path, <Route path="/studio/drafts/:id/figures/:stem" element={<ComposerPage />} />);
  return fake;
}
const writes = (fake: ReturnType<typeof answering>) =>
  fake.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") !== "GET")
    .map(([url, init]) => [`${init?.method} ${url}`, JSON.parse(String(init?.body))]);
const edited = (text: string): StudioFigureOut => ({ ...FLOW, text });

describe("the figure composer (M6.5)", () => {
  it("adds a chart by Choose, Data, Describe and one save", async () => {
    const fake = composer("/studio/drafts/d-1/figures/new?at=2", {
      "POST /api/studio/drafts/d-1/figures": saved(),
    });
    await userEvent.click(await screen.findByRole("button", { name: /^chart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("table", { name: "Values" })).toBeInTheDocument();
    // Short words: each key re-renders the composer, and 54 of them neared the timeout (#401).
    await userEvent.type(screen.getByLabelText("Alt text"), "Bars by k.");
    await userEvent.type(screen.getByLabelText("Caption"), "K-mers by k.");
    await userEvent.click(screen.getByRole("button", { name: "Save to the page" }));
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent("/studio/drafts/d-1"),
    );
    const [[call, body]] = writes(fake) as [[string, Record<string, unknown>]];
    expect(call).toBe("POST /api/studio/drafts/d-1/figures");
    expect(body.at).toBe(2);
    expect(body.caption).toBe("K-mers by k.\n");
    expect(String(body.text)).toMatch(/^component: chart\nalt: Bars by k\.\ndata:\n/);
  });

  it("names what a domain component computed, in Data and in Checks (M6DC.5)", async () => {
    composer("/studio/drafts/d-1/figures/new?at=2");
    await userEvent.click(await screen.findByRole("button", { name: /^kmer-graph/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const computed = screen.getByRole("region", { name: "Computed" });
    expect(within(computed).getByText("ACG CGT GTT TTA TAG GTC")).toBeInTheDocument();
    expect(within(computed).getByText("spells ACGTTAG")).toBeInTheDocument();
    const checks = screen.getByRole("region", { name: "Checks" });
    expect(within(checks).getByText("Computed from the reads")).toBeInTheDocument();
    expect(
      within(checks).getByText("6 k-mers, 5 edges; the path of 1–3 spells ACGTTAG"),
    ).toBeInTheDocument();
    expect(screen.getByText("4 reads · k = 3")).toBeInTheDocument();
  });

  it("sends a changed cell as its one line", async () => {
    const fake = composer(`/studio/drafts/d-1/figures/flow?block=${AT}`, {
      "PUT /api/studio/drafts/d-1/figures/flow": saved(),
    });
    const cell = await screen.findByRole("textbox", { name: "Nodes row 2 label" });
    await userEvent.clear(cell);
    await userEvent.type(cell, "kmer");
    await userEvent.click(screen.getByRole("button", { name: "Save to the page" }));
    await waitFor(() => expect(writes(fake)).toHaveLength(1));
    const [[call, body]] = writes(fake) as [[string, { text: string }]];
    expect(call).toBe("PUT /api/studio/drafts/d-1/figures/flow");
    const before = FLOW_TEXT.split("\n");
    const after = body.text.split("\n");
    expect(after.filter((line, n) => line !== before[n])).toEqual([
      "    - {id: kmers, label: kmer}",
    ]);
  });

  it("goes to the cell a check names, keeps the last good drawing and holds Save", async () => {
    composer(`/studio/drafts/d-1/figures/flow?block=${AT}`);
    const cell = await screen.findByRole("textbox", { name: "Edges row 1 to" });
    await userEvent.clear(cell);
    await userEvent.type(cell, "kmrs");
    const checks = screen.getByRole("region", { name: "Checks" });
    expect(within(checks).getByText("CS1007")).toBeInTheDocument();
    expect(within(checks).getByText("data.edges[0].to")).toBeInTheDocument();
    expect(within(checks).getByText("no node is kmrs")).toBeInTheDocument();
    expect(
      screen.getByText("The last drawing that checks; fix 1 problem to see your change."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to the page" })).toBeDisabled();
    cell.blur();
    await userEvent.click(within(checks).getByRole("button", { name: "Go to data.edges[0].to" }));
    expect(screen.getByRole("textbox", { name: "Edges row 1 to" })).toHaveFocus();
  });

  it("opens a layered chart as YAML and says why", async () => {
    const layered =
      "component: chart\nalt: Two layers.\ndata:\n  data: {values: [{a: 1, b: 2}]}\n  layer:\n" +
      "    - {mark: bar, encoding: {x: {field: a, type: quantitative}}}\n";
    composer(
      `/studio/drafts/d-1/figures/flow?block=${AT}`,
      {},
      {
        ...WITH_FLOW,
        figures: [edited(layered)],
      },
    );
    expect(
      await screen.findByText("A layered chart: the form edits one mark, so edit it as YAML."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Edit as YAML" })).toHaveValue(layered);
  });

  it("keeps a file that does not parse as typed, with the sheets hidden", async () => {
    composer(`/studio/drafts/d-1/figures/flow?block=${AT}`);
    await screen.findByRole("table", { name: "Nodes" });
    await userEvent.click(screen.getByText("Edit as YAML"));
    const yaml = screen.getByRole("textbox", { name: "Edit as YAML" });
    await userEvent.type(yaml, "{{  oops: [[");
    expect(screen.queryByRole("table", { name: "Nodes" })).not.toBeInTheDocument();
    expect(screen.getByText(/^It does not parse as YAML/)).toBeInTheDocument();
    expect(yaml).toHaveValue(`${FLOW_TEXT}{  oops: [`);
    expect(screen.getByRole("button", { name: "Save to the page" })).toBeDisabled();
  });

  it("keeps the copy when the server refuses the save", async () => {
    composer(`/studio/drafts/d-1/figures/flow?block=${AT}`, {
      "PUT /api/studio/drafts/d-1/figures/flow": {
        status: 422,
        body: {
          detail: "The figure's file would not validate.",
          code: "CA0208",
          problems: [
            {
              file: "figures/flow.yaml",
              code: "CS1007",
              message: "data.edges[0].to: no node is x",
            },
          ],
        },
      },
    });
    const cell = await screen.findByRole("textbox", { name: "Nodes row 2 label" });
    await userEvent.type(cell, "s");
    await userEvent.click(screen.getByRole("button", { name: "Save to the page" }));
    const checks = screen.getByRole("region", { name: "Checks" });
    expect(await within(checks).findByText("no node is x")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nodes row 2 label" })).toHaveValue("k-merss");
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("sends the caption only once the file is saved, and stays when the file is refused (#390)", async () => {
    const fake = composer(`/studio/drafts/d-1/figures/flow?block=${AT}`, {
      "PUT /api/studio/drafts/d-1/figures/flow": {
        status: 422,
        body: {
          detail: "No.",
          code: "CA0208",
          problems: [{ file: "f", code: "CS1007", message: "x" }],
        },
      },
      [`PUT /api/studio/drafts/d-1/blocks/${AT}`]: saved(),
    });
    await userEvent.type(await screen.findByRole("textbox", { name: "Nodes row 2 label" }), "s");
    await userEvent.type(screen.getByLabelText("Caption"), " Again.");
    await userEvent.click(screen.getByRole("button", { name: "Save to the page" }));
    expect(
      await within(screen.getByRole("region", { name: "Checks" })).findByText("x"),
    ).toBeInTheDocument();
    expect(writes(fake).map(([call]) => call)).toEqual(["PUT /api/studio/drafts/d-1/figures/flow"]);
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("sends a changed caption alone as its block", async () => {
    const fake = composer(`/studio/drafts/d-1/figures/flow?block=${AT}`, {
      [`PUT /api/studio/drafts/d-1/blocks/${AT}`]: saved(),
    });
    await userEvent.type(await screen.findByLabelText("Caption"), " Again.");
    await userEvent.click(screen.getByRole("button", { name: "Save to the page" }));
    await waitFor(() => expect(writes(fake)).toHaveLength(1));
    expect(writes(fake)[0]).toEqual([
      `PUT /api/studio/drafts/d-1/blocks/${AT}`,
      {
        block: { kind: "figure", file: "flow", caption: "Reads become k-mers. Again.\n" },
        question: null,
        revision: 3,
      },
    ]);
  });

  it("sends Describe's alt text to Edit as YAML when the form would lay the file out anew (#393)", async () => {
    const four = FLOW_TEXT.replace(/^ {2}/gm, "    ").replace(/^ {4}- /gm, "        - ");
    composer(
      `/studio/drafts/d-1/figures/flow?block=${AT}`,
      {},
      {
        ...WITH_FLOW,
        figures: [edited(four)],
      },
    );
    expect(
      await screen.findByText(
        "Edit the alt text and the source in Edit as YAML: the form would lay this file out anew.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Alt text")).toBeNull();
    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
  });

  it("names every place the figure shows", async () => {
    composer(`/studio/drafts/d-1/figures/flow?block=${AT}`);
    const here = await screen.findByRole("region", { name: "This figure" });
    expect(here).toHaveTextContent("figures/flow.yaml is placed once in this node: block");
  });

  it("asks before an in-app link leaves unsaved work, and stays when told to (#391)", async () => {
    const ask = vi.fn(() => false);
    vi.stubGlobal("confirm", ask);
    answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: WITH_FLOW } },
    });
    renderAt(
      `/studio/drafts/d-1/figures/flow?block=${AT}`,
      <Route
        path="/studio/drafts/:id/figures/:stem"
        element={
          <>
            <Link to="/studio/drafts">Drafts</Link>
            <ComposerPage />
          </>
        }
      />,
    );
    await userEvent.type(await screen.findByRole("textbox", { name: "Nodes row 2 label" }), "s");
    await userEvent.click(screen.getByRole("link", { name: "Drafts" }));
    expect(ask).toHaveBeenCalledWith("Leave the composer? What you changed here is not saved.");
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
    ask.mockReturnValue(true);
    await userEvent.click(screen.getByRole("link", { name: "Drafts" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts");
  });

  it("leaves without asking when nothing changed", async () => {
    const ask = vi.fn(() => false);
    vi.stubGlobal("confirm", ask);
    composer(`/studio/drafts/d-1/figures/flow?block=${AT}`);
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts/d-1");
    expect(ask).not.toHaveBeenCalled();
  });

  it("says when the draft has no such figure", async () => {
    composer("/studio/drafts/d-1/figures/nope");
    expect(await screen.findByText("This draft has no figure nope.")).toBeInTheDocument();
  });
});

describe("the Interaction step (M6.6b spec, M6FA.6)", () => {
  it("shows for a kit with tasks only, between Data and Describe", async () => {
    composer("/studio/drafts/d-1/figures/new?at=2");
    await userEvent.click(await screen.findByRole("button", { name: /^kmer-graph/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent?.replace(/^[✓\d]/, ""))).toEqual([
      "Choose",
      "Data",
      "Interaction",
      "Describe",
    ]);
    await userEvent.click(screen.getByRole("button", { name: /Interaction/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Trace a path/ }));
    for (const name of ["start", "midway", "wrong answer", "answered"]) {
      expect(screen.getByRole("figure", { name })).toBeInTheDocument();
    }
    const checks = screen.getByRole("region", { name: "Checks" });
    expect(within(checks).getByText("One right answer")).toBeInTheDocument();
    expect(within(checks).getByText("Every state draws")).toBeInTheDocument();
    expect(within(checks).getByText("4 of 4")).toBeInTheDocument();
  });

  it("is not a step for a kit without tasks", async () => {
    composer("/studio/drafts/d-1/figures/new?at=2");
    await userEvent.click(await screen.findByRole("button", { name: /^chart/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: /Interaction/ })).toBeNull();
  });
});
