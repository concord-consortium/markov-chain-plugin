import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useMarkovTool } from "../../hooks/use-markov-tool";
import { useResizeObserver } from "../../hooks/use-resize-observer";
import {
  animatedNodeColor, incomingArrowColor, outgoingArrowColor, selectedNodeColor
} from "../../components/graph-highlight";
import { MarkovAuthoredState, ModeId } from "../authored-state";
import { MarkovInteractiveState } from "../interactive-state";
import { ArrowWidths } from "../../components/graph-utils";
import { useApHost } from "./ap-host";
import { ArrowMarkers } from "./arrow-markers";
import { DataWorkspace } from "./data-workspace";
import { DrawWorkspace } from "./draw-workspace";
import { ModeSwitch } from "./mode-switch";
import { ProbabilitiesToggle } from "./probabilities-toggle";
import {
  collapsedStrip, controlsRowHeight, defaultPaneSizes, dividerBand, paneBorder, paneGap, paneHeader, panePadding,
  stackBelow, toolbarButton, toolbarGap
} from "./pane-sizes";
import { restoreWork } from "./restore-work";
import { workspaceConfig } from "./workspace-config";

import "./workspace.scss";

interface WorkspaceProps {
  authoredState: MarkovAuthoredState;
  savedState: MarkovInteractiveState;
  // saves the input; absent standalone
  onSaveInput?: (text: string) => void;
  hosted: boolean;
}

// the sizes and colors the stylesheet reads, so none is written in both languages
const cssValues = {
  "--pane-gap": `${paneGap}px`, "--pane-padding": `${panePadding}px`, "--pane-border": `${paneBorder}px`,
  "--pane-top": `${defaultPaneSizes.top}px`, "--divider-band": `${dividerBand}px`,
  "--collapsed-strip": `${collapsedStrip}px`, "--pane-header": `${paneHeader}px`,
  "--toolbar-button": `${toolbarButton}px`, "--toolbar-gap": `${toolbarGap}px`,
  "--controls-row": `${controlsRowHeight}px`,
  "--highlight-selected": selectedNodeColor, "--highlight-output": animatedNodeColor,
  "--highlight-in": incomingArrowColor, "--highlight-out": outgoingArrowColor,
} as React.CSSProperties;

// The student's workspace: one tool per mode, each mode's body staying mounted, hidden while the other shows, so each
// keeps its work
export const Workspace = ({ authoredState, savedState, onSaveInput, hosted }: WorkspaceProps) => {
  const [configs] = useState(() => ({
    useData: workspaceConfig(authoredState, "useData"), draw: workspaceConfig(authoredState, "draw"),
  }));
  const [restored] = useState(() => restoreWork(savedState, authoredState, configs));
  const [mode, setMode] = useState<ModeId>(restored.mode);
  const [probabilities, setProbabilities] = useState(restored.probabilities);
  const [orderMatters, setOrderMatters] = useState(restored.orderMatters);
  // arrows keep their probability widths whether or not probabilities are shown
  const arrowWidths: ArrowWidths = "byState";
  const hosts = { useData: useApHost(hosted, "useData", orderMatters), draw: useApHost(hosted, "draw") };
  const tools = {
    useData: useMarkovTool(hosts.useData, restored.useData.tool), draw: useMarkovTool(hosts.draw, restored.draw.tool),
  };

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useResizeObserver(rootRef);
  const stacked = !!dimensions && dimensions.width < stackBelow;

  // each body has its own copy of the switch, so a radio with focus hides itself: the shown body's takes focus
  const moveFocusRef = useRef(false);
  const handleModeChange = (next: ModeId, radio: HTMLInputElement) => {
    moveFocusRef.current = radio.ownerDocument.activeElement === radio;
    setMode(next);
    hosts[next].log("ModeSwitched", { mode: next });
  };
  useEffect(() => {
    if (moveFocusRef.current) {
      moveFocusRef.current = false;
      rootRef.current?.querySelector<HTMLInputElement>(".workspace-body:not([hidden]) .mode-switch :checked")?.focus();
    }
  }, [mode]);

  const handleProbabilitiesChange = (on: boolean) => {
    setProbabilities(on);
    hosts[mode].log("ProbabilitiesToggled", { on });
  };

  const controls = (
    <>
      { configs.useData.modeSwitch &&
        <ModeSwitch mode={mode} disabled={tools[mode].animating} onChange={handleModeChange} />
      }
      { configs[mode].probabilities.showToggle &&
        <ProbabilitiesToggle on={probabilities} onChange={handleProbabilitiesChange} />
      }
    </>
  );

  return (
    <div className={clsx("markov-workspace", { stacked })} style={cssValues} ref={rootRef}>
      <ArrowMarkers />
      { authoredState.modes.useData &&
        <DataWorkspace text={restored.text} capitalization={restored.capitalization} inputSplit={restored.inputSplit}
          start={restored.useData} onSaveInput={onSaveInput} host={hosts.useData} tool={tools.useData}
          config={configs.useData} stacked={stacked}
          hidden={mode !== "useData"} controls={controls} probabilities={probabilities} arrowWidths={arrowWidths}
          orderMatters={orderMatters} onOrderMattersChange={setOrderMatters} />
      }
      { authoredState.modes.draw &&
        <DrawWorkspace host={hosts.draw} tool={tools.draw} config={configs.draw} stacked={stacked}
          hidden={mode !== "draw"} controls={controls} probabilities={probabilities} arrowWidths={arrowWidths}
          start={restored.draw} />
      }
    </div>
  );
};
