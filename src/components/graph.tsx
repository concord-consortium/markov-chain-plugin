import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { useResizeObserver } from "../hooks/use-resize-observer";
import { Edge, GraphData, Node } from "../type";
import { ViewMode } from "../hooks/use-codap";

import "./graph.scss";

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
  highlightColor: string
  highlightAllNextNodes: boolean;
  allowDragging: boolean;
  autoArrange: boolean;
  rubberBand?: RubberBand;
  drawingMode?: DrawingMode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onNodeClick?: (id: string, onLoop?: boolean) => void;
  onNodeDoubleClick?: (id: string) => void;
  onEdgeClick?: (options: {from: string, to: string}) => void;
  onDragStop?: (id: string, pos: Point) => void;
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

export const orangeColor = "#FF9900";

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
  const nodeSignature = graph.nodes.map(n => `${n.id}/${n.label}/${n.weight}/${n.radius}`);
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

export const Graph = (props: Props) => {
  const {graph, highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes,
         highlightColor, allowDragging, autoArrange, mode, rubberBand, drawingMode,
         onClick, onMouseUp, onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop} = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useResizeObserver(wrapperRef);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [d3Graph, setD3Graph] = useState<D3Graph>({nodes: [], edges: []});
  const waitForDoubleRef = useRef<number|undefined>(undefined);

  // calculate the svg dimensions
  useEffect(() => {
    if (dimensions) {
      setWidth(dimensions.width);
      setHeight(dimensions.height - 5);
    }
  }, [dimensions]);

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
          //weight: edge.value,
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

    // add edge arrows
    svg
      .append("svg:defs")
      .append("svg:marker")
      .attr("id", "arrow")
      .attr("refX", 12)
      .attr("refY", 6)
      .attr("markerWidth", 30)
      .attr("markerHeight", 30)
      .attr("markerUnits","userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 12 6 0 12 3 6 0 0")
      .style("fill", "black");

    svg
      .append("svg:defs")
      .append("svg:marker")
      .attr("id", "highlightOrangeArrow")
      .attr("refX", 12)
      .attr("refY", 6)
      .attr("markerWidth", 30)
      .attr("markerHeight", 30)
      .attr("markerUnits","userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 12 6 0 12 3 6 0 0")
      .attr("stroke", orangeColor)
      .attr("stroke-width", 2)
      .style("fill", orangeColor);

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
    };

    const dragging = (event: any, d: any) => {
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

    const circles = nodes
      .append("ellipse")
      .attr("fill", "#fff")
      .attr("stroke", "#999")
      .attr("stroke-width", d => 2)
      .attr("rx", d => d.radius)
      .attr("ry", d => ry(d.radius))
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("style", drawingMode !== "addNode" ? "cursor: pointer" : "")
      .on("click", (e, d) => {
        if (waitForDoubleRef.current) {
          clearTimeout(waitForDoubleRef.current);
          waitForDoubleRef.current = undefined;
          onNodeDoubleClick?.(d.id);
        } else {
          waitForDoubleRef.current = setTimeout(() => {
            onNodeClick?.(d.id);
            waitForDoubleRef.current = undefined;
          }, 250);
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

      lines
        .attr("x1", d => d.sourceX)
        .attr("x2", d => d.targetX)
        .attr("y1", d => d.sourceY)
        .attr("y2", d => d.targetY);

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
    }

    // calculate the edge positions
    d3Graph.edges = calculateEdges(d3Graph.edges);
    // d3Graph.nodes = calculateLoops(d3Graph);

    // draw edges
    const lines = svg
      .selectAll("line.edge")
      .data(d3Graph.edges)
      .enter()
      .append("line")
      .attr("class", "edge")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => d.weight)
      .attr("x1", d => d.sourceX)
      .attr("x2", d => d.targetX)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => d.targetY)
      .attr("data-from", d => d.source.id)
      .attr("data-to", d => d.target.id)
      .attr("marker-end", "url(#arrow)")
      .attr("style", drawingMode === "delete" ? "cursor: pointer" : "")
      .on("click", (e, d) => {
        onEdgeClick?.({from: d.source.id, to: d.target.id});
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
      .attr("stroke-opacity", 0.6)
      .attr("fill-opacity", 0)
      .attr("stroke-width", d => d.loopWeight)
      .attr("marker-end", "url(#arrow)")
      .attr("style", drawingMode === "delete" ? "cursor: pointer" : "")
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
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("x1", d => d.x1)
        .attr("x2", d => d.x2)
        .attr("y1", d => d.y1)
        .attr("y2", d => d.y2)
        .attr("marker-end", "url(#arrow)");
    }

  }, [svgRef, d3Graph, allowDragging, autoArrange, rubberBand, drawingMode,
      onNodeClick, onNodeDoubleClick, onEdgeClick, onDragStop]);

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
      .attr("fill", highlightColor);

    const arrowUrl = "url(#highlightOrangeArrow)";

    // highlight animated edges
    svg
      .selectAll("line")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "")
      .attr("marker-end", "url(#arrow)")
      .filter((d: any) => ((
        (highlightNode?.id === d.source?.id && highlightAllNextNodes) ||
        (highlightEdge?.from === d.source?.id && highlightEdge?.to === d.target?.id))))
      .attr("stroke", highlightColor)
      .attr("stroke-dasharray", highlightAllNextNodes ? "4" : "")
      .attr("marker-end", arrowUrl);

    svg
      .selectAll("path.loop")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "")
      .attr("marker-end", "url(#arrow)")
      .filter((d: any) => highlightLoopOnNode?.id === d.id)
      .attr("stroke", highlightColor)
      .attr("stroke-dasharray", highlightAllNextNodes ? "4" : "")
      .attr("marker-end", arrowUrl);

  }, [svgRef, d3Graph.nodes, highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightColor]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!autoArrange && onClick) {
      onClick(e);
    }
  }, [autoArrange, onClick]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!autoArrange && onMouseUp) {
      onMouseUp(e);
    }
  }, [autoArrange, onMouseUp]);

  const viewBox = mode === "drawing" ? `0 0 ${width} ${height}` : `${-width / 2} ${-height / 2} ${width} ${height}`;

  return (
    <div className="graph" ref={wrapperRef} onClick={handleClick} onMouseUp={handleMouseUp}>
      <svg
        width={width}
        height={height}
        id="barchart"
        viewBox={viewBox}
        ref={svgRef}
      />
    </div>
  );
};

