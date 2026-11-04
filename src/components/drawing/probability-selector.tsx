import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { clsx } from "clsx";
import { ViewMode } from "../../type";
import { movePairedPercentage, probability, reduceToSum } from "./state-editor";

import "./probability-selector.scss";

interface ProbabilitySelectorOffset {
  min: number
  cur: number
  max: number
}
interface ProbabilitySelectorThumbProps {
  index: number
  offset: ProbabilitySelectorOffset
  visibleLineLength: number
  onChange: (index: number, probability: number) => void;
}

interface ProbabilitySelectorProps {
  viewMode: ViewMode;
  exactPercentages: number[]
  edgeLabels: string[]
  onChange: (newPercentages: number[]) => void
  // the thumbs are sliders that take keys, touch and pen
  accessible?: boolean;
}

interface AccessibleThumbProps extends Pick<ProbabilitySelectorThumbProps, "index" | "offset" | "onChange"> {
  label: string;
  value: number;
  max: number;
  onStep: (index: number, delta: number) => void;
}

const svgWidth = 200;
const svgHeight = 18;
const thumbRadius = 7;
const thumbDiameter = thumbRadius * 2;
const lineWidth = 2;
const lineStart = thumbRadius;
const lineEnd = svgWidth - thumbRadius;
const lineLength = lineEnd - lineStart;
const lineY = (svgHeight - lineWidth) / 2;
// Thumbs with cumulative percentage higher than this value will be rendered in reverse so they can be dragged left
const reversePercent = .9;

const distinctColors = [
  "#e6194B", "#3cb44b", "#4363d8", "#f58231", "#42d4f4", "#ffe119",
  "#f032e6", "#fabed4", "#469990", "#dcbeff", "#9A6324", "#fffac8",
  "#800000", "#aaffc3", "#000075", "#a9a9a9", "#ffffff", "#000000"
];
const getDistinctColor = (i: number) => distinctColors[i % distinctColors.length];

const draggedProbability = (offset: ProbabilitySelectorOffset, delta: number) => {
  const newOffset = Math.min(Math.max(offset.min, offset.cur + delta), offset.max);
  return (newOffset - offset.min) / (offset.max - offset.min);
};

const keySteps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

export const ProbabilitySelectorThumb = (props: ProbabilitySelectorThumbProps) => {
  const { index, offset, onChange } = props;

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGCircleElement>) => {
    const startX = e.clientX;

    const handleMouseMove = (e2: MouseEvent) => {
      onChange(index, draggedProbability(offset, e2.clientX - startX));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [index, offset, onChange]);

  return (
    <circle
      cx={offset.cur}
      cy={lineY}
      r={thumbRadius}
      onMouseDown={handleMouseDown}
    />
  );
};

// crossing reversePercent remounts the thumb, so the drag listens on the window
const AccessibleThumb = ({ index, offset, label, value, max, onChange, onStep }: AccessibleThumbProps) => {
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const { pointerId, clientX: startX } = e;

    const handlePointerMove = (e2: PointerEvent) => {
      if (e2.pointerId === pointerId) {
        onChange(index, draggedProbability(offset, e2.clientX - startX));
      }
    };

    const handlePointerEnd = (e2: PointerEvent) => {
      if (e2.pointerId === pointerId) {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
  }, [index, offset, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<SVGCircleElement>) => {
    const step = keySteps[e.key];
    if (step) {
      e.preventDefault();
      onStep(index, e.shiftKey ? step * 10 : step);
    }
  };

  return (
    <circle
      cx={offset.cur}
      cy={lineY}
      r={thumbRadius}
      role="slider"
      tabIndex={0}
      aria-label={`Probability of ${label}`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}%`}
      data-thumb={index}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
};

export const ProbabilitySelector = ({
  viewMode, exactPercentages, edgeLabels, onChange, accessible
}: ProbabilitySelectorProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const steppedThumbRef = useRef<number | undefined>(undefined);

  const roundPercentages = useMemo(() => {
    if (exactPercentages.length === 0) {
      return [];
    }
    const result = exactPercentages.slice(0, -1).map(exactPercentage => Math.round(exactPercentage));
    result.push(100 - reduceToSum(result));
    return result;
  }, [exactPercentages]);

  const visibleLineLength = lineLength - ((exactPercentages.length - 1) * thumbDiameter);

  const offsets = useMemo(() => {
    let lastOffset = lineStart;
    return exactPercentages.slice(0, -1).map((exactPercentage, i) => {
      const offset: ProbabilitySelectorOffset = {
        min: lineStart + (i * thumbRadius),
        cur: lastOffset + (probability(exactPercentage) * lineLength),
        max: lineEnd - (i * thumbRadius),
      };
      lastOffset = offset.cur;
      return offset;
    });
  }, [exactPercentages]);

  const segments = useMemo(() => {
    if (offsets.length > 0) {
      let start = offsets[0].min;
      const result = offsets.map(offset => {
        const segment = {
          start,
          end: offset.cur
        };
        start = offset.cur;
        return segment;
      });
      result.push({
        start: result[result.length - 1].end,
        end: lineEnd
      });
      return result;
    }
    return [];
  }, [offsets]);

  const handleProbabilitySelectorThumbChange = useCallback((index: number, newProbability: number) => {
    const newExactPercentages = movePairedPercentage(exactPercentages, index, newProbability);
    if (newExactPercentages) {
      onChange(newExactPercentages);
    }
  }, [exactPercentages, onChange]);

  const stepThumb = useCallback((index: number, delta: number) => {
    const pair = exactPercentages[index] + exactPercentages[index + 1];
    const share = Math.min(pair, Math.max(0, exactPercentages[index] + delta));
    const newExactPercentages = [...exactPercentages];
    newExactPercentages[index] = share;
    newExactPercentages[index + 1] = pair - share;
    steppedThumbRef.current = index;
    onChange(newExactPercentages);
  }, [exactPercentages, onChange]);

  // a stepped thumb that crossed reversePercent has remounted, losing focus
  useLayoutEffect(() => {
    if (steppedThumbRef.current !== undefined) {
      svgRef.current?.querySelector<SVGCircleElement>(`[data-thumb="${steppedThumbRef.current}"]`)?.focus();
      steppedThumbRef.current = undefined;
    }
  }, [exactPercentages]);

  const renderThumb = (offset: ProbabilitySelectorOffset, index: number) => accessible
    ? <AccessibleThumb
        key={index}
        index={index}
        offset={offset}
        label={edgeLabels[index]}
        value={roundPercentages[index]}
        max={roundPercentages[index] + roundPercentages[index + 1]}
        onChange={handleProbabilitySelectorThumbChange}
        onStep={stepThumb}
      />
    : <ProbabilitySelectorThumb
        key={index}
        index={index}
        offset={offset}
        visibleLineLength={visibleLineLength}
        onChange={handleProbabilitySelectorThumbChange}
      />;

  const isDrawingMode = viewMode === "drawing";
  if (isDrawingMode && (exactPercentages.length < 2)) {
    return null;
  }

  return (
    <div className="probability-selector">
      <div className="header">Transition Probabilities</div>
      { isDrawingMode &&
      <div className={clsx("svg-container", { accessible })} style={{ width: svgWidth, height: svgHeight }}>
        <svg ref={svgRef} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          { segments.map(({ start, end }, i) => (
            <line
              key={i}
              x1={start}
              y1={lineY}
              x2={end}
              y2={lineY}
              strokeWidth={lineWidth}
              stroke={getDistinctColor(i)}
            />
          )) }
          { offsets.map((offset, index) => {
            if (offset.cur / lineLength < reversePercent) {
              return renderThumb(offset, index);
            }
          }).filter(thumb => !!thumb) }
          { /* Render thumbs with high cumulative percentage in reverse so they can be dragged left */ }
          { /* A copy, since reversing the memoized list swaps the thumbs on a render that doesn't rebuild it */ }
          { (accessible ? [...offsets].reverse() : offsets.reverse()).map((offset, _index) => {
            const index = offsets.length - _index - 1;
            if (offset.cur / lineLength >= reversePercent) {
              return renderThumb(offset, index);
            }
          }).filter(thumb => !!thumb) }
        </svg>
      </div>
      }
      <div className="percentages">
        { edgeLabels.length === 0 && <div>None</div> }
        { roundPercentages.map((p, i) => (
          <div key={i} style={{ color: isDrawingMode ? getDistinctColor(i) : "#000" }}>
            To { edgeLabels[i] }: { p }%
          </div>
        )) }
      </div>
    </div>
  );
};
