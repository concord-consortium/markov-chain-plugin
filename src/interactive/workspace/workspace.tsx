import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useMarkovTool } from "../../hooks/use-markov-tool";
import { useResizeObserver } from "../../hooks/use-resize-observer";
import {
  animatedNodeColor, incomingArrowColor, outgoingArrowColor, selectedNodeColor
} from "../../components/graph-highlight";
import { MarkovAuthoredState, ModeId } from "../authored-state";
import { useApHost } from "./ap-host";
import { ArrowMarkers } from "./arrow-markers";
import { DataWorkspace } from "./data-workspace";
import { DrawWorkspace } from "./draw-workspace";
import { ModeSwitch } from "./mode-switch";
import {
  collapsedStrip, controlsRowHeight, defaultPaneSizes, dividerBand, paneBorder, paneGap, paneHeader, panePadding,
  stackBelow, toolbarButton, toolbarGap
} from "./pane-sizes";
import { workspaceConfig } from "./workspace-config";

import "./workspace.scss";

interface WorkspaceProps {
  authoredState: MarkovAuthoredState;
  savedInput?: string;
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
export const Workspace = ({ authoredState, savedInput, onSaveInput, hosted }: WorkspaceProps) => {
  const [mode, setMode] = useState<ModeId>(authoredState.startingMode);
  const [configs] = useState(() => ({
    useData: workspaceConfig(authoredState, "useData"), draw: workspaceConfig(authoredState, "draw"),
  }));
  const hosts = { useData: useApHost(hosted, "useData"), draw: useApHost(hosted, "draw") };
  const tools = { useData: useMarkovTool(hosts.useData), draw: useMarkovTool(hosts.draw) };

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

  const controls = configs.useData.modeSwitch &&
    <ModeSwitch mode={mode} disabled={tools[mode].animating} onChange={handleModeChange} />;

  return (
    <div className={clsx("markov-workspace", { stacked })} style={cssValues} ref={rootRef}>
      <ArrowMarkers />
      { authoredState.modes.useData &&
        <DataWorkspace authoredState={authoredState} savedInput={savedInput} onSaveInput={onSaveInput}
          host={hosts.useData} tool={tools.useData} config={configs.useData} stacked={stacked}
          hidden={mode !== "useData"} controls={controls} />
      }
      { authoredState.modes.draw &&
        <DrawWorkspace host={hosts.draw} tool={tools.draw} config={configs.draw} stacked={stacked}
          hidden={mode !== "draw"} controls={controls} />
      }
    </div>
  );
};
