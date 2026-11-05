import React, { useCallback } from "react";
import { clsx } from "clsx";
import { Drawing } from "../../components/drawing";
import { ArrowWidths } from "../../components/graph-utils";
import { D3Node, Graph, GraphView, Transform } from "../../components/graph";
import { graphLabels } from "../../components/graph-labels";
import { Tool, Toolbar } from "../../components/toolbar";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { MarkovHost } from "../../components/host";
import { useZoomRequest } from "../../hooks/use-zoom-request";
import { graphBodyHeight, paneGap, toolbarColumns, toolbarWidth } from "./pane-sizes";
import { useLatest } from "../../hooks/use-latest";
import { graphNotes } from "./graph-notes";
import { ModeSaving } from "./use-pane-layout";

export const dataTools: Tool[] = ["select", "fitView", "recenter", "zoomIn", "zoomOut"];
const noop = () => undefined;
const fitMs = 250;

interface GraphPaneProps {
  // the graph of Data mode's input, or a drawing
  variant?: "data" | "draw";
  tools?: Tool[];
  tool: MarkovToolApi;
  log: MarkovHost["log"];
  // the row height the pane is drawn at
  top: number;
  emptyMessage?: string;
  onUserZoom: () => void;
  onFit: () => void;
  onResized: () => void;
  initialView?: GraphView;
  saving: ModeSaving;
  readOnly: boolean;
  onDoubleClickState?: (id: string) => void;
  probabilities: boolean;
  arrowWidths: ArrowWidths;
  // false draws a bag of words, whose arrows can't be chosen; a drawing is always a Markov chain
  orderMatters?: boolean;
}

// The graph and its toolbar. Every callback handed to Graph keeps its identity, reading the tool through a ref,
// since a new callback redraws the whole graph.
export const GraphPane = ({
  variant = "data", tools = dataTools, tool, log, top, emptyMessage, onUserZoom, onFit, onResized, initialView,
  saving, readOnly, onDoubleClickState, probabilities, arrowWidths, orderMatters = true
}: GraphPaneProps) => {
  const toolRef = useLatest(tool);
  const onUserZoomRef = useLatest(onUserZoom);
  const onDoubleClickStateRef = useLatest(onDoubleClickState);

  const setSelectedNodeId = useCallback((id?: string, skipToggle?: boolean) =>
    toolRef.current.selectState(id, "graph", skipToggle), [toolRef]);
  const handleEdgeSelect = useCallback((edge: { from: string, to: string }) =>
    toolRef.current.selectTransition(edge, "graph"), [toolRef]);
  const handleBackgroundClick = useCallback(() => toolRef.current.clearSelection("background"), [toolRef]);
  const handleNodeDoubleClick = useCallback((id: string) => onDoubleClickStateRef.current?.(id),
    [onDoubleClickStateRef]);
  const handleDragStop = useCallback((id: string) => {
    const label = toolRef.current.graph.nodes.find(node => node.id === id)?.label ?? id;
    log("StateMoved", { state: label });
  }, [log, toolRef]);
  const onResizedRef = useLatest(onResized);
  const handleDimensions = useCallback((dimensions: { width: number, height: number }) => {
    toolRef.current.view.onDimensions(dimensions);
    onResizedRef.current();
  }, [toolRef, onResizedRef]);
  const handleUserZoom = useCallback(() => onUserZoomRef.current(), [onUserZoomRef]);
  const savingRef = useLatest(saving);
  const handleTransformed = useCallback(({ x, y, k }: Transform) => {
    savingRef.current.report.view = { x, y, k };
  }, [savingRef]);
  const handleArranged = useCallback((nodes: D3Node[]) => {
    savingRef.current.report.arranged = nodes;
    savingRef.current.afterDraw();
  }, [savingRef]);
  const { zoomRequest, zoomIn, zoomOut } = useZoomRequest(handleUserZoom);

  const columns = toolbarColumns(tools.length, graphBodyHeight(top));
  const { graphHighlights, view } = tool;
  // a generating step's labels come and go, so the note stays for the whole sequence and is read out once
  const labelsShown = probabilities && (tool.animating ||
    graphLabels(tool.graph, orderMatters, { ...graphHighlights, animating: tool.animating }).length > 0);
  const notes = graphNotes({
    labelsShown, orderMatters, stateChosen: tool.selection?.kind === "state", animating: tool.animating
  });

  return (
    <div className={clsx("graph-pane-content", { columns: columns > 1 })}
      style={{ "--toolbar-columns": columns } as React.CSSProperties}>
      { variant === "draw"
        ? <Drawing
            tools={tools}
            graph={tool.graph}
            {...graphHighlights}
            animating={tool.animating}
            graphOpacity={view.graphOpacity}
            fitViewAt={view.fitViewAt}
            recenterViewAt={view.recenterViewAt}
            resetViewAt={view.resetViewAt}
            setGraph={view.setGraph}
            setHighlightNode={view.setHighlightNode}
            setSelectedNodeId={setSelectedNodeId}
            onReset={view.onReset}
            onReturnToMainMenu={noop}
            onFitView={onFit}
            onRecenterView={view.onRecenterView}
            onDimensions={handleDimensions}
            onEdgeSelect={handleEdgeSelect}
            onBackgroundClick={handleBackgroundClick}
            onUserZoom={handleUserZoom}
            onTransformed={handleTransformed}
            initialView={initialView}
            readOnly={readOnly}
            fitTransitionMs={fitMs}
            probabilityLabels={probabilities}
            arrowWidths={arrowWidths}
            closeEditorOnEscape
            uniqueLabels
            accessibleEditor
            log={log}
          />
        : <>
          <Toolbar
            tools={tools}
            disabled={tool.animating}
            onToolSelected={noop}
            onReset={noop}
            onReturnToMainMenu={noop}
            onFitView={onFit}
            onRecenterView={view.onRecenterView}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
          />
          <Graph
            graph={tool.graph}
            {...graphHighlights}
            animating={tool.animating}
            opacity={view.graphOpacity}
            allowDragging={!tool.animating && !readOnly}
            autoArrange={true}
            keepPositions={true}
            zoomButtons={false}
            zoomRequest={zoomRequest}
            onUserZoom={handleUserZoom}
            onTransformed={handleTransformed}
            onAutoArrangeEnd={handleArranged}
            initialView={initialView}
            fitTransitionMs={fitMs}
            fitViewAt={view.fitViewAt}
            recenterViewAt={view.recenterViewAt}
            setSelectedNodeId={setSelectedNodeId}
            onEdgeSelect={orderMatters ? handleEdgeSelect : undefined}
            onBackgroundClick={handleBackgroundClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onDragStop={handleDragStop}
            onDimensions={handleDimensions}
            probabilityLabels={probabilities}
            arrowWidths={arrowWidths}
            orderMatters={orderMatters}
          />
          </>
      }
      { tool.graphEmpty && emptyMessage && <div className="graph-empty">{ emptyMessage }</div> }
      <div className="graph-notes" aria-live="polite" style={{ left: toolbarWidth(columns) + paneGap }}>
        { notes.map(note => <p key={note}>{ note }</p>) }
      </div>
    </div>
  );
};
