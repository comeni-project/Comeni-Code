import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the Comeni Code heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Comeni Code" })).toBeInTheDocument();
  });
});
