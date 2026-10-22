import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkingCopy } from "./useWorkingCopy";

const FLOW =
  "component: flow\nalt: Reads become k-mers.\ndata:\n  nodes:\n    - {id: reads, label: reads}\n" +
  "    - {id: kmers, label: k-mers}\n  edges:\n    - {from: reads, to: kmers}\n";

describe("the working copy (M6CO.2)", () => {
  it("reads the file and draws it", () => {
    const { result } = renderHook(() => useWorkingCopy("flow", FLOW));
    expect(result.current.problems).toEqual([]);
    expect(result.current.lastGood?.component).toBe("flow");
    expect(result.current.changed).toBe(false);
  });

  it("keeps the last drawing that checked while a problem waits", () => {
    const { result } = renderHook(() => useWorkingCopy("flow", FLOW));
    act(() =>
      result.current.edit([{ op: "set", path: ["data", "edges", 0, "to"], value: "kmrs" }]),
    );
    expect(result.current.problems.map((p) => [p.code, p.path])).toEqual([
      ["CS1007", "data.edges[0].to"],
    ]);
    expect(result.current.lastGood?.data).toEqual(
      expect.objectContaining({ edges: [{ from: "reads", to: "kmers" }] }),
    );
    expect(result.current.changed).toBe(true);
  });

  it("takes text typed as YAML, and a note from an edit", () => {
    const { result } = renderHook(() => useWorkingCopy("flow", FLOW));
    act(() => result.current.edit([{ op: "remove", path: ["data", "edges", 0] }], "a note"));
    expect(result.current.note).toBe("a note");
    act(() => result.current.setText("component: [\n"));
    expect(result.current.text).toBe("component: [\n");
    expect(result.current.note).toBeNull();
    expect(result.current.problems[0]?.code).toBe("CS1023");
  });

  it("starts empty for a new figure until a component is chosen", () => {
    const { result } = renderHook(() => useWorkingCopy("new", null));
    expect(result.current.text).toBe("");
    expect(result.current.lastGood).toBeNull();
  });
});
