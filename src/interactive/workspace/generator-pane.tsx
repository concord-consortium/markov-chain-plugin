import React, { useId } from "react";
import { clsx } from "clsx";
import { Generator } from "../../components/generator";
import { SequenceOutput } from "../../components/sequence-output";
import { MarkovToolApi } from "../../hooks/use-markov-tool";

interface GeneratorPaneProps {
  tool: MarkovToolApi;
  controlsOpen: boolean;
  onToggleControls: () => void;
}

// The generator's controls in a column that collapses on its own, beside the output
export const GeneratorPane = ({ tool, controlsOpen, onToggleControls }: GeneratorPaneProps) => {
  const controlsId = useId();
  const action = controlsOpen ? "Collapse" : "Expand";
  return (
    <div className="generator-pane-content">
      <div className={clsx("generator-controls", { collapsed: !controlsOpen })}>
        <button type="button" className="controls-toggle" aria-expanded={controlsOpen} aria-controls={controlsId}
          aria-label={`${action} the generator's controls`} title={`${action} the generator's controls`}
          onClick={onToggleControls}>
          <span aria-hidden="true">{ controlsOpen ? "‹" : "›" }</span>
        </button>
        <div id={controlsId} className="generator-controls-body" hidden={!controlsOpen}>
          <Generator {...tool.generatorProps} />
        </div>
      </div>
      <SequenceOutput {...tool.outputProps} keyboardSelect />
    </div>
  );
};
