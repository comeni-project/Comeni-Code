import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPool } from "./examKit";
import { examQuestion } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("ExamPoolTab", () => {
  it("lists each question with its kind and state, as the board does (M4P.5)", async () => {
    renderPool([examQuestion("a", "approved"), examQuestion("b", "draft", "choice")]);
    expect(await screen.findByText("Q1 · number")).toBeInTheDocument();
    expect(screen.getByText("Q2 · choice")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Question a, number, approved" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question b, choice, draft" })).toBeInTheDocument();
    expect(screen.getByText(/A node needs at least 4 approved questions/)).toBeInTheDocument();
    expect(screen.getByText("2 of 4 · 1 approved")).toBeInTheDocument();
  });

  it("draws its own side panel, not the page's", async () => {
    renderPool([examQuestion("a", "approved")]);
    await screen.findByText("Q1 · number");
    expect(screen.queryByRole("tablist", { name: "Side panel" })).toBeNull();
  });

  it("selects the first question, and another on a click", async () => {
    renderPool([examQuestion("a", "approved"), examQuestion("b", "draft")]);
    const first = await screen.findByRole("button", { name: /^Question a,/ });
    expect(first).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Question b,/ }));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: /^Question b,/ })).toHaveAttribute(
        "aria-current",
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: /^Question a,/ })).toHaveAttribute(
      "aria-current",
      "false",
    );
  });

  it("an empty pool says so and offers + New", async () => {
    renderPool([]);
    expect(await screen.findByText("No exam questions yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ New" })).toBeInTheDocument();
  });

  it("offers no + New on a draft that is not open", async () => {
    renderPool([], {}, { state: "submitted" });
    expect(await screen.findByText("No exam questions yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ New" })).toBeNull();
  });
});
