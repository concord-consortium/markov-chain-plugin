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
  const orderless = group.orderMatters === false;

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
        { orderless && <div>Order matters: No</div> }
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
      { orderless && <><span>/</span><span>Orderless</span></> }
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
  // each output also takes Tab and is chosen with Enter or Space, reporting whether it is chosen
  keyboardSelect?: boolean;
  heading?: string;
  // opens at the newest output, once it is shown
  openAtNewest?: boolean;
}

export const SequenceOutput = ({
  sequenceGroups, graphEmpty, generationMode, lengthLimit, highlightOutput, onToggleHighlight, onClear, onCancel,
  keyboardSelect, heading = "Output:", openAtNewest
}: SequenceOutputProps) => {
  const animating = generationMode !== "ready";
  const disabled = sequenceGroups.length === 0;

  // scroll to the newest output when the groups change; on mount, an output opens at the top without openAtNewest
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

  // an output in a hidden mode or a collapsed pane has no height, and a scrollTop written then is lost
  useEffect(() => {
    const output = innerOutputRef.current;
    if (!openAtNewest || !output) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (output.clientHeight > 0) {
        output.scrollTop = output.scrollHeight;
        observer.disconnect();
      }
    });
    observer.observe(output);
    return () => observer.disconnect();
  }, [openAtNewest]);

  return (
    <div className="sequence-output">
      <label>{ heading }</label>
      <div className="output">
        <div className="inner-output" ref={innerOutputRef}>
          { sequenceGroups.map((group, i) => {
            return (
              <div className="group" key={i}>
                <SequenceOutputHeader group={group} />
                <div className="sequences">
                  { group.sequences.map((s, j) => {
                    const highlighted = highlightOutput?.group === group && highlightOutput.sequence === s;
                    const choose = animating ? undefined : () => onToggleHighlight(group, s);
                    const keyboard = keyboardSelect && {
                      role: "button",
                      tabIndex: animating ? -1 : 0,
                      "aria-pressed": highlighted,
                      "aria-disabled": animating || undefined,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          choose?.();
                        }
                      },
                    };
                    return (
                      <div
                        key={j}
                        className={clsx("sequence", { disabled: animating, highlighted })}
                        onClick={choose}
                        {...keyboard}
                      >
                        { s.map(n => n.label).join(group.delimiter) }
                      </div>
                    );
                  }) }
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
