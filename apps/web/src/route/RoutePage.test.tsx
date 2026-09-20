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
