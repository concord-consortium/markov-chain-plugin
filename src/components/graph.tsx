import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import { useResizeObserver } from "../hooks/use-resize-observer";
import { Edge, GraphData, Node } from "../type";
import { ArrowWidths, edgeWeights, graphSignature, isPlaced, settings } from "./graph-utils";
import { slotColumns, slotMaxRadius, slotPositions } from "./scan-line-layout";
import { useLatest } from "../hooks/use-latest";
import { D3Graph, D3Node } from "./graph-geometry";
import {
  GraphSelection, highlightAnimation, highlightSelected as highlightSelectedNodes,
  unhighlightNonOutput as unhighlightNonOutputNodes
} from "./graph-highlight";
import { drawGraph } from "./graph-draw";
import { drawOverlay, moveOverlay } from "./graph-overlay";

import PlusIcon from "../assets/plus.svg";
import MinusIcon from "../assets/minus.svg";

import "./graph.scss";

export type DrawingMode = "select"|"addNode"|"addEdge"|"delete"|"addText";

export type Transform = d3.ZoomTransform;

export type Point = {x: number, y: number};

export type RubberBand = {from: string, to: Point};

export type GraphView = {x: number, y: number, k: number};

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
  // states already drawn keep their places when the graph changes and only new ones are laid out, unless most are new
  keepPositions?: boolean;
  // a transition to highlight as chosen, and clicks on arrows in any tool but Delete
  selectedEdge?: { from: string, to: string };
  onEdgeSelect?: (edge: { from: string, to: string }) => void;
  // a click on the SVG's background, which d3-zoom doesn't send after a pan
  onBackgroundClick?: () => void;
  // false leaves out the zoom buttons the graph draws in its corner, for a layout whose toolbar zooms
  zoomButtons?: boolean;
  // scales the graph by `by` each time `id` changes, as the corner buttons do
  zoomRequest?: { id: number, by: number };
  // a zoom or pan the student made (wheel, background drag), not a fit, a recenter or a zoomRequest
  onUserZoom?: () => void;
  // where the view starts; a host passing it doesn't ask for a fit on mount
  initialView?: GraphView;
  // fits animate over this many ms; absent, they are instant
  fitTransitionMs?: number;
  // labels the arrows the highlights point out with their probabilities
  probabilityLabels?: boolean;
  arrowWidths?: ArrowWidths;
  // false draws a bag of words: the states, and only the arrows the highlights point out
  orderMatters?: boolean;
  // a redraw keeps a chosen output's highlights, which it otherwise drops until the next highlight change
  keepOutputOnRedraw?: boolean;
  // fits and recenters bring a graph off the origin to the view's center; absent, they move it half the way
  centerOffOrigin?: boolean;
  // with keepPositions, each new state goes in the slot of its order, in rows back and forth across the view, rather
  // than being placed by force
  scanLine?: boolean;
};

// a press that moves this many px or less is still a click, and a gesture that moves the view no more isn't a zoom
const clickDistance = 4;
// the zoom buttons' steps, which a host's own zoom buttons take too
export const zoomInStep = 1.1;
export const zoomOutStep = 0.9;

export const Graph = (props: Props) => {
  const { graph, highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes,
         allowDragging, autoArrange, rubberBand, drawingMode,
         onClick, onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop,
         fitViewAt, recenterViewAt, onAutoArrangeEnd, opacity,
         selectedNodeId, setSelectedNodeId, animating, onDimensions, onTransformed, keepPositions, selectedEdge,
         onEdgeSelect, onBackgroundClick, zoomButtons = true, zoomRequest, onUserZoom, fitTransitionMs,
         probabilityLabels, arrowWidths = "byState", orderMatters, keepOutputOnRedraw,
         centerOffOrigin, initialView, scanLine } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useResizeObserver(wrapperRef);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const sizeRef = useLatest({ width, height });
  const sized = width > 0 && height > 0;
  const [d3Graph, setD3Graph] = useState<D3Graph>({ nodes: [], edges: [] });
  const lastClickTimeRef = useRef<number|undefined>(undefined);
  const lastClickIdRef = useRef<string|undefined>(undefined);
  const draggedRef = useRef(false);
  const transformRef = useRef<Transform | undefined>(undefined);
  const zoomRef = useRef<d3.ZoomBehavior<any, any> | undefined>(undefined);
  const lastFitViewAtRef = useRef<number | undefined>(undefined);
  const lastRecenterViewAtRef = useRef<number | undefined>(undefined);
  const lastZoomRequestIdRef = useRef(zoomRequest?.id);
  const gestureStartRef = useRef<Transform | undefined>(undefined);
  const viewAppliedRef = useRef(false);

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
    highlightSelectedNodes(svg, { selectedNodeId, selectedEdge, animating, graph, orderMatters });
  }, [selectedNodeId, selectedEdge, animating, graph, orderMatters]);

  const unhighlightNonOutput = useCallback((svg: GraphSelection) => {
    unhighlightNonOutputNodes(svg, { highlightOutputNodes, animating });
  }, [highlightOutputNodes, animating]);

  const selectionRef = useRef({ selectedNodeId, setSelectedNodeId, highlightSelected });
  useLayoutEffect(() => {
    selectionRef.current = { selectedNodeId, setSelectedNodeId, highlightSelected };
  });

  const overlayRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    overlayRef.current = () => drawOverlay(d3.select(svgRef.current).select("g.root"), d3Graph, {
      graph, probabilityLabels, arrowWidths, orderMatters, animating, selectedNodeId, highlightNode, highlightEdge,
      highlightAllNextNodes, highlightOutputNodes,
    });
  });

  const highlightsRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    highlightsRef.current = () => {
      const root = d3.select(svgRef.current).select("g.root");
      highlightAnimation(root, {
        highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes,
        highlightOutputEdges
      });
      unhighlightNonOutput(root);
      highlightSelected(root);
      overlayRef.current();
    };
  });

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
    const { minRadius } = settings;
    // the slots are spaced for their own largest radius
    const maxRadius = scanLine && keepPositions ? slotMaxRadius : settings.maxRadius;

    const oldD3Nodes = graph.nodes.map(node => d3Graph.nodes.find(n => n.id === node.id));
    const placed = graph.nodes.map((node, index) => isPlaced(!!keepPositions, !!oldD3Nodes[index], node));
    const radiusOf = (node: Node) => minRadius + ((maxRadius - minRadius) * (node.value / totalNodeValue));
    const placedPositions = new Map<string, { x: number, y: number }>();
    graph.nodes.forEach((node, index) => {
      if (placed[index]) {
        const oldD3Node = oldD3Nodes[index];
        // a dragged state's x trails its pin until the next tick
        placedPositions.set(node.id, {
          x: oldD3Node?.fx ?? oldD3Node?.x ?? node.x ?? 0, y: oldD3Node?.fy ?? oldD3Node?.y ?? node.y ?? 0
        });
      }
    });

    const newIds = graph.nodes.filter((_, index) => !placed[index]).map(node => node.id);
    const inSlots = !!scanLine && !!keepPositions && newIds.length > 0;
    // a row's slots are counted from the view's width, so new states wait for its size; a graph already placed is
    // built while hidden, so its positions are still reported and saved
    if (inSlots && !sized) {
      return;
    }
    const slots = inSlots
      ? slotPositions(graph.nodes.flatMap((node, slot) => placed[slot] ? [] : [{ id: node.id, slot }]),
        [...placedPositions.values()], slotColumns(sizeRef.current.width))
      : undefined;

    graph.nodes.forEach((node, index) => {
      const oldD3Node = oldD3Nodes[index];
      const start = slots?.get(node.id) ?? placedPositions.get(node.id);
      const x = start?.x ?? oldD3Node?.x ?? node.x ?? 0;
      const y = start?.y ?? oldD3Node?.y ?? node.y ?? 0;

      const d3Node: D3Node = {
        index,
        id: node.id,
        x,
        y,
        placed: !!slots || placed[index],
        label: node.label,
        radius: radiusOf(node),
        loops: false,
        loopWeight: 0,
        weight: node.value
      };
      newD3Graph.nodes.push(d3Node);
      d3NodeMap[node.id] = d3Node;
    });

    const edgeWeight = edgeWeights(graph.edges, arrowWidths);

    (orderMatters === false ? [] : graph.edges).forEach((edge) => {
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
  }, [d3Graph, graph, keepPositions, arrowWidths, orderMatters, sized, scanLine, sizeRef]);

  // enable zooming
  useEffect(() => {
    const svg = d3.select(svgRef.current);

    // add zoom
    zoomRef.current = d3.zoom()
      //.scaleExtent([0.5, 10]) // This defines the zoom levels (min, max)
      .on("start", (e) => {
        gestureStartRef.current = e.transform;
      })
      .on("zoom", (e) => {
        const root = svg.select("g.root");
        const transform = e.transform as d3.ZoomTransform;
        root.attr("transform", transform.toString());
        transformRef.current = transform;
        onTransformed?.(transform);

        // fits, recenters and zoom requests have no source event
        const start = gestureStartRef.current;
        if (onUserZoom && e.sourceEvent && start &&
            (transform.k !== start.k || Math.hypot(transform.x - start.x, transform.y - start.y) > clickDistance)) {
          onUserZoom();
        }
      });
    if (onBackgroundClick || onUserZoom) {
      zoomRef.current.clickDistance(clickDistance);
    }
    svg
      .call(zoomRef.current)
      .on("dblclick.zoom", null); // disable double click to zoom

    // through the zoom behavior, so the next wheel zoom carries on from it
    if (initialView && !viewAppliedRef.current) {
      viewAppliedRef.current = true;
      svg.call(zoomRef.current.transform, new d3.ZoomTransform(initialView.k, initialView.x, initialView.y));
    }
  });

  // draw the graph
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const simulation = drawGraph(d3.select(svgRef.current), d3Graph, {
      transform: transformRef.current, allowDragging, autoArrange, rubberBand, drawingMode, keepPositions,
      selectionRef, onNodeClick, onNodeDoubleClick, onEdgeClick, onEdgeSelect, onDragStop, onAutoArrangeEnd,
      lastClickTimeRef, lastClickIdRef, draggedRef,
      onTick: () => moveOverlay(d3.select(svgRef.current).select("g.root")),
    });
    if (keepOutputOnRedraw) {
      highlightsRef.current();
    } else {
      overlayRef.current();
    }

    return () => {
      simulation?.stop();
    };
  }, [svgRef, d3Graph, allowDragging, autoArrange, rubberBand, drawingMode, keepPositions, animating,
      keepOutputOnRedraw, onNodeClick, onNodeDoubleClick, onEdgeClick, onEdgeSelect, onDragStop, onAutoArrangeEnd]);

  // animate the node if needed
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    highlightsRef.current();

  }, [svgRef, d3Graph.nodes, selectedNodeId, selectedEdge, highlightNode, highlightLoopOnNode,
      highlightEdge, highlightAllNextNodes, highlightSelected, highlightOutputNodes,
      unhighlightNonOutput, highlightOutputEdges, probabilityLabels, arrowWidths]);

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
    const reach = centerOffOrigin ? 1 : 0.5;
    const x = scale * -center.x * reach;
    const y = scale * -center.y * reach;
    const transform = new d3.ZoomTransform(scale, x, y);

    if (fitTransitionMs && op === "fit") {
      svg.transition().duration(fitTransitionMs).call(zoomRef.current.transform, transform);
    } else {
      svg.call(zoomRef.current.transform, transform);
    }

    return true;
  }, [width, height, fitTransitionMs, centerOffOrigin]);

  // a graph whose states wait for the view's size to be laid out has nothing drawn to fit yet
  const undrawn = graph.nodes.length > 0 && d3Graph.nodes.length === 0;
  // listen for fit view requests
  useEffect(() => {
    if (!undrawn && (fitViewAt ?? 0) > (lastFitViewAtRef.current ?? 0)) {
      // a host that follows the graph drops a fit with nothing to fit, or it would land later over the student's view
      if (fitOrCenter("fit") || (onUserZoom && width && height)) {
        lastFitViewAtRef.current = fitViewAt;
      }
    }
  }, [fitViewAt, fitOrCenter, onUserZoom, width, height, undrawn]);

  // listen for recenter view requests
  useEffect(() => {
    if ((recenterViewAt ?? 0) > (lastRecenterViewAtRef.current ?? 0)) {
      if (fitOrCenter("center") || (onUserZoom && width && height)) {
        lastRecenterViewAtRef.current = recenterViewAt;
      }
    }
  }, [recenterViewAt, fitOrCenter, onUserZoom, width, height]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!autoArrange && onClick) {
      onClick(e);
    }
  }, [autoArrange, onClick]);

  const scaleBy = useCallback((value: number) => {
    if (zoomRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.call(zoomRef.current.scaleBy, value);
    }
  }, []);

  const handleZoomIn = () => scaleBy(zoomInStep);
  const handleZoomOut = () => scaleBy(zoomOutStep);

  useEffect(() => {
    if (zoomRequest && zoomRequest.id !== lastZoomRequestIdRef.current) {
      lastZoomRequestIdRef.current = zoomRequest.id;
      scaleBy(zoomRequest.by);
    }
  }, [zoomRequest, scaleBy]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget) {
      onBackgroundClick?.();
    }
  };

  return (
    <div className="graph" ref={wrapperRef} onClick={handleClick}>
      <svg
        width="100%"
        height="calc(100vh - 20px)"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        ref={svgRef}
        style={{ opacity }}
        onClick={handleSvgClick}
      />
      { zoomButtons &&
        <div className="zoomButtons">
          <button className="plusButton" onClick={handleZoomIn}><PlusIcon /></button>
          <button className="minusButton" onClick={handleZoomOut}><MinusIcon /></button>
        </div>
      }
    </div>
  );
};

