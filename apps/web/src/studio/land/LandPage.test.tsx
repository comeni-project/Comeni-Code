import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt } from "../../test-kit";
import { landingOf, READY, renderLand } from "./landKit";
import { ReadyTable } from "./ReadyTable";

afterEach(() => vi.unstubAllGlobals());

describe("LandPage — its place", () => {
  it("opens with three questions and counts each view", async () => {
    const fake = renderLand();
    expect(await screen.findByRole("tab", { name: /Ready to land 2/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Landed 1/ })).toBeInTheDocument();
    const asked = fake.mock.calls.map(([url]) => url).filter((url) => url !== "/api/me");
    expect(asked.sort()).toEqual([
      "/api/studio/index",
      "/api/studio/landings",
      "/api/studio/landings/ready",
    ]);
  });
});

describe("LandPage — ready to land", () => {
  it("lists each draft with its region, approver and files", async () => {
    renderLand();
    expect(await screen.findByRole("link", { name: "salmon" })).toHaveAttribute(
      "href",
      "/studio/drafts/d-1",
    );
    expect(screen.getByText("~node ~body")).toBeInTheDocument();
    expect(screen.getByText("Otto · self-approved")).toBeInTheDocument();
    expect(screen.getByText("-exam")).toBeInTheDocument();
  });

  it("lands the picked drafts as one pull request and shows the landing", async () => {
    const made = landingOf({ public_id: "l-9", state: "pending", pull_number: null });
    const fake = renderLand({ "POST /api/studio/landings": { status: 202, body: made } });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Pick salmon" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Pick tpm" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Land 2 drafts as one pull request" }),
    );
    const sent = fake.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ drafts: ["d-1", "d-2"] });
    expect(await screen.findByRole("tab", { name: /Landing/, selected: true })).toBeInTheDocument();
  });

  it("says a refusal, each problem under the draft it names", async () => {
    // Review Focus 5.
    const problem = (file: string, text: string) => ({
      file,
      line: 3,
      field: null,
      code: "CS0011",
      message: text,
      text,
    });
    renderLand({
      "POST /api/studio/landings": {
        status: 422,
        body: {
          detail: "The batch does not validate in place.",
          code: "CA0305",
          problems: [
            problem("transcriptomics/tpm/node.yaml", "tpm needs a node that is gone"),
            problem("graph", "a cycle through k-mers"),
          ],
        },
      },
    });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Pick tpm" }));
    await userEvent.click(screen.getByRole("button", { name: "Land 1 draft as one pull request" }));
    expect(await screen.findByText("The batch does not validate in place.")).toBeInTheDocument();
    // The problem is the row right under tpm's.
    const rows = screen.getAllByRole("row");
    const at = rows.findIndex((r) => r.textContent === "tpm needs a node that is gone");
    expect(rows[at - 1]).toHaveTextContent(/^tpm/);
    expect(screen.getByText("a cycle through k-mers")).toBeInTheDocument();
  });

  it("sends only the picked drafts still listed", async () => {
    // Review Focus 4: salmon left the list (landed from another tab) after it was picked.
    function Shrinking() {
      const [rows, setRows] = useState(READY);
      return (
        <>
          <button type="button" onClick={() => setRows(READY.slice(1))}>
            shrink
          </button>
          <ReadyTable rows={rows} loaded onLanded={() => {}} />
        </>
      );
    }
    const fake = answering({
      "POST /api/studio/landings": { status: 202, body: landingOf({ state: "pending" }) },
    });
    renderAt("/", <Route path="/" element={<Shrinking />} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Pick salmon" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Pick tpm" }));
    await userEvent.click(screen.getByRole("button", { name: "shrink" }));
    await userEvent.click(screen.getByRole("button", { name: "Land 1 draft as one pull request" }));
    const sent = fake.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ drafts: ["d-2"] });
  });

  it("says when nothing is ready", async () => {
    renderLand({ "GET /api/studio/landings/ready": { body: [] } });
    expect(await screen.findByText("No approved drafts are waiting to land.")).toBeInTheDocument();
  });
});
