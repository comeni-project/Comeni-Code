import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Body } from "./Body";

describe("Body", () => {
  it("draws nothing for a text block that is only blank lines", () => {
    const { container } = render(
      <Body blocks={[{ kind: "text", markdown: "\n\n" }]} questions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing for a try whose question the node does not carry", () => {
    const { container } = render(
      <Body blocks={[{ kind: "try", question: "gone" }]} questions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
