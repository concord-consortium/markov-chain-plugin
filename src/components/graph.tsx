import React from "react";
import GraphVis from "react-graph-vis";
import { GraphData } from "../type";

type Props = {
  graph: GraphData
};

const options = {
  autoResize: true,
  interaction: {
    navigationButtons: true,
    hover: true,
    hoverConnectedEdges: true,
    zoomSpeed: 0.2
  },
  nodes: {
    scaling: {
      min: 5, max: 10,
      label: {
        enabled: true,
        min: 10,
        max: 20
      }
    },
  },
  layout: {
    hierarchical: false,
  },
  edges: {
    color: "#000000",
    scaling: {max: 5},
    smooth: true
  },
  /*
        manipulation: {
          enabled: true,
          initiallyActive: true,
        },
  */
  height: "100%",
  width: "100%"
};

const events = {
  select: (event: any) => {
    // const {nodes, edges} = event;
    debugger;
  }
};

export const Graph = ({graph}: Props) => {
  return (
    <GraphVis
      graph={graph}
      options={options}
      events={events}
    />
  );
};
