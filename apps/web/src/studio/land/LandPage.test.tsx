import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt } from "../../test-kit";
import { INDEX, landingOf, READY, renderLand } from "./landKit";
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

describe("LandPage — the landings", () => {
  const dropped = {
    draft: "d-8",
    node_id: "de-bruijn-graphs",
    revision: 2,
    live: false,
    dropped_code: "CA0306",
    dropped_reason: "de-bruijn-graphs changed on main since this draft was opened.",
  };

  it("lists a view's landings and shows the one picked", async () => {
    renderLand();
    await userEvent.click(await screen.findByRole("tab", { name: /Landed/ }));
    await userEvent.click(screen.getByRole("button", { name: /#41/ }));
    expect(screen.getByText("1 node in one pull request")).toBeInTheDocument();
    expect(screen.getAllByText("The index follows main")).toHaveLength(1);
  });

  it("shows the moving landing's steps and what was dropped", async () => {
    const live = landingOf({ entries: [...landingOf().entries, dropped] });
    renderLand({ "GET /api/studio/landings": { body: [live] } });
    expect(await screen.findByText("Its checks are running")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText(/de-bruijn-graphs/, { selector: "b" }).parentElement).toHaveTextContent(
      "dropped: de-bruijn-graphs changed on main since this draft was opened. (CA0306)",
    );
    expect(screen.getByText("k-mers · rev 6")).toBeInTheDocument();
  });

  it("keeps each kept draft apart (#315)", async () => {
    const two = {
      draft: "d-7",
      node_id: "salmon",
      revision: 4,
      live: true,
      dropped_code: "",
      dropped_reason: "",
    };
    const live = landingOf({ entries: [...landingOf().entries, two] });
    renderLand({ "GET /api/studio/landings": { body: [live] } });
    expect(await screen.findByText("k-mers · rev 6")).toBeInTheDocument();
    expect(screen.getByText("salmon · rev 4")).toBeInTheDocument();
  });

  it("draws a state tag at its word's width (#316)", async () => {
    renderLand();
    await userEvent.click(await screen.findByRole("tab", { name: /Landed/ }));
    const row = screen.getByRole("button", { name: /#41/ });
    expect(within(row).getByText("Landed")).toHaveClass("w-fit");
  });

  it("says a refused landing's reason in place of its steps", async () => {
    const refused = landingOf({
      state: "refused",
      pull_number: null,
      reason: "Every draft was dropped.",
    });
    renderLand({ "GET /api/studio/landings": { body: [refused] } });
    await userEvent.click(await screen.findByRole("tab", { name: /Failed/ }));
    // #318: one short word in the pull request's column.
    await userEvent.click(screen.getByRole("button", { name: /^none/ }));
    expect(screen.getByText("Every draft was dropped.")).toBeInTheDocument();
    // #317: no pull request was opened, so none is counted.
    expect(screen.getByText("No pull request was opened")).toBeInTheDocument();
    expect(screen.queryByText(/in one pull request/)).toBeNull();
    expect(screen.queryByText("Merged into main")).toBeNull();
  });

  it("asks for a moving landing every 15 s and stops once it settles", async () => {
    // Review Focus 3.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let polls = 0;
      const fake = renderLand({
        "GET /api/studio/landings": { body: [landingOf()] },
        "GET /api/studio/landings/l-1": () => {
          polls += 1;
          return { body: landingOf({ state: "merged", landed: true }) };
        },
      });
      await screen.findByText("Its checks are running");
      await vi.advanceTimersByTimeAsync(15_000);
      expect(polls).toBe(1);
      const lists = () =>
        fake.mock.calls.filter(([url]) => url === "/api/studio/landings/ready").length;
      await vi.waitFor(() => expect(lists()).toBe(2)); // asked once more when it settled
      await vi.advanceTimersByTimeAsync(45_000);
      expect(polls).toBe(1);
      expect(lists()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("LandPage — keeping up (final review)", () => {
  it("keeps watching a moving landing while another is shown (#319)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let polls = 0;
      renderLand({
        "GET /api/studio/landings": {
          body: [
            landingOf(),
            landingOf({ public_id: "l-2", pull_number: 41, state: "merged", landed: true }),
          ],
        },
        "GET /api/studio/landings/l-1": () => {
          polls += 1;
          return { body: landingOf() };
        },
      });
      await screen.findByText("Its checks are running");
      await userEvent.click(screen.getByRole("tab", { name: /Landed/ }));
      await userEvent.click(screen.getByRole("button", { name: /#41/ }));
      expect(screen.getByText("comeni-code-content#41 · studio/land-7f3a")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(polls).toBe(1); // watched, not shown, and asked once, not twice
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks for the index again when a landing settles (#321)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fake = renderLand({
        "GET /api/studio/landings": { body: [landingOf()] },
        "GET /api/studio/landings/l-1": { body: landingOf({ state: "merged", landed: true }) },
      });
      await screen.findByText("Its checks are running");
      await vi.advanceTimersByTimeAsync(15_000);
      const index = () => fake.mock.calls.filter(([url]) => url === "/api/studio/index").length;
      await vi.waitFor(() => expect(index()).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("LandPage — the failed card and the index", () => {
  const failed = landingOf({
    public_id: "l-4",
    pull_number: 41,
    state: "failed",
    reason: "validate failed: https://ci.test/run/9",
  });

  it("closes a failed landing and asks for the lists again", async () => {
    const fake = renderLand({
      "GET /api/studio/landings": { body: [failed] },
      "POST /api/studio/landings/l-4/close": { body: { ...failed, state: "closed" } },
    });
    expect(await screen.findByText("validate failed: https://ci.test/run/9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close the landing" }));
    const asked = () =>
      fake.mock.calls.filter(([url]) => url === "/api/studio/landings/ready").length;
    await vi.waitFor(() => expect(asked()).toBe(2));
  });

  it("says main, the live build and how often main is followed", async () => {
    renderLand();
    const card = await screen.findByRole("region", { name: "Main and the index" });
    expect(card).toHaveTextContent("a1b2c3d");
    expect(card).toHaveTextContent("26 nodes");
    expect(card).toHaveTextContent("every 5 minutes, and on a merge");
    expect(card).toHaveTextContent("Up to date.");
  });

  it("says a live build without a commit by its node count alone (#314)", async () => {
    const live = { ...INDEX.live, commit: "" } as typeof INDEX.live;
    renderLand({ "GET /api/studio/index": { body: { ...INDEX, live } } });
    const card = await screen.findByRole("region", { name: "Main and the index" });
    expect(card).toHaveTextContent("Live build26 nodes");
    expect(card).not.toHaveTextContent("· 26 nodes");
  });

  it("says when the index is behind main", async () => {
    renderLand({
      "GET /api/studio/index": { body: { ...INDEX, behind: true, main_head: "ffff000" } },
    });
    expect(await screen.findByText("Behind main.")).toBeInTheDocument();
  });
});
