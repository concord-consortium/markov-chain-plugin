import React, { createRef, useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";

import { DrawingMode, Graph, Point, RubberBand, Transform } from "./graph";
import { Edge, GraphData, Node } from "../type";

import { DragIcon } from "./drawing/drag-icon";
import { NodeModal } from "./drawing/node-modal";
import { Tool, Toolbar } from "./toolbar";
import { AddText } from "./drawing/add-text";

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
  fitViewAt?: number;
  recenterViewAt?: number;
  setGraph: React.Dispatch<React.SetStateAction<GraphData>>;
  setHighlightNode: React.Dispatch<React.SetStateAction<Node | undefined>>
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
  onReset: () => void;
  onReturnToMainMenu: () => void;
  onFitView: () => void;
  onRecenterView: () => void;
  onDimensions?: (dimensions: {width: number, height: number}) => void;
}

const keepPunctuationRegex = /[.,?!:;]/g;
const removePunctuationRegex = /["(){}[\]_+=|\\/><]/g;

export const Drawing = (props: Props) => {
  const {highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes,
         graph, setGraph, setHighlightNode, setSelectedNodeId: _setSelectedNodeId,
         fitViewAt, recenterViewAt,
         selectedNodeId, animating, onReset, onReturnToMainMenu, onFitView, onRecenterView} = props;
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("select");
  const [firstEdgeNode, setFirstEdgeNode] = useState<Node|undefined>(undefined);
  const [rubberBand, setRubberBand] = useState<RubberBand|undefined>(undefined);
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<Node|undefined>(undefined);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const transformRef = useRef<Transform>();
  const [autoArrange, setAutoArrange] = useState(false);
  const [addTextWidth, setAddTextWidth] = useState(0);
  const prevWordsRef = useRef<string[]>([]);
  const textAreaRef = createRef<HTMLTextAreaElement>();

  const setSelectedNodeId = useCallback((id?: string, skipToggle?: boolean) => {
    if (drawingMode === "select") {
      _setSelectedNodeId(id, skipToggle);
    }
  }, [drawingMode, _setSelectedNodeId]);

  const handleDimensionChange = ({width, height}: {width: number, height: number}) => {
    widthRef.current = width;
    heightRef.current = height;
    setAddTextWidth(width - 40); // for 10px margin and padding

    // also tell the app so that it can translate the origin of any loaded data if needed
    props.onDimensions?.({width, height});
  };

  const handleTransformed = (transform: Transform) => {
    transformRef.current = transform;
  };

  const translateToGraphPoint = (e: MouseEvent|React.MouseEvent<HTMLDivElement>): Point => {
    // the offsets were determined visually to put the state centered on the mouse
    const {x, y, k} = transformRef.current ?? {x: 0, y: 0, k: 1};
    return {
      x: ((e.clientX - 50 - (widthRef.current / 2)) - x) / k,
      y: ((e.clientY - 10 - (heightRef.current / 2)) - y) / k,
    };
  };

  const getNode = useCallback((id: string) => graph.nodes.find(n => n.id === id), [graph.nodes]);

  const clearSelections = useCallback(() => {
    setFirstEdgeNode(undefined);
    setHighlightNode(undefined);
    setRubberBand(undefined);
  }, [setFirstEdgeNode, setHighlightNode]);

  useEffect(() => {
    if (drawingMode === "addEdge" && firstEdgeNode) {
      const updateRubberBand = (e: MouseEvent) => {
        const newRubberBand: RubberBand = {from: firstEdgeNode.id, to: translateToGraphPoint(e)};
        setRubberBand(newRubberBand);
      };
      window.addEventListener("mousemove", updateRubberBand);
      return () => window.removeEventListener("mousemove", updateRubberBand);
    }
  }, [drawingMode, firstEdgeNode]);

  useEffect(() => {
    const listenForEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelections();
        setDrawingMode("select");
      }
    };
    window.addEventListener("keydown", listenForEscape);
    return () => window.removeEventListener("keydown", listenForEscape);
  }, [drawingMode, setDrawingMode, clearSelections]);

  useEffect(() => {
    if (drawingMode === "addText" && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [drawingMode, textAreaRef]);

  const handleToolSelected = (tool: Tool) => {
    if (drawingTools.includes(tool)) {
      setDrawingMode(tool as DrawingMode);
      setAutoArrange(tool === "addText");
      prevWordsRef.current = [];
      clearSelections();
    }
  };

  const addNode = useCallback(({x, y}: {x: number, y: number}) => {
    setGraph(prev => {
      const id = nanoid();
      const label = `State ${prev.nodes.length + 1}`;
      const newNode: Node = {id, label, value: 1, x, y};
      return {
        nodes: [...prev.nodes, newNode],
        edges: prev.edges
      };
    });
  }, [setGraph]);

  const addEdge = useCallback(({from, to}: {from: string, to: string}) => {
    setGraph(prev => {
      const newEdge: Edge = {from, to, value: 1};
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
  }, [setGraph]);

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
        addEdge({from: firstEdgeNode.id, to: node.id});
        setFirstEdgeNode(undefined);
        setRubberBand(undefined);
      }
    }

    if (drawingMode === "delete") {
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
  }, [addEdge, drawingMode, getNode, firstEdgeNode, setFirstEdgeNode, setGraph]);

  const handleNodeDoubleClicked = useCallback((id: string) => {
    if (drawingMode === "select") {
      setSelectedNodeForModal(getNode(id));
    }
    if (drawingMode === "addEdge") {
      addEdge({from: id, to: id});
      setFirstEdgeNode(undefined);
      setRubberBand(undefined);
    }
  }, [drawingMode, addEdge, getNode]);

  const handleEdgeClicked = useCallback(({from, to}: {from: string, to: string}) => {
    if (drawingMode === "delete") {
      setGraph(prev => {
        const edges = [...prev.edges];
        const edgeIndex = prev.edges.findIndex(e => e.from === from && e.to === to);
        if (edgeIndex !== -1) {
          edges.splice(edgeIndex, 1);
          return {...prev, edges};
        } else {
          return prev;
        }
      });
    }
  }, [setGraph, drawingMode]);

  const handleDragStop = useCallback((id: string, {x, y}: Point) => {
    setGraph(prev => {
      const nodeIndex = prev.nodes.findIndex(n => n.id === id);
      if (nodeIndex !== -1) {
        const node = {...prev.nodes[nodeIndex]};
        const nodes = [...prev.nodes];
        node.x = x;
        node.y = y;
        nodes.splice(nodeIndex, 1, node);
        return {...prev, nodes};
      }
      return prev;
    });
  }, [setGraph]);

  const handleClearSelectedNode = useCallback(() => setSelectedNodeForModal(undefined), [setSelectedNodeForModal]);

  const handleChangeNode = useCallback((id: string, newNode: Node, newEdges: Edge[]) => {
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
  }, [setGraph, handleClearSelectedNode]);

  const handleTextChange = useCallback((newText: string) => {
    const words = newText
      .replace(keepPunctuationRegex, (match) => ` ${match} `)
      .replace(removePunctuationRegex, " ")
      .split(/\s/)
      .map(w => w.trim().toLocaleLowerCase())
      .filter(w => w.length > 0);

    const nodes: Record<string, Node> = {};
    const edges: Record<string, Edge> = {};

    words.forEach((word, index) => {
      nodes[word] = nodes[word] ?? {id: word, label: word, value: 0};
      nodes[word].value++;

      if (index > 0) {
        const lastWord = words[index - 1];
        const key = `${lastWord}|${word}`;
        edges[key] = edges[key] ?? {from: lastWord, to: word, value: 0};
        edges[key].value++;
      }
    });

    if (JSON.stringify(words) !== JSON.stringify(prevWordsRef.current)) {
      setGraph({ nodes: Object.values(nodes), edges: Object.values(edges) });
    }
    prevWordsRef.current = words;

  }, [setGraph]);

  return (
    <div className="drawing">
      <Toolbar
        disabled={animating}
        tools={tools}
        onToolSelected={handleToolSelected}
        onReset={onReset}
        onReturnToMainMenu={onReturnToMainMenu}
        onFitView={onFitView}
        onRecenterView={onRecenterView}
      />
      <Graph
        mode="drawing"
        drawingMode={drawingMode}
        graph={graph}
        highlightNode={highlightNode}
        highlightEdge={highlightEdge}
        highlightAllNextNodes={highlightAllNextNodes}
        highlightOutputNodes={highlightOutputNodes}
        highlightLoopOnNode={highlightLoopOnNode}
        allowDragging={drawingMode === "select"}
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
        fitViewAt={fitViewAt}
        recenterViewAt={recenterViewAt}
      />
      <DragIcon drawingMode={drawingMode} />
      <NodeModal
        node={selectedNodeForModal}
        graph={graph}
        onChange={handleChangeNode}
        onCancel={handleClearSelectedNode}
      />
      <AddText
        ref={textAreaRef}
        visible={drawingMode === "addText"}
        width={addTextWidth}
        disabled={animating}
        onChange={handleTextChange}
      />
    </div>
  );
};

