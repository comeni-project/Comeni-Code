// Answering by the figure (M6.6b spec, M6FA.4): real buttons over the drawing, nothing given away
// while asked, the four states.
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FigureOut } from "../../api/schema";
import { derive } from "../kits";
import { FigureAnswer, type Outcome } from "./FigureAnswer";

const TRACE_DATA = {
  reads: [
    { sequence: "ACGTT" },
    { sequence: "CGTTA" },
    { sequence: "GTTAG" },
    { sequence: "CGTC" },
  ],
  k: 3,
  highlight: "none",
};
const TRACE = { task: "trace", spells: "ACGTTAG" };
const PICK_DATA = {
  reads: [
    { sequence: "ACGTTAGC" },
    { sequence: "ACGTTAGC" },
    { sequence: "ACGTCAGC" },
    { sequence: "ACGTTAGG" },
  ],
  k: 3,
};
const PICK = { task: "pick", artifact: "bubble" };
const PATH = ["ACG", "CGT", "GTT", "TTA", "TAG"];

const record = (component: "kmer-graph" | "graph-artifacts", data: object, interact: object) =>
  ({
    stem: "f",
    component,
    alt: "A graph of k-mers.",
    data,
    derived: derive(component, data, interact),
    source: null,
    interact,
  }) as unknown as FigureOut;

function Held({ figure, outcome = null }: { figure: FigureOut; outcome?: Outcome }) {
  const [selection, setSelection] = useState<string[]>([]);
  return (
    <FigureAnswer record={figure} selection={selection} onSelect={setSelection} outcome={outcome} />
  );
}

const kmer = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });
const live = () => screen.getByTestId("figure-answer-said").textContent;

describe("a trace", () => {
  it("is every k-mer a button, pressed when picked, the live line reading it back", () => {
    render(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} />);
    for (const name of ["ACG", "CGT", "GTT", "TTA", "TAG", "GTC"]) {
      expect(kmer(name)).toHaveAttribute("aria-pressed", "false");
    }
    fireEvent.click(kmer("ACG"));
    fireEvent.click(kmer("CGT"));
    expect(kmer("CGT")).toHaveAttribute("aria-pressed", "true");
    expect(live()).toBe("Your path ACG → CGT spells ACGT");
  });

  it("trace by keyboard: Tab reaches the k-mers in reading order, a pick off the arrows is not taken", async () => {
    render(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} />);
    const order = screen.getAllByRole("button").map((b) => b.getAttribute("data-kmer"));
    expect(order.filter(Boolean)).toEqual(["ACG", "CGT", "GTT", "TTA", "TAG", "GTC"]);
    for (const name of ["ACG", "CGT", "GTT"]) {
      kmer(name).focus();
      fireEvent.keyDown(kmer(name), { key: "Enter" });
      fireEvent.click(kmer(name)); // a button's Enter is its click
    }
    fireEvent.click(kmer("TAG"));
    expect(kmer("TAG")).toHaveAttribute("aria-pressed", "false");
    await vi.waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "TAG doesn’t follow GTT: the only arrow from GTT leads to TTA.",
      ),
    );
    expect(kmer("TTA")).toHaveAttribute("data-next", "");
  });

  it("gives nothing away while asked, and draws the computed path once answered", () => {
    const { container, rerender } = render(
      <Held figure={record("kmer-graph", TRACE_DATA, TRACE)} />,
    );
    expect(container.querySelector("[data-testid=spells]")).toBeNull();
    expect(container.querySelector("[data-on-path]")).toBeNull();
    rerender(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} outcome="right" />);
    const onPath = [...container.querySelectorAll("[data-kmer][data-on-path]")].map((g) =>
      g.getAttribute("data-kmer"),
    );
    expect(onPath).toEqual(PATH);
    expect(screen.queryAllByRole("button").filter((b) => b.hasAttribute("data-kmer"))).toEqual([]);
  });

  it("undoes the last pick and clears them all", () => {
    render(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} />);
    fireEvent.click(kmer("ACG"));
    fireEvent.click(kmer("CGT"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(live()).toBe("Your path ACG spells ACG");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(live()).toBe("Click the k-mer the path starts at. Tab and Enter work too.");
  });

  it("gives each k-mer a tap area of at least 44 px", () => {
    render(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} />);
    const style = kmer("ACG").style;
    expect(style.minWidth).toBe("44px");
    expect(style.minHeight).toBe("44px");
  });
});

describe("a pick", () => {
  it("hides the tips and bubbles while asked, and shows them once answered", () => {
    const { container, rerender } = render(
      <Held figure={record("graph-artifacts", PICK_DATA, PICK)} />,
    );
    expect(container.querySelector("[data-artifact]")).toBeNull();
    fireEvent.click(kmer("TCA"));
    fireEvent.click(kmer("GTC"));
    expect(live()).toBe("Your pick GTC");
    expect(kmer("TCA")).toHaveAttribute("aria-pressed", "false");
    rerender(<Held figure={record("graph-artifacts", PICK_DATA, PICK)} outcome="right" />);
    expect(container.querySelector("[data-artifact=bubble]")).not.toBeNull();
  });
});

describe("what a screen reader hears (#412, #413)", () => {
  it("announces a refusal through a region always there, cleared by Undo and Clear", async () => {
    render(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");
    for (const name of ["ACG", "CGT", "GTT"]) fireEvent.click(kmer(name));
    fireEvent.click(kmer("TAG"));
    expect(screen.getByRole("status")).toBe(status);
    await vi.waitFor(() => expect(status).toHaveTextContent("TAG doesn’t follow GTT"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(status).toHaveTextContent("");
  });

  it("tells a revealed answer from the learner's own", () => {
    render(<Held figure={record("kmer-graph", TRACE_DATA, TRACE)} outcome="revealed" />);
    expect(live()).toBe("The path ACG → CGT → GTT → TTA → TAG spells ACGTTAG");
  });
});
