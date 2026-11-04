import type * as d3 from "d3";

import { Edge, GraphData, Node } from "../type";
import { lineDashArray } from "./graph-geometry";

export const unselectedOpacity = 0.35;
export const lineAndLoopOpacity = 0.6;

export const selectedNodeColor = "#14f49e3f";  // 3f is 25% opacity
export const incomingArrowColor = "#0081ff";
export const outgoingArrowColor = "#ff9900";
export const animatedNodeColor = "#FF00877f"; // 7f is 50% opacity
export const animatedArrowColor = "#FF0087";
export const selectedLoopArrowColor = "#8d61bc";

export const arrowUrl = "url(#arrow)";
export const incomingArrowUrl = "url(#incomingArrow)";
export const outgoingArrowUrl = "url(#outgoingArrow)";
export const animatedArrowUrl = "url(#animatedArrow)";
export const selectedLoopArrowUrl = "url(#selectedLoopArrow)";
export const unselectedArrowUrl = "url(#unselectedArrow)";
export const unselectedLoopArrowUrl = "url(#unselectedLoopArrow)";

// the arrowheads the graph's arrows point their marker-end at
export const arrowMarkers: { id: string, color: string, opacity?: number }[] = [
  { id: "arrow", color: "black" },
  { id: "loopArrow", color: "black" },
  { id: "animatedArrow", color: animatedArrowColor },
  { id: "incomingArrow", color: incomingArrowColor },
  { id: "outgoingArrow", color: outgoingArrowColor },
  { id: "selectedLoopArrow", color: selectedLoopArrowColor },
  { id: "unselectedArrow", color: "black", opacity: unselectedOpacity },
  { id: "unselectedLoopArrow", color: "black", opacity: unselectedOpacity / lineAndLoopOpacity },
];
export const arrowMarkerSize = 4;
export const arrowMarkerRefX = 1;
export const arrowMarkerRefY = 2;
export const arrowMarkerPath = "M 0 0 4 2 0 4 1 2 0 0";

export type GraphSelection = d3.Selection<any, unknown, any, unknown>;

export interface HighlightSelectedOptions {
  selectedNodeId?: string;
  selectedEdge?: { from: string, to: string };
  animating: boolean;
  graph: GraphData;
  // false: every state follows the chosen one, so none fades, whatever the chain's transitions
  orderMatters?: boolean;
}

const highlightSelectedEdge = (svg: GraphSelection, { from, to }: { from: string, to: string }) => {
  const ends = [from, to];

  svg
    .selectAll("g.node")
    .selectAll("ellipse")
    .style("opacity", unselectedOpacity)
    .filter((d: any) => ends.includes(d.id))
    .style("opacity", 1);

  svg
    .selectAll("line.edge")
    .style("opacity", unselectedOpacity)
    .attr("marker-end", unselectedArrowUrl)
    .filter((d: any) => d.source?.id === from && d.target?.id === to)
    .attr("stroke", outgoingArrowColor)
    .attr("marker-end", outgoingArrowUrl)
    .style("opacity", 1);

  svg
    .selectAll("path.loop")
    .style("opacity", unselectedOpacity)
    .attr("marker-end", unselectedLoopArrowUrl)
    .filter((d: any) => from === to && d.id === from)
    .attr("stroke", selectedLoopArrowColor)
    .attr("stroke-dasharray", "")
    .attr("marker-end", selectedLoopArrowUrl)
    .style("opacity", 1);

  svg
    .selectAll("g.node")
    .selectAll("text")
    .style("opacity", unselectedOpacity)
    .filter((d: any) => ends.includes(d.id))
    .style("opacity", 1);
};

export const highlightSelected = (svg: GraphSelection,
  { selectedNodeId, selectedEdge, animating, graph, orderMatters }: HighlightSelectedOptions) => {
  if (animating) {
    return;
  }
  if (selectedEdge) {
    highlightSelectedEdge(svg, selectedEdge);
    return;
  }
  if (!selectedNodeId) {
    return;
  }

  const connectedNodeIds = graph.edges
    .filter(e => e.from === selectedNodeId || e.to === selectedNodeId)
    .map(e => e.from === selectedNodeId ? e.to: e.from)
    .concat(selectedNodeId);
  const connected = (id: string) => orderMatters === false || connectedNodeIds.includes(id);

  // highlight selected node
  svg
    .selectAll("g.node")
    .selectAll("ellipse")
    .style("opacity", unselectedOpacity)
    .filter((d: any) => connected(d.id))
    .style("opacity", 1)
    .filter((d: any) => selectedNodeId === d.id)
    .attr("fill", selectedNodeColor);

  svg
    .selectAll("line.edge")
    .style("opacity", unselectedOpacity)
    .attr("marker-end", unselectedArrowUrl);

  // highlight selected incoming edges
  svg
    .selectAll("line.edge")
    .filter((d: any) => ((
      (d.value > 0) && (selectedNodeId === d.target?.id))))
    .attr("stroke", incomingArrowColor)
    .attr("marker-end", incomingArrowUrl)
    .style("opacity", 1);

  // highlight selected outgoing edges
  svg
    .selectAll("line.edge")
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
    .selectAll("g.node")
    .selectAll("text")
    .style("opacity", unselectedOpacity)
    .filter((d: any) => connected(d.id))
    .style("opacity", 1);
};

export const unhighlightNonOutput = (svg: GraphSelection,
  { highlightOutputNodes, animating }: { highlightOutputNodes?: Node[], animating: boolean }) => {
  if (animating) {
    return;
  }

  const nodeIds = highlightOutputNodes?.map(n => n.id) ?? [];
  const haveNodes = nodeIds.length > 0;

  // unhighlight non-highlighted nodes
  svg
    .selectAll("g.node")
    .selectAll("ellipse")
    .style("opacity", 1)
    .filter((d: any) => haveNodes && !nodeIds.includes(d.id))
    .style("opacity", unselectedOpacity);

  // unhighlight non-highlighted edges
  svg
    .selectAll("line")
    .style("opacity", 1)
    .filter((d: any) => ((
      (d.value > 0) && haveNodes && (!(nodeIds.includes(d.source?.id) && nodeIds.includes(d.target?.id))))))
    .style("opacity", unselectedOpacity);

  // unhighlight loops
  svg
    .selectAll("path.loop")
    .style("opacity", 1)
    .filter((d: any) => haveNodes && !nodeIds.includes(d.id))
    .style("opacity", unselectedOpacity);

  // unhighlight text
  svg
    .selectAll("g.node")
    .selectAll("text")
    .style("opacity", 1)
    .filter((d: any) => haveNodes && !nodeIds.includes(d.id))
    .style("opacity", unselectedOpacity);
};

export interface HighlightAnimationOptions {
  highlightNode?: Node;
  highlightLoopOnNode?: Node;
  highlightEdge?: Edge;
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
  highlightOutputEdges: Edge[];
}

export const highlightAnimation = (root: GraphSelection, { highlightNode, highlightLoopOnNode, highlightEdge,
  highlightAllNextNodes, highlightOutputNodes, highlightOutputEdges }: HighlightAnimationOptions) => {
  // de-highlight all nodes
  root
    .selectAll("g.node")
    .selectAll("ellipse")
    .attr("fill", "#fff");

  // highlight animated node and output nodes
  root
    .selectAll("g.node")
    .selectAll("ellipse")
    .filter((d: any) => (highlightNode?.id === d.id) || !!highlightOutputNodes?.find(n => n.id === d.id))
    .attr("fill", animatedNodeColor);

  // highlight animated edges
  root
    .selectAll("line.edge")
    .attr("stroke", "#999")
    .attr("stroke-dasharray", (d: any) => lineDashArray(d))
    .attr("marker-end", arrowUrl)
    .filter((d: any) => ((
      (d.value > 0) && (
          (highlightNode?.id === d.source?.id && highlightAllNextNodes) ||
          (highlightEdge?.from === d.source?.id && highlightEdge?.to === d.target?.id) ||
          (!!highlightOutputEdges.find(e => e.from === d.source?.id && e.to === d.target?.id))
        )
      )))
    .attr("stroke", animatedArrowColor)
    .attr("stroke-dasharray", highlightAllNextNodes ? "4" : "")
    .attr("marker-end", animatedArrowUrl);

  root
    .selectAll("path.loop")
    .attr("stroke", "#999")
    .attr("stroke-dasharray", "")
    .attr("marker-end", arrowUrl)
    .filter((d: any) => highlightLoopOnNode?.id === d.id)
    .attr("stroke", animatedArrowColor)
    .attr("stroke-dasharray", highlightAllNextNodes ? "4" : "")
    .attr("marker-end", animatedArrowUrl);
};
