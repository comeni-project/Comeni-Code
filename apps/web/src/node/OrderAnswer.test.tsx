import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderAnswer } from "./OrderAnswer";

describe("OrderAnswer (#264)", () => {
  it("keeps focus on the step it moved to the top, and says where it stands", async () => {
    render(<OrderAnswer steps={["B", "A", "C"]} disabled={false} onCheck={vi.fn()} />);
    const up = screen.getByRole("button", { name: "Move A up" });
    up.focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move A down" }));
    expect(screen.getByRole("status")).toHaveTextContent("A, step 1 of 3");
  });

  it("keeps focus on the step it moved to the bottom", async () => {
    render(<OrderAnswer steps={["A", "C", "B"]} disabled={false} onCheck={vi.fn()} />);
    screen.getByRole("button", { name: "Move C down" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move C up" }));
    expect(screen.getByRole("status")).toHaveTextContent("C, step 3 of 3");
  });
});
