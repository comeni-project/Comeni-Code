import { screen } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT, signedInAs } from "../test-kit";
import { StudioHome } from "./StudioHome";
import { StudioShell } from "./StudioShell";

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

  it("opens the first page a member can open", async () => {
    answering({ "GET /api/me": signedInAs("operator") });
    studio("/studio");
    expect(await screen.findByText("Team page")).toBeInTheDocument();
  });

  it("says when there is nothing for a role yet", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    studio("/studio");
    expect(await screen.findByText("Nothing in Studio for your role yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team" })).toBeNull();
  });

  it("shows the API's sentence when it cannot say who you are", async () => {
    answering({ "GET /api/me": { status: 503, body: { detail: "The database is down." } } });
    studio("/studio/team");
    expect(await screen.findByText("The database is down.")).toBeInTheDocument();
    expect(screen.queryByTestId("where")).toBeNull();
  });
});
