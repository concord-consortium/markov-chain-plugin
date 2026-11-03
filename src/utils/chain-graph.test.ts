import { graphFromValues } from "./chain-graph";
import { wordsToGraph } from "./text-to-graph";

const labels = (graph: { nodes: { label: string }[] }) => graph.nodes.map(n => n.label);
const transitions = (graph: { edges: { from: string, to: string, value: number }[] }) =>
  graph.edges.map(e => [e.from, e.to, e.value]);

describe("chainsToGraph through wordsToGraph and graphFromValues", () => {
  it("puts array-index words first in numeric order in wordsToGraph", () => {
    expect(labels(wordsToGraph(["b", "2", "a", "1", "b"]))).toEqual(["1", "2", "b", "a"]);
  });

  it("keeps first-appearance order in graphFromValues", () => {
    expect(labels(graphFromValues(["b", "2", "a", "1", "b"]))).toEqual(["b", "2", "a", "1"]);
  });

  it("breaks graphFromValues' chain at an empty value", () => {
    const graph = graphFromValues(["a", "b", "", "c", "a"]);
    expect(transitions(graph)).toEqual([["a", "b", 1], ["c", "a", 1]]);
  });

  it("counts words and values named like Object.prototype properties", () => {
    const expected = [
      { id: "constructor", label: "constructor", value: 2 },
      { id: "toString", label: "toString", value: 1 },
    ];
    expect(wordsToGraph(["constructor", "toString", "constructor"]).nodes).toEqual(expected);
    expect(graphFromValues(["constructor", "toString", "constructor"]).nodes).toEqual(expected);
  });

  it("keeps transitions apart when a value contains a bar", () => {
    const graph = graphFromValues(["a|b", "c", "", "a", "b|c"]);
    expect(transitions(graph)).toEqual([["a|b", "c", 1], ["a", "b|c", 1]]);
  });
});
