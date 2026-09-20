import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RouteMap } from "./RouteMap";
import { SALMON } from "./salmon.fixture";

const map = (selected: string | null = null, onSelect = vi.fn()) => {
  render(<RouteMap route={SALMON} selected={selected} onSelect={onSelect} />);
  return onSelect;
};

describe("the map", () => {
  it("draws a button for every stop, titled", () => {
    map();
    expect(screen.getAllByRole("button")).toHaveLength(17);
    expect(screen.getByRole("button", { name: /DNA and genes/ })).toBeInTheDocument();
  });

  it("says which stop is the goal", () => {
    map();
    expect(screen.getByRole("button", { name: /Salmon/ })).toHaveAccessibleName(/your goal/);
  });

  it("shows each stop's minutes", () => {
    map();
    expect(screen.getByRole("button", { name: /DNA and genes/ })).toHaveAccessibleName(/10 min/);
  });

  it("tells the page which stop was clicked", async () => {
    const onSelect = map();
    await userEvent.click(screen.getByRole("button", { name: /k-mers/ }));
    expect(onSelect).toHaveBeenCalledWith("k-mers");
  });

  it("marks the selected stop", () => {
    map("k-mers");
    expect(screen.getByRole("button", { name: /k-mers/ })).toHaveAttribute("aria-current", "true");
  });

  it("names every band beside the map", () => {
    map();
    for (const name of [
      "Molecular biology",
      "Sequencing",
      "Sequence analysis",
      "Statistics",
      "Transcriptomics",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("describes itself for a reader who cannot see it", () => {
    map();
    expect(screen.getByRole("img", { name: /17 stops/ })).toBeInTheDocument();
  });
});
