import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ProbabilitySelector } from "./probability-selector";

// jsdom has no PointerEvent, and a plain Event carries no pointerId or clientX
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

const renderSelector = (exactPercentages: number[], onChange = jest.fn(), accessible = true) =>
  render(<ProbabilitySelector viewMode="drawing" exactPercentages={exactPercentages}
    edgeLabels={["cat", "mat", "dog"].slice(0, exactPercentages.length)} onChange={onChange}
    accessible={accessible} />);

// keeps the percentages it is told, as the state editor does
const LiveSelector = ({ start }: { start: number[] }) => {
  const [percentages, setPercentages] = useState(start);
  return <ProbabilitySelector viewMode="drawing" exactPercentages={percentages} edgeLabels={["cat", "mat", "dog"]}
    onChange={setPercentages} accessible />;
};

describe("ProbabilitySelector", () => {
  describe("with accessible", () => {
    it("reports each thumb as a slider of its state's probability", () => {
      renderSelector([50, 50]);
      const thumb = screen.getByRole("slider", { name: "Probability of cat" });
      expect(thumb).toHaveAttribute("aria-valuenow", "50");
      expect(thumb).toHaveAttribute("aria-valuemin", "0");
      expect(thumb).toHaveAttribute("aria-valuemax", "100");
      expect(thumb).toHaveAttribute("aria-valuetext", "50%");
      expect(thumb).toHaveAttribute("tabindex", "0");
    });

    it("bounds a thumb by its own pair of states", () => {
      renderSelector([20, 30, 50]);
      expect(screen.getByRole("slider", { name: "Probability of mat" })).toHaveAttribute("aria-valuemax", "80");
    });

    it.each([
      ["ArrowRight", false, [51, 49]], ["ArrowUp", false, [51, 49]], ["ArrowLeft", false, [49, 51]],
      ["ArrowDown", false, [49, 51]], ["ArrowRight", true, [60, 40]], ["ArrowLeft", true, [40, 60]],
    ])("moves the thumb with %s, Shift %s", (key, shiftKey, expected) => {
      const onChange = jest.fn();
      renderSelector([50, 50], onChange);
      const scrolls = fireEvent.keyDown(screen.getByRole("slider"), { key, shiftKey });
      expect(onChange).toHaveBeenCalledWith(expected);
      expect(scrolls).toBe(false);
    });

    it("stops a step at the ends of the pair", () => {
      const onChange = jest.fn();
      renderSelector([95, 5], onChange);
      fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight", shiftKey: true });
      expect(onChange).toHaveBeenCalledWith([100, 0]);
    });

    it("stops a step down at the start of the pair", () => {
      const onChange = jest.fn();
      renderSelector([5, 95], onChange);
      fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft", shiftKey: true });
      expect(onChange).toHaveBeenCalledWith([0, 100]);
    });

    it("steps only the thumb's own pair", () => {
      const onChange = jest.fn();
      renderSelector([20, 30, 50], onChange);
      fireEvent.keyDown(screen.getByRole("slider", { name: "Probability of mat" }), { key: "ArrowRight" });
      expect(onChange).toHaveBeenCalledWith([20, 31, 49]);
    });

    it("ignores other keys", () => {
      const onChange = jest.fn();
      renderSelector([50, 50], onChange);
      expect(fireEvent.keyDown(screen.getByRole("slider"), { key: "a" })).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps focus on a thumb that a step carries past the point it remounts", () => {
      render(<LiveSelector start={[80, 10, 10]} />);
      const thumb = screen.getByRole("slider", { name: "Probability of cat" });
      act(() => thumb.focus());
      fireEvent.keyDown(thumb, { key: "ArrowRight", shiftKey: true });
      const moved = screen.getByRole("slider", { name: "Probability of cat" });
      expect(moved).not.toBe(thumb);
      expect(moved).toHaveFocus();
    });

    describe("dragged by a pointer", () => {
      const original = window.PointerEvent;
      beforeAll(() => { (window as any).PointerEvent = TestPointerEvent; });
      afterAll(() => { (window as any).PointerEvent = original; });

      const pointer = (type: string, clientX: number, pointerId = 1) =>
        act(() => { window.dispatchEvent(new TestPointerEvent(type, { clientX, pointerId })); });

      it("moves while the pointer is down, and stops when it comes up", () => {
        const onChange = jest.fn();
        renderSelector([50, 50], onChange);
        fireEvent.pointerDown(screen.getByRole("slider"), { clientX: 100, pointerId: 1 });
        pointer("pointermove", 120);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0][0][0]).toBeGreaterThan(50);

        pointer("pointerup", 120);
        pointer("pointermove", 140);
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      it("stops when the pointer is canceled", () => {
        const onChange = jest.fn();
        renderSelector([50, 50], onChange);
        fireEvent.pointerDown(screen.getByRole("slider"), { clientX: 100, pointerId: 1 });
        pointer("pointercancel", 100);
        pointer("pointermove", 140);
        expect(onChange).not.toHaveBeenCalled();
      });

      it("ignores another pointer", () => {
        const onChange = jest.fn();
        renderSelector([50, 50], onChange);
        fireEvent.pointerDown(screen.getByRole("slider"), { clientX: 100, pointerId: 1 });
        pointer("pointermove", 120, 2);
        expect(onChange).not.toHaveBeenCalled();

        pointer("pointerup", 120, 2);
        pointer("pointermove", 130);
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      it("removes its listeners when the drag ends", () => {
        const removed = jest.spyOn(window, "removeEventListener");
        renderSelector([50, 50]);
        fireEvent.pointerDown(screen.getByRole("slider"), { clientX: 100, pointerId: 1 });
        pointer("pointerup", 100);
        expect(removed.mock.calls.map(([type]) => type))
          .toEqual(expect.arrayContaining(["pointermove", "pointerup", "pointercancel"]));
        removed.mockRestore();
      });
    });
  });

  it.each([true, false])("keeps its thumbs on their states across a render that doesn't rebuild the offsets, " +
    "accessible %s", (accessible) => {
    const props = {
      viewMode: "drawing" as const, exactPercentages: [20, 30, 50], onChange: jest.fn(), accessible,
      edgeLabels: ["cat", "mat", "dog"]
    };
    const { asFragment, rerender } = render(<ProbabilitySelector {...props} />);
    const before = asFragment();
    rerender(<ProbabilitySelector {...props} />);
    expect(asFragment()).toEqual(before);
  });

  it("gives its thumbs no role without accessible", () => {
    renderSelector([50, 50], jest.fn(), false);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});
