import { focusManager } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leave } from "../layout/leave";
import { answering, renderAt, SIGNED_OUT, signedInAs } from "../test-kit";
import { StudioHome } from "./StudioHome";
import { StudioShell } from "./StudioShell";

vi.mock("../layout/leave", () => ({ leave: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

const studio = (path: string) =>
  renderAt(
    path,
    <Route path="/studio" element={<StudioShell />}>
      <Route index element={<StudioHome />} />
      <Route path="team" element={<h1>Team page</h1>} />
    </Route>,
  );

describe("StudioShell", () => {
  it("sends the signed-out to Sign in, coming back here", async () => {
    answering({ "GET /api/me": SIGNED_OUT });
    studio("/studio/team");
    expect(await screen.findByTestId("where")).toHaveTextContent("/sign-in?next=%2Fstudio%2Fteam");
  });

  it("tells a member without a role that Studio is for the team", async () => {
    answering({ "GET /api/me": signedInAs("") });
    studio("/studio");
    expect(
      await screen.findByRole("heading", { name: "Studio is for the team" }),
    ).toBeInTheDocument();
  });

  it("names the role a page needs", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    studio("/studio/team");
    expect(await screen.findByText("This page needs the operator role.")).toBeInTheDocument();
    expect(screen.queryByText("Team page")).toBeNull();
  });

  it("shows the page to a member who can open it, with its rail entry", async () => {
    answering({ "GET /api/me": signedInAs("operator") });
    studio("/studio/team");
    expect(await screen.findByText("Team page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page");
  });

  it("opens Drafts for an author", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    studio("/studio");
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/drafts");
  });

  it("shows the API's sentence when it cannot say who you are", async () => {
    answering({ "GET /api/me": { status: 503, body: { detail: "The database is down." } } });
    studio("/studio/team");
    expect(await screen.findByText("The database is down.")).toBeInTheDocument();
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("signs out to Start, not to Sign in", async () => {
    let signedIn = true;
    answering({
      "GET /api/me": () => (signedIn ? signedInAs("operator") : SIGNED_OUT),
      "DELETE /_allauth/browser/v1/auth/session": () => {
        signedIn = false;
        return { status: 401, body: { status: 401 } };
      },
    });
    studio("/studio/team");
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("keeps the open page when asking again fails", async () => {
    let asked = 0;
    answering({
      "GET /api/me": () => {
        asked += 1;
        return asked === 1
          ? signedInAs("operator")
          : { status: 503, body: { detail: "The database is down." } };
      },
    });
    studio("/studio/team");
    expect(await screen.findByText("Team page")).toBeInTheDocument();
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(asked).toBe(2));
    expect(screen.getByText("Team page")).toBeInTheDocument();
  });
});
