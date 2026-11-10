import { Node } from "../../type";
import { defaultAuthoredState, MarkovAuthoredState, readAuthoredState } from "../authored-state";
import { MarkovInteractiveState, SavedMode, statesKey } from "../interactive-state";
import { encodeOutputs } from "../saved-outputs";
import { defaultInputSplit, defaultPaneSizes, maxRowHeight, minPaneSizes } from "./pane-sizes";
import { restoreWork } from "./restore-work";
import { workspaceConfig } from "./workspace-config";

const restore = (saved: Partial<MarkovInteractiveState>, authored: unknown = {}, readOnly = false) => {
  const authoredState: MarkovAuthoredState = readAuthoredState(authored);
  const configs = { useData: workspaceConfig(authoredState, "useData"), draw: workspaceConfig(authoredState, "draw") };
  return restoreWork({ version: 1, ...saved }, authoredState, configs, { readOnly });
};

const panesOff = (id: "input" | "inspect" | "generator" | "graph") =>
  ({ panes: { ...defaultAuthoredState.panes, [id]: { available: false, startsOpen: true } } });

const dataOnly = { modes: { useData: true, draw: false } };
const drawOnly = { modes: { useData: false, draw: true } };

const node = (id: string): Node => ({ id, label: id, value: 0 });
const outputs = (...sequences: string[][]) => encodeOutputs([{
  delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined,
  sequences: sequences.map(sequence => sequence.map(node)),
}]);

const xy = (nodes: Node[] | undefined) => nodes?.map(({ x, y }) => [x, y]);

describe("restoreWork's count of tables saved", () => {
  it("starts at 0 with nothing saved", () => {
    const work = restore({});
    expect(work.useData.tablesSaved).toBe(0);
    expect(work.draw.tablesSaved).toBe(0);
  });

  it("gives each mode its own count", () => {
    const work = restore({ useData: { tablesSaved: 2 }, draw: { tablesSaved: 5 } });
    expect(work.useData.tablesSaved).toBe(2);
    expect(work.draw.tablesSaved).toBe(5);
  });
});

describe("restoreWork with nothing saved", () => {
  it("gives the workspace as authored", () => {
    const work = restore({}, {
      startingMode: "draw", startingText: "the cat", inputView: "text", capitalization: "asTyped",
      orderMatters: { startsOn: false, showSwitch: true },
      buttons: { probabilities: { available: true, startsOn: true } },
      panes: { inspect: { available: true, startsOpen: false } },
    });
    expect(work).toMatchObject({
      mode: "draw", probabilities: true, orderMatters: false, capitalization: "asTyped", text: "the cat",
      inputSplit: defaultInputSplit,
    });
    expect(work.useData.tool.values).toEqual(["the", "cat"]);
    expect(work.useData.tool.graph?.nodes.map(n => n.id)).toEqual(["the", "cat"]);
    expect(work.useData.panes).toEqual({ input: true, graph: true, inspect: false, generator: true });
    expect(work.useData.controlsOpen).toBe(true);
    expect(work.useData.sizes).toEqual(defaultPaneSizes);
    expect(work.useData.view).toBeUndefined();
    expect(work.draw.tool.graph).toEqual({ nodes: [], edges: [] });
  });
});

describe("restoreWork's mode", () => {
  it("uses the saved mode where the page offers it", () => {
    expect(restore({ mode: "draw" }).mode).toBe("draw");
  });

  it("otherwise uses the authored starting mode", () => {
    expect(restore({ mode: "draw" }, dataOnly).mode).toBe("useData");
    expect(restore({ mode: "useData" }, drawOnly).mode).toBe("draw");
  });
});

describe("restoreWork's switches", () => {
  const onPage = {
    orderMatters: { startsOn: true, showSwitch: true }, showCaseSwitch: true, capitalization: "lowercase",
    buttons: { probabilities: { available: true, startsOn: false } },
  };
  const offPage = { ...onPage, orderMatters: { startsOn: true, showSwitch: false }, showCaseSwitch: false,
    buttons: { probabilities: { available: false, startsOn: false } } };
  const saved = { orderMatters: false, caseSensitive: true, probabilities: true };

  it("takes the saved value of a switch the page shows", () => {
    expect(restore(saved, onPage)).toMatchObject(
      { orderMatters: false, capitalization: "asTyped", probabilities: true });
    expect(restore({ caseSensitive: false }, { ...onPage, capitalization: "asTyped" }).capitalization)
      .toBe("lowercase");
  });

  it("takes the page's setting where it shows no switch", () => {
    expect(restore(saved, offPage)).toMatchObject(
      { orderMatters: true, capitalization: "lowercase", probabilities: false });
  });

  it("takes the page's setting for a probabilities toggle with no Graph pane to show it", () => {
    const noGraph = { ...onPage, ...dataOnly, ...panesOff("graph") };
    expect(restore({ probabilities: true }, noGraph).probabilities).toBe(false);
  });
});

describe("restoreWork's input", () => {
  it("puts a student's edited input before the starting text", () => {
    expect(restore({ input: { text: "a b" } }, { startingText: "c" }).text).toBe("a b");
    expect(restore({ input: { text: "" } }, { startingText: "c" }).text).toBe("");
  });

  it("ignores the saved input with no Input pane", () => {
    expect(restore({ input: { text: "a b" } }, { ...panesOff("input"), startingText: "c" }).text).toBe("c");
  });

  it("has an Input pane only where the page offers Data mode", () => {
    expect(restore({}).hasInputPane).toBe(true);
    expect(restore({}, panesOff("input")).hasInputPane).toBe(false);
    expect(restore({}, drawOnly).hasInputPane).toBe(false);
  });

  it("reads the text under the case rule in use", () => {
    expect(restore({ input: { text: "A a" }, caseSensitive: true }).useData.tool.values).toEqual(["A", "a"]);
    expect(restore({ input: { text: "A a" }, caseSensitive: false }).useData.tool.values).toEqual(["a", "a"]);
  });
});

describe("restoreWork's panes", () => {
  it("keeps the saved state of a pane the page has, and ignores one it lacks", () => {
    const useData: SavedMode = { panes: { input: false, inspect: false, generator: false } };
    expect(restore({ useData }).useData.panes).toEqual({ input: false, graph: true, inspect: false, generator: false });
    expect(restore({ useData }, panesOff("inspect")).useData.panes).toEqual(
      { input: false, graph: true, generator: false });
  });

  it("starts a pane the save lacks as authored", () => {
    const authored = { panes: { inspect: { available: true, startsOpen: false } } };
    expect(restore({ useData: { panes: { input: false } } }, authored).useData.panes.inspect).toBe(false);
  });

  it("always opens Draw mode's Graph pane", () => {
    expect(restore({ draw: { panes: { graph: false } } }).draw.panes.graph).toBe(true);
    expect(restore({ useData: { panes: { graph: false } } }).useData.panes.graph).toBe(false);
  });

  it("keeps whether the generator's controls were open", () => {
    expect(restore({ draw: { controlsOpen: false } }).draw.controlsOpen).toBe(false);
  });
});

describe("restoreWork's sizes", () => {
  it("keeps sizes within their limits", () => {
    const sizes = { input: 300, inspect: 240, top: 250 };
    expect(restore({ useData: { sizes } }).useData.sizes).toEqual(sizes);
  });

  it("raises a size below its minimum, and lowers a row above its maximum", () => {
    expect(restore({ useData: { sizes: { input: 1, inspect: 1, top: 1 } } }).useData.sizes).toEqual(
      { input: minPaneSizes.input, inspect: minPaneSizes.inspect, top: minPaneSizes.top });
    expect(restore({ draw: { sizes: { top: 9999 } } }).draw.sizes.top).toBe(maxRowHeight);
  });

  it("fills a size the save lacks", () => {
    expect(restore({ useData: { sizes: { input: 300 } } }).useData.sizes).toEqual({ ...defaultPaneSizes, input: 300 });
  });

  it("keeps the linked split between 0 and 1", () => {
    expect(restore({ useData: { inputSplit: 0.25 } }).inputSplit).toBe(0.25);
    expect(restore({ useData: { inputSplit: -1 } }).inputSplit).toBe(0);
    expect(restore({ useData: { inputSplit: 2 } }).inputSplit).toBe(1);
  });
});

describe("restoreWork's positions", () => {
  const input = { text: "a b" };

  it("places the states in the order they first appear", () => {
    const work = restore({ input, caseSensitive: false, useData: { positions: [1, 2, 3, 4] } });
    expect(xy(work.useData.tool.graph?.nodes)).toEqual([[1, 2], [3, 4]]);
  });

  it("refuses positions for another number of states", () => {
    const work = restore({ input, caseSensitive: false, useData: { positions: [1, 2] } });
    expect(xy(work.useData.tool.graph?.nodes)).toEqual([[undefined, undefined], [undefined, undefined]]);
  });

  it("refuses positions saved under another case rule", () => {
    const positions = [1, 2, 3, 4];
    const nodes = (saved: Partial<MarkovInteractiveState>, authored: unknown) =>
      xy(restore({ input, useData: { positions }, ...saved }, authored).useData.tool.graph?.nodes)?.[0];
    expect(nodes({ caseSensitive: true }, { showCaseSwitch: false })).toEqual([undefined, undefined]);
    expect(nodes({}, {})).toEqual([undefined, undefined]);
    expect(nodes({ caseSensitive: true }, {})).toEqual([1, 2]);
  });

  it("refuses positions saved for other states of the same number", () => {
    const useData = { positions: [1, 2, 3, 4], positionsKey: statesKey(["x", "y"]) };
    const work = restore({ input, caseSensitive: false, useData });
    expect(xy(work.useData.tool.graph?.nodes)).toEqual([[undefined, undefined], [undefined, undefined]]);
  });

  it("refuses positions saved for the same states in another order", () => {
    const useData = { positions: [1, 2, 3, 4], positionsKey: statesKey(["b", "a"]) };
    const work = restore({ input, caseSensitive: false, useData });
    expect(xy(work.useData.tool.graph?.nodes)).toEqual([[undefined, undefined], [undefined, undefined]]);
  });

  it("places positions saved for these states", () => {
    const useData = { positions: [1, 2, 3, 4], positionsKey: statesKey(["a", "b"]) };
    const work = restore({ input, caseSensitive: false, useData });
    expect(xy(work.useData.tool.graph?.nodes)).toEqual([[1, 2], [3, 4]]);
  });
});

describe("restoreWork's view", () => {
  const view = { x: 1, y: 2, k: 3 };

  it("keeps the starting mode's view alone", () => {
    const work = restore({ mode: "draw", useData: { view }, draw: { view } });
    expect(work.draw.view).toEqual(view);
    expect(work.useData.view).toBeUndefined();
  });

  it("keeps no view read-only", () => {
    const work = restore({ mode: "draw", useData: { view }, draw: { view } }, {}, true);
    expect(work.draw.view).toBeUndefined();
    expect(work.useData.view).toBeUndefined();
  });
});

describe("restoreWork's generator", () => {
  const input = { text: "a b" };

  it("keeps the saved settings", () => {
    const generator = {
      startingState: "a", lengthLimit: 7, delimiter: "-", delimiterType: "other" as const, fast: true,
    };
    expect(restore({ input, useData: { generator } }).useData.tool.generator).toEqual(generator);
  });

  it("reads a starting state not in the graph as any", () => {
    const generator = { startingState: "gone", lengthLimit: 7 };
    expect(restore({ input, useData: { generator } }).useData.tool.generator).toEqual(
      { startingState: undefined, lengthLimit: 7 });
  });
});

describe("restoreWork's outputs and selection", () => {
  const input = { text: "a b" };
  const drawing = { nodes: [{ id: "n1", label: "A", value: 1 }], edges: [{ from: "n1", to: "n1", value: 1 }] };

  it("decodes each mode's outputs", () => {
    const work = restore({ input, useData: { outputs: outputs(["a", "b"]) }, draw: { outputs: outputs(["x"]) } });
    expect(work.useData.tool.sequenceGroups?.[0].sequences[0].map(n => n.label)).toEqual(["a", "b"]);
    expect(work.draw.tool.sequenceGroups?.[0].sequences[0].map(n => n.label)).toEqual(["x"]);
  });

  it("keeps a chosen state or transition the work has", () => {
    expect(restore({ input, useData: { selection: { kind: "state", id: "a" } } }).useData.tool.selection)
      .toEqual({ kind: "state", id: "a" });
    const selection = { kind: "transition" as const, from: "a", to: "b" };
    expect(restore({ input, useData: { selection } }).useData.tool.selection).toEqual(selection);
    expect(restore({ draw: { drawing, selection: { kind: "state", id: "n1" } } }).draw.tool.selection)
      .toEqual({ kind: "state", id: "n1" });
  });

  it("drops a chosen state or transition the work doesn't have", () => {
    expect(restore({ input, useData: { selection: { kind: "state", id: "x" } } }).useData.tool.selection)
      .toBeUndefined();
    const selection = { kind: "transition" as const, from: "b", to: "a" };
    expect(restore({ input, useData: { selection } }).useData.tool.selection).toBeUndefined();
  });

  it("drops a chosen transition with order off, in Data mode alone", () => {
    const selection = { kind: "transition" as const, from: "a", to: "b" };
    expect(restore({ input, orderMatters: false, useData: { selection } }).useData.tool.selection).toBeUndefined();
    const drawnSelection = { kind: "transition" as const, from: "n1", to: "n1" };
    expect(restore({ orderMatters: false, draw: { drawing, selection: drawnSelection } }).draw.tool.selection)
      .toEqual(drawnSelection);
  });

  it("points a chosen output into the decoded groups", () => {
    const useData: SavedMode = { outputs: outputs(["a"], ["b"]), selection: { kind: "output", group: 0, sequence: 1 } };
    const { selection, sequenceGroups } = restore({ input, useData }).useData.tool;
    expect(selection?.kind === "output" && selection.group).toBe(sequenceGroups?.[0]);
    expect(selection?.kind === "output" && selection.sequence).toBe(sequenceGroups?.[0].sequences[1]);
  });

  it("follows a chosen output past a damaged group or sequence before it", () => {
    const saved = outputs(["a"], ["b"], ["a", "b"]);
    const [good] = saved.groups;
    const damaged = { ...good, start: 99 };
    const useData: SavedMode = {
      outputs: { ...saved, groups: [damaged, { ...good, sequences: [[99], ...good.sequences] }] },
      selection: { kind: "output", group: 1, sequence: 2 },
    };
    const { selection, sequenceGroups } = restore({ useData }).useData.tool;
    expect(selection?.kind === "output" && selection.group).toBe(sequenceGroups?.[0]);
    expect(selection?.kind === "output" && selection.sequence).toBe(sequenceGroups?.[0].sequences[1]);
    expect(selection?.kind === "output" && selection.sequence.map(({ label }) => label)).toEqual(["b"]);
  });

  it("drops a chosen output that was left out, rather than choosing the next one", () => {
    const saved = outputs(["a"], ["b"]);
    const [good] = saved.groups;
    const damagedGroup = { ...saved, groups: [{ ...good, start: 99 }, good] };
    expect(restore({ useData: { outputs: damagedGroup, selection: { kind: "output", group: 0, sequence: 0 } } })
      .useData.tool.selection).toBeUndefined();
    const damagedSequence = { ...saved, groups: [{ ...good, sequences: [[99], ...good.sequences] }] };
    expect(restore({ useData: { outputs: damagedSequence, selection: { kind: "output", group: 0, sequence: 0 } } })
      .useData.tool.selection).toBeUndefined();
  });

  it("drops a chosen output that doesn't exist", () => {
    const missing = (group: number, sequence: number) => restore({ input, useData: {
      outputs: outputs(["a"]), selection: { kind: "output", group, sequence }
    } }).useData.tool.selection;
    expect(missing(0, 1)).toBeUndefined();
    expect(missing(1, 0)).toBeUndefined();
  });

  it("starts Draw mode from the saved drawing", () => {
    expect(restore({ draw: { drawing } }).draw.tool.graph).toEqual(drawing);
  });
});
