import { GraphData } from "../type";
import { chainKey, graphFromValues } from "./chain-graph";
import {
  applyStatePercentages, movePairedPercentage, percentage, reduceToSum
} from "../components/drawing/state-editor";
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

describe("chainKey", () => {
  // a state with arrows to each of the given values, as a drawing holds it
  const fanOut = (values: number[]): GraphData => ({
    nodes: [{ id: "s", label: "s", value: 1, x: 0, y: 0 },
      ...values.map((_, i) => ({ id: `t${i}`, label: `t${i}`, value: 1, x: i, y: 0 }))],
    edges: values.map((value, i) => ({ from: "s", to: `t${i}`, value })),
  });
  // the shares the state editor holds, the last one making up 100
  const shares = (percentages: number[]) =>
    [...percentages.slice(0, -1), 100 - reduceToSum(percentages.slice(0, -1))];
  // the state editor's Save with the shares it opened with, or with one thumb moved
  const saved = (graph: GraphData, move?: { index: number, probability: number }) => {
    const values = graph.edges.filter(e => e.from === "s").map(e => e.value);
    const sum = reduceToSum(values);
    const opened = shares(values.map(value => percentage(value / sum)));
    const moved = move ? movePairedPercentage(opened, move.index, move.probability) : opened;
    if (!moved) {
      throw new Error("the thumb can't move there");
    }
    return { ...graph, edges: applyStatePercentages(graph.edges, "s", sum, shares(moved)) };
  };

  it("is the same for the same values built twice", () => {
    expect(chainKey(graphFromValues(["a", "b", "a"]))).toBe(chainKey(graphFromValues(["a", "b", "a"])));
  });

  it("is the same with the states and transitions in another order, or a state moved", () => {
    const graph = fanOut([1, 2]);
    const reordered = { nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() };
    const moved = { ...graph, nodes: graph.nodes.map(n => n.id === "s" ? { ...n, x: 50, y: -20 } : n) };
    expect(chainKey(reordered)).toBe(chainKey(graph));
    expect(chainKey(moved)).toBe(chainKey(graph));
  });

  it.each([[[1, 1, 1]], [[1, 2]]])("is the same after the state editor saves %j unchanged", values => {
    const graph = fanOut(values);
    const after = saved(graph);
    expect(after.edges.map(e => e.value)).not.toEqual(values);
    expect(chainKey(after)).toBe(chainKey(graph));
  });

  it("is the same after a share taken to nothing is saved again unchanged", () => {
    const zeroed = saved(fanOut([1, 1, 1]), { index: 1, probability: 1 });
    expect(zeroed.edges.map(e => e.value)[2]).toBe(0);
    const again = saved(zeroed);
    expect(again.edges.map(e => e.value)[2]).not.toBe(0);
    expect(chainKey(again)).toBe(chainKey(zeroed));
  });

  it("differs for a changed label, a state's count, a transition's value or an added transition", () => {
    const graph = fanOut([1, 2]);
    const key = chainKey(graph);
    const changed: GraphData[] = [
      { ...graph, nodes: graph.nodes.map(n => n.id === "t0" ? { ...n, label: "u" } : n) },
      { ...graph, nodes: graph.nodes.map(n => n.id === "s" ? { ...n, value: 2 } : n) },
      { ...graph, edges: graph.edges.map(e => e.to === "t0" ? { ...e, value: 3 } : e) },
      { ...graph, edges: [...graph.edges, { from: "t0", to: "t1", value: 1 }] },
    ];
    changed.forEach(other => expect(chainKey(other)).not.toBe(key));
  });
});
