import { GraphData, ViewMode } from "../type";

// What the Markov tool needs from whatever hosts it: CODAP for the plugin, the Activity Player for the interactive.
// Keep each function's identity across renders unless what depends on it should run again: a playing sequence
// keeps the outputSequence it started with, and a new markDirty re-sends drawing mode's dirty notice.
export interface MarkovHost {
  viewMode?: ViewMode;
  setViewMode: (viewMode?: ViewMode) => void;
  markDirty: () => void;
  outputSequence: (labels: string[]) => Promise<void>;
}

// What a host can ask of the tool, through its ref.
export interface MarkovToolHandle {
  getGraph: () => GraphData;
  // a saved drawing; drawings before version 2 have their origin at the top left
  loadDrawing: (graph: GraphData, version: number) => void;
  // dataset mode's values, which replace the graph; the view is fitted to the new graph unless fit is false
  dataChanged: (values: string[], options?: { fit?: boolean }) => void;
}
