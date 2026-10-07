import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answering, SIGNED_OUT } from "../test-kit";
import { TopBar } from "./TopBar";

const FIELD = "Search topics, tools and goals";

function Where() {
  const { pathname, search } = useLocation();
  return <span data-testid="where">{`${pathname}${search}`}</span>;
}

const bar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/health"]}>
        <TopBar />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  answering({ "GET /api/me": SIGNED_OUT });
});
afterEach(() => vi.unstubAllGlobals());

describe("TopBar", () => {
  it("shows the account cell beside what a page puts there", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TopBar>
            <span>theme</span>
          </TopBar>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("theme")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends what was typed to the Start page", async () => {
    bar();
    await userEvent.type(screen.getByLabelText(FIELD), "why my reads don't map{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/?q=why+my+reads+don%27t+map");
  });

  it("goes nowhere when the field is empty", async () => {
    bar();
    await userEvent.type(screen.getByLabelText(FIELD), "{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/health");
  });

  it("focuses the field when / is pressed", async () => {
    bar();
    await userEvent.keyboard("/");
    expect(screen.getByLabelText(FIELD)).toHaveFocus();
  });

  it("leaves / alone while the field has focus", async () => {
    bar();
    const field = screen.getByLabelText(FIELD);
    await userEvent.type(field, "k/mer");
    expect(field).toHaveValue("k/mer");
  });
});
