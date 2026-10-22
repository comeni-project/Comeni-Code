import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STARTERS } from "../../figures/kits";
import { Sheet } from "./Sheet";
import { sheetsOf } from "./sheets";

const [NODES, EDGES] = sheetsOf("flow", STARTERS.flow);

function shown(problems: { code: string; path: string; message: string }[] = []) {
  const onOps = vi.fn();
  if (EDGES === undefined) throw new Error("no sheet");
  render(<Sheet sheet={EDGES} problems={problems} onOps={onOps} />);
  return onOps;
}

describe("a sheet (M6CO.4)", () => {
  it("draws a row per item and a column per key", () => {
    shown();
    expect(screen.getByRole("columnheader", { name: "from" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Edges row 1 to" })).toHaveValue("k-mers");
  });

  it("writes a typed cell at its path", async () => {
    const onOps = shown();
    const cell = screen.getByRole("textbox", { name: "Edges row 1 to" });
    await userEvent.clear(cell);
    await userEvent.type(cell, "x");
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "edges", 0, "to"], value: "x" },
    ]);
  });

  it("removes an optional key left empty", async () => {
    const onOps = shown();
    const cell = screen.getByRole("textbox", { name: "Edges row 1 label" });
    await userEvent.type(cell, "a");
    await userEvent.clear(cell);
    expect(onOps).toHaveBeenLastCalledWith([{ op: "remove", path: ["data", "edges", 0, "label"] }]);
  });

  it("adds, moves and removes rows", async () => {
    if (NODES === undefined) throw new Error("no sheet");
    const onOps = vi.fn();
    render(<Sheet sheet={NODES} problems={[]} onOps={onOps} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a row to Nodes" }));
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "insert", path: ["data", "nodes"], at: 2, item: { id: "", label: "" } },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Move Nodes row 2 up" }));
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "move", path: ["data", "nodes"], from: 1, to: 0 },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Remove Nodes row 1" }));
    expect(onOps).toHaveBeenLastCalledWith([{ op: "remove", path: ["data", "nodes", 0] }]);
  });

  it("fills rows from the cell pasted into, and says what did not fit", () => {
    const onOps = shown();
    fireEvent.paste(screen.getByRole("textbox", { name: "Edges row 1 to" }), {
      clipboardData: { getData: () => "a\tb\tc\n" },
    });
    expect(onOps).toHaveBeenLastCalledWith(
      [
        { op: "set", path: ["data", "edges", 0, "to"], value: "a" },
        { op: "set", path: ["data", "edges", 0, "label"], value: "b" },
      ],
      "1 pasted cell did not fit and was left out.",
    );
  });

  it("marks the cell a problem names", () => {
    shown([{ code: "CS1007", path: "data.edges[0].to", message: "no node is kmrs" }]);
    const cell = screen.getByRole("textbox", { name: "Edges row 1 to" });
    expect(cell).toHaveAttribute("aria-invalid", "true");
    expect(cell).toHaveAttribute("data-path", "data.edges[0].to");
  });
});
