import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeOut } from "../api/schema";
import { SALMON } from "../route/salmon.fixture";
import { DE_BRUIJN } from "./debruijn.fixture";
import { NodePage } from "./NodePage";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Read mapping as the page would get it: a node that is on the Salmon route. */
const READ_MAPPING: NodeOut = {
  ...DE_BRUIJN,
  id: "read-mapping",
  title: "Mapping reads to a reference",
  region: { id: "sequence-analysis", name: "Sequence analysis" },
  level: "introductory",
  resources: [],
  questions: [],
  body: "Reads are placed on a reference.\n",
};

/** One stub for both endpoints; a node the map doesn't hold is the API's 404. */
function answering(nodes: NodeOut[] = [DE_BRUIJN, READ_MAPPING]) {
  const stub = vi.fn(async (url: string) => {
    if (url.startsWith("/api/routes")) return json(SALMON);
    const node = nodes.find((one) => url === `/api/nodes/${one.id}`);
    return node
      ? json(node)
      : json({ detail: "No topic with id 'nope'. It may have been removed or renamed." }, 404);
  });
  vi.stubGlobal("fetch", stub);
  return stub;
}

function open(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/node/:id" element={<NodePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("the Node page", () => {
  it("names the node, its region, its level and its time", async () => {
    answering();
    open("/node/de-bruijn-graphs");
    expect(
      await screen.findByRole("heading", { level: 1, name: "de Bruijn graphs" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      "Algorithms › de Bruijn graphs",
    );
    expect(screen.getAllByText("Intermediate")[0]).toBeInTheDocument();
    // 15 minutes of reading and one for each of the two questions.
    expect(screen.getByText("About 17 min with the questions")).toBeInTheDocument();
  });

  it("puts the claim in the board's box", async () => {
    answering();
    open("/node/de-bruijn-graphs");
    const box = await screen.findByRole("region", { name: "What you’ll be able to do" });
    expect(box).toHaveTextContent(DE_BRUIJN.claim);
  });

  it("links each need, keeping the route, and ticks only what is known", async () => {
    answering();
    open("/node/de-bruijn-graphs?goal=salmon&known=k-mers");
    const needs = await screen.findByRole("list", { name: "Before this, all of:" });
    const kmers = within(needs).getByRole("link", { name: /k-mers/ });
    expect(kmers).toHaveAttribute("href", "/node/k-mers?goal=salmon&known=k-mers");
    expect(within(kmers).getByLabelText("known")).toBeInTheDocument();
    const others = within(needs)
      .getAllByRole("link")
      .filter((link) => link !== kmers);
    for (const link of others) expect(within(link).queryByLabelText("known")).toBeNull();
  });

  it("draws the body's headings, and none of its HTML", async () => {
    answering([{ ...DE_BRUIJN, body: `${DE_BRUIJN.body}\n<script>alert(1)</script>\n` }]);
    const { container } = open("/node/de-bruijn-graphs");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Further reading" }),
    ).toHaveAttribute("id", "further-reading");
    expect(container.querySelector("script")).toBeNull();
  });

  it("asks each question where its marker is", async () => {
    answering();
    open("/node/de-bruijn-graphs");
    const first = await screen.findByText(DE_BRUIJN.questions[0]?.ask ?? "");
    const second = screen.getByText(DE_BRUIJN.questions[1]?.ask ?? "");
    const code = screen.getByText(/ACGTTGCA/, { selector: "code" });
    const reading = screen.getByRole("heading", { name: "Further reading" });
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(code, first)).toBe(true);
    expect(follows(first, second)).toBe(true);
    expect(follows(second, reading)).toBe(true);
    expect(screen.queryByText(/\{% try/)).toBeNull();
  });

  it("lists Learn it and the body's sections on this page", async () => {
    answering();
    open("/node/de-bruijn-graphs");
    const contents = await screen.findByRole("navigation", { name: "On this page" });
    expect(within(contents).getByRole("link", { name: "Learn it" })).toHaveAttribute(
      "href",
      "#learn-it",
    );
    expect(within(contents).getByRole("link", { name: "Further reading" })).toHaveAttribute(
      "href",
      "#further-reading",
    );
  });

  it("shows the side column's groups with each neighbour's level and time", async () => {
    const deeperCard = {
      id: "pufferfish-index",
      title: "The pufferfish index",
      level: "advanced",
      minutes: 14,
      reason: "The index Salmon builds is a compacted de Bruijn graph.",
    };
    answering([{ ...DE_BRUIJN, goes_deeper: [deeperCard] }]);
    open("/node/de-bruijn-graphs?goal=salmon");
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Goes deeper · 1" }));
    const deeper = screen.getByRole("list", { name: "Goes deeper" });
    const row = within(deeper).getByRole("link", { name: /The pufferfish index/ });
    expect(row).toHaveAttribute("href", "/node/pufferfish-index?goal=salmon");
    expect(row).toHaveTextContent("Advanced · 14 min");
    expect(screen.getByRole("button", { name: /Needed by · \d/ })).toBeInTheDocument();
  });

  it("keeps each group folded until it is opened, saying how many it holds", async () => {
    answering();
    open("/node/de-bruijn-graphs");
    await screen.findByRole("heading", { level: 1 });
    const count = DE_BRUIJN.needed_by.length;
    const toggle = screen.getByRole("button", { name: `Needed by · ${count}` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Needed by" })).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getByRole("list", { name: "Needed by" })).getAllByRole("link"),
    ).toHaveLength(count);
    await userEvent.click(toggle);
    expect(screen.queryByRole("list", { name: "Needed by" })).toBeNull();
  });

  it("leaves out a group with nothing in it", async () => {
    answering([{ ...DE_BRUIJN, related: [] }]);
    open("/node/de-bruijn-graphs");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /Related/ })).toBeNull();
  });

  it("marks the goal in Needed by", async () => {
    answering([
      {
        ...READ_MAPPING,
        needed_by: [
          { id: "salmon", title: "Salmon", level: "intermediate", minutes: 15, reason: "x" },
        ],
      },
    ]);
    open("/node/read-mapping?goal=salmon");
    await userEvent.click(await screen.findByRole("button", { name: "Needed by · 1" }));
    const needed = screen.getByRole("list", { name: "Needed by" });
    expect(within(needed).getByRole("link", { name: /Salmon/ })).toHaveTextContent("your goal");
  });
});

describe("the route strip", () => {
  it("says where the node sits on the route it was opened from", async () => {
    answering();
    open("/node/read-mapping?goal=salmon");
    const strip = await screen.findByRole("region", { name: "Your route" });
    expect(await within(strip).findByText(/On your route to/)).toHaveTextContent(
      "On your route to Salmon",
    );
    expect(strip).toHaveTextContent("Sequence analysis line");
    expect(strip).toHaveTextContent("stop 10 of 17");
    expect(strip).toHaveTextContent("unlocks Reads that map to several places, Salmon");
    expect(within(strip).getByRole("link", { name: "Back to the route" })).toHaveAttribute(
      "href",
      "/route?goal=salmon&stop=read-mapping",
    );
  });

  it("says so when the node is not on that route", async () => {
    answering();
    open("/node/de-bruijn-graphs?goal=salmon");
    const strip = await screen.findByRole("region", { name: "Your route" });
    await within(strip).findByText(/Not on your route to/);
    expect(strip).toHaveTextContent("Not on your route to Salmon");
    expect(within(strip).getByRole("link", { name: "Back to the route" })).toHaveAttribute(
      "href",
      "/route?goal=salmon",
    );
  });

  it("is not there when the page was opened on its own", async () => {
    const stub = answering();
    open("/node/de-bruijn-graphs");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Your route" })).toBeNull();
    expect(stub.mock.calls.some(([url]) => String(url).startsWith("/api/routes"))).toBe(false);
  });
});

describe("the Node page's states", () => {
  it("prints the API's sentence for a node that does not exist", async () => {
    answering();
    open("/node/nope");
    expect(await screen.findByText(/No topic with id 'nope'/)).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("No topic with id 'nope'");
    expect(screen.getByRole("link", { name: /Start/ })).toHaveAttribute("href", "/");
  });

  it("has no Learn it without resources, and none in its contents", async () => {
    answering();
    open("/node/read-mapping");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: "Learn it" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
    expect(screen.getByText("About 15 min")).toBeInTheDocument();
  });

  it("says it is loading while it waits", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    open("/node/de-bruijn-graphs");
    expect(screen.getByText("Loading the page…")).toBeInTheDocument();
  });
});
