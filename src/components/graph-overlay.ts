import type * as d3 from "d3";

import { GraphData, Node } from "../type";
import { D3Edge, D3Graph, D3Node } from "./graph-geometry";
import type { GraphSelection } from "./graph-highlight";
import { chainOutgoing, ProbabilityLabel, probabilityLabels } from "./graph-labels";
import { ry } from "./graph-utils";

export interface OverlayOptions {
  graph: GraphData;
  probabilityLabels?: boolean;
  animating: boolean;
  selectedNodeId?: string;
  highlightNode?: Node;
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
}

// a label and what it sits on: an arrow, or a loop's state
export type PlacedLabel = ProbabilityLabel & { edge?: D3Edge, loop?: D3Node };

// how far a label sits to the right of its arrow, the side a two-way pair's arrows part to
const labelOffset = 8;
const alongArrow = 1 / 3;
const loopLabelGap = 4;

export const labelPoint = ({ edge, loop }: Pick<PlacedLabel, "edge" | "loop">) => {
  if (loop) {
    return { x: loop.x - loop.radius - ry(loop.radius) - loopLabelGap, y: loop.y };
  }
  const { sourceX, sourceY, targetX, targetY } = edge as D3Edge;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: sourceX + dx * alongArrow - labelOffset * dy / length,
    y: sourceY + dy * alongArrow + labelOffset * dx / length,
  };
};

const placeLabels = (labels: d3.Selection<any, PlacedLabel, any, any>) => labels
  .attr("x", d => labelPoint(d).x)
  .attr("y", d => labelPoint(d).y);

const placedLabels = (labels: ProbabilityLabel[], d3Graph: D3Graph) => {
  const edges = new Map(d3Graph.edges.map(edge => [JSON.stringify([edge.source.id, edge.target.id]), edge]));
  const nodes = new Map(d3Graph.nodes.map(node => [node.id, node]));
  return labels
    .map<PlacedLabel>(label => label.from === label.to
      ? { ...label, loop: nodes.get(label.from) }
      : { ...label, edge: edges.get(JSON.stringify([label.from, label.to])) })
    .filter(label => label.edge || label.loop);
};

// draws what the highlights put over the graph, replacing what was there; without labels it leaves nothing
export const drawOverlay = (root: GraphSelection, d3Graph: D3Graph, options: OverlayOptions) => {
  root.selectAll("g.probability-labels").remove();
  if (!options.probabilityLabels) {
    return;
  }

  const { graph, animating, selectedNodeId, highlightNode, highlightAllNextNodes, highlightOutputNodes } = options;
  const labels = probabilityLabels({
    outgoing: chainOutgoing(graph.edges), animating, selectedNodeId, highlightNode, highlightAllNextNodes,
    highlightOutputNodes,
  });

  const drawn = root
    .append("g")
    .attr("class", "probability-labels")
    .selectAll("text")
    .data(placedLabels(labels, d3Graph))
    .enter()
    .append("text")
    .attr("class", (d: PlacedLabel) => d.strength === "faded" ? "probability-label faded" : "probability-label")
    .attr("data-from", (d: PlacedLabel) => d.from)
    .attr("data-to", (d: PlacedLabel) => d.to)
    .attr("text-anchor", (d: PlacedLabel) => d.loop ? "end" : "middle")
    .text((d: PlacedLabel) => d.text);
  placeLabels(drawn);
};

// moves what drawOverlay drew to follow its states, without rebuilding it
export const moveOverlay = (root: GraphSelection) => {
  placeLabels(root.selectAll<SVGTextElement, PlacedLabel>("g.probability-labels text"));
};
