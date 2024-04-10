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
  graphEmpty: boolean;
  fitViewAt?: number;
  recenterViewAt?: number;
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
  onReset: () => void;
  onReturnToMainMenu: () => void;
  onFitView: () => void;
  onRecenterView: () => void;
  onDimensions?: (dimensions: {width: number, height: number}) => void;
}

export const Dataset = (props: Props) => {
  const {highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes,
         graph, graphEmpty, setSelectedNodeId, selectedNodeId, animating,
         fitViewAt, recenterViewAt,
         onReset, onReturnToMainMenu, onFitView, onRecenterView} = props;

  const handleToolSelected = (tool: Tool) => {
    // TBD
  };

  if (graphEmpty) {
    return (
      <div className="dataset">
        <Toolbar
          disabled={animating}
          tools={["home"]}
          onToolSelected={handleToolSelected}
          onReset={onReset}
          onReturnToMainMenu={onReturnToMainMenu}
          onFitView={onFitView}
          onRecenterView={onRecenterView}
        />
        <div className="instructions">
          <h2>Markov Chains</h2>
          <p>
            This plugin generates sequences of text using a Markov chain. The plugin uses a Markov chain built from a
            dataset in CODAP. The dataset must have a column of states. The plugin will build a Markov chain from the
            states, and then allow generation of a sequence of text using the Markov chain.
          </p>
          <p>
            To use the plugin, first drag an attribute into the plugin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dataset">
      <Toolbar
        disabled={animating}
        tools={["select","fitView","recenter","reset","home"]}
        onToolSelected={handleToolSelected}
        onReset={onReset}
        onReturnToMainMenu={onReturnToMainMenu}
        onFitView={onFitView}
        onRecenterView={onRecenterView}
      />
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
        fitViewAt={fitViewAt}
        recenterViewAt={recenterViewAt}
      />
    </div>
  );
};
