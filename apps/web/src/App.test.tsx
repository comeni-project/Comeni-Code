import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App path={path} />
    </QueryClientProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("App", () => {
  it("shows the health page at /", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Health" })).toBeInTheDocument();
  });

  it("shows the identity specimen at /identity", () => {
    renderAt("/identity");
    expect(
      screen.getByRole("heading", { level: 1, name: "Identity specimen" }),
    ).toBeInTheDocument();
  });

  it("says not found anywhere else, under the Comeni Code bar", () => {
    renderAt("/nowhere");
    expect(screen.getByText("Comeni Code")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
  });
});
