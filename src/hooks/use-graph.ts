import { useCallback, useState } from "react";
import { GraphData } from "../type";
import { graphFromValues } from "../utils/chain-graph";

export const useGraph = (initial?: GraphData) => {
  const [graph, setGraph] = useState<GraphData>(initial ?? { nodes: [], edges: [] });

  const updateGraph = useCallback((values: string[]) => {
    setGraph(graphFromValues(values));
  }, []);

  return {
    graph,
    updateGraph,
    setGraph
  };
};
