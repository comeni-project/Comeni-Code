import { screen, within } from "@testing-library/react";
import { Route } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answering, renderAt, signedInAs } from "../../test-kit";
import { StudioShell } from "../StudioShell";
import { ReviewPage } from "./ReviewPage";
import { QUEUE } from "./reviewKit";

afterEach(() => vi.unstubAllGlobals());

describe("Review in Studio", () => {
  it("is in the rail for a reviewer, with the keys still to review", async () => {
    answering({ "GET /api/me": signedInAs("reviewer"), "GET /api/studio/review": { body: QUEUE } });
    renderAt(
      "/studio/review",
      <Route path="/studio" element={<StudioShell />}>
        <Route path="review" element={<ReviewPage />} />
      </Route>,
    );
    const link = await screen.findByRole("link", { name: /Review/ });
    expect(await within(link).findByText("4")).toBeInTheDocument();
  });
});
