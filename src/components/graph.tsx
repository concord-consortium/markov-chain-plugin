import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

import { GraphData } from "../type";

import "./graph.scss";
import { useResizeObserver } from "../hooks/use-resize-observer";

type Props = {
  graph: GraphData
};

type D3Node = {
  index: number,
  color: string,
  label: string;
  x: number,
  y: number,
  radius: number,
  loops: boolean
};

type D3Edge = {
  source: D3Node,
  target: D3Node,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
};

type D3Graph = {
  nodes: D3Node[],
  edges: D3Edge[],
};

type FindLineBetweenCirclesArgs = {x1: number, y1: number, r1: number, x2: number, y2: number, r2: number};
type FindLineCircleIntersectionArgs = {
  x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number
};
type FindLineLengthArgs = {x1: number, y1: number, x2: number, y2: number};

//const NodeRadius = 15;

const findLineCircleIntersection = ({x1, y1, x2, y2, cx, cy, r}: FindLineCircleIntersectionArgs) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const a = dx * dx + dy * dy;
  const b = 2 * (dx * (x1 - cx) + dy * (y1 - cy));
  const c = cx * cx + cy * cy + x1 * x1 + y1 * y1 - 2 * (cx * x1 + cy * y1) - r * r;
  const determinant = Math.sqrt(b * b - 4 * a * c);
  const t1 = (-b + determinant) / (2 * a);
  const t2 = (-b - determinant) / (2 * a);
  const intersection1 = {x: x1 + t1 * dx, y: y1 + t1 * dy};
  const intersection2 = {x: x1 + t2 * dx, y: y1 + t2 * dy};
  return [intersection1, intersection2];
};

const findLineLength = ({x1, y1, x2, y2}: FindLineLengthArgs) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

const findLineBetweenCircles = ({x1, y1, r1, x2, y2, r2}: FindLineBetweenCirclesArgs) => {
  const int1 = findLineCircleIntersection({x1, y1, x2, y2, cx: x1, cy: y1, r: r1});
  const int2 = findLineCircleIntersection({x1, y1, x2, y2, cx: x2, cy: y2, r: r2});

  const combos = [
    [int1[0], int2[0]],
    [int1[0], int2[1]],
    [int1[1], int2[0]],
    [int1[1], int2[1]]
  ];

  let minLength = Infinity;
  let minCombo = combos[0];
  combos.forEach((combo, index) => {
    const length = findLineLength({x1: combo[0].x, y1: combo[0].y, x2: combo[1].x, y2: combo[1].y});
    if (length < minLength) {
      minLength = length;
      minCombo = combo;
    }
  });

  return [{x: minCombo[0].x, y: minCombo[0].y}, {x: minCombo[1].x, y: minCombo[1].y}];
};

export const Graph = ({graph}: Props) => {
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
    const numNodes = graph.nodes.length;

    const newD3Graph: D3Graph = {nodes: [], edges: []};
    const d3NodeMap: Record<string, D3Node> = {};
    graph.nodes.forEach((node, index) => {
      const d3Node: D3Node = {
        index,
        color: d3.interpolateRainbow(index / numNodes),
        x: 0,
        y: 0,
        label: node.label,
        radius: 15 + (5 * (node.label.length - 1)),
        loops: false
      };
      newD3Graph.nodes.push(d3Node);
      d3NodeMap[node.id] = d3Node;
    });
    graph.edges.forEach((edge) => {
      if (edge.from === edge.to) {
        d3NodeMap[edge.from].loops = true;
      } else {
        newD3Graph.edges.push({
          source: d3NodeMap[edge.from],
          target: d3NodeMap[edge.to],
          sourceX: 0, sourceY: 0, targetX: 0, targetY: 0 // calculated after force layout
          });
      }
    });
    setD3Graph(newD3Graph);

  }, [graph]);

  // draw the graph
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);

    // clear the existing items
    svg.selectAll("*").remove();

    // Create a new force simulation and assign forces
    const simulation = d3
      .forceSimulation(d3Graph.nodes)
      .force("link", d3.forceLink(d3Graph.edges).distance(e => e.source.radius + e.target.radius + 10))
      .force("charge", d3.forceManyBody().strength(-350))
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .stop();
    while (simulation.alpha() > simulation.alphaMin()) {
      simulation.tick();
    }

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
      .attr("d", "M 0 0 12 6 0 12 3 6")
      .style("fill", "black");

    // draw nodes
    const groups = svg
      .selectAll("group")
      .data(d3Graph.nodes)
      .enter()
      .append("g");

    groups
      .append("circle")
      .attr("fill", "#fff")
      .attr("stroke", "#999")
      .attr("stroke-width", d => d.loops ? 4 : 2)
      .attr("r", d => d.radius)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    groups
      .append("text")
      .text(d => d.label)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .attr("font-size", d =>d.radius/((d.radius*10)/150))
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      ;

    // calculate the edge positions
    d3Graph.edges = d3Graph.edges.map(edge => {
      const [sourceEdge, targetEdge] =
        findLineBetweenCircles({
          x1: edge.source.x,
          y1: edge.source.y,
          r1: edge.source.radius,
          x2: edge.target.x,
          y2: edge.target.y,
          r2: edge.target.radius
        });
      edge.sourceX = sourceEdge.x;
      edge.sourceY = sourceEdge.y;
      edge.targetX = targetEdge.x;
      edge.targetY = targetEdge.y;
      return edge;
    });

    // draw edges
    svg
      .selectAll("line")
      .data(d3Graph.edges)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => 2)
      .attr("x1", d => d.sourceX)
      .attr("x2", d => d.targetX)
      .attr("y1", d => d.sourceY)
      .attr("y2", d => d.targetY)
      .attr("marker-end", "url(#arrow)");

  }, [svgRef, d3Graph, width, height]);

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

