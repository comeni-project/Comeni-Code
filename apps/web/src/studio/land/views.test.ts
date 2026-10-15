import { describe, expect, it } from "vitest";
import { landingOf } from "./landKit";
import { landingsIn, stepsOf } from "./views";

describe("Land's views", () => {
  const all = [
    landingOf({ public_id: "p", state: "pending" }),
    landingOf({ public_id: "o", state: "open" }),
    landingOf({ public_id: "m", state: "merged", landed: false }),
    landingOf({ public_id: "l", state: "merged", landed: true }),
    landingOf({ public_id: "c", state: "closed" }),
    landingOf({ public_id: "f", state: "failed" }),
    landingOf({ public_id: "r", state: "refused" }),
  ];
  const ids = (view: Parameters<typeof landingsIn>[0]) =>
    landingsIn(view, all).map((l) => l.public_id);

  it("puts each landing in one view", () => {
    expect(ids("Landing")).toEqual(["p", "o", "m"]);
    expect(ids("Landed")).toEqual(["l"]);
    expect(ids("Failed")).toEqual(["f", "c", "r"]);
    expect(ids("Ready to land")).toEqual([]);
  });

  it("marks the steps a landing has passed", () => {
    expect(stepsOf(landingOf({ state: "pending" }))).toEqual([
      "on",
      "todo",
      "todo",
      "todo",
      "todo",
    ]);
    expect(stepsOf(landingOf({ state: "open" }))).toEqual(["done", "done", "on", "todo", "todo"]);
    expect(stepsOf(landingOf({ state: "merged", landed: false }))).toEqual([
      "done",
      "done",
      "done",
      "done",
      "on",
    ]);
    expect(stepsOf(landingOf({ state: "merged", landed: true }))).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
  });
});
