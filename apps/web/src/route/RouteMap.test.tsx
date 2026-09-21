import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { layout } from "./layout";
import { LARGEST, RouteMap } from "./RouteMap";
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

  it("describes itself for a reader who cannot see it", () => {
    map();
    const drawing = screen.getByRole("img", { name: /17 stops/ });
    expect(drawing).toHaveAccessibleName(/5 lines/);
    expect(drawing).toHaveAccessibleName(/ending at Salmon/);
  });

  it("draws each title on the map, wrapped", () => {
    map();
    const drawing = screen.getByRole("img", { name: /17 stops/ });
    expect(within(drawing).getByText("Reads that map to")).toBeInTheDocument();
    expect(within(drawing).getByText("several places")).toBeInTheDocument();
  });

  it("draws the canvas's three marks", () => {
    const { container } = render(<RouteMap route={SALMON} selected={null} onSelect={vi.fn()} />);
    expect(container.querySelectorAll('[data-mark="goal"]')).toHaveLength(1);
    expect(
      container.querySelector('[data-mark="meets"][data-stop="dna-and-genes"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-mark="stop"][data-stop="likelihood"]')).not.toBeNull();
  });

  it("rings the selected stop", () => {
    const { container } = render(<RouteMap route={SALMON} selected="k-mers" onSelect={vi.fn()} />);
    expect(container.querySelector('[data-selected="k-mers"]')).not.toBeNull();
  });

  it("never draws bigger than its largest scale, so a short route keeps its text size", () => {
    map();
    const frame = screen.getByRole("img", { name: /17 stops/ }).parentElement;
    expect(frame).toHaveStyle({ maxWidth: `${layout(SALMON).box.width * LARGEST}px` });
  });

  it("wraps a long goal name", () => {
    const long = {
      ...SALMON,
      stops: SALMON.stops.map((stop) =>
        stop.id === "salmon" ? { ...stop, title: "Uncertainty in abundance" } : stop,
      ),
    };
    render(<RouteMap route={long} selected={null} onSelect={vi.fn()} />);
    const drawing = screen.getByRole("img", { name: /17 stops/ });
    expect(within(drawing).getByText("Uncertainty in")).toBeInTheDocument();
    expect(within(drawing).getByText("abundance")).toBeInTheDocument();
  });
});
