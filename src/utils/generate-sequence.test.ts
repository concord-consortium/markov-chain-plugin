import { generateSequence } from "./generate-sequence";

const state = (id: string, value = 1) => ({ id, label: id, value });
const ids = (sequence: {id: string}[]) => sequence.map(s => s.id);

describe("generateSequence", () => {
  afterEach(() => jest.restoreAllMocks());

  const a = state("a"), b = state("b", 3), c = state("c");
  // a goes to b with value 1 and to c with value 3; b goes back to a; c has no way out
  const graph = {
    nodes: [a, b, c],
    edges: [{ from: "a", to: "b", value: 1 }, { from: "a", to: "c", value: 3 }, { from: "b", to: "a", value: 1 }]
  };

  it("chooses each next state in proportion to the transitions' values", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.2);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 3 }))).toEqual(["a", "b", "a"]);
    jest.spyOn(Math, "random").mockReturnValue(0.3);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 3 }))).toEqual(["a", "c"]);
  });

  it("chooses the first state in proportion to the states' values when none is given", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.19);
    expect(ids(await generateSequence(graph, { lengthLimit: 1 }))).toEqual(["a"]);
    jest.spyOn(Math, "random").mockReturnValue(0.21);
    expect(ids(await generateSequence(graph, { lengthLimit: 1 }))).toEqual(["b"]);
    jest.spyOn(Math, "random").mockReturnValue(0.81);
    expect(ids(await generateSequence(graph, { lengthLimit: 1 }))).toEqual(["c"]);
  });

  it("stops at a state with no way out, before the length limit", async () => {
    expect(ids(await generateSequence(graph, { startingNode: c, lengthLimit: 5 }))).toEqual(["c"]);
  });

  it("never goes past the length limit", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.2);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 5 }))).toEqual(["a", "b", "a", "b", "a"]);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 1 }))).toEqual(["a"]);
    expect(await generateSequence(graph, { startingNode: a, lengthLimit: 0 })).toEqual([]);
  });

  it("gives an empty sequence for an empty graph", async () => {
    expect(await generateSequence({ nodes: [], edges: [] }, { lengthLimit: 5 })).toEqual([]);
  });

  it("never follows a transition with value 0, and follows a self-loop", async () => {
    const zero = {
      nodes: [a, b, c],
      edges: [{ from: "a", to: "b", value: 0 }, { from: "a", to: "a", value: 1 }]
    };
    jest.spyOn(Math, "random").mockReturnValue(1e-9);
    expect(ids(await generateSequence(zero, { startingNode: a, lengthLimit: 3 }))).toEqual(["a", "a", "a"]);
  });
});
