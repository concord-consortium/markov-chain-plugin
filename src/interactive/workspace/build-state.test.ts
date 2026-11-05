import { defaultAuthoredState, readAuthoredState } from "../authored-state";
import { copyState, MarkovInteractiveState, readInteractiveState } from "../interactive-state";
import { buildInteractiveState, maxSavedPositions, ModeReport, StateParts, ToolParts } from "./build-state";
import { restoreWork } from "./restore-work";
import { defaultPaneSizes } from "./pane-sizes";
import { workspaceConfig } from "./workspace-config";

const authoredText = "the cat";

const dataNodes = [{ id: "the", label: "the", value: 1 }, { id: "cat", label: "cat", value: 1 }];
const group = {
  delimiter: " ", lengthLimit: 3, startingState: "", startingNode: undefined, orderMatters: true,
  sequences: [[dataNodes[0], dataNodes[1]]],
};

const tool = (overrides: Partial<ToolParts> = {}): ToolParts => ({
  graph: { nodes: dataNodes, edges: [{ from: "the", to: "cat", value: 1 }] },
  generator: { startingState: "", lengthLimit: 5, delimiter: " ", delimiterType: "space", fast: false },
  sequenceGroups: [],
  selection: undefined,
  ...overrides,
});

const report = (overrides: Partial<ModeReport> = {}): ModeReport => ({
  layout: {
    open: { input: true, graph: true, inspect: true, generator: true }, controlsOpen: true, sizes: defaultPaneSizes,
  },
  following: () => true,
  inspect: {
    tab: "states",
    sorts: {
      states: { column: "state", ascending: true }, transitions: { column: "transition", ascending: true },
    },
  },
  ...overrides,
});

const dataReport = (overrides: Partial<ModeReport> = {}) => report({
  text: authoredText, capitalization: "lowercase", inputSplit: 0.4, arranged: [{ x: 1.4, y: 2.6 }, { x: 3, y: 4 }],
  ...overrides,
});

const parts = (overrides: Partial<StateParts> = {}): StateParts => ({
  offered: { useData: true, draw: true },
  hasInputPane: true,
  authoredText,
  mode: "useData",
  probabilities: false,
  orderMatters: true,
  tools: { useData: tool(), draw: tool({ graph: { nodes: [], edges: [] } }) },
  reports: { useData: dataReport(), draw: report() },
  ...overrides,
});

const build = (overrides: Partial<StateParts> = {}, previous: MarkovInteractiveState = { version: 1 }) =>
  buildInteractiveState(previous, parts(overrides));

const asSaved = (state: MarkovInteractiveState) => JSON.parse(JSON.stringify(state));

describe("buildInteractiveState", () => {
  it("gives the same state for the same parts, as JSON", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("leaves out an unedited input, and clears an earlier edit that went back to the starting text", () => {
    expect(asSaved(build())).not.toHaveProperty("input");
    expect(asSaved(build({}, { version: 1, input: { text: "an edit" } }))).not.toHaveProperty("input");
  });

  it("holds an edited input", () => {
    const reports = { useData: dataReport({ text: "the dog" }), draw: report() };
    expect(build({ reports }).input).toEqual({ text: "the dog" });
  });

  it("keeps the saved input with no Input pane", () => {
    const state = build({ hasInputPane: false }, { version: 1, input: { text: "kept" } });
    expect(state.input).toEqual({ text: "kept" });
  });

  it("keeps fields it doesn't know, at the top level and in each mode", () => {
    const previous = { version: 1, later: 1, useData: { later: 2 }, draw: { later: 3 } } as MarkovInteractiveState;
    expect(build({}, previous)).toMatchObject({ later: 1, useData: { later: 2 }, draw: { later: 3 } });
  });

  it("keeps a mode the page doesn't offer", () => {
    const useData = { outputs: { states: ["a"], groups: [] }, controlsOpen: false };
    const previous = { version: 1, orderMatters: false, caseSensitive: true, useData } as MarkovInteractiveState;
    const offered = { useData: false, draw: true };
    const state = build({ offered, hasInputPane: false, orderMatters: true }, previous);
    expect(state.useData).toEqual(useData);
    expect(state.orderMatters).toBe(false);
    expect(state.caseSensitive).toBe(true);
    const draw = { controlsOpen: false };
    expect(build({ offered: { useData: true, draw: false } }, { version: 1, draw }).draw).toEqual(draw);
  });

  it("rounds a state's position, reading a dragged state from its pin", () => {
    const reports = { useData: dataReport({ arranged: [{ x: 1.4, y: 2.6, fx: 10.2, fy: 20.7 }, { x: 3, y: 4 }] }),
      draw: report() };
    expect(build({ reports }).useData?.positions).toEqual([10, 21, 3, 4]);
    expect(build().useData?.positions).toEqual([1, 3, 3, 4]);
  });

  it("leaves out positions past the most it saves, and for a mode with no graph", () => {
    const arranged = (count: number) => Array.from({ length: count }, () => ({ x: 1, y: 2 }));
    const withStates = (count: number) => build({
      reports: { useData: dataReport({ arranged: arranged(count) }), draw: report() }
    }).useData?.positions;
    expect(withStates(maxSavedPositions)).toHaveLength(2 * maxSavedPositions);
    expect(withStates(maxSavedPositions + 1)).toBeUndefined();
    const reports = { useData: dataReport({ arranged: undefined }), draw: report() };
    expect(asSaved(build({ reports }, { version: 1, useData: { positions: [1, 2] } })).useData)
      .not.toHaveProperty("positions");
  });

  it("rounds a drawing's states to whole numbers and leaves an unplaced one so", () => {
    const graph = {
      nodes: [{ id: "n", label: "A", value: 1, x: 1.6, y: -2.4 }, { id: "m", label: "B", value: 1 }], edges: [],
    };
    const { draw } = build({ tools: { useData: tool(), draw: tool({ graph }) } });
    expect(draw?.drawing?.nodes[0]).toMatchObject({ x: 2, y: -2 });
    expect(asSaved({ version: 1, draw }).draw.drawing.nodes[1]).toEqual({ id: "m", label: "B", value: 1 });
  });

  describe("view", () => {
    const view = { x: 1.2345, y: -2.3456, k: 1.234567 };
    const following = () => false;
    const taken = { useData: dataReport({ following, view }), draw: report({ following, view }) };

    it("is written for the mode showing once the student took it, rounded", () => {
      const state = build({ reports: taken });
      expect(state.useData?.view).toEqual({ x: 1.23, y: -2.35, k: 1.2346 });
    });

    it("isn't written for a hidden mode", () => {
      expect(build({ reports: taken }).draw?.view).toBeUndefined();
      expect(build({ reports: taken, mode: "draw" }).useData?.view).toBeUndefined();
    });

    it("isn't written while the view follows the graph, clearing an earlier one", () => {
      const reports = { useData: dataReport({ view }), draw: report() };
      const previous = { version: 1 as const, useData: { view: { x: 1, y: 2, k: 3 } } };
      expect(asSaved(build({ reports }, previous)).useData).not.toHaveProperty("view");
    });
  });

  it("saves a chosen output as its places", () => {
    const chosen = { ...group, sequences: [[dataNodes[0]], [dataNodes[1]]] };
    const selection = { kind: "output" as const, group: chosen, sequence: chosen.sequences[1] };
    const useData = tool({ sequenceGroups: [group, chosen], selection });
    expect(build({ tools: { useData, draw: tool() } }).useData?.selection)
      .toEqual({ kind: "output", group: 1, sequence: 1 });
  });

  it("saves no chosen output that isn't among the outputs", () => {
    const selection = { kind: "output" as const, group: { ...group }, sequence: group.sequences[0] };
    const useData = tool({ sequenceGroups: [group], selection });
    expect(build({ tools: { useData, draw: tool() } }).useData?.selection).toBeUndefined();
  });

  it("leaves out outputs when there are none, clearing earlier ones", () => {
    const previous = { version: 1 as const, useData: { outputs: { states: ["a"], groups: [] } } };
    expect(asSaved(build({}, previous)).useData).not.toHaveProperty("outputs");
  });
});

describe("reading what buildInteractiveState builds", () => {
  const authoredState = readAuthoredState({ ...defaultAuthoredState, startingText: authoredText });
  const configs = { useData: workspaceConfig(authoredState, "useData"), draw: workspaceConfig(authoredState, "draw") };
  const reopen = (state: MarkovInteractiveState, authored = authoredState) =>
    restoreWork(readInteractiveState(copyState(state)), authored, configs);

  it("gives back the parts", () => {
    const drawn = { nodes: [{ id: "n", label: "A", value: 1, x: 5, y: 6 }], edges: [{ from: "n", to: "n", value: 2 }] };
    const open = { input: false, graph: true, inspect: true, generator: false };
    const view = { x: 1, y: 2, k: 3 };
    const inspect = {
      tab: "transitions" as const,
      sorts: {
        states: { column: "count" as const, ascending: false },
        transitions: { column: "probability" as const, ascending: true },
      },
    };
    const generator = {
      startingState: "cat", lengthLimit: 8, delimiter: "-", delimiterType: "other" as const, fast: true,
    };
    const state = build({
      mode: "draw", probabilities: true, orderMatters: false,
      tools: {
        useData: tool({ generator, sequenceGroups: [group], selection: { kind: "state", id: "cat" } }),
        draw: tool({ graph: drawn, selection: { kind: "transition", from: "n", to: "n" } }),
      },
      reports: {
        useData: dataReport({
          text: "the cat ran", capitalization: "asTyped", inputSplit: 0.25, inspect,
          arranged: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }],
          layout: { open, controlsOpen: false, sizes: { input: 300, inspect: 240, top: 250 } },
        }),
        draw: report({ following: () => false, view }),
      },
    });
    const work = reopen(state);
    expect(work).toMatchObject({
      mode: "draw", probabilities: true, orderMatters: false, capitalization: "asTyped", text: "the cat ran",
      inputSplit: 0.25,
    });
    expect(work.useData).toMatchObject({
      panes: open, controlsOpen: false, sizes: { input: 300, inspect: 240, top: 250 }, inspect,
    });
    expect(work.useData.tool.generator).toEqual(generator);
    expect(work.useData.tool.selection).toEqual({ kind: "state", id: "cat" });
    expect(work.useData.tool.sequenceGroups?.[0].sequences[0].map(node => node.label)).toEqual(["the", "cat"]);
    expect(work.useData.tool.graph?.nodes.map(({ x, y }) => [x, y])).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(work.draw.tool.graph).toEqual(drawn);
    expect(work.draw.tool.selection).toEqual({ kind: "transition", from: "n", to: "n" });
    expect(work.draw.view).toEqual(view);
  });

  it("reads a changed starting text for an input the student never edited", () => {
    const changed = readAuthoredState({ ...authoredState, startingText: "a new text" });
    expect(reopen(build(), changed).text).toBe("a new text");
  });

  it("keeps an edited input over a changed starting text", () => {
    const reports = { useData: dataReport({ text: "my text" }), draw: report() };
    const changed = readAuthoredState({ ...authoredState, startingText: "a new text" });
    expect(reopen(build({ reports }), changed).text).toBe("my text");
  });
});
