// Land's views and a landing's steps (M4.9c spec, M4LS.3), worked out from what the API says.
import { moving } from "../../api/landing";
import type { LandingOut } from "../../api/schema";

export const VIEWS = ["Ready to land", "Landing", "Landed", "Failed"] as const;
export type View = (typeof VIEWS)[number];

const ENDED = new Set(["refused", "closed"]);

export function landingsIn(view: View, landings: LandingOut[]): LandingOut[] {
  if (view === "Landing") return landings.filter(moving);
  if (view === "Landed") return landings.filter((l) => l.state === "merged" && l.landed);
  if (view === "Failed")
    // Failed ones hold their drafts until closed, so they come first; then the ended ones.
    return [
      ...landings.filter((l) => l.state === "failed"),
      ...landings.filter((l) => ENDED.has(l.state)),
    ];
  return [];
}

export const STEPS = [
  ["Checked in place against the index", ""],
  ["One commit, opened as a pull request", "by Comeni Code Studio, auto-merge on"],
  ["Its checks are running", "validate · review"],
  ["Merged into main", ""],
  ["The index follows main", "then learners see it"],
] as const;

export type Step = "done" | "on" | "todo";

/** Every step before the current one is done. A failed landing stops at its checks. */
export function stepsOf(landing: LandingOut): Step[] {
  const at =
    landing.state === "pending" ? 0 : landing.state === "merged" ? (landing.landed ? 5 : 4) : 2;
  return STEPS.map((_, i) => (i < at ? "done" : i === at ? "on" : "todo"));
}
