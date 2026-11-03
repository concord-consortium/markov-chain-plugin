import { Selection } from "../../components/host";
import { Token } from "../input/tokenizer";

export type HighlightKind = "selected" | "output";
export type TransitionHighlight = "in" | "out" | "chosen" | "output";

// what a selection lights up outside the graph
export interface Highlights {
  kind?: HighlightKind;
  // word token indexes, for table rows and the text box
  tokens: Set<number>;
  // Inspect States rows
  states: Set<string>;
  // Inspect Transitions rows, keyed by transitionKey
  transitions: Map<string, TransitionHighlight>;
}

export const transitionKey = (from: string, to: string) => `${from}\u0000${to}`;

// each pair of word tokens with no break between them, by their indexes
const steps = (tokens: Token[]) => tokens.flatMap((token, i) => {
  const next = tokens[i + 1];
  return token.kind === "word" && next?.kind === "word" ? [{ i, j: i + 1, from: token.state, to: next.state }] : [];
});

const wordsIn = (tokens: Token[], states: Set<string>) =>
  new Set(tokens.flatMap((token, i) => token.kind === "word" && states.has(token.state) ? [i] : []));

export const highlightsFor = (selection: Selection, tokens: Token[]): Highlights => {
  const transitions = new Map<string, TransitionHighlight>();
  if (!selection) {
    return { tokens: new Set(), states: new Set(), transitions };
  }

  if (selection.kind === "state") {
    const { id } = selection;
    steps(tokens).forEach(({ from, to }) => {
      if (from === id) {
        transitions.set(transitionKey(from, to), "out");
      } else if (to === id) {
        transitions.set(transitionKey(from, to), "in");
      }
    });
    const chosen = new Set([id]);
    return { kind: "selected", tokens: wordsIn(tokens, chosen), states: chosen, transitions };
  }

  if (selection.kind === "transition") {
    const { from, to } = selection;
    const lit = new Set<number>();
    steps(tokens).forEach(step => {
      if (step.from === from && step.to === to) {
        lit.add(step.i);
        lit.add(step.j);
      }
    });
    transitions.set(transitionKey(from, to), "chosen");
    return { kind: "selected", tokens: lit, states: new Set([from, to]), transitions };
  }

  const states = new Set(selection.sequence.map(node => node.id));
  selection.sequence.slice(1).forEach((node, i) =>
    transitions.set(transitionKey(selection.sequence[i].id, node.id), "output"));
  return { kind: "output", tokens: wordsIn(tokens, states), states, transitions };
};
