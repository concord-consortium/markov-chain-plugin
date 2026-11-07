import React, { createRef, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { nanoid } from "nanoid";

import { D3Node, DrawingMode, Graph, GraphView, Point, RubberBand, Transform } from "./graph";
import { Edge, GraphData, Node } from "../type";
import { ArrowWidths } from "./graph-utils";

import { DragIcon } from "./drawing/drag-icon";
import { NodeModal } from "./drawing/node-modal";
import { nextStateLabel } from "./drawing/state-labels";
import { Tool, Toolbar } from "./toolbar";
import { AddText } from "./drawing/add-text";
import { textToWords, wordsToGraph } from "../utils/text-to-graph";
import { MarkovHost } from "./host";
import { useLatest } from "../hooks/use-latest";
import { useZoomRequest } from "../hooks/use-zoom-request";

import "./drawing.scss";

const tools: Tool[] = ["select","addNode","addEdge","addText","delete","fitView","recenter","reset","home"];
const drawingTools: Tool[] = ["select", "addNode", "addEdge", "delete", "addText"];

interface Props {
  highlightNode?: Node,
  highlightLoopOnNode?: Node,
  highlightEdge?: Edge,
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
  graph: GraphData;
  selectedNodeId?: string;
  animating: boolean;
  graphOpacity: number;
  fitViewAt?: number;
  recenterViewAt?: number;
  resetViewAt?: number;
  setGraph: React.Dispatch<React.SetStateAction<GraphData>>;
  setHighlightNode: React.Dispatch<React.SetStateAction<Node | undefined>>
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
  onReset: () => void;
  onReturnToMainMenu: () => void;
  onFitView: () => void;
  onRecenterView: () => void;
  onDimensions?: (dimensions: {width: number, height: number}) => void;
  onClearHighlightOutput?: () => void;
  log: MarkovHost["log"];
  // the toolbar's tools; absent, the CODAP plugin's list
  tools?: Tool[];
  probabilityLabels?: boolean;
  arrowWidths?: ArrowWidths;
  selectedEdge?: { from: string, to: string };
  onEdgeSelect?: (edge: { from: string, to: string }) => void;
  onBackgroundClick?: () => void;
  // the student's own zoom or pan, from the graph or the toolbar; absent in the plugin, which has no following
  onUserZoom?: () => void;
  onTransformed?: (transform: Transform) => void;
  initialView?: GraphView;
  // states can't be dragged, and the state editor doesn't open
  readOnly?: boolean;
  fitTransitionMs?: number;
  // Escape closes an open state editor and does nothing else; absent in the plugin
  closeEditorOnEscape?: boolean;
  // every state's label is its own: new states skip names in use, and the editor refuses an empty or taken one
  uniqueLabels?: boolean;
  // the state editor's slider takes keys, touch and pen, and its fields are named; absent in the plugin
  accessibleEditor?: boolean;
}

export const Drawing = (props: Props) => {
  const { highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes,
         graph, setGraph, setHighlightNode, setSelectedNodeId: _setSelectedNodeId,
         fitViewAt, recenterViewAt, onClearHighlightOutput, graphOpacity, resetViewAt,
         selectedNodeId, animating, onReset, onReturnToMainMenu, onFitView, onRecenterView, log,
         tools: shownTools = tools, probabilityLabels, arrowWidths, selectedEdge, onEdgeSelect, onBackgroundClick,
         onUserZoom, onTransformed, initialView, readOnly, fitTransitionMs, closeEditorOnEscape,
         uniqueLabels, accessibleEditor } = props;
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("select");
  const [firstEdgeNode, setFirstEdgeNode] = useState<Node|undefined>(undefined);
  const [rubberBand, setRubberBand] = useState<RubberBand|undefined>(undefined);
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<Node|undefined>(undefined);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const transformRef = useRef<Transform | undefined>(undefined);
  const [autoArrange, setAutoArrange] = useState(false);
  const [addTextWidth, setAddTextWidth] = useState(0);
  const prevWordsRef = useRef<string[]>([]);
  const textAreaRef = createRef<HTMLTextAreaElement>();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { zoomRequest, zoomIn, zoomOut } = useZoomRequest(onUserZoom);

  const isHidden = () => !!rootRef.current?.closest("[hidden]");

  const setSelectedNodeId = useCallback((id?: string, skipToggle?: boolean) => {
    if (drawingMode === "select") {
      _setSelectedNodeId(id, skipToggle);
    }
  }, [drawingMode, _setSelectedNodeId]);

  const onDimensionsRef = useLatest(props.onDimensions);

  const handleDimensionChange = useCallback(({ width, height }: {width: number, height: number}) => {
    widthRef.current = width;
    heightRef.current = height;
    setAddTextWidth(width - 40); // for 10px margin and padding

    // also tell the app so that it can translate the origin of any loaded data if needed
    onDimensionsRef.current?.({ width, height });
  }, [onDimensionsRef]);

  const handleTransformed = (transform: Transform) => {
    transformRef.current = transform;
    onTransformed?.(transform);
  };

  const translateToGraphPoint = (e: MouseEvent|React.MouseEvent<HTMLDivElement>): Point => {
    const svg = rootRef.current?.querySelector(".graph > svg")?.getBoundingClientRect();
    const { x, y, k } = transformRef.current ?? { x: 0, y: 0, k: 1 };
    return {
      x: ((e.clientX - (svg?.left ?? 0) - (widthRef.current / 2)) - x) / k,
      y: ((e.clientY - (svg?.top ?? 0) - (heightRef.current / 2)) - y) / k,
    };
  };

  const getNode = useCallback((id: string) => graph.nodes.find(n => n.id === id), [graph.nodes]);

  // with a tool list, Escape leaves a generating step's highlight, which the generator clears
  const keepHighlightNode = animating && !!props.tools;
  const clearSelections = useCallback(() => {
    setFirstEdgeNode(undefined);
    if (!keepHighlightNode) {
      setHighlightNode(undefined);
    }
    setRubberBand(undefined);
  }, [setFirstEdgeNode, setHighlightNode, keepHighlightNode]);

  useEffect(() => {
    if (drawingMode === "addEdge" && firstEdgeNode) {
      const updateRubberBand = (e: MouseEvent) => {
        if (isHidden()) {
          return;
        }
        const newRubberBand: RubberBand = { from: firstEdgeNode.id, to: translateToGraphPoint(e) };
        // redraw before the next mouse event, so a press on a state never spans a redraw
        flushSync(() => setRubberBand(newRubberBand));
      };
      window.addEventListener("mousemove", updateRubberBand);
      return () => window.removeEventListener("mousemove", updateRubberBand);
    }
  }, [drawingMode, firstEdgeNode]);

  useEffect(() => {
    const listenForEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isHidden()) {
        return;
      }
      if (closeEditorOnEscape && selectedNodeForModal) {
        setSelectedNodeForModal(undefined);
        return;
      }
      clearSelections();
      setDrawingMode("select");
    };
    window.addEventListener("keydown", listenForEscape);
    return () => window.removeEventListener("keydown", listenForEscape);
  }, [drawingMode, setDrawingMode, clearSelections, closeEditorOnEscape, selectedNodeForModal]);

  useEffect(() => {
    if (drawingMode === "addText" && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [drawingMode, textAreaRef]);

  const handleToolSelected = (tool: Tool) => {
    onClearHighlightOutput?.();
    if (drawingTools.includes(tool)) {
      setDrawingMode(tool as DrawingMode);
      setAutoArrange(tool === "addText");
      prevWordsRef.current = [];
      clearSelections();
    }
  };

  const label = useCallback((id: string) => getNode(id)?.label ?? id, [getNode]);

  const addNode = useCallback(({ x, y }: {x: number, y: number}) => {
    const id = nanoid();
    const newLabel = uniqueLabels ? nextStateLabel(graph.nodes.map(n => n.label)) : `State ${graph.nodes.length + 1}`;
    setGraph(prev => {
      const newNode: Node = { id, label: newLabel, value: 1, x, y };
      return {
        nodes: [...prev.nodes, newNode],
        edges: prev.edges
      };
    });
    log("StateAdded", { state: newLabel });
  }, [graph, setGraph, log, uniqueLabels]);

  const addEdge = useCallback(({ from, to }: {from: string, to: string}) => {
    if (!graph.edges.some(e => e.from === from && e.to === to)) {
      log("TransitionAdded", { from: label(from), to: label(to) });
    }
    setGraph(prev => {
      const newEdge: Edge = { from, to, value: 1 };
      const prevEdge = prev.edges.find(e => e.from === from && e.to === to);
      if (!prevEdge) {
        return {
          nodes: prev.nodes,
          edges: [...prev.edges, newEdge]
        };
      } else {
        return prev;
      }
    });
  }, [graph, setGraph, label, log]);

  const handleClicked = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingMode === "addNode") {
      addNode(translateToGraphPoint(e));
    } else if (drawingMode === "addEdge") {
      const onSVGBackground = ((e.target as HTMLElement)?.tagName || "").toLowerCase() === "svg";
      if (onSVGBackground) {
        clearSelections();
      }
    }
  }, [drawingMode, addNode, clearSelections]);

  const handleNodeClicked = useCallback((id: string, onLoop?: boolean) => {
    const node = getNode(id);
    if (!node) {
      return;
    }

    if (drawingMode === "addEdge" && !onLoop) {
      if (!firstEdgeNode) {
        setFirstEdgeNode(node);
      } else {
        addEdge({ from: firstEdgeNode.id, to: node.id });
        setFirstEdgeNode(undefined);
        setRubberBand(undefined);
      }
    }

    if (drawingMode === "delete") {
      if (onLoop) {
        log("TransitionDeleted", { from: node.label, to: node.label });
      } else {
        log("StateDeleted", { state: node.label });
      }
      setGraph(prev => {
        const nodes = [...prev.nodes];
        let edges = [...prev.edges];

        if (onLoop) {
          // delete the self-referential edge
          const edgeIndex = edges.findIndex(e => e.from === id && e.to === id);
          if (edgeIndex !== -1) {
            edges.splice(edgeIndex, 1);
          }

        } else {
          const nodeIndex = nodes.findIndex(n => n.id === id);
          if (nodeIndex !== -1) {
            nodes.splice(nodeIndex, 1);
            edges = edges.filter(e => e.from !== node.id && e.to !== node.id);
          }
        }

        return {
          nodes,
          edges
        };
      });
    }
  }, [addEdge, drawingMode, getNode, firstEdgeNode, setFirstEdgeNode, setGraph, log]);

  const handleNodeDoubleClicked = useCallback((id: string) => {
    if (drawingMode === "select" && !readOnly) {
      setSelectedNodeForModal(getNode(id));
      log("StateDialogOpened", { state: label(id) });
    }
    if (drawingMode === "addEdge") {
      addEdge({ from: id, to: id });
      setFirstEdgeNode(undefined);
      setRubberBand(undefined);
    }
  }, [drawingMode, readOnly, addEdge, getNode, label, log]);

  const handleEdgeClicked = useCallback(({ from, to }: {from: string, to: string}) => {
    if (drawingMode === "delete") {
      log("TransitionDeleted", { from: label(from), to: label(to) });
      setGraph(prev => {
        const edges = [...prev.edges];
        const edgeIndex = prev.edges.findIndex(e => e.from === from && e.to === to);
        if (edgeIndex !== -1) {
          edges.splice(edgeIndex, 1);
          return { ...prev, edges };
        } else {
          return prev;
        }
      });
    }
  }, [setGraph, drawingMode, label, log]);

  const handleDragStop = useCallback((id: string, { x, y }: Point) => {
    log("StateMoved", { state: label(id) });
    setGraph(prev => {
      const nodeIndex = prev.nodes.findIndex(n => n.id === id);
      if (nodeIndex !== -1) {
        const node = { ...prev.nodes[nodeIndex] };
        const nodes = [...prev.nodes];
        node.x = x;
        node.y = y;
        nodes.splice(nodeIndex, 1, node);
        return { ...prev, nodes };
      }
      return prev;
    });
  }, [setGraph, label, log]);

  const handleAutoArrangeEnd = useCallback((nodes: D3Node[]) => {
    const d3NodesById = nodes.reduce<Record<string,D3Node>>((acc, cur) => {
      acc[cur.id] = cur;
      return acc;
    }, {});

    setGraph(prev => {
      prev.nodes = prev.nodes.map(n => {
        const d3Node = d3NodesById[n.id];
        if (d3Node) {
          n.x = d3Node.x;
          n.y = d3Node.y;
        }
        return n;
      });
      return prev;
    });
  }, [setGraph]);

  const handleClearSelectedNode = useCallback(() => setSelectedNodeForModal(undefined), [setSelectedNodeForModal]);

  const handleChangeNode = useCallback((id: string, newNode: Node, newEdges: Edge[]) => {
    log("StateEdited", {
      state: newNode.label,
      transitions: newEdges.filter(e => e.from === id)
        .map(e => ({ to: e.to === id ? newNode.label : label(e.to), value: e.value })),
    });
    setGraph(prev => {
      const nodeIndex = prev.nodes.findIndex(n => n.id === id);
      if (nodeIndex !== -1) {
        const nodes = [...prev.nodes];
        nodes.splice(nodeIndex, 1, newNode);
        return { nodes, edges: newEdges };
      } else {
        return prev;
      }
    });
    handleClearSelectedNode();
  }, [setGraph, handleClearSelectedNode, label, log]);

  const handleTextChange = useCallback((newText: string) => {
    const words = textToWords(newText);

    if (JSON.stringify(words) !== JSON.stringify(prevWordsRef.current)) {
      setGraph(wordsToGraph(words));
    }
    prevWordsRef.current = words;

    setTimeout(() => {
      onFitView();
    }, 0);

  }, [setGraph, onFitView]);

  return (
    <div className="drawing" ref={rootRef}>
      <Toolbar
        disabled={animating}
        tools={shownTools}
        selectedTool={props.tools ? drawingMode : undefined}
        onToolSelected={handleToolSelected}
        onReset={onReset}
        onReturnToMainMenu={onReturnToMainMenu}
        onFitView={onFitView}
        onRecenterView={onRecenterView}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />
      <Graph
        drawingMode={drawingMode}
        graph={graph}
        highlightNode={highlightNode}
        highlightEdge={highlightEdge}
        highlightAllNextNodes={highlightAllNextNodes}
        highlightOutputNodes={highlightOutputNodes}
        highlightLoopOnNode={highlightLoopOnNode}
        allowDragging={drawingMode === "select" && !readOnly}
        opacity={graphOpacity}
        autoArrange={autoArrange}
        rubberBand={rubberBand}
        selectedNodeId={selectedNodeId}
        animating={animating}
        onClick={handleClicked}
        onNodeClick={handleNodeClicked}
        onNodeDoubleClick={handleNodeDoubleClicked}
        onEdgeClick={handleEdgeClicked}
        onDragStop={handleDragStop}
        setSelectedNodeId={setSelectedNodeId}
        onDimensions={handleDimensionChange}
        onTransformed={handleTransformed}
        onAutoArrangeEnd={handleAutoArrangeEnd}
        fitViewAt={fitViewAt}
        recenterViewAt={recenterViewAt}
        probabilityLabels={probabilityLabels}
        arrowWidths={arrowWidths}
        selectedEdge={selectedEdge}
        onEdgeSelect={drawingMode === "select" ? onEdgeSelect : undefined}
        onBackgroundClick={drawingMode === "select" ? onBackgroundClick : undefined}
        zoomButtons={!shownTools.includes("zoomIn")}
        zoomRequest={zoomRequest}
        onUserZoom={onUserZoom}
        initialView={initialView}
        fitTransitionMs={fitTransitionMs}
        keepOutputOnRedraw={!!props.tools}
        centerOffOrigin={!!props.tools}
      />
      <DragIcon drawingMode={drawingMode} />
      <NodeModal
        viewMode="drawing"
        node={selectedNodeForModal}
        graph={graph}
        onChange={handleChangeNode}
        onCancel={handleClearSelectedNode}
        uniqueLabels={uniqueLabels}
        accessibleEditor={accessibleEditor}
      />
      <AddText
        ref={textAreaRef}
        visible={drawingMode === "addText"}
        width={addTextWidth}
        disabled={animating}
        resetViewAt={resetViewAt}
        onChange={handleTextChange}
      />
    </div>
  );
};

