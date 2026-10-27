import { graphSignature, stateEdgeWeights } from "./graph-utils";

describe("stateEdgeWeights", () => {
  it("compares an edge only with the other edges leaving its state", () => {
    const edges = [
      {from: "a", to: "b", value: 1}, {from: "a", to: "c", value: 1},
      {from: "b", to: "a", value: 10}, {from: "b", to: "c", value: 10},
    ];
    const weight = stateEdgeWeights(edges);
    expect(new Set(edges.map(weight)).size).toBe(1);
  });

  it("scales from 2 to 4.5 by probability, loops included", () => {
    const weight = stateEdgeWeights([{from: "a", to: "b", value: 1}, {from: "a", to: "a", value: 3}]);
    expect(weight({from: "a", to: "b", value: 1})).toBeCloseTo(2.625);
    expect(weight({from: "a", to: "a", value: 3})).toBeCloseTo(3.875);
    expect(stateEdgeWeights([{from: "a", to: "b", value: 5}])({from: "a", to: "b", value: 5})).toBe(4.5);
  });

  it("leaves other states' widths alone when one state's values change", () => {
    const before = [{from: "a", to: "b", value: 1}, {from: "b", to: "a", value: 1}, {from: "b", to: "c", value: 3}];
    const after = [{from: "a", to: "b", value: 100}, ...before.slice(1)];
    expect(after.slice(1).map(stateEdgeWeights(after))).toEqual(before.slice(1).map(stateEdgeWeights(before)));
  });

  it("draws a state with no outgoing value at the minimum width", () => {
    expect(stateEdgeWeights([{from: "a", to: "b", value: 0}])({from: "a", to: "b", value: 0})).toBe(2);
  });
});

describe("graphSignature", () => {
  it("changes when only a node's loop width changes", () => {
    const node = {id: "a", label: "a", weight: 1, radius: 30, x: 0, y: 0, loopWeight: 0};
    expect(graphSignature({nodes: [node], edges: []}))
      .not.toEqual(graphSignature({nodes: [{...node, loopWeight: 4.5}], edges: []}));
  });
});
