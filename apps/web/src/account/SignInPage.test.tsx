import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { SignInPage } from "./SignInPage";

afterEach(() => vi.unstubAllGlobals());

const CONFIG = {
  body: { data: { socialaccount: { providers: [{ id: "github", name: "GitHub" }] } } },
};
const page = (path = "/sign-in") =>
  renderAt(path, <Route path="/sign-in" element={<SignInPage />} />);

describe("SignInPage", () => {
  it("draws one button per provider allauth reports", async () => {
    answering({ "GET /_allauth/browser/v1/config": CONFIG, "GET /api/me": SIGNED_OUT });
    page();
    expect(await screen.findByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
  });

  it("signs in and goes where it was sent from", async () => {
    answering({
      "GET /_allauth/browser/v1/config": CONFIG,
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/login": { body: { status: 200 } },
    });
    page("/sign-in?next=%2Fstudio%2Fteam");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.org");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/studio/team");
  });

  it("shows allauth's sentence beside its field", async () => {
    answering({
      "GET /_allauth/browser/v1/config": CONFIG,
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/login": {
        status: 400,
        body: { status: 400, errors: [{ message: "Wrong password.", param: "password" }] },
      },
    });
    page();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.c");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("links to Create an account and the reset", () => {
    answering({});
    page();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
      "href",
      "/reset-password",
    );
  });
});
