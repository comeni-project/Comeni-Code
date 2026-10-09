import { screen } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, examQuestion, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

afterEach(() => vi.unstubAllGlobals());

describe("ExamPoolTab", () => {
  it("says how many questions there are and how many are approved (M4Q.5)", async () => {
    const exam = [
      examQuestion("a", "approved"),
      examQuestion("b", "approved"),
      examQuestion("c", "draft"),
    ];
    answering({
      "GET /api/me": signedInAs("author"),
      "GET /api/studio/drafts/d-1": { body: { ...DRAFT, node: { ...NODE, exam } } },
    });
    renderAt(
      "/studio/drafts/d-1?tab=exam",
      <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />,
    );
    expect(await screen.findByText("3 of 4 · 2 approved")).toBeInTheDocument();
  });
});
