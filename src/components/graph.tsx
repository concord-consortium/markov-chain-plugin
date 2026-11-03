import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import { useResizeObserver } from "../hooks/use-resize-observer";
import { Edge, GraphData, Node } from "../type";
import { graphSignature, settings, stateEdgeWeights } from "./graph-utils";
import { D3Graph, D3Node } from "./graph-geometry";
import {
  GraphSelection, highlightAnimation, highlightSelected as highlightSelectedNodes,
  unhighlightNonOutput as unhighlightNonOutputNodes
} from "./graph-highlight";
import { drawGraph } from "./graph-draw";

import PlusIcon from "../assets/plus.svg";
import MinusIcon from "../assets/minus.svg";

import "./graph.scss";

export type DrawingMode = "select"|"addNode"|"addEdge"|"delete"|"addText";

export type Transform = d3.ZoomTransform;

export type Point = {x: number, y: number};

export type RubberBand = {from: string, to: Point};

export type { D3Node } from "./graph-geometry";

type Props = {
  graph: GraphData,
  highlightNode?: Node,
  highlightLoopOnNode?: Node,
  highlightEdge?: Edge,
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
  allowDragging: boolean;
  autoArrange: boolean;
  rubberBand?: RubberBand;
  drawingMode?: DrawingMode;
  selectedNodeId?: string;
  animating: boolean;
  opacity: number;
  fitViewAt?: number;
  recenterViewAt?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onNodeClick?: (id: string, onLoop?: boolean) => void;
  onNodeDoubleClick?: (id: string) => void;
  onEdgeClick?: (options: {from: string, to: string}) => void;
  onDragStop?: (id: string, pos: Point) => void;
  onDimensions?: (dimensions: {width: number, height: number}) => void;
  onTransformed?: (transform: Transform) => void;
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
  onAutoArrangeEnd?: (nodes: D3Node[]) => void;
};

export const Graph = (props: Props) => {
  const { graph, highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes,
         allowDragging, autoArrange, rubberBand, drawingMode,
         onClick, onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop,
         fitViewAt, recenterViewAt, onAutoArrangeEnd, opacity,
         selectedNodeId, setSelectedNodeId, animating, onDimensions, onTransformed } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useResizeObserver(wrapperRef);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [d3Graph, setD3Graph] = useState<D3Graph>({ nodes: [], edges: [] });
  const lastClickTimeRef = useRef<number|undefined>(undefined);
  const lastClickIdRef = useRef<string|undefined>(undefined);
  const draggedRef = useRef(false);
  const transformRef = useRef<Transform | undefined>(undefined);
  const zoomRef = useRef<d3.ZoomBehavior<any, any> | undefined>(undefined);
  const lastFitViewAtRef = useRef<number | undefined>(undefined);
  const lastRecenterViewAtRef = useRef<number | undefined>(undefined);

  // generate an ordered edge list from the highlight output nodes
  const highlightOutputEdges = useMemo(() => {
    const edges: Edge[] = [];
    if (highlightOutputNodes) {
      for (let i = 0; i < highlightOutputNodes.length - 1; i++) {
        const fromNode = highlightOutputNodes[i];
        const toNode = highlightOutputNodes[i + 1];
        edges.push({ from: fromNode.id, to: toNode.id, value: 0 });
      }
    }
    return edges;
  }, [highlightOutputNodes]);

  const highlightSelected = useCallback((svg: GraphSelection) => {
    highlightSelectedNodes(svg, { selectedNodeId, animating, graph });
  }, [selectedNodeId, animating, graph]);

  const unhighlightNonOutput = useCallback((svg: GraphSelection) => {
    unhighlightNonOutputNodes(svg, { highlightOutputNodes, animating });
  }, [highlightOutputNodes, animating]);

  // calculate the svg dimensions
  useEffect(() => {
    if (dimensions) {
      setWidth(dimensions.width);
      setHeight(dimensions.height);
      onDimensions?.({ width: dimensions.width, height: dimensions.height });
    }
  }, [dimensions, onDimensions]);

  // create the d3 graph info
  useEffect(() => {
    const newD3Graph: D3Graph = { nodes: [], edges: [] };
    const d3NodeMap: Record<string, D3Node> = {};

    // get the sum of all the values
    const totalNodeValue = graph.nodes.reduce((acc, cur) => acc + cur.value, 0);
    const { minRadius, maxRadius } = settings;

    graph.nodes.forEach((node, index) => {
      const oldD3Node = d3Graph.nodes.find(n => n.id === node.id);
      const x = oldD3Node?.x ?? node.x ?? 0;
      const y = oldD3Node?.y ?? node.y ?? 0;

      const d3Node: D3Node = {
        index,
        id: node.id,
        x,
        y,
        label: node.label,
        radius: minRadius + ((maxRadius - minRadius) * (node.value / totalNodeValue)),
        loops: false,
        loopWeight: 0,
        weight: node.value
      };
      newD3Graph.nodes.push(d3Node);
      d3NodeMap[node.id] = d3Node;
    });

    const edgeWeight = stateEdgeWeights(graph.edges);

    graph.edges.forEach((edge) => {
      if (edge.from === edge.to) {
        d3NodeMap[edge.from].loops = true;
        d3NodeMap[edge.from].loopWeight = edgeWeight(edge);
      } else {
        newD3Graph.edges.push({
          value: edge.value,
          weight: edgeWeight(edge),
          source: d3NodeMap[edge.from],
          target: d3NodeMap[edge.to],
          sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 // calculated after force layout
        });
      }
    });

    // only change if the graph really changed to prevent a redraw
    if (graphSignature(d3Graph) !== graphSignature(newD3Graph)) {
      setD3Graph(newD3Graph);
    }
  }, [d3Graph, graph]);

  // enable zooming
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // add zoom
    zoomRef.current = d3.zoom()
      //.scaleExtent([0.5, 10]) // This defines the zoom levels (min, max)
      .on("zoom", (e) => {
        const root = svg.select("g.root");
        const transform = e.transform as d3.ZoomTransform;
        root.attr("transform", transform.toString());
        transformRef.current = transform;
        onTransformed?.(transform);
      });
    svg
      .call(zoomRef.current)
      .on("dblclick.zoom", null); // disable double click to zoom
  });

  // draw the graph
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const simulation = drawGraph(d3.select(svgRef.current), d3Graph, {
      transform: transformRef.current, allowDragging, autoArrange, rubberBand, drawingMode, selectedNodeId,
      setSelectedNodeId, onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop, onAutoArrangeEnd,
      highlightSelected, lastClickTimeRef, lastClickIdRef, draggedRef
    });

    return () => {
      simulation?.stop();
    };
  }, [svgRef, d3Graph, allowDragging, autoArrange, rubberBand, drawingMode,
      onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop, setSelectedNodeId,
      selectedNodeId, highlightSelected, onAutoArrangeEnd]);

  // animate the node if needed
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const root = d3.select(svgRef.current).select("g.root");

    highlightAnimation(root, {
      highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes,
      highlightOutputEdges
    });

    unhighlightNonOutput(root);
    highlightSelected(root);

  }, [svgRef, d3Graph.nodes, selectedNodeId, highlightNode, highlightLoopOnNode,
      highlightEdge, highlightAllNextNodes, highlightSelected, highlightOutputNodes,
      unhighlightNonOutput, highlightOutputEdges]);

  const fitOrCenter = useCallback((op: "fit" | "center") => {
    if (!width || !height || !zoomRef.current) {
      return false;
    }

    const svg = d3.select(svgRef.current);
    const root = svg.select("g.root");
    const bounds = (root.node() as SVGGElement).getBBox();

    if (!bounds.width || !bounds.height) {
      return false;
    }

    const center = {
      x: bounds.x + (bounds.width / 2),
      y: bounds.y + (bounds.height / 2),
    };
    const currentScale = transformRef.current?.k ?? 1;
    const fitScale = Math.min(width / bounds.width, height / bounds.height) * 0.8;
    const scale = op === "center" ? currentScale : fitScale;
    const x = scale * (-center.x / 2);
    const y = scale * (-center.y / 2);
    const transform = new d3.ZoomTransform(scale, x, y);

    svg.call(zoomRef.current.transform, transform);

    return true;
  }, [width, height]);

  // listen for fit view requests
  useEffect(() => {
    if ((fitViewAt ?? 0) > (lastFitViewAtRef.current ?? 0)) {
      if (fitOrCenter("fit")) {
        lastFitViewAtRef.current = fitViewAt;
      }
    }
  }, [fitViewAt, fitOrCenter]);

  // listen for recenter view requests
  useEffect(() => {
    if ((recenterViewAt ?? 0) > (lastRecenterViewAtRef.current ?? 0)) {
      if (fitOrCenter("center")) {
        lastRecenterViewAtRef.current = recenterViewAt;
      }
    }
  }, [recenterViewAt, fitOrCenter]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!autoArrange && onClick) {
      onClick(e);
    }
  }, [autoArrange, onClick]);

  const scaleBy = (value: number) => {
    if (zoomRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.call(zoomRef.current.scaleBy, value);
    }
  };

  const handleZoomIn = () => scaleBy(1.1);
  const handleZoomOut = () => scaleBy(0.9);

  return (
    <div className="graph" ref={wrapperRef} onClick={handleClick}>
      <svg
        width="100%"
        height="calc(100vh - 20px)"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        ref={svgRef}
        style={{ opacity }}
      />
      <div className="zoomButtons">
        <button className="plusButton" onClick={handleZoomIn}><PlusIcon /></button>
        <button className="minusButton" onClick={handleZoomOut}><MinusIcon /></button>
      </div>
    </div>
  );
};

