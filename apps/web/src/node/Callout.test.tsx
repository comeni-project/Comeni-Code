import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Callout } from "./Callout";

describe("Callout", () => {
  it("draws a callout with its kind and title", () => {
    render(
      <Callout kind="misconception" title="TPM is not a count of reads" markdown="Equal reads." />,
    );
    const box = screen.getByRole("note", { name: "Misconception: TPM is not a count of reads" });
    expect(within(box).getByText("Misconception")).toBeInTheDocument();
    expect(within(box).getByText("Equal reads.")).toBeInTheDocument();
  });

  it("is named by its kind alone when it has no title", () => {
    render(<Callout kind="caveat" title="" markdown="Mind the units." />);
    expect(screen.getByRole("note", { name: "Caveat" })).toBeInTheDocument();
  });

  it("draws none of an author's HTML", () => {
    const { container } = render(
      <Callout kind="convention" title="T" markdown={"Text.\n\n<script>alert(1)</script>\n"} />,
    );
    expect(container.querySelector("script")).toBeNull();
  });
});
