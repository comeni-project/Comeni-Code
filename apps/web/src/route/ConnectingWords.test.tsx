import { screen } from "@testing-library/react";
import { Route } from "react-router";
import { expect, it } from "vitest";
import { answering, renderAt } from "../test-kit";
import { RouteWords } from "./ConnectingWords";

it("marks generated route text as unreviewed", async () => {
  const bundle = {
    public_id: "b-1",
    state: "ready",
    code: "",
    goals: ["dna"],
    known: [],
    texts: [
      {
        key: "introduction",
        kind: "introduction",
        text: "Learn how bases pair.",
        state: "ready",
        version: 1,
        flags: [],
        context: {},
      },
    ],
  };
  answering({
    "POST /api/routes/text": { body: bundle },
    "GET /api/routes/text/b-1": { body: bundle },
  });
  renderAt("/", <Route path="/" element={<RouteWords goals={["dna"]} known={[]} />} />);
  expect(await screen.findByText("Learn how bases pair.")).toBeInTheDocument();
  expect(screen.getByText("AI connecting text · not yet reviewed")).toBeInTheDocument();
});
