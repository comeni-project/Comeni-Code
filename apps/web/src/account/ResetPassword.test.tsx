import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { RequestResetPage, ResetPasswordPage } from "./ResetPassword";

afterEach(() => vi.unstubAllGlobals());

const routes = (
  <>
    <Route path="/reset-password" element={<RequestResetPage />} />
    <Route path="/reset-password/:key" element={<ResetPasswordPage />} />
  </>
);

describe("resetting a password", () => {
  it("says a link is on its way, whoever asked", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/password/request": { body: { status: 200 } },
    });
    renderAt("/reset-password", routes);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.org");
    await userEvent.click(screen.getByRole("button", { name: "Send a link" }));
    expect(
      await screen.findByText("If an account has that address, a link is on its way."),
    ).toBeInTheDocument();
  });

  it("sets the new password with the link's key", async () => {
    const fake = answering({
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/password/reset": { status: 401, body: { status: 401 } },
    });
    renderAt("/reset-password/k-1", routes);
    await userEvent.type(screen.getByLabelText("New password"), "a long new password");
    await userEvent.click(screen.getByRole("button", { name: "Set the password" }));
    expect(await screen.findByText("Your password is set.")).toBeInTheDocument();
    const reset = fake.mock.calls.find(([url]) => url.endsWith("/password/reset"));
    expect(reset?.[1]?.body).toBe('{"key":"k-1","password":"a long new password"}');
  });

  it("shows why a link no longer works", async () => {
    answering({
      "GET /api/me": SIGNED_OUT,
      "POST /_allauth/browser/v1/auth/password/reset": {
        status: 400,
        body: {
          status: 400,
          errors: [{ message: "The password reset token was invalid.", param: "key" }],
        },
      },
    });
    renderAt("/reset-password/old", routes);
    await userEvent.type(screen.getByLabelText("New password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Set the password" }));
    expect(await screen.findByText("The password reset token was invalid.")).toBeInTheDocument();
  });
});
