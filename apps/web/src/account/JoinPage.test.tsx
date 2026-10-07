import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { JoinPage } from "./JoinPage";

afterEach(() => vi.unstubAllGlobals());

const routes = (
  <>
    <Route path="/join" element={<JoinPage />} />
    <Route path="/join/:token" element={<JoinPage />} />
  </>
);
const INVITE = { body: { email: "new@example.org", role: "author" } };

describe("JoinPage", () => {
  it("says learner accounts are coming, without an invite", () => {
    answering({ "GET /api/me": SIGNED_OUT });
    renderAt("/join", routes);
    expect(
      screen.getByRole("heading", { name: "Learner accounts are coming" }),
    ).toBeInTheDocument();
  });

  it("creates the account with the invite's address and lands in Studio", async () => {
    const fake = answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/tok": INVITE,
      "POST /api/invites/tok/accept": INVITE,
      "POST /_allauth/browser/v1/auth/signup": { body: { status: 200 } },
    });
    renderAt("/join/tok", routes);
    expect(await screen.findByLabelText("Email")).toHaveValue("new@example.org");
    await userEvent.type(screen.getByLabelText("Password"), "a long password");
    await userEvent.click(screen.getByRole("button", { name: "Create your account" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio");
    const order = fake.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);
    expect(order.indexOf("POST /api/invites/tok/accept")).toBeLessThan(
      order.indexOf("POST /_allauth/browser/v1/auth/signup"),
    );
  });

  it("shows allauth's sentence about the address (#234)", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/tok": INVITE,
      "POST /api/invites/tok/accept": INVITE,
      "POST /_allauth/browser/v1/auth/signup": {
        status: 400,
        body: {
          status: 400,
          errors: [{ message: "A user is already registered with this email.", param: "email" }],
        },
      },
    });
    renderAt("/join/tok", routes);
    await userEvent.type(await screen.findByLabelText("Password"), "a long password");
    await userEvent.click(screen.getByRole("button", { name: "Create your account" }));
    expect(
      await screen.findByText("A user is already registered with this email."),
    ).toBeInTheDocument();
  });

  it("shows the API's sentence for a spent invite", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/old": {
        status: 410,
        body: { detail: "This invite has expired; ask for a new one.", code: "CA0104" },
      },
    });
    renderAt("/join/old", routes);
    expect(
      await screen.findByText("This invite has expired; ask for a new one."),
    ).toBeInTheDocument();
  });

  it("does not sign up when the invite was spent meanwhile", async () => {
    const fake = answering({
      "GET /api/me": SIGNED_OUT,
      "GET /api/invites/tok": INVITE,
      "POST /api/invites/tok/accept": {
        status: 410,
        body: { detail: "This invite has been used already.", code: "CA0106" },
      },
    });
    renderAt("/join/tok", routes);
    await userEvent.type(await screen.findByLabelText("Password"), "a long password");
    await userEvent.click(screen.getByRole("button", { name: "Create your account" }));
    expect(await screen.findByText("This invite has been used already.")).toBeInTheDocument();
    expect(fake.mock.calls.some(([url]) => url.endsWith("/auth/signup"))).toBe(false);
  });
});
