import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Specimen } from "./Specimen";

// The top bar asks who is signed in; that question never answers here.
beforeEach(() => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
});
afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("Specimen", () => {
  it("says every colour role in words, not colour alone", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Specimen />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    for (const role of [
      "Route · valid",
      "Next · selected",
      "Measured · stale",
      "Needs you · wrong",
      "Settled · no colour",
    ]) {
      expect(screen.getByText(role)).toBeInTheDocument();
    }
  });

  it("switches the theme attribute, and system removes it", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Specimen />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "system" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(screen.getByRole("button", { name: "system" })).toHaveAttribute("aria-pressed", "true");
  });
});
