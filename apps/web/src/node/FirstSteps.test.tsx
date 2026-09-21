import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeOut } from "../api/schema";
import { SALMON } from "../route/salmon.fixture";
import { DE_BRUIJN } from "./debruijn.fixture";
import { DNA } from "./firststeps.fixture";
import { NodePage } from "./NodePage";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function answering(nodes: NodeOut[] = [DNA, DE_BRUIJN]) {
  const stub = vi.fn(async (url: string) => {
    if (url.startsWith("/api/routes")) return json(SALMON);
    const node = nodes.find((one) => url === `/api/nodes/${one.id}`);
    return node ? json(node) : json({ detail: "No topic with id 'x'." }, 404);
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

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("a First steps node", () => {
  it("is drawn in its own form: one column, the claim as a lead", async () => {
    answering();
    open("/node/dna-and-genes?goal=salmon");
    expect(await screen.findByRole("heading", { level: 1, name: DNA.title })).toBeInTheDocument();
    expect(screen.getByText(DNA.claim)).toBeInTheDocument();
    expect(screen.getByText("About 10 minutes")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "On this page" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Around this node" })).toBeNull();
    expect(screen.queryByRole("region", { name: "What you’ll be able to do" })).toBeNull();
  });

  it("leaves every other level in the full page's form", async () => {
    answering();
    open("/node/de-bruijn-graphs?goal=salmon");
    await screen.findByRole("heading", { level: 1, name: DE_BRUIJN.title });
    expect(screen.getByRole("region", { name: "What you’ll be able to do" })).toBeInTheDocument();
  });

  it("offers the video rather than playing it straight away", async () => {
    answering();
    open("/node/dna-and-genes");
    const watch = await screen.findByRole("button", { name: "Watch · 13 min" });
    expect(screen.getByText(/Prefer to watch\?/)).toBeInTheDocument();
    expect(screen.queryByTitle(/Khan Academy:/)).toBeNull();
    await userEvent.click(watch);
    expect(screen.getByTitle(/Khan Academy:/)).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/AmOO4j0E408?start=0&end=781",
    );
    await userEvent.click(screen.getByRole("button", { name: "Read" }));
    expect(screen.queryByTitle(/Khan Academy:/)).toBeNull();
  });

  it("asks its question in the large form, and answers it", async () => {
    answering();
    open("/node/dna-and-genes");
    expect(await screen.findByText("Try it · question 1")).toBeInTheDocument();
    const question = DNA.questions[0];
    expect(screen.getByText(question?.ask ?? "")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "T (thymine)" }));
    expect(screen.getByText("Right — T (thymine).")).toBeInTheDocument();
    expect(screen.getByText(question?.rationale ?? "")).toBeInTheDocument();
  });

  it("numbers the body's sections, and keeps Further reading out of them", async () => {
    answering([
      {
        ...DNA,
        body: "Lead.\n\n## What DNA is\n\nText.\n\n## Why it matters\n\nText.\n\n## Further reading\n\n- [A](https://example.org)\n",
      },
    ]);
    open("/node/dna-and-genes");
    expect(await screen.findByRole("heading", { name: "1 · What DNA is" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2 · Why it matters" })).toBeInTheDocument();
    const footer = screen.getByRole("region", { name: "Where this comes from" });
    expect(within(footer).getByRole("link", { name: "A" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Further reading/ })).toBeNull();
  });

  it("says what comes next on the route, and keeps the route in the link", async () => {
    answering();
    open("/node/dna-and-genes?goal=salmon");
    const next = await screen.findByRole("region", { name: "Next on your route" });
    const after = SALMON.stops[1];
    expect(within(next).getByRole("link", { name: /Continue/ })).toHaveAttribute(
      "href",
      `/node/${after?.id}?goal=salmon`,
    );
    expect(next).toHaveTextContent(after?.title ?? "");
  });

  it("says nothing about what is next when the page stands alone", async () => {
    answering();
    open("/node/dna-and-genes");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Next on your route" })).toBeNull();
  });

  it("says this is the route's first stop", async () => {
    answering();
    open("/node/dna-and-genes?goal=salmon");
    const strip = await screen.findByRole("region", { name: "Your route" });
    await within(strip).findByText(/the very first stop/);
    expect(strip).toHaveTextContent("On your route to Salmon · the very first stop");
  });

  it("names where the page comes from", async () => {
    answering();
    open("/node/dna-and-genes");
    const footer = await screen.findByRole("region", { name: "Where this comes from" });
    expect(within(footer).getByRole("link", { name: "DNA" })).toBeInTheDocument();
    expect(footer).toHaveTextContent("Wikipedia");
  });
});
