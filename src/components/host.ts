import { GraphData, Node, SequenceGroup, ViewMode } from "../type";
import { LogEvent } from "./log-events";

// What the Markov tool needs from whatever hosts it: CODAP for the plugin, the Activity Player for the interactive.
// Keep each function's identity across renders unless what depends on it should run again: a playing sequence
// keeps the outputSequence and log it started with, and a new markDirty re-sends drawing mode's dirty notice.
export interface MarkovHost {
  viewMode?: ViewMode;
  // false makes the tool a bag of words; absent, as in the CODAP plugin, order matters
  orderMatters?: boolean;
  setViewMode: (viewMode?: ViewMode) => void;
  markDirty: () => void;
  outputSequence: (labels: string[]) => Promise<void>;
  log: (event: LogEvent, data?: Record<string, unknown>) => void;
}

// where a state or transition was chosen, and how a selection was cleared
export type SelectionSource = "graph" | "inspect" | "table";
export type ClearVia = "toggle" | "background" | "escape" | "button" | "table";
export type Selection =
  | { kind: "state", id: string }
  | { kind: "transition", from: string, to: string }
  | { kind: "output", group: SequenceGroup, sequence: Node[] }
  | undefined;

// What a host can ask of the tool, through its ref.
export interface MarkovToolHandle {
  getGraph: () => GraphData;
  // a saved drawing; drawings before version 2 have their origin at the top left
  loadDrawing: (graph: GraphData, version: number) => void;
  // dataset mode's values, which replace the graph; the view is fitted to the new graph unless fit is false
  dataChanged: (values: string[], options?: { fit?: boolean }) => void;
}
