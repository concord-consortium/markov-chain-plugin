import { MarkovToolStart } from "../../hooks/use-markov-tool";
import { GraphData } from "../../type";
import { graphFromValues } from "../../utils/chain-graph";
import { Capitalization, capitalizationFor, MarkovAuthoredState, ModeId } from "../authored-state";
import { tokenize, tokensToValues } from "../input/tokenizer";
import { MarkovInteractiveState, SavedMode, SavedSelection, SavedView } from "../interactive-state";
import { decodeOutputs } from "../saved-outputs";
import { clamp, defaultInputSplit, defaultPaneSizes, maxRowHeight, minPaneSizes, PaneSizes } from "./pane-sizes";
import { DataWorkspaceConfig, DrawWorkspaceConfig, WorkspaceConfig } from "./workspace-config";

export interface RestoredMode {
  tool: MarkovToolStart;
  panes: Record<string, boolean>;
  controlsOpen: boolean;
  sizes: PaneSizes;
  inspect: SavedMode["inspect"];
  view: SavedView | undefined;
}

export interface RestoredWork {
  mode: ModeId;
  probabilities: boolean;
  orderMatters: boolean;
  capitalization: Capitalization;
  text: string;
  inputSplit: number;
  useData: RestoredMode;
  draw: RestoredMode;
}

const restoredSizes = (sizes: SavedMode["sizes"]): PaneSizes => ({
  input: Math.max(sizes?.input ?? defaultPaneSizes.input, minPaneSizes.input),
  inspect: Math.max(sizes?.inspect ?? defaultPaneSizes.inspect, minPaneSizes.inspect),
  top: clamp(sizes?.top ?? defaultPaneSizes.top, minPaneSizes.top, maxRowHeight),
});

const restoredSelection = (saved: SavedSelection | undefined, graph: GraphData, orderMatters: boolean,
  groups: NonNullable<MarkovToolStart["sequenceGroups"]>): MarkovToolStart["selection"] => {
  switch (saved?.kind) {
    case "state":
      return graph.nodes.some(node => node.id === saved.id) ? saved : undefined;
    case "transition":
      return orderMatters && graph.edges.some(edge => edge.from === saved.from && edge.to === saved.to)
        ? saved : undefined;
    case "output": {
      const group = groups[saved.group];
      const sequence = group?.sequences[saved.sequence];
      return sequence && { kind: "output", group, sequence };
    }
  }
};

const restoredMode = (saved: SavedMode | undefined, config: WorkspaceConfig, graph: GraphData, orderMatters: boolean,
  view: SavedView | undefined): RestoredMode => {
  const sequenceGroups = saved?.outputs ? decodeOutputs(saved.outputs) : [];
  const startingState = saved?.generator?.startingState;
  return {
    tool: {
      graph,
      sequenceGroups,
      generator: {
        ...saved?.generator,
        startingState: graph.nodes.some(node => node.id === startingState) ? startingState : undefined,
      },
      selection: restoredSelection(saved?.selection, graph, orderMatters, sequenceGroups),
    },
    panes: Object.fromEntries(config.panes.map(({ id, startsOpen }) =>
      [id, (config.mode === "draw" && id === "graph") || (saved?.panes?.[id] ?? startsOpen)])),
    controlsOpen: saved?.controlsOpen ?? true,
    sizes: restoredSizes(saved?.sizes),
    inspect: saved?.inspect,
    view,
  };
};

// What each part of the workspace starts from: a saved state read under the page's current settings, which may not be
// the settings it was saved under. With no saved state, this is the workspace as authored.
export const restoreWork = (saved: MarkovInteractiveState, authoredState: MarkovAuthoredState,
  configs: { useData: DataWorkspaceConfig, draw: DrawWorkspaceConfig },
  { readOnly = false }: { readOnly?: boolean } = {}): RestoredWork => {
  const mode = saved.mode && authoredState.modes[saved.mode] ? saved.mode : authoredState.startingMode;
  const data = configs.useData;
  const probabilities = configs[mode].probabilities.showToggle
    ? saved.probabilities ?? data.probabilities.startsOn : data.probabilities.startsOn;
  const orderMatters = data.orderMatters.showSwitch
    ? saved.orderMatters ?? data.orderMatters.startsOn : data.orderMatters.startsOn;
  const savedCapitalization = saved.caseSensitive === undefined ? undefined : capitalizationFor(saved.caseSensitive);
  const capitalization = (data.caseSwitch && savedCapitalization) || data.capitalization;

  // with no Input pane the student cannot edit the input, so a saved one is ignored
  const hasInputPane = data.panes.some(pane => pane.id === "input");
  const text = hasInputPane ? saved.input?.text ?? authoredState.startingText : authoredState.startingText;
  const values = tokensToValues(tokenize(text, capitalization));
  const graph = graphFromValues(values);
  const positions = saved.useData?.positions;
  if (positions?.length === 2 * graph.nodes.length && savedCapitalization === capitalization) {
    graph.nodes.forEach((node, index) => {
      node.x = positions[2 * index];
      node.y = positions[2 * index + 1];
    });
  }

  const viewOf = (id: ModeId) => id === mode && !readOnly ? saved[id]?.view : undefined;
  const useData = restoredMode(saved.useData, data, graph, orderMatters, viewOf("useData"));
  return {
    mode, probabilities, orderMatters, capitalization, text,
    inputSplit: clamp(saved.useData?.inputSplit ?? defaultInputSplit, 0, 1),
    useData: { ...useData, tool: { ...useData.tool, values } },
    draw: restoredMode(saved.draw, configs.draw, saved.draw?.drawing ?? { nodes: [], edges: [] }, true, viewOf("draw")),
  };
};
