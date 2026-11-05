import React, { useId } from "react";
import { clsx } from "clsx";
import { Generator } from "../../components/generator";
import { SequenceOutput } from "../../components/sequence-output";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { ToggleIcon } from "./pane";

interface GeneratorPaneProps {
  tool: MarkovToolApi;
  controlsOpen: boolean;
  onToggleControls: () => void;
  limitReached: boolean;
}

// The generator's controls in a column that collapses on its own, beside the output
export const GeneratorPane = ({ tool, controlsOpen, onToggleControls, limitReached }: GeneratorPaneProps) => {
  const controlsId = useId();
  const action = controlsOpen ? "Collapse" : "Expand";
  return (
    <div className="generator-pane-content">
      <div className={clsx("generator-controls", { collapsed: !controlsOpen })}>
        <div className="generator-controls-header">
          { controlsOpen && <h3>Controls</h3> }
          <button type="button" className="pane-toggle controls-toggle" aria-expanded={controlsOpen}
            aria-controls={controlsId} aria-label={`${action} the generator's controls`}
            title={`${action} the generator's controls`} onClick={onToggleControls}>
            <ToggleIcon open={controlsOpen} />
          </button>
        </div>
        <div id={controlsId} className="generator-controls-body" hidden={!controlsOpen}>
          <Generator {...tool.generatorProps} limitReached={limitReached} />
        </div>
      </div>
      <div className="generator-output">
        <SequenceOutput {...tool.outputProps} keyboardSelect heading="Output" openAtNewest />
        <p role="status" className="output-limit">
          { limitReached && "You have reached the maximum number of outputs." }
        </p>
      </div>
    </div>
  );
};
