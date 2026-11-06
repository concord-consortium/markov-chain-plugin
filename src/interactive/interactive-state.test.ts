import { copyState, MarkovInteractiveState, readInteractiveState, statesKey } from "./interactive-state";
import { maxDelimiterLength } from "./saved-outputs";
import { inspectColumns } from "./workspace/inspect-rows";

const deepFreeze = <T, >(value: T): T => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const savedMode = {
  panes: { input: true, graph: false, inspect: true, generator: false },
  controlsOpen: false,
  sizes: { input: 300, inspect: 240, top: 280 },
  inspect: {
    tab: "transitions",
    sorts: { states: { column: "count", ascending: false }, transitions: { column: "probability", ascending: true } },
  },
  generator: { startingState: "the", lengthLimit: 7, delimiter: "-", delimiterType: "other", fast: true },
  outputs: { states: ["the"], groups: [{ delimiter: " ", lengthLimit: 5, startingState: "", sequences: [[0]] }] },
  selection: { kind: "transition", from: "the", to: "cat" },
  view: { x: 10, y: -4, k: 1.5 },
};

const fullState = {
  version: 1,
  input: { text: "the cat" },
  mode: "draw",
  probabilities: true,
  orderMatters: false,
  caseSensitive: true,
  useData: { ...savedMode, inputSplit: 0.3, positions: [1, 2, 3, 4], positionsKey: "abc" },
  draw: {
    ...savedMode,
    selection: { kind: "output", group: 0, sequence: 0 },
    drawing: {
      nodes: [{ id: "a", label: "A", value: 1, x: 5, y: 6 }, { id: "b", label: "B", value: 1 }],
      edges: [{ from: "a", to: "b", value: 2 }],
    },
  },
};

const fieldAt = (path: string[]) => {
  const state = copyState(fullState) as Record<string, any>;
  const parent = path.slice(0, -1).reduce((at, key) => at[key], state);
  return { state, parent, key: path[path.length - 1] };
};

const withField = (path: string[], value: unknown) => {
  const { state, parent, key } = fieldAt(path);
  parent[key] = value;
  return state;
};

const withoutField = (path: string[]) => {
  const { state, parent, key } = fieldAt(path);
  delete parent[key];
  return state;
};

describe("statesKey", () => {
  it("is the same for the same states in the same order, and differs otherwise", () => {
    expect(statesKey(["a", "b"])).toBe(statesKey(["a", "b"]));
    expect(statesKey(["a", "b"])).not.toBe(statesKey(["b", "a"]));
    expect(statesKey(["a", "b"])).not.toBe(statesKey(["a", "c"]));
    expect(statesKey(["a b"])).not.toBe(statesKey(["a", "b"]));
    expect(statesKey(["Aa"])).not.toBe(statesKey(["BB"]));
  });
});

describe("readInteractiveState", () => {
  it("reads nothing, and a string that doesn't parse, as the version alone", () => {
    [null, undefined, {}, { version: 1 }, "{not json", 3, []].forEach(raw => {
      expect(readInteractiveState(raw)).toEqual({ version: 1 });
    });
  });

  it("reads a state holding only the input text", () => {
    const saved = { version: 1, input: { text: "the cat" } };
    expect(readInteractiveState(saved)).toEqual(saved);
    expect(readInteractiveState({ version: 1, input: { text: "" } })).toEqual({ version: 1, input: { text: "" } });
  });

  it("reads a full state back unchanged, from an object or a JSON string", () => {
    expect(readInteractiveState(fullState)).toEqual(fullState);
    expect(readInteractiveState(JSON.stringify(fullState))).toEqual(fullState);
  });

  it("gives back a copy the workspace can edit, from a state the library froze", () => {
    const state = readInteractiveState(deepFreeze(JSON.parse(JSON.stringify(fullState)))) as MarkovInteractiveState;
    expect(Object.isFrozen(state)).toBe(false);
    expect(Object.isFrozen(state.draw?.drawing?.nodes[0])).toBe(false);
    expect(Object.isFrozen(state.useData?.positions)).toBe(false);
  });

  it("keeps fields it doesn't know, at the top level and in each mode", () => {
    const state = { ...fullState, later: 1, useData: { ...fullState.useData, later: 2 },
      draw: { ...fullState.draw, later: 3 } };
    expect(readInteractiveState(state)).toEqual(state);
  });

  it.each<[string[], unknown]>([
    [["input"], "the cat"],
    [["input"], { text: 3 }],
    [["mode"], "paint"],
    [["probabilities"], "yes"],
    [["orderMatters"], 1],
    [["caseSensitive"], null],
    [["useData"], "data"],
    [["draw"], []],
    [["useData", "inputSplit"], "half"],
    [["useData", "positions"], "1,2"],
    [["useData", "positions"], [1, 2, 3]],
    [["useData", "positions"], [1, "2"]],
    [["useData", "positions"], [1, null]],
    [["useData", "positionsKey"], 3],
    [["useData", "panes"], true],
    [["useData", "panes", "input"], "open"],
    [["useData", "panes", "graph"], "open"],
    [["useData", "panes", "inspect"], 1],
    [["draw", "panes", "generator"], 1],
    [["useData", "controlsOpen"], "no"],
    [["useData", "sizes"], 300],
    [["useData", "sizes", "input"], "wide"],
    [["useData", "sizes", "inspect"], "wide"],
    [["draw", "sizes", "top"], null],
    [["useData", "inspect"], "states"],
    [["useData", "inspect", "tab"], "words"],
    [["useData", "inspect", "sorts"], []],
    [["useData", "inspect", "sorts", "states"], { column: "probability", ascending: true }],
    [["useData", "inspect", "sorts", "states"], { column: "state", ascending: "up" }],
    [["draw", "inspect", "sorts", "transitions"], { column: "state", ascending: true }],
    [["useData", "generator"], "go"],
    [["useData", "generator", "startingState"], 3],
    [["useData", "generator", "lengthLimit"], "7"],
    [["useData", "generator", "delimiter"], null],
    [["useData", "generator", "delimiter"], "-".repeat(maxDelimiterLength + 1)],
    [["useData", "generator", "delimiterType"], "comma"],
    [["draw", "generator", "fast"], "fast"],
    [["useData", "outputs"], []],
    [["useData", "outputs"], { states: "the", groups: [] }],
    [["draw", "outputs"], { states: [], groups: {} }],
    [["useData", "selection"], "the"],
    [["useData", "selection"], { kind: "state", id: 3 }],
    [["useData", "selection"], { kind: "transition", from: "the" }],
    [["useData", "selection"], { kind: "transition", from: 3, to: "cat" }],
    [["useData", "selection"], { kind: "output", group: 0, sequence: "0" }],
    [["useData", "selection"], { kind: "output", group: "0", sequence: 0 }],
    [["useData", "selection"], { kind: "word", id: "the" }],
    [["useData", "view"], "zoomed"],
    [["useData", "view"], { x: 1, y: 2 }],
    [["useData", "view"], { x: "1", y: 2, k: 1 }],
    [["useData", "view"], { x: 1, y: "2", k: 1 }],
    [["draw", "view"], { x: 1, y: 2, k: 0 }],
    [["draw", "view"], { x: 1, y: 2, k: -1 }],
    [["draw", "drawing"], "a drawing"],
    [["draw", "drawing"], { nodes: [] }],
    [["draw", "drawing"], { nodes: {}, edges: [] }],
  ])("drops %j when it is %j, and keeps the rest", (path, value) => {
    expect(readInteractiveState(withField(path, value))).toEqual(withoutField(path));
  });

  it.each<[string[], unknown]>([
    [["mode"], "useData"],
    [["mode"], "draw"],
    [["useData", "selection"], { kind: "state", id: "the" }],
    [["useData", "selection"], { kind: "transition", from: "the", to: "cat" }],
    [["useData", "selection"], { kind: "output", group: 1, sequence: 2 }],
    [["useData", "inspect", "tab"], "states"],
    [["useData", "inspect", "tab"], "transitions"],
    [["useData", "generator", "delimiter"], "-".repeat(maxDelimiterLength)],
    [["useData", "generator", "delimiterType"], "none"],
    [["useData", "generator", "delimiterType"], "space"],
    [["useData", "generator", "delimiterType"], "other"],
    ...(["states", "transitions"] as const).flatMap(tab => inspectColumns("useData")[tab].map(
      (column): [string[], unknown] => [["useData", "inspect", "sorts", tab], { column, ascending: false }])),
  ])("keeps %j as %j", (path, value) => {
    const state = withField(path, value);
    expect(readInteractiveState(state)).toEqual(state);
  });

  it("reads any version as this one", () => {
    expect(readInteractiveState({ version: "2" })).toEqual({ version: 1 });
  });

  it("drops a drawing's bad states, and with them their arrows", () => {
    const good = { id: "a", label: "A", value: 1 };
    const state = withField(["draw", "drawing"], {
      nodes: [
        good, { id: 2, label: "B", value: 1 }, { id: "c", value: 1 }, { id: "d", label: "D" },
        { id: "e", label: "E", value: 1, x: "1" }, { id: "f", label: "F", value: 1, y: null }, "g",
      ],
      edges: [
        { from: "a", to: "a", value: 1 }, { from: "a", to: "c", value: 1 }, { from: "c", to: "a", value: 1 },
        { from: "a", to: "a", value: "1" }, "h",
      ],
    });
    expect(readInteractiveState(state).draw?.drawing).toEqual({
      nodes: [good], edges: [{ from: "a", to: "a", value: 1 }],
    });
  });
});
