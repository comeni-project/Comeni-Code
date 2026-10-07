import { screen } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT } from "../test-kit";
import { SignInErrorPage } from "./SignInErrorPage";

afterEach(() => vi.unstubAllGlobals());

const page = (query: string) =>
  renderAt(`/sign-in/error${query}`, <Route path="/sign-in/error" element={<SignInErrorPage />} />);

describe("SignInErrorPage", () => {
  it("is not yet for an account Code doesn't know", () => {
    answering({ "GET /api/me": SIGNED_OUT });
    page("?error=signup_closed&error_process=login");
    expect(
      screen.getByRole("heading", { name: "Learner accounts are coming" }),
    ).toBeInTheDocument();
  });

  it("names any other reason, with a way back", () => {
    answering({ "GET /api/me": SIGNED_OUT });
    page("?error=cancelled");
    expect(screen.getByRole("heading", { name: "Signing in didn’t finish" })).toBeInTheDocument();
    expect(screen.getByText(/cancelled/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
});
