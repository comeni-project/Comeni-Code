import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResultOut, SearchOut } from "../api/schema";
import { StartPage } from "./StartPage";

const salmon: ResultOut = {
  id: "salmon",
  title: "Salmon",
  claim: "Salmon estimates how much of each transcript a sample holds.",
  level: "intermediate",
  minutes: 15,
  region: { id: "transcriptomics", name: "Transcriptomics" },
};

const kallisto: ResultOut = { ...salmon, id: "kallisto", title: "kallisto" };
const tpm: ResultOut = { ...salmon, id: "tpm", title: "TPM" };

const found = (results: ResultOut[], unmatched: string[] = []): SearchOut => ({
  query: "salmon",
  results,
  unmatched,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** One stub for both endpoints: whichever URL is asked for gets its own answer. */
function answering(search: unknown, route?: unknown, status = 200) {
  const stub = vi.fn(async (url: string) =>
    url.startsWith("/api/search") ? json(search, status) : json(route ?? {}, status),
  );
  vi.stubGlobal("fetch", stub);
  return stub;
}

function open(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <StartPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

/** The 17-stop Salmon route, in the shape /api/routes answers (M2P4.2). */
function route() {
  const stop = (id: string, title: string, minutes: number) => ({
    id,
    title,
    level: "first-steps",
    minutes,
    region: { id: "molecular-biology", name: "Molecular biology" },
    needed_by: [],
  });
  return {
    goals: ["salmon"],
    known: [],
    minutes: 184,
    span: { lowest: "first-steps", highest: "intermediate" },
    stops: [
      stop("dna-and-genes", "DNA and genes", 10),
      ...Array.from({ length: 15 }, (_, index) => stop(`stop-${index}`, `Stop ${index}`, 11)),
      { ...stop("salmon", "Salmon", 15), level: "intermediate" },
    ],
  };
}

describe("the Start page", () => {
  it("asks the question and offers the board's examples", () => {
    answering(found([]));
    open();
    expect(
      screen.getByRole("heading", { level: 1, name: "What do you want to learn?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Why my reads don't map" })).toBeInTheDocument();
  });

  it("searches what was typed, and puts it in the url", async () => {
    answering(found([salmon]));
    open();
    await userEvent.type(screen.getByLabelText("What do you want to learn?"), "salmon");
    await userEvent.click(screen.getByRole("button", { name: "Build my route" }));
    expect(await screen.findByText(/Is this what you mean\?/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search?q=salmon"),
      expect.anything(),
    );
  });

  it("searches straight away when the url already carries the words", async () => {
    answering(found([salmon]));
    open("/?q=salmon");
    expect(await screen.findByRole("button", { name: "Choose Salmon" })).toBeInTheDocument();
    expect(screen.getByText(salmon.claim)).toBeInTheDocument();
  });

  it("says it is searching while it waits", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    open("/?q=salmon");
    expect(screen.getByText("Searching…")).toBeInTheDocument();
  });

  it("names a word nothing is about", async () => {
    answering(found([], ["nanopore"]));
    open("/?q=nanopore");
    expect(await screen.findByText(/Nothing here is about “nanopore” yet/)).toBeInTheDocument();
  });

  it("prints the API's own sentence when there is no index", async () => {
    answering({ detail: "The index has not been built yet." }, undefined, 503);
    open("/?q=salmon");
    expect(await screen.findByText("The index has not been built yet.")).toBeInTheDocument();
  });

  it("says when it cannot reach the API", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("no network");
    });
    open("/?q=salmon");
    expect(await screen.findByText(/Can't reach the API · network error/)).toBeInTheDocument();
  });

  it("searches an example's phrase when it is clicked", async () => {
    answering(found([salmon]));
    open();
    await userEvent.click(screen.getByRole("button", { name: "Why my reads don't map" }));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("q=Why+my+reads+don%27t+map"),
      expect.anything(),
    );
  });

  it("keeps up to three targets, and then stops offering more", async () => {
    answering(found([salmon, kallisto, tpm]), route());
    open("/?q=salmon");
    for (const title of ["Salmon", "kallisto", "TPM"]) {
      const more = screen.queryByRole("button", { name: /Add another target/ });
      if (more !== null) await userEvent.click(more);
      await userEvent.click(await screen.findByRole("button", { name: `Choose ${title}` }));
    }
    expect(screen.getByText("Three targets is the most a route takes.")).toBeInTheDocument();
  });

  it("folds the other candidates away once a target is chosen, as the board does", async () => {
    answering(found([salmon, kallisto]), route());
    open("/?q=salmon&goal=salmon");
    expect(await screen.findByRole("button", { name: "Remove Salmon" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose kallisto" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Add another target/ }));
    expect(screen.getByRole("button", { name: "Choose kallisto" })).toBeInTheDocument();
  });

  it("drops a target when its chip is removed", async () => {
    answering(found([salmon, kallisto]), route());
    open("/?q=salmon&goal=salmon");
    await userEvent.click(await screen.findByRole("button", { name: "Remove Salmon" }));
    expect(screen.queryByRole("button", { name: "Remove Salmon" })).not.toBeInTheDocument();
  });
});

describe("the route preview", () => {
  const chosen = "/?q=salmon&goal=salmon";

  it("shows the route once a target is chosen", async () => {
    answering(found([salmon]), route());
    open(chosen);
    expect(await screen.findByText("17 stops")).toBeInTheDocument();
    expect(screen.getByText("about 3 h 4 min")).toBeInTheDocument();
    expect(screen.getByText("First steps → Intermediate")).toBeInTheDocument();
    expect(screen.getByText("DNA and genes")).toBeInTheDocument();
  });

  it("draws the route as the map, as the Start board does", async () => {
    answering(found([salmon]), route());
    open(chosen);
    expect(await screen.findByRole("img", { name: /17 stops on/ })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Stops on this route" })).not.toBeInTheDocument();
  });

  it("shows a chosen target as a ticked card", async () => {
    answering(found([salmon]), route());
    open(chosen);
    const remove = await screen.findByRole("button", { name: "Remove Salmon" });
    expect(remove).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the goal among the stops", async () => {
    answering(found([salmon]), route());
    open(chosen);
    expect(await screen.findByText("your goal")).toBeInTheDocument();
  });

  it("says it is weaving while it waits", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.startsWith("/api/search") ? json(found([salmon])) : new Promise(() => {}),
    );
    open(chosen);
    expect(await screen.findByText("Weaving your route…")).toBeInTheDocument();
  });

  it("links Start from the beginning to the route page", async () => {
    answering(found([salmon]), route());
    open(chosen);
    expect(await screen.findByRole("link", { name: "Start from the beginning" })).toHaveAttribute(
      "href",
      "/route?goal=salmon",
    );
  });

  it("prints the API's sentence when the route cannot be woven", async () => {
    vi.stubGlobal("fetch", async (url: string) =>
      url.startsWith("/api/search")
        ? json(found([salmon]))
        : json({ detail: "No topic with id 'salmon'. It may have been removed or renamed." }, 404),
    );
    open(chosen);
    expect(await screen.findByText(/No topic with id 'salmon'/)).toBeInTheDocument();
  });
});
