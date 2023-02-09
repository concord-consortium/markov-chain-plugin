import { Node, Edge, GraphData } from "../type";

export type GenerateOptions = {
  lengthLimit: number;
};

export const useGenerator = () => {
  const generate = async (graph: GraphData, options: GenerateOptions) => {
    const {lengthLimit} = options;
    const generatedResult: string[] = [];

    const chooseRandomNode = () => {
      const
        sumValues = graph.nodes.reduce((iSum, iNode) => iSum + (iNode?.value ?? 0), 0),
        chosenSum = Math.random() * sumValues;
      let tSum = 0;
      return graph.nodes.find((iNode: Node) => {
        tSum += (iNode?.value ?? 0);
        return tSum >= chosenSum;
      });
    };

    const chooseRandomEdge = (iNode: Node) => {
      const edges = graph.edges.filter((iEdge: Edge) => iEdge.from === iNode?.id),
        sumEdgeValues = edges.reduce((iSum, iEdge) => iSum + (iEdge?.value ?? 0), 0),
        chosenSum = Math.random() * sumEdgeValues;
      let tSum = 0;
      return edges.find((iEdge: Edge) => {
        tSum += (iEdge?.value ?? 0);
        return tSum >= chosenSum;
      });
    };

    if (graph) {
      let currentNode = chooseRandomNode();
      while (currentNode && generatedResult.length < lengthLimit) {
        generatedResult.push(currentNode.label);
        // As a next node, choose one of the edges with a probability proportional to the edge value
        const currentEdge = chooseRandomEdge(currentNode);
        if (currentEdge?.to) {
          currentNode = graph.nodes.find((iNode: Node) => iNode?.id === currentEdge.to);
        } else {
          currentNode = null;
        }
      }
    }

    return generatedResult;
  };

  return {
    generate
  };
};
