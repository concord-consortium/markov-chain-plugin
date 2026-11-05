import { Selection } from "../../components/host";
import { MarkovToolApi } from "../../hooks/use-markov-tool";
import { GraphData, SequenceGroup } from "../../type";
import { Capitalization, ModeId } from "../authored-state";
import { MarkovInteractiveState, SavedGenerator, SavedMode, SavedSelection, SavedView } from "../interactive-state";
import { encodeOutputs } from "../saved-outputs";
import { PaneSizes } from "./pane-sizes";

// a graph with more states is far past what a student can use, and its positions would take too much of the budget
export const maxSavedPositions = 6000;

// What the builder reads that lives in a mode's body, reported there in effects so it never renders anything.
export interface ModeReport {
  layout?: { open: Record<string, boolean>, controlsOpen: boolean, sizes: PaneSizes };
  following?: () => boolean;
  inspect?: SavedMode["inspect"];
  view?: SavedView;
  // Data mode: the committed text, which the graph shows
  text?: string;
  capitalization?: Capitalization;
  inputSplit?: number;
  // the states as last drawn, which dragging moves
  arranged?: { x?: number, y?: number, fx?: number | null, fy?: number | null }[];
}

export interface ToolParts {
  graph: GraphData;
  generator: Partial<SavedGenerator>;
  sequenceGroups: SequenceGroup[];
  selection: Selection;
}

export const toolParts = ({ graph, generatorProps, outputProps, selection }: MarkovToolApi): ToolParts => ({
  graph,
  generator: {
    startingState: generatorProps.startingState, lengthLimit: generatorProps.lengthLimit,
    delimiter: generatorProps.delimiter, delimiterType: generatorProps.delimiterType,
    fast: generatorProps.fastSimulation,
  },
  sequenceGroups: outputProps.sequenceGroups,
  selection,
});

export interface StateParts {
  offered: Record<ModeId, boolean>;
  hasInputPane: boolean;
  authoredText: string;
  mode: ModeId;
  probabilities: boolean;
  orderMatters: boolean;
  tools: Record<ModeId, ToolParts>;
  reports: Record<ModeId, ModeReport>;
}

const toPlaces = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
const whole = (value?: number) => value === undefined ? undefined : Math.round(value);

const savedSelection = (selection: Selection, groups: SequenceGroup[]): SavedSelection | undefined => {
  if (selection?.kind !== "output") {
    return selection;
  }
  const group = groups.indexOf(selection.group);
  const sequence = selection.group.sequences.indexOf(selection.sequence);
  return group >= 0 && sequence >= 0 ? { kind: "output", group, sequence } : undefined;
};

// every field the builder owns is named, as undefined when there is none, so it replaces what the state held before
const modeFields = (tool: ToolParts, report: ModeReport, showing: boolean): SavedMode => {
  const following = report.following?.() ?? true;
  const { sequenceGroups, generator, selection } = tool;
  return {
    panes: report.layout?.open,
    controlsOpen: report.layout?.controlsOpen,
    sizes: report.layout?.sizes,
    inspect: report.inspect,
    generator,
    outputs: sequenceGroups.length > 0 ? encodeOutputs(sequenceGroups) : undefined,
    selection: savedSelection(selection, sequenceGroups),
    view: showing && !following && report.view
      ? { x: toPlaces(report.view.x, 2), y: toPlaces(report.view.y, 2), k: toPlaces(report.view.k, 4) }
      : undefined,
  };
};

const savedPositions = (arranged: ModeReport["arranged"]) => !arranged || arranged.length > maxSavedPositions
  ? undefined
  // a dragged state's x trails its pin until the next tick
  : arranged.flatMap(({ x, y, fx, fy }) => [Math.round(fx ?? x ?? 0), Math.round(fy ?? y ?? 0)]);

export const savedDrawing = ({ nodes, edges }: GraphData): GraphData => ({
  nodes: nodes.map(node => ({ ...node, x: whole(node.x), y: whole(node.y) })), edges,
});

// The whole state from what is on screen. It is pure and deterministic, so a page leave after a save posts a state the
// Activity Player sees as unchanged. previous is the state read at open, which keeps what this page can't show and
// fields this version doesn't know.
export const buildInteractiveState = (previous: MarkovInteractiveState, parts: StateParts): MarkovInteractiveState => {
  const { offered, hasInputPane, authoredText, mode, probabilities, orderMatters, tools, reports } = parts;
  const { text, capitalization, inputSplit, arranged } = reports.useData;
  return {
    ...previous,
    // undefined rather than left out, so going back to the starting text clears an earlier edit
    ...(hasInputPane ? { input: text === authoredText || text === undefined ? undefined : { text } } : {}),
    mode,
    probabilities,
    ...(offered.useData ? { orderMatters, caseSensitive: capitalization === "asTyped" } : {}),
    ...(offered.useData ? {
      useData: {
        ...previous.useData, ...modeFields(tools.useData, reports.useData, mode === "useData"),
        inputSplit, positions: savedPositions(arranged),
      }
    } : {}),
    ...(offered.draw ? {
      draw: {
        ...previous.draw, ...modeFields(tools.draw, reports.draw, mode === "draw"),
        drawing: savedDrawing(tools.draw.graph),
      }
    } : {}),
  };
};
