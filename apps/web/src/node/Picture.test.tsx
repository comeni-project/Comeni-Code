import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ImageRecordOut } from "../api/schema";
import { Body } from "./Body";
import { deedOf } from "./licence";

const COMMONS: ImageRecordOut = {
  file: "kmers.png",
  alt: "Three reads cut into overlapping k-mers.",
  author: "Jane Doe",
  source: "https://commons.wikimedia.org/wiki/File:Kmers.png",
  licence: "CC BY-SA 3.0 de",
};
const OWN: ImageRecordOut = {
  file: "graph.png",
  alt: "A graph.",
  author: "Comeni Code",
  source: "own work",
  licence: "CC BY 4.0",
};
const pictures = {
  records: [COMMONS, OWN],
  url: (file: string) => `/api/nodes/n/images/${file}`,
};

describe("Picture (M6IM.5)", () => {
  it("draws the image, its number, caption and credit, as the board's Figure 5", () => {
    render(
      <Body
        blocks={[
          { kind: "image", file: "kmers.png", caption: "Reads cut into $k$-mers.\n" },
          { kind: "text", markdown: "Between.\n" },
          { kind: "image", file: "graph.png", caption: "A drawing.\n" },
        ]}
        questions={[]}
        pictures={pictures}
      />,
    );
    const first = screen.getByRole("img", { name: COMMONS.alt });
    expect(first).toHaveAttribute("src", "/api/nodes/n/images/kmers.png");
    const figures = screen.getAllByRole("figure");
    expect(figures[0]).toHaveTextContent("Figure 1.");
    expect(figures[1]).toHaveTextContent("Figure 2.");
    expect(figures[0]).toHaveTextContent("Image: Jane Doe, via Wikimedia Commons");
    expect(screen.getByRole("link", { name: "CC BY-SA 3.0 de" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/3.0/de/",
    );
    expect(screen.getByRole("link", { name: "source" })).toHaveAttribute("href", COMMONS.source);
    expect(figures[1]).toHaveTextContent("Image: Comeni Code, own work");
    expect((figures[0] as HTMLElement).querySelector(".katex")).not.toBeNull();
  });

  it("draws nothing for an image it has no record of", () => {
    const { container } = render(
      <Body blocks={[{ kind: "image", file: "gone.png", caption: "C.\n" }]} questions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links each licence to its deed", () => {
    expect(deedOf("CC0 1.0")).toBe("https://creativecommons.org/publicdomain/zero/1.0/");
    expect(deedOf("Public domain")).toBe("https://creativecommons.org/publicdomain/mark/1.0/");
    expect(deedOf("CC BY 4.0")).toBe("https://creativecommons.org/licenses/by/4.0/");
  });
});
