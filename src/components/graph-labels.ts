import { Edge, Node } from "../type";

export type Outgoing = (id: string) => Edge[];
export interface ProbabilityLabel { from: string, to: string, text: string, strength: "full" | "faded" }
export interface LabelState {
  outgoing: Outgoing;
  animating: boolean;
  selectedNodeId?: string;
  highlightNode?: Node;
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
  // a chosen output labels only its steps, as the bag of words does
  stepsOnly?: boolean;
}

// a share as Inspect and the graph show it: a whole percent
export const percentOf = (value: number, total: number) => total > 0 ? Math.round(100 * value / total) : 0;

// a Markov chain's arrows leaving a state, loops included
export const chainOutgoing = (edges: Edge[]): Outgoing => id => edges.filter(e => e.from === id);

const labelsFrom = (outgoing: Outgoing, id: string, strength: (to: string) => ProbabilityLabel["strength"]) => {
  const edges = outgoing(id);
  const total = edges.reduce((sum, e) => sum + e.value, 0);
  return edges.map(e => ({ from: id, to: e.to, text: `${percentOf(e.value, total)}%`, strength: strength(e.to) }));
};

// the candidates of a generating step; else a chosen output's path; else a chosen state's arrows
export const probabilityLabels = (s: LabelState): ProbabilityLabel[] => {
  if (s.animating) {
    return s.highlightNode && s.highlightAllNextNodes ? labelsFrom(s.outgoing, s.highlightNode.id, () => "full") : [];
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
