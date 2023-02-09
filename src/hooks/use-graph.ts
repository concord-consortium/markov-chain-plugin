import { useCallback, useState } from "react";
import { Node, Edge, GraphData } from "../type";

export const useGraph = () => {
  const [graph, setGraph] = useState<GraphData>({nodes: [], edges: []});

  const updateGraph = useCallback((values: string[]) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    if (values.length > 0) {
      let prevState: Node = null,
        maxEdgeValue = 0;

      values.forEach((iState) => {
        if (iState !== "") {
          let theState = nodes.find(element => element?.label === iState);
          if (!theState) {
            const fixedValue = false; // nodes.length === 1
            theState = {id: iState, label: iState, value: 0, fixed: fixedValue};
            nodes.push(theState);
          }
          theState.value++;
          theState.title = `(${theState.value})`;
          if (prevState) {
            let theEdge = edges.find(element => element.from === prevState?.id &&
              element.to === theState?.id);
            if (!theEdge) {
              theEdge = {
                from: prevState.id, to: theState.id, value: 0,
                label: iState.length === 2 && (iState.includes("R") || iState.includes("P") || iState.includes("S")) ?
                  iState.charAt(1) : undefined
              };
              edges.push(theEdge);
            }
            theEdge.value++;
            maxEdgeValue = Math.max(maxEdgeValue, theEdge.value);
          }
          prevState = theState;
        } else {
          prevState = null;
        }
      });
    }
    setGraph({nodes, edges});
  }, []);

  return {
    graph,
    updateGraph
  };
};
