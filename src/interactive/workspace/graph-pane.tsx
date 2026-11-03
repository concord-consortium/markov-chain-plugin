import React, { useCallback, useState } from "react";
import { clsx } from "clsx";
import { Graph } from "../../components/graph";
import { Tool, Toolbar } from "../../components/toolbar";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { MarkovHost } from "../../components/host";
import { graphBodyHeight, toolbarColumns, toolbarRowHeight } from "./pane-sizes";
import { useLatest } from "./use-latest";

const tools: Tool[] = ["select", "fitView", "recenter", "zoomIn", "zoomOut"];
const noop = () => undefined;
// the steps the graph's corner zoom buttons take
const zoomInStep = 1.1;
const zoomOutStep = 0.9;

interface GraphPaneProps {
  tool: MarkovToolApi;
  log: MarkovHost["log"];
  // the row height the pane is laid out in, whether a row divider is below it, and whether the panes are stacked
  top: number;
  rowsDivider: boolean;
  stacked: boolean;
  emptyMessage: string;
  onUserZoom: () => void;
  onFit: () => void;
  onDoubleClickState: (id: string) => void;
}

// The graph and its toolbar. Every callback handed to Graph keeps its identity, reading the tool through a ref,
// since a new callback redraws the whole graph.
export const GraphPane = ({
  tool, log, top, rowsDivider, stacked, emptyMessage, onUserZoom, onFit, onDoubleClickState
}: GraphPaneProps) => {
  const [zoomRequest, setZoomRequest] = useState<{ id: number, by: number }>();
  const toolRef = useLatest(tool);
  const onUserZoomRef = useLatest(onUserZoom);
  const onDoubleClickStateRef = useLatest(onDoubleClickState);

  const setSelectedNodeId = useCallback((id?: string, skipToggle?: boolean) =>
    toolRef.current.selectState(id, "graph", skipToggle), [toolRef]);
  const handleEdgeSelect = useCallback((edge: { from: string, to: string }) =>
    toolRef.current.selectTransition(edge, "graph"), [toolRef]);
  const handleBackgroundClick = useCallback(() => toolRef.current.clearSelection("background"), [toolRef]);
  const handleNodeDoubleClick = useCallback((id: string) => onDoubleClickStateRef.current(id),
    [onDoubleClickStateRef]);
  const handleDragStop = useCallback((id: string) => {
    const label = toolRef.current.graph.nodes.find(node => node.id === id)?.label ?? id;
    log("StateMoved", { state: label });
  }, [log, toolRef]);
  const handleDimensions = useCallback((dimensions: { width: number, height: number }) =>
    toolRef.current.view.onDimensions(dimensions), [toolRef]);
  const handleUserZoom = useCallback(() => onUserZoomRef.current(), [onUserZoomRef]);

  const zoom = (by: number) => {
    onUserZoom();
    setZoomRequest(request => ({ id: (request?.id ?? 0) + 1, by }));
  };

  const columns = toolbarColumns(tools.length, graphBodyHeight(toolbarRowHeight(top, stacked), rowsDivider));
  const { graphHighlights, view } = tool;

  return (
    <div className={clsx("graph-pane-content", { "two-columns": columns === 2 })}>
      <Toolbar
        tools={tools}
        disabled={tool.animating}
        onToolSelected={noop}
        onReset={noop}
        onReturnToMainMenu={noop}
        onFitView={onFit}
        onRecenterView={view.onRecenterView}
        onZoomIn={() => zoom(zoomInStep)}
        onZoomOut={() => zoom(zoomOutStep)}
      />
      <Graph
        graph={tool.graph}
        {...graphHighlights}
        animating={tool.animating}
        opacity={view.graphOpacity}
        allowDragging={!tool.animating}
        autoArrange={true}
        keepPositions={true}
        zoomButtons={false}
        zoomRequest={zoomRequest}
        onUserZoom={handleUserZoom}
        fitTransitionMs={250}
        fitViewAt={view.fitViewAt}
        recenterViewAt={view.recenterViewAt}
        setSelectedNodeId={setSelectedNodeId}
        onEdgeSelect={handleEdgeSelect}
        onBackgroundClick={handleBackgroundClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onDragStop={handleDragStop}
        onDimensions={handleDimensions}
      />
      { tool.graphEmpty && <div className="graph-empty">{ emptyMessage }</div> }
    </div>
  );
};
