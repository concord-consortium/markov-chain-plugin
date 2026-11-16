import { Edge, GraphData, Node } from "../type";

export type Outgoing = (id: string) => Edge[];
export interface ProbabilityLabel { from: string, to: string, text: string, strength: "full" | "faded" }
export interface LabelState {
  outgoing: Outgoing;
  animating: boolean;
  selectedNodeId?: string;
  highlightNode?: Node;
  // a generating step's chosen transition
  highlightEdge?: Edge;
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
  // leaves out a chosen output's faded labels
  stepsOnly?: boolean;
}

// a share as Inspect and the graph show it: a whole percent
export const percentOf = (value: number, total: number) => total > 0 ? Math.round(100 * value / total) : 0;

// a Markov chain's arrows leaving a state, loops included
export const chainOutgoing = (edges: Edge[]): Outgoing => id => edges.filter(e => e.from === id);

// a bag of words' arrows leaving a state: one to every state, itself included, weighted by that state's count; none
// from a state the graph doesn't have, such as a chosen output's state the input no longer holds
export const bagOutgoing = (nodes: Node[]): Outgoing => id => nodes.some(n => n.id === id)
  ? nodes.map(n => ({ from: id, to: n.id, value: n.value }))
  : [];

const labelsFrom = (outgoing: Outgoing, id: string, strength: (to: string) => ProbabilityLabel["strength"],
  labeled: (edge: Edge) => boolean = () => true) => {
  const edges = outgoing(id);
  const total = edges.reduce((sum, e) => sum + e.value, 0);
  return edges.filter(labeled)
    .map(e => ({ from: id, to: e.to, text: `${percentOf(e.value, total)}%`, strength: strength(e.to) }));
};

// the candidates of a generating step, or the one it chose; else a chosen output's path; else a chosen state's arrows
export const probabilityLabels = (s: LabelState): ProbabilityLabel[] => {
  if (s.animating) {
    const chosen = s.highlightEdge;
    if (s.highlightNode && s.highlightAllNextNodes) {
      // an arrow of no value can't be taken, so it isn't a candidate
      return labelsFrom(s.outgoing, s.highlightNode.id, () => "full", e => e.value > 0);
    }
    return chosen ? labelsFrom(s.outgoing, chosen.from, () => "full", e => e.to === chosen.to) : [];
  }
  const path = s.highlightOutputNodes;
  if (path && path.length > 0) {
    const steps = new Set(path.slice(1).map((n, i) => JSON.stringify([path[i].id, n.id])));
    const from = [...new Set(path.slice(0, -1).map(n => n.id))];
    const labels = from.flatMap(id =>
      labelsFrom(s.outgoing, id, to => steps.has(JSON.stringify([id, to])) ? "full" : "faded"));
    return s.stepsOnly ? labels.filter(label => label.strength === "full") : labels;
  }
  return s.selectedNodeId ? labelsFrom(s.outgoing, s.selectedNodeId, () => "full") : [];
};

// the arrows leaving a state in a graph as it's drawn: the chain's, or with order off a bag of words'
export const outgoingFor = (graph: GraphData, orderMatters?: boolean): Outgoing =>
  orderMatters === false ? bagOutgoing(graph.nodes) : chainOutgoing(graph.edges);

// the labels a graph draws, where a bag of words labels only a chosen output's steps
export const graphLabels = (graph: GraphData, orderMatters: boolean | undefined,
  highlights: Omit<LabelState, "outgoing" | "stepsOnly">) => probabilityLabels({
  ...highlights, outgoing: outgoingFor(graph, orderMatters), stepsOnly: orderMatters === false,
});

export type BagArrow = Edge & { kind: "chosen" | "candidate" | "step" };

// the only arrows a bag of words draws: a generating step's, a chosen output's steps, or a chosen state's
export const bagArrows = (s: Omit<LabelState, "stepsOnly">): BagArrow[] => {
  const leaving = (id: string, kind: BagArrow["kind"]) => s.outgoing(id).map(e => ({ ...e, kind }));
  const step = ({ from, to }: { from: string, to: string }) => leaving(from, "step").filter(e => e.to === to);

  if (s.animating) {
    return [
      ...(s.highlightNode && s.highlightAllNextNodes ? leaving(s.highlightNode.id, "candidate") : []),
      ...(s.highlightEdge ? step(s.highlightEdge) : []),
    ];
  }
  const path = s.highlightOutputNodes;
  if (path && path.length > 0) {
    const steps = new Map(path.slice(1).map((n, i) =>
      [JSON.stringify([path[i].id, n.id]), { from: path[i].id, to: n.id }]));
    return [...steps.values()].flatMap(step);
  }
  return s.selectedNodeId ? leaving(s.selectedNodeId, "chosen") : [];
};
