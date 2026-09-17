import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Specimen } from "./Specimen";

afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("Specimen", () => {
  it("says every colour role in words, not colour alone", () => {
    render(<Specimen />);
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
    render(<Specimen />);
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "system" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(screen.getByRole("button", { name: "system" })).toHaveAttribute("aria-pressed", "true");
  });
});
