import { Edge } from "../../type";

export const percentage = (n: number) => n * 100;
export const probability = (n: number) => n / 100;
export const reduceToSum = (a: number[]) => a.reduce((acc, cur) => acc + cur, 0);

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

// moving a slider thumb trades percentage between its share and the next one, so the total stays the same
export const movePairedPercentage = (exactPercentages: number[], index: number, newProbability: number) => {
  const prevExactPercentages = exactPercentages
    .slice(0, index)
    .reduce((acc, cur) => acc + cur, 0);
  const pairedPercentageSum = exactPercentages
    .slice(index, index + 2)
    .reduce((acc, cur) => acc + cur, 0);
  const newExactPercentage = Math.min(100, Math.max(0, percentage(newProbability) - prevExactPercentages));

  const newExactPercentages = [...exactPercentages];
  newExactPercentages[index] = newExactPercentage;
  newExactPercentages[index+1] = pairedPercentageSum - newExactPercentage;

  const allAboveZero = newExactPercentages.find(n => n < 0) === undefined;
  return allAboveZero ? newExactPercentages : undefined;
};
