import React from "react";
import * as d3 from "d3";

import { calculateNodeFontSizes, layoutFor, linkDistance, nodeLoopPath, ry } from "./graph-utils";
import { calculateEdges, D3Graph, D3Node, lineDashArray, lineEnd } from "./graph-geometry";
import {
  animatedArrowColor, arrowUrl, incomingArrowColor, lineAndLoopOpacity, outgoingArrowColor, selectedLoopArrowColor,
  unselectedOpacity
} from "./graph-highlight";
import type { DrawingMode, Point, RubberBand, Transform } from "./graph";

export interface DrawGraphOptions {
  transform?: Transform;
  allowDragging: boolean;
  autoArrange: boolean;
  rubberBand?: RubberBand;
  drawingMode?: DrawingMode;
  keepPositions?: boolean;
  // read when a state is clicked and once the graph is drawn, so a selection needn't redraw the graph
  selectionRef: React.MutableRefObject<{
    selectedNodeId?: string;
    setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
    highlightSelected: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void;
  }>;
  onNodeClick?: (id: string, onLoop?: boolean) => void;
  onNodeDoubleClick?: (id: string) => void;
  onEdgeClick?: (options: {from: string, to: string}) => void;
  onEdgeSelect?: (edge: {from: string, to: string}) => void;
  onDragStop?: (id: string, pos: Point) => void;
  onAutoArrangeEnd?: (nodes: D3Node[]) => void;
  lastClickTimeRef: React.MutableRefObject<number | undefined>;
  lastClickIdRef: React.MutableRefObject<string | undefined>;
  draggedRef: React.MutableRefObject<boolean>;
}

// draws the graph into the svg, replacing what it held, and returns the layout's simulation when it auto-arranges
export const drawGraph = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, d3Graph: D3Graph,
  options: DrawGraphOptions) => {
  const { transform, allowDragging, autoArrange, rubberBand, drawingMode, keepPositions, selectionRef,
    onNodeClick, onNodeDoubleClick, onEdgeClick, onEdgeSelect, onDragStop, onAutoArrangeEnd,
    lastClickTimeRef, lastClickIdRef, draggedRef } = options;
  const selectEdges = !!onEdgeSelect && drawingMode !== "delete";
  let simulation: d3.Simulation<D3Node, undefined>|undefined;

  // clear the existing items
  svg.selectAll("*").remove();

  // add the root element
  const root = svg
    .append("g")
    .attr("class", "root")
    .attr("transform", transform?.toString() ?? "")
    ;

  const addArrowMarker = (id: string, color: string, markerOpacity?: number) => {
    root
      .append("svg:defs")
      .append("svg:marker")
      .attr("id", id)
      .attr("refX", 1)
      .attr("refY", 2)
      .attr("markerWidth", 4)
      .attr("markerHeight", 4)
      .attr("markerUnits", "strokeWidth")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 4 2 0 4 1 2 0 0")
      .style("fill", color)
      .style("fill-opacity", markerOpacity ?? 1);
  };

  // add arrows markers
  addArrowMarker("arrow", "black");
  addArrowMarker("loopArrow", "black");
  addArrowMarker("animatedArrow", animatedArrowColor);
  addArrowMarker("incomingArrow", incomingArrowColor);
  addArrowMarker("outgoingArrow", outgoingArrowColor);
  addArrowMarker("selectedLoopArrow", selectedLoopArrowColor);
  addArrowMarker("unselectedArrow", "black", unselectedOpacity);
  addArrowMarker("unselectedLoopArrow", "black", unselectedOpacity / lineAndLoopOpacity);

  // draw nodes
  const nodes = root
    .selectAll("g.node")
    .data(d3Graph.nodes)
    .enter()
    .append("g")
    .attr("class", "node");

  const dragStart = () => {
    simulation?.alphaTarget(0.5).restart();
    draggedRef.current = false;
  };

  const dragging = (event: d3.D3DragEvent<SVGEllipseElement, D3Node, D3Node>, d: D3Node) => {
    if (event.dx || event.dy) {
      draggedRef.current = true;
    }
    // simulation.alpha(0.5).restart()
    if (autoArrange) {
      d.fx = event.x;
      d.fy = event.y;
    } else {
      d.x = event.x;
      d.y = event.y;

      // update graph
      tick();
    }
  };

  const dragEnd = (event: d3.D3DragEvent<SVGEllipseElement, D3Node, D3Node>) => {
    simulation?.alphaTarget(0);
    // a press without a drag must not redraw, or the click that follows lands on a removed state
    if (draggedRef.current) {
      onDragStop?.(event.subject.id, { x: event.x, y: event.y });
    }
  };

  const drag = d3.drag<SVGEllipseElement, D3Node>()
    .on("start", dragStart)
    .on("drag", dragging)
    .on("end", dragEnd);

  const circleClass = [
    drawingMode === "addEdge" ? "can-add-edge" : "",
    drawingMode === "delete" ? "can-delete" : "",
  ].join(" ");

  const circles = nodes
    .append("ellipse")
    .attr("class", circleClass)
    .attr("fill", "#fff")
    .attr("stroke", "#999")
    .attr("stroke-width", d => 2)
    .attr("rx", d => d.radius)
    .attr("ry", d => ry(d.radius))
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("style", drawingMode === "select" ? "cursor: pointer" : "")
    .on("click", (e, d) => {
      const now = Date.now();
      const timeDiff = now - (lastClickTimeRef.current ?? 0);
      const sameNode = lastClickIdRef.current === d.id;
      const withinDoubleClickTime = timeDiff <= 250;
      const { selectedNodeId, setSelectedNodeId } = selectionRef.current;
      const skipToggle = withinDoubleClickTime && d.id === selectedNodeId;

      lastClickTimeRef.current = now;
      lastClickIdRef.current = d.id;

      if (withinDoubleClickTime && sameNode) {
        setSelectedNodeId(d.id, true);
        onNodeDoubleClick?.(d.id);
      } else {
        setSelectedNodeId(d.id, skipToggle);
        onNodeClick?.(d.id);
      }
    })
    ;

  if (allowDragging) {
    circles.call(drag);
  }

  const finalLabelsAndFontSizes = calculateNodeFontSizes(nodes.data());

  const labels = nodes
    .append("text")
    .text((d, i) => finalLabelsAndFontSizes[i].label)
    .attr("fill", "#000")
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-size", (d, i) => finalLabelsAndFontSizes[i].fontSize)
    .attr("x", d => d.x)
    .attr("y", d => d.y);

  const tick = () => {
    circles.attr("cx", d => d.x).attr("cy", d => d.y);
    labels.attr("x", d => d.x).attr("y", d => d.y);

    d3Graph.edges = calculateEdges(d3Graph.edges);

    lineBackgrounds
      .attr("x1", d => d.sourceX)
      .attr("x2", d => d.targetX)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => d.targetY);

    lines
      .attr("x1", d => d.sourceX)
      .attr("x2", d => lineEnd(d).x)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => lineEnd(d).y);

    loopBackgrounds.attr("d", d => nodeLoopPath(d));
    loops.attr("d", d => nodeLoopPath(d, d.loopWeight));
  };

  if (autoArrange) {
    const placedCount = d3Graph.nodes.filter(d => d.placed).length;
    const layout = keepPositions ? layoutFor(placedCount, d3Graph.nodes.length) : "whole";
    if (layout !== "whole") {
      d3Graph.nodes
        .filter(d => d.placed)
        .forEach(d => {
          d.fx = d.x;
          d.fy = d.y;
        });
    }

    // Create a new force simulation and assign forces
    simulation = d3
      .forceSimulation(d3Graph.nodes)
      .force("link", d3.forceLink(d3Graph.edges).distance(e => linkDistance(e.source.radius, e.target.radius)))
      .force("charge", d3.forceManyBody().strength(-350))
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .on("tick", tick);
    // the ticks below lay the graph out; the simulation's own timer would run its ticks again in the background
    simulation.stop();

    // a redraw of a graph already laid out (its states are pinned) has nothing to place
    if (d3Graph.nodes.some(d => d.fx == null)) {
      if (layout === "new") {
        simulation.alpha(0.3);
        for (let i = 0; i < 30; i++) {
          simulation.tick();
        }
      } else {
        while (simulation.alpha() > simulation.alphaMin()) {
          simulation.tick();
        }
      }
    }

    onAutoArrangeEnd?.(d3Graph.nodes);

    // pin the nodes so that dragging does not cause a force layout change
    d3Graph.nodes
      .forEach(d => {
        d.fx = d.x;
        d.fy = d.y;
      });

    // the simulation's timer is stopped, so no tick has moved the states and labels to their laid-out places
    circles.attr("cx", d => d.x).attr("cy", d => d.y);
    labels.attr("x", d => d.x).attr("y", d => d.y);
  }

  // calculate the edge positions
  d3Graph.edges = calculateEdges(d3Graph.edges);

  const lineBackgroundClass = [
    "edge-background",
    drawingMode === "delete" ? "can-delete" : "",
  ].join(" ");

  // draw backgrounds for edges to increase click area
  const lineBackgrounds = root
    .selectAll("line.edge-background")
    .data(d3Graph.edges)
    .enter()
    .append("line")
    .lower() // add below nodes
    .attr("class", lineBackgroundClass)
    .attr("stroke", "#000")
    .attr("stroke-opacity", 0)
    .attr("stroke-width", 15)
    .attr("x1", d => d.sourceX)
    .attr("x2", d => d.targetX)
    .attr("y1", d => d.sourceY)
    .attr("y2", d => d.targetY)
    .attr("style", drawingMode === "delete" || selectEdges ? "cursor: pointer" : "")
    .on("click", (e, d) => {
      onEdgeClick?.({ from: d.source.id, to: d.target.id });
      if (selectEdges) {
        onEdgeSelect({ from: d.source.id, to: d.target.id });
      }
    })
    ;

  // draw edges
  const lines = root
    .selectAll("line.edge")
    .data(d3Graph.edges)
    .enter()
    .append("line")
    .lower() // add below nodes
    .attr("class", "edge")
    .attr("stroke", "#999")
    .attr("stroke-opacity", lineAndLoopOpacity)
    .attr("stroke-width", d => d.weight)
    .attr("stroke-dasharray", d => lineDashArray(d))
    .attr("x1", d => d.sourceX)
    .attr("x2", d => lineEnd(d).x)
    .attr("y1", d => d.sourceY)
    .attr("y2", d => lineEnd(d).y)
    .attr("marker-end", arrowUrl)
    .attr("style", drawingMode === "delete" ? "pointer-events: none" : "")
    .on("click", (e, d) => {
      onEdgeClick?.({ from: d.source.id, to: d.target.id });
      if (selectEdges) {
        onEdgeSelect({ from: d.source.id, to: d.target.id });
      }
    })
    ;

  const loopStyle = drawingMode === "delete" || selectEdges ? "cursor: pointer" : "pointer-events: none";
  const handleLoopClick = (id: string) => {
    if (selectEdges) {
      onEdgeSelect({ from: id, to: id });
    } else {
      onNodeClick?.(id, true);
    }
  };

  const loopBackgrounds = root
    .selectAll("path.loop-background")
    .data(d3Graph.nodes.filter(n => n.loops))
    .enter()
    .append("path")
    .lower() // add below nodes
    .attr("class", "loop-background")
    .attr("d", d => nodeLoopPath(d))
    .attr("stroke", "#000")
    .attr("stroke-opacity", 0)
    .attr("fill-opacity", 0)
    .attr("stroke-width", 15)
    .attr("style", loopStyle)
    .on("click", (e, d) => handleLoopClick(d.id))
    ;

  const loops = root
    .selectAll("path.loop")
    .data(d3Graph.nodes.filter(n => n.loops))
    .enter()
    .append("path")
    .lower() // add below nodes
    .attr("class", "loop")
    .attr("d", d => nodeLoopPath(d, d.loopWeight))
    .attr("stroke", "#999")
    .attr("stroke-opacity", lineAndLoopOpacity)
    .attr("fill-opacity", 0)
    .attr("stroke-width", d => d.loopWeight)
    .attr("marker-end", arrowUrl)
    .attr("style", loopStyle)
    .on("click", (e, d) => handleLoopClick(d.id))
    ;

  const rubberBandNode = d3Graph.nodes.find(n => n.id === rubberBand?.from);
  if (rubberBand && rubberBandNode) {
    const data = [{ x1: rubberBandNode.x, x2: rubberBand.to.x, y1: rubberBandNode.y, y2: rubberBand.to.y }];
    root
      .selectAll("line.rubberband")
      .data(data)
      .enter()
      .append("line")
      .attr("class", "rubberband")
      .attr("stroke", "#999")
      .attr("stroke-opacity", lineAndLoopOpacity)
      .attr("stroke-width", 2)
      .attr("x1", d => d.x1)
      .attr("x2", d => d.x2)
      .attr("y1", d => d.y1)
      .attr("y2", d => d.y2)
      .attr("marker-end", arrowUrl);

    // add loopback "ghost" with background
    if (!rubberBandNode.loops) {
      root
        .selectAll("path.ghost-loop-background")
        .data([rubberBandNode])
        .enter()
        .append("path")
        .attr("class", "ghost-loop-background")
        .attr("d", d => nodeLoopPath(d))
        .attr("stroke", "#000")
        .attr("stroke-opacity", 0)
        .attr("fill-opacity", 0)
        .attr("stroke-width", 15)
        .attr("style", "cursor: pointer")
        .on("click", () => {
          onNodeClick?.(rubberBandNode.id);
        })
        ;
      root
        .selectAll("path.ghost-loop")
        .data([rubberBandNode])
        .enter()
        .append("path")
        .attr("class", "ghost-loop")
        .attr("d", d => nodeLoopPath(d))
        .attr("stroke", "#999")
        .attr("stroke-opacity", lineAndLoopOpacity)
        .attr("stroke-dasharray", 4)
        .attr("fill-opacity", 0)
        .attr("stroke-width", 1)
        .attr("marker-end", arrowUrl)
        .attr("style", "cursor: pointer")
        .on("click", () => {
          onNodeClick?.(rubberBandNode.id);
        })
        ;
    }
  }

  selectionRef.current.highlightSelected(svg);

  return simulation;
};
