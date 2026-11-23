import { Edge, GraphData, Node } from "../type";
import { shortHash } from "./short-hash";

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

// a state editor's Save rebuilds arrow values through percentages, which can move them in the last bit or leave a
// tiny value where 0 was
const keyValue = (value: number) => +value.toFixed(9);

// The chain a graph holds, as a short key: its states and transitions in any order, without the states' positions,
// which a drawing changes when it is rearranged
export const chainKey = ({ nodes, edges }: GraphData) => shortHash(JSON.stringify([
  nodes.map(({ id, label, value }) => JSON.stringify([id, label, keyValue(value)])).sort(),
  edges.map(({ from, to, value }) => JSON.stringify([from, to, keyValue(value)])).sort(),
]));
