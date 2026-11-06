import { Capitalization, InputView, MarkovAuthoredState, ModeId } from "../authored-state";

export type WorkspacePaneId = "input" | "graph" | "inspect" | "generator";

// what the workspace shows in a mode, from the author's settings
export type WorkspaceConfig = WorkspaceSettings & ({ mode: "useData", inputView: InputView } | { mode: "draw" });

interface WorkspaceSettings {
  // the panes present, in layout order, and whether each starts open
  panes: { id: WorkspacePaneId, startsOpen: boolean }[];
  // the starting value, which the "Case sensitive" switch changes
  capitalization: Capitalization;
  // the switch, else a read-only label; Data mode alone shows either
  caseSwitch: boolean;
  modeSwitch: boolean;
  // Data mode alone shows the switch
  orderMatters: { startsOn: boolean, showSwitch: boolean };
  probabilities: { startsOn: boolean, showToggle: boolean };
  sendToCodap: boolean;
  downloadTables: boolean;
}

export const workspaceConfig = (state: MarkovAuthoredState, mode: ModeId = state.startingMode): WorkspaceConfig => {
  const data = mode === "useData";
  const pane = (id: WorkspacePaneId) => state.panes[id];
  // Draw mode has no Input pane, and its Graph pane is always present and open
  const panes = (["input", "graph", "inspect", "generator"] as const)
    .filter(id => id === "graph" ? (!data || pane(id).available) : (id !== "input" || data) && pane(id).available)
    .map(id => ({ id, startsOpen: id === "graph" && !data ? true : pane(id).startsOpen }));
  return {
    ...(data ? { mode: "useData", inputView: state.inputView } : { mode: "draw" }),
    panes,
    capitalization: state.capitalization,
    caseSwitch: data && state.showCaseSwitch,
    modeSwitch: state.modes.useData && state.modes.draw,
    orderMatters: { startsOn: state.orderMatters.startsOn, showSwitch: data && state.orderMatters.showSwitch },
    probabilities: {
      startsOn: !!state.buttons.probabilities.startsOn,
      // its labels are drawn on the graph
      showToggle: state.buttons.probabilities.available && panes.some(p => p.id === "graph"),
    },
    sendToCodap: state.buttons.sendToCodap.available,
    downloadTables: state.buttons.downloadTables.available,
  };
};
