// A figure question in review (M6.6b spec, M6FA.7; M4R.4): asked by its figure, the selection
// sent as the answer, the right path shown once answered.
import { fireEvent, screen } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewQuestionOut } from "../../api/schema";
import { OPTIONS, PATH, TRACE_PATH } from "../../figures/answer/answers.fixture";
import { answering, renderAt } from "../../test-kit";
import { ReviewQuestion, theKey } from "./ReviewQuestion";

afterEach(() => vi.unstubAllGlobals());

const TRACE: ReviewQuestionOut = {
  id: "trace-the-path",
  pool: "try",
  kind: "figure",
  ask: "Trace the path that spells ACGTTAG.",
  stem: [],
  options: null,
  option_figures: null,
  figure: "trace-path",
  right_selections: null,
  unit: "",
  steps: null,
  hints: ["Five k-mers."],
  given: null,
  right: null,
  right_option: null,
  right_steps: null,
  value: null,
  tolerance: null,
  rationale: null,
};

const show = (question: ReviewQuestionOut, figures = [TRACE_PATH]) =>
  renderAt(
    "/",
    <Route
      path="/"
      element={<ReviewQuestion draftId="d-1" question={question} figures={figures} />}
    />,
  );

describe("ReviewQuestion — a figure question", () => {
  it("is answered by tracing its figure, drawn once, and sends the k-mers picked", async () => {
    const fake = answering({
      "PUT /api/studio/drafts/d-1/review/answers/trace-the-path": {
        body: { ...TRACE, given: PATH, right: true, right_selections: [PATH], rationale: "Five." },
      },
    });
    const { container } = show(TRACE);
    expect(container.querySelectorAll("svg[role=img]")).toHaveLength(1);
    for (const name of PATH)
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}$`) }));
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    await vi.waitFor(() => expect(fake).toHaveBeenCalled());
    const [, init] = fake.mock.calls.find(([url]) => String(url).includes("answers")) ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ given: PATH });
  });

  it("states the key as the path, and a figure option by its figure", () => {
    expect(theKey({ ...TRACE, right_selections: [PATH] })).toBe(PATH.join(" → "));
    const pick = { ...TRACE, figure: "error-bubble", right_selections: [["GTC"], ["TCA"]] };
    expect(theKey(pick)).toBe("GTC or TCA");
    const options = {
      ...TRACE,
      kind: "choice",
      figure: null,
      options: ["", "", "", ""],
      option_figures: OPTIONS.map((o) => o.stem),
      right_option: 1,
    };
    expect(theKey(options)).toBe("B · the figure options-bubble");
  });
});
