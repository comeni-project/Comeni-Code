// The Exam pool's tests (M4.8d): the workbench opened on its Exam pool tab, a draft holding `exam`,
// its checklist with nothing to say, and any further answers the test needs.
import { Route } from "react-router";
import type { DraftOut, StudioExamQuestionOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { DRAFT, NODE } from "./fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

export function renderPool(
  exam: StudioExamQuestionOut[],
  extra: Record<string, Answer> = {},
  draft: Partial<DraftOut> = {},
) {
  const fake = answering({
    "GET /api/me": signedInAs("author"),
    "GET /api/studio/drafts/d-1": { body: { ...DRAFT, ...draft, node: { ...NODE, exam } } },
    // A save waits for Checks to be asked again (useDraftEdit), so the pool's tests answer it.
    "GET /api/studio/drafts/d-1/checklist": {
      body: { passed: true, items: [], problems: [], questions: [] },
    },
    ...extra,
  });
  renderAt(
    "/studio/drafts/d-1?tab=exam",
    <Route path="/studio/drafts/:id" element={<WorkbenchPage />} />,
  );
  return fake;
}
