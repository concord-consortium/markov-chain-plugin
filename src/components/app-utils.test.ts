import { clampLengthLimit, compareStateLabels, graphToRestore } from "./app-utils";

const sortLabels = (labels: unknown[]) => labels.map(label => ({ label })).sort(compareStateLabels).map(n => n.label);

describe("compareStateLabels", () => {
  it("sorts labels alphabetically, punctuation first", () => {
    expect(sortLabels(["zebra", "apple", "mango"])).toEqual(["apple", "mango", "zebra"]);
    expect(sortLabels(["i", "love", "class", "!"])).toEqual(["!", "class", "i", "love"]);
  });

  it("sorts numbers in labels numerically, and numeric labels without throwing", () => {
    expect(sortLabels(["State 10", "State 2"])).toEqual(["State 2", "State 10"]);
    expect(sortLabels([10, 2])).toEqual([2, 10]);
  });
});

describe("graphToRestore", () => {
  const initialGraph = { nodes: [{ id: "a", label: "a", value: 1 }], edges: [] };

  it("restores the loaded drawing in drawing mode", () => {
    expect(graphToRestore("drawing", initialGraph, ["x", "y"])).toBe(initialGraph);
    expect(graphToRestore("drawing", undefined, ["x", "y"])).toBeUndefined();
  });

  it("rebuilds the graph from the current values in dataset mode", () => {
    expect(graphToRestore("dataset", undefined, ["x", "y", "x"])).toEqual({
      nodes: [{ id: "x", label: "x", value: 2 }, { id: "y", label: "y", value: 1 }],
      edges: [{ from: "x", to: "y", value: 1 }, { from: "y", to: "x", value: 1 }],
    });
    expect(graphToRestore("dataset", initialGraph, undefined)).toBeUndefined();
  });
});

describe("clampLengthLimit", () => {
  it("raises values below 1 to 1 and keeps the rest", () => {
    expect(clampLengthLimit(0)).toBe(1);
    expect(clampLengthLimit(-3)).toBe(1);
    expect(clampLengthLimit(5)).toBe(5);
    expect(clampLengthLimit(undefined)).toBeUndefined();
  });
});
