import { Edge } from "../../type";

// percentages run from 0 to 100, one per edge leaving the state, in edge order
export const applyStatePercentages = (edges: Edge[], nodeId: string, sum: number, percentages: number[]) => {
  let valueIndex = 0;
  return edges.map(edge => {
    if (edge.from === nodeId) {
      const value = sum * percentages[valueIndex++] / 100;
      return { ...edge, value };
    } else {
      return edge;
    }
  });
};
