import React, { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { useLatest } from "../../hooks/use-latest";
import { useMarkovTool } from "../../hooks/use-markov-tool";
import { useResizeObserver } from "../../hooks/use-resize-observer";
import {
  animatedNodeColor, incomingArrowColor, outgoingArrowColor, selectedNodeColor
} from "../../components/graph-highlight";
import { MarkovAuthoredState, ModeId } from "../authored-state";
import { MarkovInteractiveState } from "../interactive-state";
import { outputsFull } from "../saved-outputs";
import { ArrowWidths } from "../../components/graph-utils";
import { useApHost } from "./ap-host";
import { ArrowMarkers } from "./arrow-markers";
import { buildInteractiveState, ModeReport, savedDrawing, toolParts } from "./build-state";
import { DataWorkspace } from "./data-workspace";
import { DrawWorkspace } from "./draw-workspace";
import { ModeSwitch } from "./mode-switch";
import { ProbabilitiesToggle } from "./probabilities-toggle";
import {
  collapsedStrip, controlsRowHeight, defaultPaneSizes, dividerBand, paneBorder, paneGap, paneHeader, panePadding,
  stackBelow, toolbarButton, toolbarGap
} from "./pane-sizes";
import { restoreWork } from "./restore-work";
import { Saver, useSavedWork, useSaveRequest } from "./use-saved-work";
import { workspaceConfig } from "./workspace-config";

import "./workspace.scss";

interface WorkspaceProps {
  authoredState: MarkovAuthoredState;
  savedState: MarkovInteractiveState;
  // absent where nothing is saved
  saver?: Saver;
  hosted: boolean;
  // a student's work shown in a report
  readOnly: boolean;
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
export const Workspace = ({ authoredState, savedState, saver, hosted, readOnly }: WorkspaceProps) => {
  const [configs] = useState(() => ({
    useData: workspaceConfig(authoredState, "useData"), draw: workspaceConfig(authoredState, "draw"),
  }));
  const [restored] = useState(() => restoreWork(savedState, authoredState, configs, { readOnly }));
  const [mode, setMode] = useState<ModeId>(restored.mode);
  const [probabilities, setProbabilities] = useState(restored.probabilities);
  const [orderMatters, setOrderMatters] = useState(restored.orderMatters);
  // arrows keep their probability widths whether or not probabilities are shown
  const arrowWidths: ArrowWidths = "byState";
  const { request, activeRef, requestSave, markActive } = useSaveRequest();
  const hostSaving = useMemo(() => ({ requestSave, markActive }), [requestSave, markActive]);
  const hosts = {
    useData: useApHost(hosted, "useData", hostSaving, orderMatters), draw: useApHost(hosted, "draw", hostSaving),
  };
  const tools = {
    useData: useMarkovTool(hosts.useData, restored.useData.tool), draw: useMarkovTool(hosts.draw, restored.draw.tool),
  };

  const animating = tools.useData.animating || tools.draw.animating;

  // the limit is checked when outputs or the drawing change, not during a sequence, which can always finish; a mode the
  // page doesn't offer still counts, since its saved outputs are kept
  const dataGroups = tools.useData.outputProps.sequenceGroups;
  const drawGroups = tools.draw.outputProps.sequenceGroups;
  const drawing = tools.draw.graph;
  const [limitReached, setLimitReached] = useState(() => outputsFull([dataGroups, drawGroups], savedDrawing(drawing)));
  const limitReachedRef = useLatest(limitReached);
  const logRef = useLatest(hosts[mode].log);
  useEffect(() => {
    if (animating) {
      return;
    }
    const full = outputsFull([dataGroups, drawGroups], savedDrawing(drawing));
    if (full && !limitReachedRef.current) {
      const outputs = [...dataGroups, ...drawGroups].reduce((count, group) => count + group.sequences.length, 0);
      logRef.current("OutputLimitReached", { outputs });
    }
    setLimitReached(full);
  }, [animating, dataGroups, drawGroups, drawing, limitReachedRef, logRef]);

  const reportsRef = useRef<Record<ModeId, ModeReport>>({ useData: {}, draw: {} });
  const { afterDraw } = useSavedWork({
    saver, request, activeRef, animating,
    build: () => buildInteractiveState(savedState, {
      offered: authoredState.modes,
      hasInputPane: authoredState.modes.useData && configs.useData.panes.some(pane => pane.id === "input"),
      authoredText: authoredState.startingText,
      mode, probabilities, orderMatters,
      tools: { useData: toolParts(tools.useData), draw: toolParts(tools.draw) },
      reports: reportsRef.current,
    }),
  });
  const saving = useMemo(() => ({
    useData: { report: reportsRef.current.useData, requestSave, markActive, afterDraw },
    draw: { report: reportsRef.current.draw, requestSave, markActive, afterDraw },
  }), [requestSave, markActive, afterDraw]);

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
          start={restored.useData} saving={saving.useData} limitReached={limitReached} readOnly={readOnly}
          host={hosts.useData}
          tool={tools.useData}
          config={configs.useData} stacked={stacked}
          hidden={mode !== "useData"} controls={controls} probabilities={probabilities} arrowWidths={arrowWidths}
          orderMatters={orderMatters} onOrderMattersChange={setOrderMatters} />
      }
      { authoredState.modes.draw &&
        <DrawWorkspace host={hosts.draw} tool={tools.draw} config={configs.draw} stacked={stacked}
          hidden={mode !== "draw"} controls={controls} probabilities={probabilities} arrowWidths={arrowWidths}
          start={restored.draw} saving={saving.draw} limitReached={limitReached} readOnly={readOnly} />
      }
    </div>
  );
};
