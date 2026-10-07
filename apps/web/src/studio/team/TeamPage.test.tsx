import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { TeamPage } from "./TeamPage";

afterEach(() => vi.unstubAllGlobals());

const ME = signedInAs("operator", "Ada");
const ADA = {
  public_id: "u-1",
  email: "ada@example.org",
  name: "Ada",
  role: "operator",
  active: true,
};
const BO = { public_id: "u-2", email: "bo@example.org", name: "Bo", role: "author", active: true };
const CY = {
  public_id: "i-1",
  email: "cy@example.org",
  role: "reviewer",
  expires_at: "2026-10-14T10:00:00Z",
};

const team = (extra: Record<string, Answer> = {}) => {
  const fake = answering({
    "GET /api/me": ME,
    "GET /api/team/members": { body: [ADA, BO] },
    "GET /api/team/invites": { body: [CY] },
    ...extra,
  });
  renderAt("/studio/team", <Route path="/studio/team" element={<TeamPage />} />);
  return fake;
};
const sent = (fake: ReturnType<typeof answering>, key: string) =>
  fake.mock.calls.find(([url, init]) => `${init?.method ?? "GET"} ${url}` === key);
const rowOf = async (text: string) => (await screen.findByText(text)).closest("tr") as HTMLElement;

describe("TeamPage", () => {
  it("lists the members and the pending invites", async () => {
    team();
    expect(await screen.findByText("bo@example.org")).toBeInTheDocument();
    expect(await screen.findByText("cy@example.org")).toBeInTheDocument();
    expect(screen.getByText("Expires 2026-10-14")).toBeInTheDocument();
  });

  it("marks your own row and gives it no actions", async () => {
    team();
    const you = await rowOf("ada@example.org");
    expect(within(you).getByText("you")).toBeInTheDocument();
    expect(within(you).queryByRole("button", { name: /Deactivate/ })).toBeNull();
  });

  it("invites someone by email and role", async () => {
    const fake = team({ "POST /api/team/invites": { status: 201, body: CY } });
    await userEvent.type(await screen.findByLabelText("Email"), "dee@example.org");
    const roles = screen.getByRole("group", { name: "Role for the invite" });
    await userEvent.click(within(roles).getByRole("radio", { name: "Reviewer" }));
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(sent(fake, "POST /api/team/invites")?.[1]?.body).toBe(
      '{"email":"dee@example.org","role":"reviewer"}',
    );
  });

  it("shows why an invite was refused", async () => {
    const sentence = "bo@example.org is already a member; change their role instead.";
    team({ "POST /api/team/invites": { status: 409, body: { detail: sentence, code: "CA0107" } } });
    await userEvent.type(await screen.findByLabelText("Email"), "bo@example.org");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });

  it("changes a member's role", async () => {
    const fake = team({ "PATCH /api/team/members/u-2": { body: { ...BO, role: "reviewer" } } });
    const bo = await rowOf("bo@example.org");
    await userEvent.click(within(bo).getByRole("radio", { name: "Reviewer" }));
    expect(sent(fake, "PATCH /api/team/members/u-2")?.[1]?.body).toBe('{"role":"reviewer"}');
  });

  it("shows the last-operator refusal and keeps the stored role", async () => {
    const sentence = "Studio needs an active operator; make someone else an operator first.";
    team({
      "PATCH /api/team/members/u-1": { status: 409, body: { detail: sentence, code: "CA0108" } },
    });
    const you = await rowOf("ada@example.org");
    await userEvent.click(within(you).getByRole("radio", { name: "Author" }));
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(within(you).getByRole("radio", { name: "Operator" })).toBeChecked();
  });

  it("deactivates only after confirming in the row", async () => {
    const fake = team({
      "POST /api/team/members/u-2/deactivate": { body: { ...BO, active: false } },
    });
    const bo = await rowOf("bo@example.org");
    await userEvent.click(within(bo).getByRole("button", { name: "Deactivate" }));
    expect(sent(fake, "POST /api/team/members/u-2/deactivate")).toBeUndefined();
    await userEvent.click(within(bo).getByRole("button", { name: "Confirm" }));
    expect(sent(fake, "POST /api/team/members/u-2/deactivate")).toBeDefined();
  });

  it("withdraws a pending invite", async () => {
    const fake = team({ "DELETE /api/team/invites/i-1": { status: 204 } });
    const cy = await rowOf("cy@example.org");
    await userEvent.click(within(cy).getByRole("button", { name: "Withdraw" }));
    expect(sent(fake, "DELETE /api/team/invites/i-1")).toBeDefined();
  });
});
