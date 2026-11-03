import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

import { GenerationMode, Node, SequenceGroup } from "../type";
import { AnyStartingState } from "./generator";

import DropdownUpArrowIcon from "../assets/dropdown-up-arrow-icon.svg";
import DropdownDownArrowIcon from "../assets/dropdown-down-arrow-icon.svg";

const SequenceOutputHeader = ({ group }: { group: SequenceGroup }) => {
  const [expanded, setExpanded] = useState(false);
  const startingState = group.startingNode?.label ?? AnyStartingState;
  const lengthLimit = group.lengthLimit;
  const delimiter = group.delimiter === "" ? "(none)" : `"${group.delimiter}"`;

  const handleToggleExpanded = () => setExpanded(prev => !prev);

  if (expanded) {
    return (
      <div className="header expanded" onClick={handleToggleExpanded}>
        <div className="firstItem">
          <div>Starting State: { startingState }</div>
          <span className="collapse"><DropdownUpArrowIcon /></span>
        </div>
        <div>Max Length: { lengthLimit }</div>
        <div>Delimiter: { delimiter }</div>
      </div>
    );
  }

  return (
    <div className="header collapsed" onClick={handleToggleExpanded}>
      <span>{ startingState }</span>
      <span>/</span>
      <span>{ lengthLimit }</span>
      <span>/</span>
      <span>{ delimiter }</span>
      <span className="expand"><DropdownDownArrowIcon /></span>
    </div>
  );
};

export interface SequenceOutputProps {
  sequenceGroups: SequenceGroup[];
  graphEmpty: boolean;
  generationMode: GenerationMode;
  lengthLimit?: number;
  highlightOutput?: { group: SequenceGroup, sequence: Node[] };
  onToggleHighlight: (group: SequenceGroup, sequence: Node[]) => void;
  onClear: () => void;
  onCancel: () => void;
}

export const SequenceOutput = ({
  sequenceGroups, graphEmpty, generationMode, lengthLimit, highlightOutput, onToggleHighlight, onClear, onCancel
}: SequenceOutputProps) => {
  const animating = generationMode !== "ready";
  const disabled = sequenceGroups.length === 0;

  // scroll to the newest output when the groups change, but not on mount, so a remounted output opens at the top
  const innerOutputRef = useRef<HTMLDivElement | null>(null);
  const scrolledGroupsRef = useRef(sequenceGroups);
  useEffect(() => {
    if (scrolledGroupsRef.current === sequenceGroups) {
      return;
    }
    scrolledGroupsRef.current = sequenceGroups;
    if (innerOutputRef.current && sequenceGroups.length > 0) {
      innerOutputRef.current.scrollTop = innerOutputRef.current.scrollHeight;
    }
  }, [sequenceGroups]);

  return (
    <div className="sequence-output">
      <label>Output:</label>
      <div className="output">
        <div className="inner-output" ref={innerOutputRef}>
          { sequenceGroups.map((group, i) => {
            return (
              <div className="group" key={i}>
                <SequenceOutputHeader group={group} />
                <div className="sequences">
                  { group.sequences.map((s, j) => (
                    <div
                      key={j}
                      className={clsx("sequence", {
                        disabled: animating,
                        highlighted: (
                          highlightOutput?.group === group && highlightOutput.sequence === s
                        )
                      })}
                      onClick={animating ? undefined : () => onToggleHighlight(group, s)}
                    >
                      { s.map(n => n.label).join(group.delimiter) }
                    </div>
                  )) }
                </div>
              </div>
            );
          }) }
        </div>
      </div>
      <div className="buttons">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || lengthLimit === undefined || generationMode !== "ready"}>
          Clear Output
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={graphEmpty || (generationMode === "ready")}>
          Cancel
        </button>
      </div>
    </div>
  );
};
