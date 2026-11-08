import React, { useMemo, useRef } from "react";
import { ConfirmModal } from "../../components/confirm-modal";
import { ArrowWidths } from "../../components/graph-utils";
import { MarkovHost } from "../../components/host";
import { Tool } from "../../components/toolbar";
import { useLatest } from "../../hooks/use-latest";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { ControlsRow } from "./controls-row";
import { GeneratorPane } from "./generator-pane";
import { dataTools, GraphPane } from "./graph-pane";
import { highlightsFor } from "./highlights";
import { InspectPane } from "./inspect-pane";
import { RestoredMode } from "./restore-work";
import { useClearGoneSelection, useEscape, useInspectChoices, useScrollToChoice } from "./use-mode-body";
import { ModeSaving, usePaneLayout } from "./use-pane-layout";
import { DrawWorkspaceConfig, WorkspacePaneId } from "./workspace-config";
import { WorkspacePanes } from "./workspace-panes";

const drawModeTools: Tool[] = [
  "select", "addNode", "addEdge", "delete", "fitView", "recenter", "zoomIn", "zoomOut", "reset"
];

interface DrawWorkspaceProps {
  host: MarkovHost;
  tool: MarkovToolApi;
  config: DrawWorkspaceConfig;
  stacked: boolean;
  hidden: boolean;
  // the shell's controls, first in the row
  controls: React.ReactNode;
  // the shell's controls in the Graph pane's header
  graphControls: React.ReactNode;
  // the shell's actions, last in the row
  actions: React.ReactNode;
  probabilities: boolean;
  arrowWidths: ArrowWidths;
  start: RestoredMode;
  saving: ModeSaving;
  limitReached: boolean;
  readOnly: boolean;
}

// Draw mode's body: a drawing in the Graph pane, with Inspect and the generator as the author set them
export const DrawWorkspace = ({
  host, tool, config, stacked, hidden, controls, graphControls, actions, probabilities, arrowWidths, start, saving,
  limitReached, readOnly
}: DrawWorkspaceProps) => {
  const toolRef = useLatest(tool);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sourcePaneRef = useRef<WorkspacePaneId>(undefined);
  const layout = usePaneLayout(config, host, tool, stacked, hidden, start, saving);
  const highlights = useMemo(() => highlightsFor(tool.selection, [], tool.graph.edges),
    [tool.selection, tool.graph.edges]);

  useClearGoneSelection(tool);
  useScrollToChoice(rootRef, tool.selection, sourcePaneRef);

  // Escape closes an open dialog and leaves what is behind it: Reset's here, before the drawing hears the key, and the
  // state editor in the drawing
  useEscape(rootRef, hidden, e => {
    const { confirmModal } = toolRef.current.view;
    if (confirmModal) {
      e.stopPropagation();
      confirmModal.onClose();
    } else if (!rootRef.current?.querySelector(".nodeModal")) {
      toolRef.current.clearSelection("escape");
    }
  });

  const { handleSelectState, handleSelectTransition } = useInspectChoices(tool);

  const renderPane = (id: WorkspacePaneId) => {
    switch (id) {
      case "graph":
        return (
          <GraphPane variant="draw" tools={readOnly ? dataTools : drawModeTools} tool={tool} log={host.log}
            top={layout.top} probabilities={probabilities} arrowWidths={arrowWidths}
            onUserZoom={layout.handleUserZoom} onFit={layout.handleFitPressed}
            onRecenter={layout.handleRecenterPressed} onResized={layout.handleGraphResized}
            initialView={start.view} saving={saving} readOnly={readOnly} />
        );
      case "inspect":
        return (
          <InspectPane mode="draw" orderMatters={true} graph={tool.graph} selection={tool.selection}
            highlights={highlights} log={host.log} onSelectState={handleSelectState}
            onSelectTransition={handleSelectTransition} start={start.inspect} report={saving.report} />
        );
      case "generator":
        return (
          <GeneratorPane tool={tool} controlsOpen={layout.controlsOpen} onToggleControls={layout.toggleControls}
            limitReached={limitReached} readOnly={readOnly} />
        );
    }
  };

  return (
    <div className="workspace-body" hidden={hidden} ref={rootRef}>
      <ControlsRow tool={tool} actions={actions}>{ controls }</ControlsRow>
      <WorkspacePanes layout={layout} stacked={stacked} sourcePaneRef={sourcePaneRef} renderPane={renderPane}
        fixedPane="graph" graphControls={graphControls} />
      { tool.view.confirmModal && <ConfirmModal {...tool.view.confirmModal} /> }
    </div>
  );
};
