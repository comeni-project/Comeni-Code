import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STARTERS } from "../../figures/kits";
import { SchemaForm } from "./SchemaForm";

function chart(
  data: Record<string, unknown> = STARTERS.chart as unknown as Record<string, unknown>,
) {
  const onOps = vi.fn();
  render(<SchemaForm component="chart" data={data} problems={[]} onOps={onOps} />);
  return onOps;
}

describe("the form generated from a schema (M6CO.4)", () => {
  it("leaves the sheets out", () => {
    chart();
    expect(screen.queryByLabelText(/values/i)).not.toBeInTheDocument();
  });

  it("switches the mark between a name and settings", async () => {
    const onOps = chart();
    const mark = screen.getByRole("combobox", { name: "mark" });
    expect(mark).toHaveAttribute("data-path", "data.mark");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "mark as" }), "settings");
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "mark"], value: { type: "bar" } },
    ]);
  });

  it("sets a name from its enum", async () => {
    const onOps = chart();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "mark" }), "line");
    expect(onOps).toHaveBeenLastCalledWith([{ op: "set", path: ["data", "mark"], value: "line" }]);
  });

  it("offers a channel's field from the values' columns", async () => {
    const onOps = chart();
    const field = screen.getByRole("combobox", { name: "encoding x field" });
    expect([...field.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["k", "n"]);
    await userEvent.selectOptions(field, "n");
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "encoding", "x", "field"], value: "n" },
    ]);
  });

  it("adds a setting the file does not have, and removes one", async () => {
    const onOps = chart();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Add to encoding" }),
      "color",
    );
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "encoding", "color"], value: { type: "quantitative" } },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Remove encoding y" }));
    expect(onOps).toHaveBeenLastCalledWith([{ op: "remove", path: ["data", "encoding", "y"] }]);
  });

  it("writes a switch and a number", async () => {
    const onOps = chart({ ...STARTERS.chart, mark: { type: "line", point: false, opacity: 0.5 } });
    await userEvent.click(screen.getByRole("switch", { name: "mark point" }));
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "mark", "point"], value: true },
    ]);
    const opacity = screen.getByRole("textbox", { name: "mark opacity" });
    await userEvent.clear(opacity);
    await userEvent.type(opacity, "1");
    expect(onOps).toHaveBeenLastCalledWith([
      { op: "set", path: ["data", "mark", "opacity"], value: 1 },
    ]);
  });

  it("shows a track's alphabet and a flow's direction, never their sheets", () => {
    render(
      <SchemaForm
        component="sequence-track"
        data={STARTERS["sequence-track"] as unknown as Record<string, unknown>}
        problems={[]}
        onOps={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "alphabet" })).toHaveValue("dna");
    expect(screen.queryByText("features")).not.toBeInTheDocument();
  });
});
