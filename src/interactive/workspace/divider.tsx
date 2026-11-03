import React, { useRef } from "react";
import { clsx } from "clsx";

const keyStep = 10;

interface DividerProps {
  // "vertical" between panes side by side, "horizontal" between panes one above the other
  orientation: "vertical" | "horizontal";
  label: string;
  // the size of the pane before the divider, and its limits
  value: number;
  min: number;
  max: number;
  // each move's delta is the total distance from where the move started
  onStart: () => void;
  onMove: (delta: number) => void;
  // a drag ended, or the divider lost focus after the arrow keys moved it
  onEnd: () => void;
}

// A pane divider: a band, absolutely positioned on the edge of the element before it, that a pointer drags and the
// arrow keys move. It takes no space in the layout.
export const Divider = ({ orientation, label, value, min, max, onStart, onMove, onEnd }: DividerProps) => {
  const dragRef = useRef<{ pointer: number, from: number }>(undefined);
  const keyMovedRef = useRef(false);
  const position = (e: React.PointerEvent) => orientation === "vertical" ? e.clientX : e.clientY;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointer: e.pointerId, from: position(e) };
    onStart();
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointer === e.pointerId) {
      onMove(position(e) - drag.from);
    }
  };
  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointer === e.pointerId) {
      dragRef.current = undefined;
      onEnd();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? keyStep
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -keyStep : 0;
    if (step) {
      e.preventDefault();
      onStart();
      onMove(step);
      keyMovedRef.current = true;
    }
  };
  const handleBlur = () => {
    if (keyMovedRef.current) {
      keyMovedRef.current = false;
      onEnd();
    }
  };

  return (
    <div role="separator" aria-orientation={orientation} aria-label={label} aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} tabIndex={0}
      className={clsx("divider", orientation)}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd} onKeyDown={handleKeyDown} onBlur={handleBlur} />
  );
};
