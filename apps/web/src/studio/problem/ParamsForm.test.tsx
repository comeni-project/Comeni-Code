import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { COUNT_KIT, DE_BRUIJN_KIT } from "./kits.fixture";
import { ParamsForm } from "./ParamsForm";

it("draws one input per param, its bounds as the hint, and writes one change", async () => {
  const onSet = vi.fn();
  render(
    <ParamsForm
      schema={DE_BRUIJN_KIT.params_schema}
      root={["params"]}
      value={{ k: 4, genome: 300, read: 30, coverage: 8, errors: 0 }}
      onSet={onSet}
      findings={[{ code: "CS1101", path: "params.read", message: "must be at least 4" }]}
    />,
  );
  expect(screen.getByText("3–12")).toBeTruthy();
  expect(screen.getByText("must be at least 4")).toBeTruthy();
  const k = screen.getByLabelText("k");
  await userEvent.clear(k);
  await userEvent.type(k, "9");
  expect(onSet).toHaveBeenLastCalledWith(["params", "k"], 9);
});

it("draws a range as two inputs", async () => {
  const onSet = vi.fn();
  render(
    <ParamsForm
      schema={COUNT_KIT.params_schema}
      root={["params"]}
      value={{ k: 8, genome: [300, 400], read: 30, coverage: 8, errors: 0 }}
      onSet={onSet}
      findings={[]}
    />,
  );
  const top = screen.getByLabelText("genome, longest");
  await userEvent.clear(top);
  await userEvent.type(top, "450");
  expect(onSet).toHaveBeenLastCalledWith(["params", "genome", 1], 450);
});
