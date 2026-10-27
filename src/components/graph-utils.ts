import { Edge } from "../type";

export type GraphSettings = {
  minRadius: number;
  maxRadius: number;
  minStroke: number;
  maxStroke: number;
  marginFactor: number;
  minFontSize: number;
};

export const settings: GraphSettings = {
  minRadius: 25,
  maxRadius: 75,
  minStroke: 2,
  maxStroke: 4.5,
  marginFactor: 0.8,
  minFontSize: 10,
};

export const ry = (radius: number) => radius / 2;

// an edge's width shows its probability among the edges leaving its own state, loops included
export const stateEdgeWeights = (edges: Edge[]) => {
  const stateTotals = new Map<string, number>();
  edges.forEach(edge => stateTotals.set(edge.from, (stateTotals.get(edge.from) ?? 0) + edge.value));

  const {minStroke, maxStroke} = settings;
  return (edge: Edge) => {
    const total = stateTotals.get(edge.from) ?? 0;
    return total > 0 ? minStroke + ((maxStroke - minStroke) * (edge.value / total)) : minStroke;
  };
};

type SignatureGraph = {
  nodes: {id: string, label: string, weight: number, radius: number, x: number, y: number, loopWeight: number}[];
  edges: {source: {id: string}, target: {id: string}, weight: number}[];
};

// loops are drawn from their nodes, not from the edge list, so a loop's width is part of its node's signature
export const graphSignature = (graph: SignatureGraph) => {
  const nodeSignature = graph.nodes.map(n =>
    `${n.id}/${n.label}/${n.weight}/${n.radius}/${n.x}/${n.y}/${n.loopWeight}`);
  const edgeSignature = graph.edges.map(e => `${e.source.id}/${e.target.id}/${e.weight}`);
  return `${nodeSignature}::${edgeSignature}`;
};
