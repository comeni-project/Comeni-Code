import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, SIGNED_OUT, signedInAs } from "../test-kit";
import { AccountButton } from "./AccountButton";

afterEach(() => vi.unstubAllGlobals());

const at = (path = "/route") => renderAt(path, <Route path="/route" element={<AccountButton />} />);

describe("AccountButton", () => {
  it("offers Sign in when signed out, coming back here", async () => {
    answering({ "GET /api/me": SIGNED_OUT });
    at();
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Froute",
    );
  });

  it("opens Studio for a member with a role", async () => {
    answering({ "GET /api/me": signedInAs("author") });
    at();
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    expect(screen.getByText("ada@example.org")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/studio",
    );
  });

  it("does not offer Studio without a role", async () => {
    answering({ "GET /api/me": signedInAs("") });
    at();
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    expect(screen.queryByRole("menuitem", { name: "Open Studio" })).toBeNull();
  });

  it("signs out, and offers Sign in again", async () => {
    let signedIn = true;
    answering({
      "GET /api/me": () => (signedIn ? signedInAs("author") : SIGNED_OUT),
      "DELETE /_allauth/browser/v1/auth/session": () => {
        signedIn = false;
        return { status: 401, body: { status: 401 } };
      },
    });
    at();
    await userEvent.click(await screen.findByRole("button", { name: "Account" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/");
  });
});
