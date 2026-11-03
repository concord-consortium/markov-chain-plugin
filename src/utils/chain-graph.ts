import { Edge, GraphData, Node } from "../type";

// Counts each label as a state and each pair of neighbors in a chain as a transition, in the order they first
// appear. Maps rather than plain objects, so a label like "constructor" can't find an inherited property.
export const chainsToGraph = (chains: string[][]): GraphData => {
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();

  chains.forEach(chain => chain.forEach((label, index) => {
    const node = nodes.get(label) ?? { id: label, label, value: 0 };
    node.value++;
    nodes.set(label, node);

    if (index > 0) {
      const from = chain[index - 1];
      const key = JSON.stringify([from, label]);
      const edge = edges.get(key) ?? { from, to: label, value: 0 };
      edge.value++;
      edges.set(key, edge);
    }
  }));

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
};

// a dataset's values as chains: an empty value breaks the chain, like an empty cell
export const graphFromValues = (values: string[]): GraphData => {
  const chains: string[][] = [[]];
  values.forEach(value => value === "" ? chains.push([]) : chains[chains.length - 1].push(value));
  return chainsToGraph(chains);
};
