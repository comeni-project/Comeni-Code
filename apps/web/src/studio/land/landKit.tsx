// Land's tests (M4.9c): two drafts ready, landings in each state, the index, as the API answers.
import { Route } from "react-router";
import type { IndexOut, LandingOut, ReadyDraftOut } from "../../api/schema";
import { type Answer, answering, renderAt, signedInAs } from "../../test-kit";
import { LandPage } from "./LandPage";

const GRACE = { public_id: "u-2", email: "grace@example.org", name: "Grace", role: "reviewer" };
const OTTO = { public_id: "u-3", email: "otto@example.org", name: "Otto", role: "operator" };

export const READY: ReadyDraftOut[] = [
  {
    public_id: "d-1",
    node_id: "salmon",
    folder: "transcriptomics/salmon",
    revision: 4,
    region: "Transcriptomics",
    approved_by: GRACE,
    self_approved: false,
    files: [
      { file: "node", change: "changed" },
      { file: "body", change: "changed" },
    ],
  },
  {
    public_id: "d-2",
    node_id: "tpm",
    folder: "transcriptomics/tpm",
    revision: 3,
    region: "Transcriptomics",
    approved_by: OTTO,
    self_approved: true,
    files: [{ file: "exam", change: "removed" }],
  },
];

export const landingOf = (overrides: Partial<LandingOut> = {}): LandingOut => ({
  public_id: "l-1",
  state: "open",
  started_by: OTTO,
  started_at: "2026-10-15T11:56:00Z",
  main_head: "a1b2c3d4e5f6",
  branch: "studio/land-7f3a",
  pull_number: 42,
  pull_url: "https://github.com/comeni-project/comeni-code-content/pull/42",
  reason: "",
  landed: false,
  entries: [
    {
      draft: "d-9",
      node_id: "k-mers",
      revision: 6,
      live: true,
      dropped_code: "",
      dropped_reason: "",
    },
  ],
  ...overrides,
});

export const LANDINGS: LandingOut[] = [
  landingOf({ public_id: "l-2", pull_number: 41, state: "merged", landed: true }),
];

export const INDEX: IndexOut = {
  live: {
    commit: "a1b2c3d4e5f6",
    digest: "x",
    outcome: "applied",
    node_count: 26,
    created_at: "2026-10-15T11:57:00Z",
    problems: [],
  },
  latest: null,
  main_head: "a1b2c3d4e5f6",
  checked_at: "2026-10-15T11:57:00Z",
  behind: false,
  follow_seconds: 300,
  regions: [],
};

export function renderLand(extra: Record<string, Answer | ((init?: RequestInit) => Answer)> = {}) {
  const fake = answering({
    "GET /api/me": signedInAs("operator"),
    "GET /api/studio/landings/ready": { body: READY },
    "GET /api/studio/landings": { body: LANDINGS },
    "GET /api/studio/index": { body: INDEX },
    ...extra,
  });
  renderAt("/studio/land", <Route path="/studio/land" element={<LandPage />} />);
  return fake;
}
