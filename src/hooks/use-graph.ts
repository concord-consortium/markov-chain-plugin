import { useCallback, useState } from "react";
import { GraphData } from "../type";
import { graphFromValues } from "../utils/attribute-values";

export const useGraph = () => {
  const [graph, setGraph] = useState<GraphData>({nodes: [], edges: []});

  const updateGraph = useCallback((values: string[]) => {
    setGraph(graphFromValues(values));
  }, []);

  return {
    graph,
    updateGraph,
    setGraph
  };
};
