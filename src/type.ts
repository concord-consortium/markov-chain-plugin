// import {makeAutoObservable, toJS} from "mobx";

export type Node = { id: string, label: string, value: number, x?: number, y?: number };
export type Edge = { from: string, to: string, value: number };
export type GraphData = { nodes: Node[], edges: Edge[] };

export type ViewMode = "dataset"|"drawing";

export type GenerationMode = "ready" | "playing" | "paused" | "stepping";

export type SequenceGroup = {
  startingState: string;
  startingNode: Node | undefined;
  delimiter: string;
  lengthLimit: number;
  sequences: Node[][];
};

export type DelimiterType = "none"|"space"|"other";

// the CODAP attribute dropped on the plugin in dataset mode, saved in the plugin's state
export type CODAPAttribute = {
  datasetName: string;
  collectionName: string;
  attributeName: string;
};
