import React, { useCallback, useMemo } from "react";

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
  exactPercentages: number[]
  edgeLabels: string[]
  onChange: (newPercentages: number[]) => void
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

const distinctColors = [
  "#e6194B", "#3cb44b", "#4363d8", "#f58231", "#42d4f4", "#ffe119",
  "#f032e6", "#fabed4", "#469990", "#dcbeff", "#9A6324", "#fffac8",
  "#800000", "#aaffc3", "#000075", "#a9a9a9", "#ffffff", "#000000"
];
const getDistinctColor = (i: number) => distinctColors[i % distinctColors.length];

export const percentage = (n: number) => n * 100;
export const probability = (n: number) => n / 100;
export const reduceToSum = (a: number[]) => a.reduce((acc, cur) => acc + cur, 0);

export const ProbabilitySelectorThumb = (props: ProbabilitySelectorThumbProps) => {
  const {index, offset, onChange} = props;

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGCircleElement>) => {
    const startX = e.clientX;

    const handleMouseMove = (e2: MouseEvent) => {
      const delta = e2.clientX - startX;
      const newOffset = Math.min(Math.max(offset.min, offset.cur + delta), offset.max);
      const newProbability = (newOffset - offset.min) / (offset.max - offset.min);
      onChange(index, newProbability);
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

export const ProbabilitySelector = ({exactPercentages, edgeLabels, onChange}: ProbabilitySelectorProps) => {

  const roundPercentages = useMemo(() => {
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
    const prevExactPercentages = exactPercentages
      .slice(0, index)
      .reduce((acc, cur) => acc + cur, 0);
    const pairedPercentageSum = exactPercentages
      .slice(index, index + 2)
      .reduce((acc, cur) => acc + cur, 0);
    const newExactPercentage = Math.min(100, Math.max(0, percentage(newProbability) - prevExactPercentages));

    const newExactPercentages = [...exactPercentages];
    newExactPercentages[index] = newExactPercentage;
    newExactPercentages[index+1] = pairedPercentageSum - newExactPercentage;
    if (newExactPercentages.find((n) => n<0) == undefined) {
      onChange(newExactPercentages);
    }
  }, [exactPercentages, onChange]);

  if (exactPercentages.length < 2) {
    return null;
  }

  return (
    <div className="probability-selector">
      <div className="header">Transition Probabilities</div>
      <div className="svg-container" style={{width: svgWidth, height: svgHeight}}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {segments.map(({start, end}, i) => (
            <line
              key={i}
              x1={start}
              y1={lineY}
              x2={end}
              y2={lineY}
              strokeWidth={lineWidth}
              stroke={getDistinctColor(i)}
            />
          ))}
          {offsets.map((offset, index) => (
            <ProbabilitySelectorThumb
              key={index}
              index={index}
              offset={offset}
              visibleLineLength={visibleLineLength}
              onChange={handleProbabilitySelectorThumbChange}
            />
          ))}
        </svg>
      </div>
      <div className="percentages">
        {roundPercentages.map((p, i) => (
          <div key={i} style={{color: getDistinctColor(i)}}>To {edgeLabels[i]}: {p}%</div>
        ))}
      </div>
    </div>
  );
};
