import React from "react";
import { Tool, Toolbar } from "./toolbar";
import { Graph } from "./graph";
import { Node, Edge, GraphData } from "../type";

import "./dataset.scss";

interface Props {
  highlightNode?: Node,
  highlightLoopOnNode?: Node,
  highlightEdge?: Edge,
  highlightAllNextNodes: boolean;
  graph: GraphData;
  selectedNodeId?: string;
  animating: boolean;
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
}

const tools: Tool[] = ["select","fitView","recenter","reset","home"];

export const Dataset = (props: Props) => {
  const {highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes,
    graph, setSelectedNodeId, selectedNodeId, animating} = props;

  const handleToolSelected = (tool: Tool) => {
    // TBD
  };

  return (
    <div className="dataset">
      <Toolbar tools={tools} onToolSelected={handleToolSelected} />
      <Graph
        mode="dataset"
        graph={graph}
        highlightNode={highlightNode}
        highlightLoopOnNode={highlightLoopOnNode}
        highlightEdge={highlightEdge}
        highlightAllNextNodes={highlightAllNextNodes}
        selectedNodeId={selectedNodeId}
        animating={animating}
        allowDragging={true && !animating}
        autoArrange={true}
        setSelectedNodeId={setSelectedNodeId}
      />
    </div>
  );
};
