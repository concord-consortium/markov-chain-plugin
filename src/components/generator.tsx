import React from "react";

import { DelimiterType, GenerationMode, Node } from "../type";
import { SpeedToggle } from "./speed-toggle";
import { compareStateLabels } from "./app-utils";

import StepIcon from "../assets/step.svg";
import PlayIcon from "../assets/play.svg";
import PauseIcon from "../assets/pause.svg";

export const AnyStartingState = "(any)";

export interface GeneratorProps {
  nodes: Node[];
  graphEmpty: boolean;
  generationMode: GenerationMode;
  startingState: string;
  lengthLimit?: number;
  delimiter: string;
  delimiterType: DelimiterType;
  fastSimulation: boolean;
  // false leaves focus where it is when the "other" delimiter's field shows
  delimiterAutoFocus?: boolean;
  onStartingStateChange: React.ChangeEventHandler<HTMLSelectElement>;
  onLengthLimitChange: React.ChangeEventHandler<HTMLInputElement>;
  onLengthLimitCommit: () => void;
  onDelimiterTypeChange: React.ChangeEventHandler<HTMLSelectElement>;
  onDelimiterChange: React.ChangeEventHandler<HTMLInputElement>;
  onDelimiterCommit: () => void;
  onSpeedChange: (fast: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
}

export const Generator = ({
  nodes, graphEmpty, generationMode, startingState, lengthLimit, delimiter, delimiterType, fastSimulation,
  delimiterAutoFocus = true, onStartingStateChange, onLengthLimitChange, onLengthLimitCommit, onDelimiterTypeChange,
  onDelimiterChange, onDelimiterCommit, onSpeedChange, onPlay, onPause, onResume, onStep
}: GeneratorProps) => {
  const animating = generationMode !== "ready";
  const playLabel = generationMode === "playing" ? "Pause" : (generationMode === "paused" ? "Resume" : "Play");
  const PlayOrPauseIcon = generationMode === "playing" ? PauseIcon : PlayIcon;
  const onPlayClick = generationMode === "playing"
    ? onPause
    : (generationMode === "paused" ? onResume : onPlay);
  const sortedNodes = [...nodes];
  sortedNodes.sort(compareStateLabels);

  const handleLengthLimitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onLengthLimitCommit();
    }
  };

  return (
    <div className="generate">
      <div className="flex-col">
        <div>
          <label>Starting State:</label>
          <select onChange={onStartingStateChange} value={startingState} disabled={animating}>
            <option value="">{ AnyStartingState }</option>
            { sortedNodes.map(n => <option key={n.id} value={n.id}>{ n.label }</option>) }
          </select>
        </div>

        <div className="flex-row">
          <div>
            <label>Max Length:</label>
            <input className="bordered" type="number"
              value={lengthLimit}
              onChange={onLengthLimitChange}
              onBlur={onLengthLimitCommit}
              onKeyDown={handleLengthLimitKeyDown}
              min={1}
              disabled={animating}
            />
          </div>

          <div>
            <label>Delimiter:</label>
            <select value={delimiterType} onChange={onDelimiterTypeChange}>
              <option value="none">none</option>
              <option value="space">space</option>
              <option value="other">other ...</option>
            </select>
            { delimiterType === "other" && <input className="bordered" type="text"
              onChange={onDelimiterChange}
              onBlur={onDelimiterCommit}
              value={delimiter}
              placeholder="delimiter"
              disabled={animating}
              style={{ width: 75, marginTop: 5 }}
              autoFocus={delimiterAutoFocus}
            /> }
          </div>
        </div>

        <SpeedToggle fastSimulation={fastSimulation} onChange={onSpeedChange} />

      </div>
      <div className="buttons">
        <button
          type="button"
          onClick={onPlayClick}
          disabled={graphEmpty || lengthLimit === undefined}>
          <PlayOrPauseIcon />
          { playLabel }
        </button>
        <button
          type="button"
          onClick={onStep}
          disabled={graphEmpty || lengthLimit === undefined || generationMode === "playing"}>
          <StepIcon />
          Step
        </button>
      </div>
    </div>
  );
};
