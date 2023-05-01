import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { useResizeObserver } from "../hooks/use-resize-observer";
import { GraphData, Node } from "../type";

import "./graph.scss";

export type GraphSettings = {
  minRadius: number;
  maxRadius: number;
  marginFactor: number;
  minFontSize: number;
};

type Props = {
  graph: GraphData,
  animateNodeIndex?: number
  highlightNodes: Node[]
  settings: GraphSettings,
};

type D3Node = {
  index: number,
  label: string;
  x: number,
  y: number,
  radius: number,
  loops: boolean
  loopAngle: number
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

const highlightYellow = "#FFFF00";
const startLoopAngle = 0.25 * Math.PI;
const endLoopAngle = 1.75 * Math.PI;
const bidirectionalEdgeAngle = 10 * (Math.PI / 180);
const Pi2 = Math.PI * 2;

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
    const labels = [edge.source.label, edge.target.label];
    labels.sort();
    return labels.join(":");
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
  const nodeSignature = graph.nodes.map(n => `${n.label}/${n.weight}/${n.radius}`);
  const edgeSignature = graph.edges.map(e => `${e.source.label}/${e.target.label}/${e.weight}`);
  return `${nodeSignature}::${edgeSignature}`;
};

const calculateNodeFontSize = (d: D3Node, settings: GraphSettings) => {
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

export const Graph = ({graph, animateNodeIndex, highlightNodes, settings}: Props) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useResizeObserver(wrapperRef);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [d3Graph, setD3Graph] = useState<D3Graph>({nodes: [], edges: []});

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
    const totalValue = graph.nodes.reduce((acc, cur) => acc + cur.value, 0);
    const {minRadius, maxRadius} = settings;

    graph.nodes.forEach((node, index) => {
      const d3Node: D3Node = {
        index,
        x: 0,
        y: 0,
        label: node.label,
        // radius: 15 + (5 * (node.label.length - 1)) + (5 * node.value),
        radius: minRadius + ((maxRadius - minRadius) * (node.value / totalValue)),
        loops: false,
        loopAngle: 0,
        weight: node.value
      };
      newD3Graph.nodes.push(d3Node);
      d3NodeMap[node.id] = d3Node;
    });
    graph.edges.forEach((edge) => {
      if (edge.from === edge.to) {
        d3NodeMap[edge.from].loops = true;
      } else {
        newD3Graph.edges.push({
          weight: edge.value,
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
  }, [d3Graph, graph, settings]);

  // draw the graph
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);

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
      .attr("id", "highlightArrow")
      .attr("refX", 12)
      .attr("refY", 6)
      .attr("markerWidth", 30)
      .attr("markerHeight", 30)
      .attr("markerUnits","userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 12 6 0 12 3 6 0 0")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .style("fill", highlightYellow);

    // draw nodes
    const nodes = svg
      .selectAll("g")
      .data(d3Graph.nodes)
      .enter()
      .append("g");

    const dragStart = (d: any) => {
      simulation.alphaTarget(0.5).restart();
      d.fx = d.x;
      d.fy = d.y;
    };

    const dragging = (event: any, d: any) => {
      // simulation.alpha(0.5).restart()
      d.fx = event.x;
      d.fy = event.y;
    };

    const dragEnd = (d: any) => {
      simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
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
      .call(drag as any);

    const finalLabelsAndFontSizes: Array<{label: string, fontSize: number}> = [];
    nodes.each(d => {
      finalLabelsAndFontSizes.push(calculateNodeFontSize(d, settings));
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

    // Create a new force simulation and assign forces
    const simulation = d3
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

    // calculate the edge positions
    d3Graph.edges = calculateEdges(d3Graph.edges);
    // d3Graph.nodes = calculateLoops(d3Graph);

    // draw edges
    const lines = svg
      .selectAll("line")
      .data(d3Graph.edges)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => 2 * d.weight)
      .attr("x1", d => d.sourceX)
      .attr("x2", d => d.targetX)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => d.targetY)
      .attr("data-from", d => d.source.label)
      .attr("data-to", d => d.target.label)
      .attr("marker-end", "url(#arrow)");

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
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");

  }, [svgRef, d3Graph, width, height, settings]);

  // draggable: https://codesandbox.io/s/d3js-draggable-force-directed-graph-py3rf?file=/app.js

  // animate the node if needed
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const animateNode = animateNodeIndex !== undefined ? highlightNodes[animateNodeIndex] : undefined;

    // de-highlight all nodes
    svg
      .selectAll("g")
      .selectAll("circle")
      .attr("fill", "#fff");

    // highlight all highlighted nodes
    const highlightedLabels = highlightNodes.map(n => n.label);
    svg
      .selectAll("g")
      .selectAll("circle")
      .filter((d: any) => highlightedLabels.includes(d.label))
      .attr("fill", "#aaa");

    // highlight animated node
    svg
      .selectAll("g")
      .selectAll("circle")
      .filter((d: any) => animateNode?.label === d.label)
      .attr("fill", highlightYellow);

    // highlight animated edges
    svg
      .selectAll("line")
      .attr("marker-end", "url(#arrow)");
    svg
      .selectAll("path.loop")
      .attr("marker-end", "url(#arrow)");

    if (animateNode) {
      const nextNode = animateNodeIndex !== undefined && highlightNodes[animateNodeIndex + 1];
      if (nextNode) {
        if (nextNode.label === animateNode.label) {
          svg
            .selectAll("path.loop")
            .filter((d: any) => nextNode.label === d.label)
            .attr("marker-end", "url(#highlightArrow)");
        } else {
          svg
            .selectAll("line")
            .filter((d: any) => animateNode.label === d.source?.label && nextNode.label === d.target?.label)
            .attr("marker-end", "url(#highlightArrow)");
        }
      }
    }

  }, [svgRef, d3Graph.nodes, animateNodeIndex, highlightNodes]);

  return (
    <div className="graph" ref={wrapperRef}>
      <svg
        width={width}
        height={height}
        id="barchart"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`} ref={svgRef}
      />
    </div>
  );
};

