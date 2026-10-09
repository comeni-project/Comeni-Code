import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeaveToSave } from "./LeaveToSave";

const box = () => {
  const onLeave = vi.fn();
  render(
    <LeaveToSave onLeave={onLeave}>
      <input aria-label="Text" />
      <span>A caption</span>
    </LeaveToSave>,
  );
  return onLeave;
};

describe("LeaveToSave", () => {
  it("does not leave on a press inside that takes no focus (padding, captions, Safari's buttons) (#255)", () => {
    const onLeave = box();
    fireEvent.pointerDown(screen.getByText("A caption"));
    fireEvent.blur(screen.getByLabelText("Text"), { relatedTarget: null });
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("leaves when focus goes outside", () => {
    const onLeave = box();
    fireEvent.blur(screen.getByLabelText("Text"), { relatedTarget: document.body });
    fireEvent.blur(screen.getByLabelText("Text"), { relatedTarget: null });
    expect(onLeave).toHaveBeenCalledTimes(2);
  });
});
