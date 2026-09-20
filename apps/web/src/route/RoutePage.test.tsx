import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoutePage } from "./RoutePage";
import { SALMON } from "./salmon.fixture";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const answering = (body: unknown, status = 200) => {
  const stub = vi.fn(async () => json(body, status));
  vi.stubGlobal("fetch", stub);
  return stub;
};

function open(path = "/route?goal=salmon") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <RoutePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("the Route page", () => {
  it("names the goal, says what it leads to, and shows the span", async () => {
    answering(SALMON);
    open();
    expect(await screen.findByRole("heading", { level: 1, name: "Learn Salmon" })).toBeVisible();
    const salmon = SALMON.stops.find((stop) => stop.id === "salmon");
    expect(screen.getByText(salmon?.claim ?? "")).toBeInTheDocument();
    expect(screen.getByText("First steps → Intermediate")).toBeInTheDocument();
  });

  it("counts the stops and the time", async () => {
    answering(SALMON);
    open();
    expect(await screen.findByText("17 stops")).toBeInTheDocument();
    expect(screen.getByText("about 3 h 4 min")).toBeInTheDocument();
  });

  it("names each line in the rail with how many stops it holds", async () => {
    answering(SALMON);
    open();
    expect(await screen.findByText("Molecular biology")).toBeInTheDocument();
    expect(screen.getByText("Sequence analysis")).toBeInTheDocument();
    expect(screen.getAllByText("4 stops")).toHaveLength(3);
    expect(screen.getByText("3 stops")).toBeInTheDocument();
  });

  it("asks the API for the goal and the known set in the url", async () => {
    const stub = answering(SALMON);
    open("/route?goal=salmon&known=read-mapping");
    await screen.findByText("17 stops");
    expect(stub).toHaveBeenCalledWith(
      "/api/routes?goal=salmon&known=read-mapping",
      expect.anything(),
    );
  });

  it("says it is weaving while it waits", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    open();
    expect(screen.getByText("Weaving your route…")).toBeInTheDocument();
  });

  it("prints the API's own sentence when a goal is gone", async () => {
    answering({ detail: "No topic with id 'zzz'. It may have been removed or renamed." }, 404);
    open("/route?goal=zzz");
    expect(await screen.findByText(/No topic with id 'zzz'/)).toBeInTheDocument();
  });

  it("says when it cannot reach the API", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("no network");
    });
    open();
    expect(await screen.findByText(/Can't reach the API · network error/)).toBeInTheDocument();
  });

  it("says there is no goal yet, with a way back to Start", () => {
    answering(SALMON);
    open("/route");
    expect(screen.getByText("No goal yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start/ })).toHaveAttribute("href", "/");
  });

  it("switches to the list, keeping every stop", async () => {
    answering(SALMON);
    open();
    await userEvent.click(await screen.findByRole("button", { name: "List" }));
    expect(screen.getByRole("list", { name: "Every stop, in order" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(17);
  });

  it("groups the list by what can be done in any order", async () => {
    answering(SALMON);
    open("/route?goal=salmon&view=list");
    // Five of the six columns hold more than one stop; only the goal stands alone.
    expect(await screen.findAllByText("These can be done in any order")).toHaveLength(5);
  });
});

describe("the selected stop", () => {
  const reasonFor = (id: string) =>
    SALMON.stops.find((stop) => stop.id === "k-mers")?.needed_by.find((one) => one.id === id)
      ?.reason ?? "";

  it("asks you to pick one when none is selected", async () => {
    answering(SALMON);
    open();
    expect(await screen.findByText(/Pick a stop to see why it's on your route/)).toBeVisible();
  });

  it("fills the panel from a pasted ?stop=", async () => {
    answering(SALMON);
    open("/route?goal=salmon&stop=k-mers");
    expect(await screen.findByRole("heading", { level: 2, name: "k-mers" })).toBeVisible();
    const kmers = SALMON.stops.find((stop) => stop.id === "k-mers");
    expect(screen.getByText(kmers?.claim ?? "")).toBeInTheDocument();
    const panel = screen.getByRole("complementary");
    expect(panel).toHaveTextContent("Foundations");
    expect(panel).toHaveTextContent("8 min");
  });

  it("lists what it needs and what it unlocks", async () => {
    answering(SALMON);
    open("/route?goal=salmon&stop=k-mers");
    expect(await screen.findByText("Needs")).toBeInTheDocument();
    const panel = screen.getByRole("complementary");
    expect(panel).toHaveTextContent("Unlocks");
    // k-mers is needed by read mapping, and needs DNA and genes.
    expect(panel).toHaveTextContent("Mapping reads to a reference");
    expect(panel).toHaveTextContent("DNA and genes");
  });

  it("gives every stored reason the stop is on this route", async () => {
    answering(SALMON);
    open("/route?goal=salmon&stop=k-mers");
    expect(await screen.findByText("Why it's on this route")).toBeInTheDocument();
    expect(screen.getByText(reasonFor("read-mapping"))).toBeInTheDocument();
  });

  it("selects a stop into the url when the map is clicked", async () => {
    answering(SALMON);
    open();
    await userEvent.click(await screen.findByRole("button", { name: /k-mers/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "k-mers" })).toBeVisible();
  });

  it("links Open page to the node", async () => {
    answering(SALMON);
    open("/route?goal=salmon&stop=k-mers");
    expect(await screen.findByRole("link", { name: "Open page" })).toHaveAttribute(
      "href",
      "/node/k-mers",
    );
  });
});

describe("what comes next", () => {
  it("offers only the stops nothing blocks, at most four", async () => {
    answering(SALMON);
    open();
    expect(await screen.findByText("Next up")).toBeInTheDocument();
    const next = screen.getByRole("list", { name: "What you can start now" });
    const names = [...next.querySelectorAll("li")].map((item) => item.textContent ?? "");
    expect(names.length).toBeLessThanOrEqual(4);
    expect(names.join(" ")).toContain("DNA and genes");
    expect(names.join(" ")).toContain("Probability");
    expect(names.join(" ")).not.toContain("Salmon");
  });

  it("says how many stops each one unlocks", async () => {
    answering(SALMON);
    open();
    expect((await screen.findAllByText(/unlocks \d+ stops?/)).length).toBeGreaterThan(0);
  });

  it("says where the lines meet", async () => {
    answering(SALMON);
    open();
    expect(await screen.findByText("Where lines meet")).toBeInTheDocument();
    const junctions = screen.getAllByText(/feeds/);
    expect(junctions.length).toBeGreaterThan(0);
    expect(junctions.map((one) => one.textContent ?? "").join(" ")).toContain(
      "(Sequence analysis)",
    );
  });
});
