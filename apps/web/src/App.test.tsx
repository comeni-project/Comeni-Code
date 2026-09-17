import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the identity specimen under the Comeni Code bar", () => {
    render(<App />);
    expect(screen.getByText("Comeni Code")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Identity specimen" }),
    ).toBeInTheDocument();
  });
});
