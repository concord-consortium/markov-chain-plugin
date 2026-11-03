import { defaultAuthoredState, MarkovAuthoredState, modesFor, UsableModes } from "../authored-state";
import { WorkspaceConfig, workspaceConfig } from "./workspace-config";

const authored = (changes: Partial<MarkovAuthoredState> = {}): MarkovAuthoredState =>
  ({ ...JSON.parse(JSON.stringify(defaultAuthoredState)), ...changes });
const withModes = (usable: UsableModes, startingMode = defaultAuthoredState.startingMode) =>
  authored({ modes: modesFor(usable), startingMode });

const allOpen = [
  { id: "input", startsOpen: true }, { id: "graph", startsOpen: true }, { id: "inspect", startsOpen: true },
  { id: "generator", startsOpen: true },
];
const dataConfig: WorkspaceConfig = {
  mode: "useData",
  panes: allOpen as WorkspaceConfig["panes"],
  inputView: "textAndTable",
  capitalization: "lowercase",
  modeSwitch: false,
  orderMatters: { startsOn: true, showSwitch: true },
  probabilities: { startsOn: false, showToggle: true },
  sendToCodap: false,
  downloadTables: false,
};
const { inputView: _inputView, ...dataSettings } = dataConfig;
const drawConfig: WorkspaceConfig = {
  ...dataSettings,
  mode: "draw",
  panes: allOpen.slice(1) as WorkspaceConfig["panes"],
  orderMatters: { startsOn: true, showSwitch: false },
};

describe("workspaceConfig", () => {
  it("shows Data mode's panes, input and switches with Data alone", () => {
    expect(workspaceConfig(withModes("useData"))).toEqual(dataConfig);
  });

  it("shows Draw mode's panes, without an Input pane or the Order matters switch, with Draw alone", () => {
    expect(workspaceConfig(withModes("draw", "draw"))).toEqual(drawConfig);
  });

  it("adds the Data/Draw switch with both modes, in either starting mode", () => {
    expect(workspaceConfig(withModes("both", "useData"))).toEqual({ ...dataConfig, modeSwitch: true });
    expect(workspaceConfig(withModes("both", "draw"))).toEqual({ ...drawConfig, modeSwitch: true });
  });

  it("opens in the mode asked for, or else the starting mode", () => {
    expect(workspaceConfig(withModes("both", "useData"), "draw").mode).toBe("draw");
  });

  it("gives Data mode the authored input view", () => {
    expect(workspaceConfig(authored({ inputView: "table" }))).toHaveProperty("inputView", "table");
    expect(workspaceConfig(authored({ inputView: "text" }))).toHaveProperty("inputView", "text");
  });

  it("leaves out a pane that isn't available, and starts collapsed one that doesn't start open", () => {
    const state = authored();
    state.panes.inspect.available = false;
    state.panes.generator.startsOpen = false;
    expect(workspaceConfig(state).panes).toEqual([
      { id: "input", startsOpen: true }, { id: "graph", startsOpen: true }, { id: "generator", startsOpen: false },
    ]);
  });

  it("opens Draw mode's graph whatever Data mode's Graph pane setting says", () => {
    const state = withModes("both", "draw");
    state.panes.graph.startsOpen = false;
    expect(workspaceConfig(state).panes[0]).toEqual({ id: "graph", startsOpen: true });
    expect(workspaceConfig(state, "useData").panes[1]).toEqual({ id: "graph", startsOpen: false });
  });

  it("shows the probabilities toggle only with a Graph pane, and only when it is available", () => {
    const noGraph = withModes("useData");
    noGraph.panes.graph.available = false;
    expect(workspaceConfig(noGraph).probabilities.showToggle).toBe(false);
    expect(workspaceConfig(noGraph, "draw").probabilities.showToggle).toBe(true);

    const notAvailable = authored();
    notAvailable.buttons.probabilities = { available: false, startsOn: true };
    expect(workspaceConfig(notAvailable).probabilities).toEqual({ startsOn: true, showToggle: false });
  });

  it("passes on the send buttons and the starting values", () => {
    const state = authored({ capitalization: "asTyped", orderMatters: { startsOn: false, showSwitch: false } });
    state.buttons.sendToCodap.available = true;
    state.buttons.downloadTables.available = true;
    expect(workspaceConfig(state)).toMatchObject({
      capitalization: "asTyped", orderMatters: { startsOn: false, showSwitch: false }, sendToCodap: true,
      downloadTables: true,
    });
  });
});
