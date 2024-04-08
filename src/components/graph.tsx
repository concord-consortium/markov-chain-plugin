import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { useResizeObserver } from "../hooks/use-resize-observer";
import { Edge, GraphData, Node } from "../type";
import { ViewMode } from "../hooks/use-codap";

import "./graph.scss";

const unselectedOpacity = 0.35;
const lineAndLoopOpacity = 0.6;

const selectedNodeColor = "#14f49e3f";  // 3f is 25% opacity
const incomingArrowColor = "#0081ff";
const outgoingArrowColor = "#ff9900";
const animatedNodeColor = "#FF00877f"; // 7f is 50% opacity
const animatedArrowColor = "#FF0087";
const selectedLoopArrowColor = "#8d61bc";

const arrowUrl = "url(#arrow)";
const incomingArrowUrl = "url(#incomingArrow)";
const outgoingArrowUrl = "url(#outgoingArrow)";
const animatedArrowUrl = "url(#animatedArrow)";
const selectedLoopArrowUrl = "url(#selectedLoopArrow)";
const unselectedArrowUrl = "url(#unselectedArrow)";
const unselectedLoopArrowUrl = "url(#unselectedLoopArrow)";

export type DrawingMode = "select"|"addNode"|"addEdge"|"delete";

export type GraphSettings = {
  minRadius: number;
  maxRadius: number;
  minStroke: number;
  maxStroke: number;
  marginFactor: number;
  minFontSize: number;
};

export type Point = {x: number, y: number};

export type RubberBand = {from: string, to: Point};

type Props = {
  graph: GraphData,
  mode: ViewMode;
  highlightNode?: Node,
  highlightLoopOnNode?: Node,
  highlightEdge?: Edge,
  highlightAllNextNodes: boolean;
  allowDragging: boolean;
  autoArrange: boolean;
  rubberBand?: RubberBand;
  drawingMode?: DrawingMode;
  selectedNodeId?: string;
  animating: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onNodeClick?: (id: string, onLoop?: boolean) => void;
  onNodeDoubleClick?: (id: string) => void;
  onEdgeClick?: (options: {from: string, to: string}) => void;
  onDragStop?: (id: string, pos: Point) => void;
  onDimensions?: (dimensions: {width: number, height: number}) => void;
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
};

type D3Node = {
  index: number,
  id: string;
  label: string;
  x: number,
  y: number,
  radius: number,
  loops: boolean
  loopWeight: number,
  weight: number;
};

type D3Edge = {
  source: D3Node,
  target: D3Node,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  weight: number;
  value: number;
};

type D3Graph = {
  nodes: D3Node[],
  edges: D3Edge[],
};

type FindLineBetweenEllipsesArgs = {
  x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, nodeEdgeCount: {source: D3Node, count: number}
};
type FindPointOnEllipseArgs = {
  x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, a: number, b: number, angleDelta: number
};

const startLoopAngle = 0.25 * Math.PI;
const endLoopAngle = 1.75 * Math.PI;
const bidirectionalEdgeAngle = 10 * (Math.PI / 180);
const Pi2 = Math.PI * 2;

const settings: GraphSettings = {
  minRadius: 25,
  maxRadius: 75,
  minStroke: 2,
  maxStroke: 7,
  marginFactor: 0.8,
  minFontSize: 10,
};

const ry = (radius: number) => radius / 2;

const normalizeAngle = (radians: number): number => {
  return radians - Pi2 * Math.floor(radians / Pi2);
};

const findPointOnEllipse = ({x1, y1, x2, y2, cx, cy, a, b, angleDelta}: FindPointOnEllipseArgs) => {
  const angle = normalizeAngle(Math.atan2(y2 - y1, x2 - x1) + angleDelta);
  return { x: cx + a * Math.cos(angle), y: cy + b * Math.sin(angle) };
};

const findLineBetweenEllipses = ({x1, y1, r1, x2, y2, r2, nodeEdgeCount}: FindLineBetweenEllipsesArgs) => {
  const angleDelta = nodeEdgeCount.count > 1 ? bidirectionalEdgeAngle : 0;
  return [
    findPointOnEllipse({x1, y1, x2, y2, cx: x1, cy: y1, a: r1, b: ry(r1), angleDelta}),
    findPointOnEllipse({x1: x2, y1: y2, x2: x1, y2: y1, cx: x2, cy: y2, a: r2, b: ry(r2), angleDelta: -angleDelta})
  ];
};

const calculateEdges = (edges: D3Edge[]) => {
  const getKey = (edge: D3Edge) => {
    const ids = [edge.source.id, edge.target.id];
    ids.sort();
    return ids.join(":");
  };
  const nodeEdgeCounts = edges.reduce<Map<string,{source: D3Node, count: number}>>((acc, edge) => {
    const key = getKey(edge);
    const entry = acc.get(key) || {source: edge.source, count: 0};
    entry.count++;
    acc.set(key, entry);
    return acc;
  }, new Map());

  return edges.map(edge => {
    const [sourceEdge, targetEdge] =
      findLineBetweenEllipses({
        x1: edge.source.x,
        y1: edge.source.y,
        r1: edge.source.radius,
        x2: edge.target.x,
        y2: edge.target.y,
        r2: edge.target.radius,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        nodeEdgeCount: nodeEdgeCounts.get(getKey(edge))!
      });
    edge.sourceX = sourceEdge.x;
    edge.sourceY = sourceEdge.y;
    edge.targetX = targetEdge.x;
    edge.targetY = targetEdge.y;
    return edge;
  });
};

const nodeLoopPath = (node: D3Node) => {
  const a = node.radius;
  const b = ry(node.radius);
  const clockwise = false;

  const circle = {x: node.x - a, y: node.y};
  const radius = b;

  const startX = circle.x + radius * Math.cos(startLoopAngle);
  const startY = circle.y + radius * Math.sin(startLoopAngle);
  const endX = circle.x + radius * Math.cos(endLoopAngle);
  const endY = circle.y + radius * Math.sin(endLoopAngle);

  const largeArc = Math.abs(endLoopAngle - startLoopAngle) <= Math.PI ? "0" : "1";
  const sweepFlag = clockwise ? "0" : "1";

  const d = "M " + startX + "," + startY + " A " + radius + "," + radius + " 0 " +
            largeArc + "," + sweepFlag + " " + endX + "," + endY;

  return d;
};

const graphSignature = (graph: D3Graph) => {
  const nodeSignature = graph.nodes.map(n => `${n.id}/${n.label}/${n.weight}/${n.radius}/${n.x}/${n.y}`);
  const edgeSignature = graph.edges.map(e => `${e.source.id}/${e.target.id}/${e.weight}`);
  return `${nodeSignature}::${edgeSignature}`;
};

const calculateNodeFontSize = (d: D3Node) => {
  let label = d.label;
  const maxHeight = ry(d.radius * 2) * settings.marginFactor;
  const maxWidth = d.radius * 2 * settings.marginFactor;

  const text = document.createElement("span");
  text.style.height = "auto";
  text.style.width = "auto";
  text.style.position = "absolute";
  text.style.whiteSpace = "no-wrap";
  text.style.opacity = "0";
  text.innerHTML = label;
  document.body.appendChild(text);

  let fontSize = maxHeight;
  let truncateLabelAt = label.length - 1;
  while (fontSize > 1) {
    text.style.fontSize = fontSize + "px";
    if ((Math.ceil(text.clientHeight) > maxHeight) || (Math.ceil(text.clientWidth) > maxWidth)) {
      if ((fontSize > settings.minFontSize) || (truncateLabelAt <= 0)) {
        fontSize--;
      } else {
        truncateLabelAt--;
        if (truncateLabelAt >= 0) {
          label = d.label.substring(0, truncateLabelAt) + "...";
          text.innerHTML = label;
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }
  document.body.removeChild(text);

  return {label, fontSize};
};

const lineDashArray = (edge: D3Edge) => edge.value ? "" : "4";

export const Graph = (props: Props) => {
  const {graph, highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes,
         allowDragging, autoArrange, rubberBand, drawingMode,
         onClick, onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop,
         selectedNodeId, setSelectedNodeId, animating, onDimensions} = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useResizeObserver(wrapperRef);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [d3Graph, setD3Graph] = useState<D3Graph>({nodes: [], edges: []});
  const lastClickTimeRef = useRef<number|undefined>(undefined);
  const lastClickIdRef = useRef<string|undefined>(undefined);
  const draggedRef = useRef(false);

  const highlightSelected = useCallback((svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    if (animating || !selectedNodeId) {
      return;
    }

    const connectedNodeIds = graph.edges
      .filter(e => e.from === selectedNodeId || e.to === selectedNodeId)
      .map(e => e.from === selectedNodeId ? e.to: e.from)
      .concat(selectedNodeId);

    // highlight selected node
    svg
      .selectAll("g")
      .selectAll("ellipse")
      .style("opacity", unselectedOpacity)
      .filter((d: any) => connectedNodeIds.includes(d.id))
      .style("opacity", 1)
      .filter((d: any) => selectedNodeId === d.id)
      .attr("fill", selectedNodeColor);

    // make all lines have the unselected opacity
    svg
      .selectAll("line")
      .style("opacity", unselectedOpacity)
      .attr("marker-end", unselectedArrowUrl);

    // highlight selected incoming edges
    svg
      .selectAll("line")
      .filter((d: any) => ((
        (d.value > 0) && (selectedNodeId === d.target?.id))))
      .attr("stroke", incomingArrowColor)
      .attr("marker-end", incomingArrowUrl)
      .style("opacity", 1);

    // highlight selected outgoing edges
    svg
      .selectAll("line")
      .filter((d: any) => ((
        (d.value > 0) && (selectedNodeId === d.source?.id))))
      .attr("stroke", outgoingArrowColor)
      .attr("marker-end", outgoingArrowUrl)
      .style("opacity", 1);

    // highlight loops
    svg
      .selectAll("path.loop")
      .style("opacity", unselectedOpacity)
      .attr("marker-end", unselectedLoopArrowUrl)
      .filter((d: any) => selectedNodeId === d.id)
      .attr("stroke", selectedLoopArrowColor)
      .attr("stroke-dasharray", "")
      .attr("marker-end", selectedLoopArrowUrl)
      .style("opacity", 1);

    // highlight text
    svg
      .selectAll("g")
      .selectAll("text")
      .style("opacity", unselectedOpacity)
      .filter((d: any) => connectedNodeIds.includes(d.id))
      .style("opacity", 1);


  }, [selectedNodeId, animating, graph]);

  // calculate the svg dimensions
  useEffect(() => {
    if (dimensions) {
      setWidth(dimensions.width);
      setHeight(dimensions.height);
      onDimensions?.({width: dimensions.width, height: dimensions.height});
    }
  }, [dimensions, onDimensions]);

  // create the d3 graph info
  useEffect(() => {
    const newD3Graph: D3Graph = {nodes: [], edges: []};
    const d3NodeMap: Record<string, D3Node> = {};

    // get the sum of all the values
    const totalNodeValue = graph.nodes.reduce((acc, cur) => acc + cur.value, 0);
    const totalEdgeValue = graph.edges.reduce((acc, cur) => acc + cur.value, 0);
    const {minRadius, maxRadius, minStroke, maxStroke} = settings;

    graph.nodes.forEach((node, index) => {
      const d3Node: D3Node = {
        index,
        id: node.id,
        x: node.x || 0,
        y: node.y || 0,
        label: node.label,
        // radius: 15 + (5 * (node.label.length - 1)) + (5 * node.value),
        radius: minRadius + ((maxRadius - minRadius) * (node.value / totalNodeValue)),
        loops: false,
        loopWeight: 0,
        weight: node.value
      };
      newD3Graph.nodes.push(d3Node);
      d3NodeMap[node.id] = d3Node;
    });

    const edgeWeight = (value: number) => minStroke + ((maxStroke - minStroke) * (value / totalEdgeValue));

    graph.edges.forEach((edge) => {
      if (edge.from === edge.to) {
        d3NodeMap[edge.from].loops = true;
        d3NodeMap[edge.from].loopWeight = edgeWeight(edge.value);
      } else {
        newD3Graph.edges.push({
          value: edge.value,
          weight: edgeWeight(edge.value),
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

  // draw the graph
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    let simulation: d3.Simulation<D3Node, undefined>|undefined;

    // clear the existing items
    svg.selectAll("*").remove();

    const addArrowMarker = (id: string, color: string, opacity?: number) => {
      svg
        .append("svg:defs")
        .append("svg:marker")
        .attr("id", id)
        .attr("refX", 12)
        .attr("refY", 6)
        .attr("markerWidth", 30)
        .attr("markerHeight", 30)
        .attr("markerUnits","userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 12 6 0 12 3 6 0 0")
        .attr("stroke", color)
        .style("fill", color)
        .style("fill-opacity", opacity ?? 1)
        .style("stroke-opacity", opacity ?? 1);
    };

    // add arrows markers
    addArrowMarker("arrow", "black");
    addArrowMarker("loopArrow", "black");
    addArrowMarker("animatedArrow", animatedArrowColor);
    addArrowMarker("incomingArrow", incomingArrowColor);
    addArrowMarker("outgoingArrow", outgoingArrowColor);
    addArrowMarker("selectedLoopArrow", selectedLoopArrowColor);
    addArrowMarker("unselectedArrow", "black", unselectedOpacity);
    addArrowMarker("unselectedLoopArrow", "black", unselectedOpacity / lineAndLoopOpacity); // 0

    // draw nodes
    const nodes = svg
      .selectAll("g")
      .data(d3Graph.nodes)
      .enter()
      .append("g");

    const dragStart = (d: any) => {
      simulation?.alphaTarget(0.5).restart();
      d.fx = d.x;
      d.fy = d.y;
      draggedRef.current = false;
    };

    const dragging = (event: any, d: any) => {
      draggedRef.current = true;
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

    const dragEnd = (d: any) => {
      simulation?.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      onDragStop?.(d.subject.id, {x: d.x, y: d.y});
    };

    const drag = d3.drag()
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
      .attr("style", drawingMode !== "addNode" ? "cursor: pointer" : "")
      .on("click", (e, d) => {
        const now = Date.now();
        const timeDiff = now - (lastClickTimeRef.current ?? 0);
        const sameNode = lastClickIdRef.current === d.id;
        const withinDoubleClickTime = timeDiff <= 250;
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
      circles.call(drag as any);
    }

    const finalLabelsAndFontSizes: Array<{label: string, fontSize: number}> = [];
    nodes.each(d => {
      finalLabelsAndFontSizes.push(calculateNodeFontSize(d));
    });

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
        .attr("x2", d => d.targetX)
        .attr("y1", d => d.sourceY)
        .attr("y2", d => d.targetY);

      loopBackgrounds.attr("d", nodeLoopPath);
      loops.attr("d", nodeLoopPath);
    };


    if (autoArrange) {
      // Create a new force simulation and assign forces
      simulation = d3
        .forceSimulation(d3Graph.nodes)
        .force("link", d3.forceLink(d3Graph.edges).distance(e => (e.source.radius + e.target.radius) * 1.5))
        .force("charge", d3.forceManyBody().strength(-350))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", tick);

      // ensure node values before calculating edge positions
      while (simulation.alpha() > simulation.alphaMin()) {
        simulation.tick();
      }

      // pin the nodes so that dragging does not cause a force layout change
      d3Graph.nodes
        .forEach((d: any) => {
          d.fx = d.x;
          d.fy = d.y;
        });
    }

    // calculate the edge positions
    d3Graph.edges = calculateEdges(d3Graph.edges);

    const lineBackgroundClass = [
      "edge-background",
      drawingMode === "delete" ? "can-delete" : "",
    ].join(" ");

    // draw backgrounds for edges to increase click area
    const lineBackgrounds = svg
      .selectAll("line.edge-background")
      .data(d3Graph.edges)
      .enter()
      .append("line")
      .attr("class", lineBackgroundClass)
      .attr("stroke", "#000")
      .attr("stroke-opacity", 0)
      .attr("stroke-width", 15)
      .attr("x1", d => d.sourceX)
      .attr("x2", d => d.targetX)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => d.targetY)
      .attr("style", drawingMode === "delete" ? "cursor: pointer" : "")
      .on("click", (e, d) => {
        onEdgeClick?.({from: d.source.id, to: d.target.id});
      })
      ;

    // draw edges
    const lines = svg
      .selectAll("line.edge")
      .data(d3Graph.edges)
      .enter()
      .append("line")
      .attr("class", "edge")
      .attr("stroke", "#999")
      .attr("stroke-opacity", lineAndLoopOpacity)
      .attr("stroke-width", d => d.weight)
      .attr("stroke-dasharray", d => lineDashArray(d))
      .attr("x1", d => d.sourceX)
      .attr("x2", d => d.targetX)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => d.targetY)
      .attr("marker-end", arrowUrl)
      .attr("style", drawingMode === "delete" ? "pointer-events: none" : "")
      .on("click", (e, d) => {
        // this is not really needed as the pointer events are off
        onEdgeClick?.({from: d.source.id, to: d.target.id});
      })
      ;

    const loopStyle = drawingMode === "delete" ? "cursor: pointer" : "pointer-events: none";

    const loopBackgrounds = svg
      .selectAll("path.loop-background")
      .data(d3Graph.nodes.filter(n => n.loops))
      .enter()
      .append("path")
      .attr("class", "loop-background")
      .attr("d", nodeLoopPath)
      .attr("stroke", "#000")
      .attr("stroke-opacity", 0)
      .attr("fill-opacity", 0)
      .attr("stroke-width", 15)
      .attr("style", loopStyle)
      .on("click", (e, d) => {
        onNodeClick?.(d.id, true);
      })
      ;

    const loops = svg
      .selectAll("path.loop")
      .data(d3Graph.nodes.filter(n => n.loops))
      .enter()
      .append("path")
      .attr("class", "loop")
      .attr("d", nodeLoopPath)
      .attr("stroke", "#999")
      .attr("stroke-opacity", lineAndLoopOpacity)
      .attr("fill-opacity", 0)
      .attr("stroke-width", d => d.loopWeight)
      .attr("marker-end", arrowUrl)
      .attr("style", loopStyle)
      .on("click", (e, d) => {
        onNodeClick?.(d.id, true);
      })
      ;

    const rubberBandNode = d3Graph.nodes.find(n => n.id === rubberBand?.from);
    if (rubberBand && rubberBandNode) {
      const data = [{x1: rubberBandNode.x, x2: rubberBand.to.x, y1: rubberBandNode.y, y2: rubberBand.to.y}];
      svg
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
        svg
          .selectAll("path.ghost-loop-background")
          .data([rubberBandNode])
          .enter()
          .append("path")
          .attr("class", "ghost-loop-background")
          .attr("d", nodeLoopPath)
          .attr("stroke", "#000")
          .attr("stroke-opacity", 0)
          .attr("fill-opacity", 0)
          .attr("stroke-width", 15)
          .attr("style", "cursor: pointer")
          .on("click", () => {
            onNodeClick?.(rubberBandNode.id);
          })
          ;
        svg
          .selectAll("path.ghost-loop")
          .data([rubberBandNode])
          .enter()
          .append("path")
          .attr("class", "ghost-loop")
          .attr("d", nodeLoopPath)
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

    highlightSelected(svg);

  }, [svgRef, d3Graph, allowDragging, autoArrange, rubberBand, drawingMode,
      onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop, setSelectedNodeId, selectedNodeId, highlightSelected]);

  // animate the node if needed
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);

    // de-highlight all nodes
    svg
      .selectAll("g")
      .selectAll("ellipse")
      .attr("fill", "#fff");

    // highlight animated node
    svg
      .selectAll("g")
      .selectAll("ellipse")
      .filter((d: any) => highlightNode?.id === d.id)
      .attr("fill", animatedNodeColor);

    // highlight animated edges
    svg
      .selectAll("line")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", (d: any) => lineDashArray(d))
      .attr("marker-end", arrowUrl)
      .filter((d: any) => ((
        (d.value > 0) && (
        (highlightNode?.id === d.source?.id && highlightAllNextNodes) ||
        (highlightEdge?.from === d.source?.id && highlightEdge?.to === d.target?.id)))))
      .attr("stroke", animatedArrowColor)
      .attr("stroke-dasharray", highlightAllNextNodes ? "4" : "")
      .attr("marker-end", animatedArrowUrl);

    svg
      .selectAll("path.loop")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "")
      .attr("marker-end", arrowUrl)
      .filter((d: any) => highlightLoopOnNode?.id === d.id)
      .attr("stroke", animatedArrowColor)
      .attr("stroke-dasharray", highlightAllNextNodes ? "4" : "")
      .attr("marker-end", animatedArrowUrl);

    highlightSelected(svg);
  }, [svgRef, d3Graph.nodes, selectedNodeId, highlightNode, highlightLoopOnNode,
      highlightEdge, highlightAllNextNodes, highlightSelected]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!autoArrange && onClick) {
      onClick(e);
    }
  }, [autoArrange, onClick]);

  return (
    <div className="graph" ref={wrapperRef} onClick={handleClick}>
      <svg
        width="100%"
        height="calc(100vh - 20px)"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        ref={svgRef}
      />
    </div>
  );
};

