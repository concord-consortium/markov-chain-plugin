import type * as d3 from "d3";

import { Edge, GraphData, Node } from "../type";
import { calculateEdges, D3Edge, D3Graph, D3Node, lineEnd } from "./graph-geometry";
import { animatedArrowColor, animatedArrowUrl, GraphSelection, lineAndLoopOpacity, outgoingArrowColor,
  outgoingArrowUrl } from "./graph-highlight";
import { BagArrow, bagArrows, bagOutgoing, chainOutgoing, Outgoing, ProbabilityLabel, probabilityLabels
} from "./graph-labels";
import { ArrowWidths, edgeWeights, nodeLoopPath, ry } from "./graph-utils";

export interface OverlayOptions {
  graph: GraphData;
  probabilityLabels?: boolean;
  arrowWidths: ArrowWidths;
  orderMatters?: boolean;
  animating: boolean;
  selectedNodeId?: string;
  highlightNode?: Node;
  highlightEdge?: Edge;
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
}

// a label and what it sits on: an arrow, or a loop's state
export type PlacedLabel = ProbabilityLabel & { edge?: D3Edge, loop?: D3Node };

type DrawnArrow = D3Edge & { kind: BagArrow["kind"] };
type DrawnLoop = { node: D3Node, kind: BagArrow["kind"], arrowWidth: number };

const arrowStyles: Record<BagArrow["kind"], { color: string, marker: string, dashes: string }> = {
  chosen: { color: outgoingArrowColor, marker: outgoingArrowUrl, dashes: "" },
  candidate: { color: animatedArrowColor, marker: animatedArrowUrl, dashes: "4" },
  step: { color: animatedArrowColor, marker: animatedArrowUrl, dashes: "" },
};

export const labelFontSize = 13;
// half the box of a label's longest text, "100%", at that size
export const labelHalfWidth = 17;
export const labelHalfHeight = 8;
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
  // to the right of the arrow, the side a two-way pair's arrows part to, by as far as the label's box reaches in that
  // direction, so the pair's boxes stay on either side of the line between them
  const offset = (labelHalfWidth * Math.abs(dy) + labelHalfHeight * Math.abs(dx)) / length;
  return {
    x: sourceX + dx * alongArrow - offset * dy / length,
    y: sourceY + dy * alongArrow + offset * dx / length,
  };
};

const placeLabels = (labels: d3.Selection<any, PlacedLabel, any, any>) => labels
  .attr("x", d => labelPoint(d).x)
  .attr("y", d => labelPoint(d).y);

const placeArrows = (arrows: d3.Selection<any, DrawnArrow, any, any>) => arrows
  .attr("x1", d => d.sourceX)
  .attr("y1", d => d.sourceY)
  .attr("x2", d => lineEnd(d).x)
  .attr("y2", d => lineEnd(d).y);

const placeLoops = (loops: d3.Selection<any, DrawnLoop, any, any>) => loops
  .attr("d", d => nodeLoopPath(d.node, d.arrowWidth));

const placedLabels = (labels: ProbabilityLabel[], edges: D3Edge[], nodes: Map<string, D3Node>) => {
  const edgeMap = new Map(edges.map(edge => [JSON.stringify([edge.source.id, edge.target.id]), edge]));
  return labels
    .map<PlacedLabel>(label => label.from === label.to
      ? { ...label, loop: nodes.get(label.from) }
      : { ...label, edge: edgeMap.get(JSON.stringify([label.from, label.to])) })
    .filter(label => label.edge || label.loop);
};

export const drawnBagArrows = (arrows: BagArrow[], outgoing: Outgoing, widths: ArrowWidths,
  nodes: Map<string, D3Node>) => {
  const weightsFrom = new Map<string, ReturnType<typeof edgeWeights>>();
  const weight = (arrow: BagArrow) => {
    const weightOf = weightsFrom.get(arrow.from) ?? edgeWeights(outgoing(arrow.from), widths);
    weightsFrom.set(arrow.from, weightOf);
    return weightOf(arrow);
  };

  const lines: DrawnArrow[] = [];
  const loops: DrawnLoop[] = [];
  arrows.forEach(arrow => {
    const source = nodes.get(arrow.from);
    const target = nodes.get(arrow.to);
    if (source && target && source === target) {
      loops.push({ node: source, kind: arrow.kind, arrowWidth: weight(arrow) });
    } else if (source && target) {
      lines.push({
        source, target, value: arrow.value, weight: weight(arrow), kind: arrow.kind,
        sourceX: 0, sourceY: 0, targetX: 0, targetY: 0,
      });
    }
  });
  calculateEdges(lines);
  return { lines, loops };
};

// the arrows have no click handlers but still catch clicks, so a click on one doesn't count as one on the background
const drawBagArrows = (root: GraphSelection, lines: DrawnArrow[], loops: DrawnLoop[]) => {
  const layer = root.insert("g", "g.node").attr("class", "bag-arrows");
  const arrows = layer
    .selectAll("line")
    .data(lines)
    .enter()
    .append("line")
    .attr("stroke", d => arrowStyles[d.kind].color)
    .attr("stroke-opacity", lineAndLoopOpacity)
    .attr("stroke-width", d => d.weight)
    .attr("stroke-dasharray", d => arrowStyles[d.kind].dashes)
    .attr("marker-end", d => arrowStyles[d.kind].marker);
  placeArrows(arrows);
  const drawnLoops = layer
    .selectAll("path")
    .data(loops)
    .enter()
    .append("path")
    .attr("stroke", d => arrowStyles[d.kind].color)
    .attr("stroke-opacity", lineAndLoopOpacity)
    .attr("fill", "none")
    .attr("stroke-width", d => d.arrowWidth)
    .attr("stroke-dasharray", d => arrowStyles[d.kind].dashes)
    .attr("marker-end", d => arrowStyles[d.kind].marker);
  placeLoops(drawnLoops);
};

const drawLabels = (root: GraphSelection, labels: PlacedLabel[]) => {
  const drawn = root
    .append("g")
    .attr("class", "probability-labels")
    .selectAll("text")
    .data(labels)
    .enter()
    .append("text")
    .attr("class", d => d.strength === "faded" ? "probability-label faded" : "probability-label")
    .attr("data-from", d => d.from)
    .attr("data-to", d => d.to)
    .attr("font-size", labelFontSize)
    .attr("text-anchor", d => d.loop ? "end" : "middle")
    .text(d => d.text);
  placeLabels(drawn);
};

// draws what the highlights put over the graph, replacing what was there; it leaves nothing unless asked for labels
// or a bag of words
export const drawOverlay = (root: GraphSelection, d3Graph: D3Graph, options: OverlayOptions) => {
  root.selectAll("g.bag-arrows, g.probability-labels").remove();

  const { graph, arrowWidths, animating, selectedNodeId, highlightNode, highlightEdge, highlightAllNextNodes,
    highlightOutputNodes } = options;
  const bag = options.orderMatters === false;
  if (!bag && !options.probabilityLabels) {
    return;
  }

  const nodes = new Map(d3Graph.nodes.map(node => [node.id, node]));
  const outgoing = bag ? bagOutgoing(graph.nodes) : chainOutgoing(graph.edges);
  const highlights = {
    outgoing, animating, selectedNodeId, highlightNode, highlightAllNextNodes, highlightOutputNodes,
  };

  let edges = d3Graph.edges;
  if (bag) {
    const { lines, loops } = drawnBagArrows(bagArrows({ ...highlights, highlightEdge }), outgoing, arrowWidths, nodes);
    drawBagArrows(root, lines, loops);
    edges = lines;
  }

  if (options.probabilityLabels) {
    drawLabels(root, placedLabels(probabilityLabels({ ...highlights, stepsOnly: bag }), edges, nodes));
  }
};

// moves what drawOverlay drew to follow its states, without rebuilding it
export const moveOverlay = (root: GraphSelection) => {
  const arrows = root.selectAll<SVGLineElement, DrawnArrow>("g.bag-arrows line");
  calculateEdges(arrows.data());
  placeArrows(arrows);
  placeLoops(root.selectAll<SVGPathElement, DrawnLoop>("g.bag-arrows path"));
  placeLabels(root.selectAll<SVGTextElement, PlacedLabel>("g.probability-labels text"));
};
