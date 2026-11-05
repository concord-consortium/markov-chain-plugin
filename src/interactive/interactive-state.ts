import type { GraphView } from "../components/graph";
import { DelimiterType, GraphData } from "../type";
import { modeIds, ModeId } from "./authored-state";
import { isRecord, parseState } from "./parse-state";
import { isSavedOutputs, SavedOutputs } from "./saved-outputs";
import type { InspectTab, Sort, SortColumn } from "./workspace/inspect-rows";
import type { PaneSizes } from "./workspace/pane-sizes";
import type { WorkspacePaneId } from "./workspace/workspace-config";

// What the interactive saves for a student. The class dashboard counts a student as having opened the interactive
// once their state isn't empty, so it always holds the version.
export const interactiveStateVersion = 1;

// the most text the input takes, in the text box and through the table's edits
export const maxInputLength = 50000;

export type SavedView = GraphView;
export type SavedSelection =
  | { kind: "state", id: string }
  | { kind: "transition", from: string, to: string }
  | { kind: "output", group: number, sequence: number };

export interface SavedGenerator {
  startingState: string;
  lengthLimit?: number;
  delimiter: string;
  delimiterType: DelimiterType;
  fast: boolean;
}

export interface SavedMode {
  panes?: Partial<Record<WorkspacePaneId, boolean>>;
  controlsOpen?: boolean;
  sizes?: Partial<PaneSizes>;
  inspect?: { tab?: InspectTab, sorts?: Partial<Record<InspectTab, Sort>> };
  generator?: Partial<SavedGenerator>;
  outputs?: SavedOutputs;
  selection?: SavedSelection;
  view?: SavedView;
}

export interface MarkovInteractiveState {
  version: typeof interactiveStateVersion;
  // the text the table and the graph are rebuilt from
  input?: { text: string };
  mode?: ModeId;
  probabilities?: boolean;
  orderMatters?: boolean;
  caseSensitive?: boolean;
  useData?: SavedMode & { inputSplit?: number, positions?: number[] };
  draw?: SavedMode & { drawing?: GraphData };
}

type Fields = Record<string, unknown>;
type Check = (value: unknown) => boolean;

const isBoolean: Check = value => typeof value === "boolean";
const isString: Check = value => typeof value === "string";
const isNumber: Check = value => Number.isFinite(value);
const isOneOf = (choices: readonly unknown[]): Check => value => choices.includes(value);

const isView: Check = value => isRecord(value) && isNumber(value.x) && isNumber(value.y) && isNumber(value.k) &&
  (value.k as number) > 0;

const isSelection: Check = value => {
  if (!isRecord(value)) {
    return false;
  }
  switch (value.kind) {
    case "state":
      return isString(value.id);
    case "transition":
      return isString(value.from) && isString(value.to);
    case "output":
      return isNumber(value.group) && isNumber(value.sequence);
    default:
      return false;
  }
};

const isPositions: Check = value => Array.isArray(value) && value.length % 2 === 0 && value.every(isNumber);

const isSortOf = (columns: readonly SortColumn[]): Check => value =>
  isRecord(value) && columns.includes(value.column as SortColumn) && isBoolean(value.ascending);

// removes each named field its check refuses, and leaves the rest, and any field it has no check for
const keepValid = (fields: Fields, checks: Record<string, Check>) => {
  Object.keys(checks).filter(key => key in fields && !checks[key](fields[key])).forEach(key => delete fields[key]);
};

const readRecord = (fields: Fields, key: string, read: (record: Fields) => void) => {
  const record = fields[key];
  if (isRecord(record)) {
    read(record);
  } else {
    delete fields[key];
  }
};

const readInspect = (inspect: Fields) => {
  keepValid(inspect, { tab: isOneOf(["states", "transitions"]) });
  readRecord(inspect, "sorts", sorts => keepValid(sorts, {
    states: isSortOf(["state", "count"]), transitions: isSortOf(["transition", "count", "probability"]),
  }));
};

const readMode = (mode: Fields) => {
  keepValid(mode, { controlsOpen: isBoolean, outputs: isSavedOutputs, selection: isSelection, view: isView });
  readRecord(mode, "panes", panes => keepValid(panes, {
    input: isBoolean, graph: isBoolean, inspect: isBoolean, generator: isBoolean,
  }));
  readRecord(mode, "sizes", sizes => keepValid(sizes, { input: isNumber, inspect: isNumber, top: isNumber }));
  readRecord(mode, "inspect", readInspect);
  readRecord(mode, "generator", generator => keepValid(generator, {
    startingState: isString, lengthLimit: isNumber, delimiter: isString,
    delimiterType: isOneOf(["none", "space", "other"]), fast: isBoolean,
  }));
};

const isNode: Check = value => isRecord(value) && isString(value.id) && isString(value.label) &&
  isNumber(value.value) && (value.x === undefined || isNumber(value.x)) && (value.y === undefined || isNumber(value.y));

const hasDrawingLists: Check = value =>
  isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.edges);

const readDrawing = (drawing: Fields) => {
  const nodes = (drawing.nodes as unknown[]).filter(isNode) as Fields[];
  const ids = new Set(nodes.map(node => node.id));
  drawing.nodes = nodes;
  drawing.edges = (drawing.edges as unknown[])
    .filter(edge => isRecord(edge) && ids.has(edge.from) && ids.has(edge.to) && isNumber(edge.value));
};

// a state is JSON, so this copy is whole; the library deep-freezes both what it sends and what it is handed
export const copyState = <T, >(state: T): T => JSON.parse(JSON.stringify(state));

// Whatever the Activity Player hands back, as a state the workspace can edit. It never throws: a field that is the
// wrong type reads as if it had never been saved, and fields this version doesn't know are kept.
export const readInteractiveState = (raw: unknown): MarkovInteractiveState => {
  const state: Fields = copyState(parseState(raw));
  keepValid(state, {
    input: value => isRecord(value) && isString(value.text), mode: isOneOf(modeIds), probabilities: isBoolean,
    orderMatters: isBoolean, caseSensitive: isBoolean,
  });
  readRecord(state, "useData", useData => {
    readMode(useData);
    keepValid(useData, { inputSplit: isNumber, positions: isPositions });
  });
  readRecord(state, "draw", draw => {
    readMode(draw);
    keepValid(draw, { drawing: hasDrawingLists });
    readRecord(draw, "drawing", readDrawing);
  });
  return { ...state, version: interactiveStateVersion };
};

// whatever the Activity Player hands back, read as the saved input text, or undefined for none; it never throws
export const readSavedInput = (raw: unknown): string | undefined => {
  const { input } = parseState(raw);
  return isRecord(input) && typeof input.text === "string" ? input.text : undefined;
};
