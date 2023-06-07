import { useCallback, useState } from "react";
import { Node, Edge, GraphData } from "../type";

export const useGraph = () => {
  const [graph, setGraph] = useState<GraphData>({nodes: [], edges: []});

  const updateGraph = useCallback((values: string[]) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (values.length > 0) {
      let prevNode: Node|null = null;

      values.forEach((value) => {
        if (value !== "") {
          let node = nodes.find(element => element?.label === value);
          if (!node) {
            node = {id: value, label: value, value: 0};
            nodes.push(node);
          }
          node.value++;
          if (prevNode) {
            let edge = edges.find(element => element.from === prevNode?.id &&
              element.to === node?.id);
            if (!edge) {
              edge = {
                from: prevNode.id,
                to: node.id,
                value: 0
              };
              edges.push(edge);
            }
            edge.value++;
          }
          prevNode = node;
        } else {
          prevNode = null;
        }
      });
    }

    setGraph({nodes, edges});
  }, []);

  return {
    graph,
    updateGraph,
    setGraph
  };
};
