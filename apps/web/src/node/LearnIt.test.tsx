import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResourceOut } from "../api/schema";
import { DE_BRUIJN } from "./debruijn.fixture";
import { LearnIt } from "./LearnIt";

const [VIDEO, READING, TUTORIAL] = DE_BRUIJN.resources as [ResourceOut, ResourceOut, ResourceOut];
// The fixtures link every video: Khan Academy is linked, never embedded (issue 76). Playing one
// in the page is still what Learn it does for a provider that allows it, so these tests embed one.
const EMBEDDED: ResourceOut = {
  ...VIDEO,
  provider: { id: "open-video", name: "Open video" },
  video: "youtube:Jnk_4Maf5Fk",
  licence: "CC BY 4.0",
  display: "embed",
};

describe("Learn it", () => {
  it("says what the outside resources are for", () => {
    render(<LearnIt resources={DE_BRUIJN.resources} />);
    expect(screen.getByRole("heading", { level: 2, name: "Learn it" })).toHaveAttribute(
      "id",
      "learn-it",
    );
    expect(screen.getByText(/Each outside resource was picked by a reviewer/)).toBeInTheDocument();
  });

  it("plays an embedded video in the page, without cookies", () => {
    render(<LearnIt resources={[EMBEDDED, READING]} />);
    const player = screen.getByTitle(`Open video: ${VIDEO.covers}`);
    expect(player.tagName).toBe("IFRAME");
    expect(player).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/Jnk_4Maf5Fk");
    expect(player).toHaveAttribute("loading", "lazy");
  });

  it("starts the player at the part", () => {
    render(<LearnIt resources={[{ ...EMBEDDED, part: "0:30–2:00" }]} />);
    expect(screen.getByTitle(`Open video: ${VIDEO.covers}`)).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/Jnk_4Maf5Fk?start=30&end=120",
    );
  });

  it("says what the video covers, whose it is, and where it lives", () => {
    render(<LearnIt resources={[EMBEDDED]} />);
    const card = screen.getByRole("article", { name: "Open video video" });
    expect(within(card).getByText("Video")).toBeInTheDocument();
    expect(within(card).getByText("Foundations")).toBeInTheDocument();
    expect(within(card).getByText(VIDEO.covers)).toBeInTheDocument();
    expect(within(card).getByText("Open video · CC BY 4.0")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Open on Open video" })).toHaveAttribute(
      "href",
      VIDEO.url,
    );
  });

  it("links a Khan Academy video out and never plays it (issue 76)", () => {
    render(<LearnIt resources={DE_BRUIJN.resources} />);
    expect(document.querySelector("iframe")).toBeNull();
    const video = screen.getByRole("link", { name: /Khan Academy video/ });
    expect(video).toHaveAttribute("href", VIDEO.url);
    expect(within(video).getByText("Khan Academy terms · link")).toBeInTheDocument();
  });

  it("links out to every other resource, in a new tab", () => {
    render(<LearnIt resources={DE_BRUIJN.resources} />);
    const reading = screen.getByRole("link", { name: /OpenStax · §17\.3/ });
    expect(reading).toHaveAttribute("href", READING.url);
    expect(reading).toHaveAttribute("target", "_blank");
    expect(reading).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(reading).getByText("Reading")).toBeInTheDocument();
    expect(within(reading).getByText("CC BY 4.0 · link")).toBeInTheDocument();
    expect(within(reading).getByText(READING.covers)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Galaxy Training tutorial/ })).toHaveAttribute(
      "href",
      TUTORIAL.url,
    );
  });

  it("marks a reading shown here when it may be embedded", () => {
    render(<LearnIt resources={[{ ...READING, display: "embed" }]} />);
    expect(screen.getByText("CC BY 4.0 · shown here")).toBeInTheDocument();
  });

  it("draws nothing when a node has no resources", () => {
    const { container } = render(<LearnIt resources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
