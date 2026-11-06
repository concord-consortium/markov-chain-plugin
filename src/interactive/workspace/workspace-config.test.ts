import { defaultAuthoredState, MarkovAuthoredState, modesFor, UsableModes } from "../authored-state";
import { WorkspaceConfig, workspaceConfig } from "./workspace-config";

const authored = (changes: Partial<MarkovAuthoredState> = {}): MarkovAuthoredState =>
  ({ ...JSON.parse(JSON.stringify(defaultAuthoredState)), ...changes });
const withModes = (usable: UsableModes, startingMode = defaultAuthoredState.startingMode) =>
  authored({ modes: modesFor(usable), startingMode });

const startingConfig = (state: MarkovAuthoredState) => workspaceConfig(state, state.startingMode);

const allOpen = [
  { id: "input", startsOpen: true }, { id: "graph", startsOpen: true }, { id: "inspect", startsOpen: true },
  { id: "generator", startsOpen: true },
];
const dataConfig: WorkspaceConfig = {
  mode: "useData",
  panes: allOpen as WorkspaceConfig["panes"],
  inputView: "textAndTable",
  capitalization: "lowercase",
  caseSwitch: true,
  csvUpload: false,
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
  caseSwitch: false,
  orderMatters: { startsOn: true, showSwitch: false },
};

describe("workspaceConfig", () => {
  it("shows Data mode's panes, input and switches with Data alone", () => {
    expect(startingConfig(withModes("useData"))).toEqual(dataConfig);
  });

  it("shows Draw mode's panes, without an Input pane or the Order matters switch, with Draw alone", () => {
    expect(startingConfig(withModes("draw", "draw"))).toEqual(drawConfig);
    expect(startingConfig({ ...withModes("draw", "draw"), inputView: "table" })).toEqual(drawConfig);
  });

  it("adds the Data/Draw switch with both modes, in either starting mode", () => {
    expect(startingConfig(withModes("both", "useData"))).toEqual({ ...dataConfig, modeSwitch: true });
    expect(startingConfig(withModes("both", "draw"))).toEqual({ ...drawConfig, modeSwitch: true });
  });

  it("shows the Case sensitive switch in Data mode only while the author shows it", () => {
    expect(startingConfig(authored({ showCaseSwitch: true })).caseSwitch).toBe(true);
    expect(startingConfig(authored({ showCaseSwitch: false })).caseSwitch).toBe(false);
    expect(workspaceConfig(authored({ showCaseSwitch: true }), "draw").caseSwitch).toBe(false);
  });

  it("offers the CSV upload in Data mode with an Input pane, only while the author allows it", () => {
    const allowed = authored({ allowCsvUpload: true });
    const noInput = { ...allowed, panes: { ...allowed.panes, input: { available: false, startsOpen: true } } };
    expect(workspaceConfig(allowed, "useData").csvUpload).toBe(true);
    expect(workspaceConfig(authored(), "useData").csvUpload).toBe(false);
    expect(workspaceConfig(noInput, "useData").csvUpload).toBe(false);
    expect(workspaceConfig(allowed, "draw").csvUpload).toBe(false);
  });

  it("opens in the mode asked for, or else the starting mode", () => {
    expect(workspaceConfig(withModes("both", "useData"), "draw").mode).toBe("draw");
  });

  it.each(["table", "text", "textAndTable"] as const)("gives Data mode the authored %s view", view => {
    const viewed = (state: MarkovAuthoredState) => ({ ...state, inputView: view });
    expect(startingConfig(viewed(withModes("useData")))).toEqual({ ...dataConfig, inputView: view });
    expect(startingConfig(viewed(withModes("both", "useData"))))
      .toEqual({ ...dataConfig, inputView: view, modeSwitch: true });
  });

  it.each(["input", "graph", "inspect", "generator"] as const)(
    "leaves out the %s pane in Data mode when it isn't available, and starts it collapsed when it doesn't start open",
    id => {
      const off = withModes("useData");
      off.panes[id].available = false;
      expect(startingConfig(off).panes).toEqual(allOpen.filter(pane => pane.id !== id));
      const closed = withModes("useData");
      closed.panes[id].startsOpen = false;
      expect(startingConfig(closed).panes)
        .toEqual(allOpen.map(pane => pane.id === id ? { ...pane, startsOpen: false } : pane));
    });

  it("leaves out a pane that isn't available, and starts collapsed one that doesn't start open", () => {
    const state = authored();
    state.panes.inspect.available = false;
    state.panes.generator.startsOpen = false;
    expect(startingConfig(state).panes).toEqual([
      { id: "input", startsOpen: true }, { id: "graph", startsOpen: true }, { id: "generator", startsOpen: false },
    ]);
  });

  it("opens Draw mode's graph whatever Data mode's Graph pane setting says", () => {
    const state = withModes("both", "draw");
    state.panes.graph.startsOpen = false;
    expect(startingConfig(state).panes[0]).toEqual({ id: "graph", startsOpen: true });
    expect(workspaceConfig(state, "useData").panes[1]).toEqual({ id: "graph", startsOpen: false });
  });

  it("shows the probabilities toggle only with a Graph pane, and only when it is available", () => {
    const noGraph = withModes("useData");
    noGraph.panes.graph.available = false;
    expect(startingConfig(noGraph).probabilities.showToggle).toBe(false);
    expect(workspaceConfig(noGraph, "draw").probabilities.showToggle).toBe(true);

    const notAvailable = authored();
    notAvailable.buttons.probabilities = { available: false, startsOn: true };
    expect(startingConfig(notAvailable).probabilities).toEqual({ startsOn: true, showToggle: false });
  });

  it("passes on the send buttons and the starting values", () => {
    const state = authored({ capitalization: "asTyped", orderMatters: { startsOn: false, showSwitch: false } });
    state.buttons.sendToCodap.available = true;
    state.buttons.downloadTables.available = true;
    expect(startingConfig(state)).toMatchObject({
      capitalization: "asTyped", orderMatters: { startsOn: false, showSwitch: false }, sendToCodap: true,
      downloadTables: true,
    });
  });
});
