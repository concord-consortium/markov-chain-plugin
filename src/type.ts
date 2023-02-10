// import {makeAutoObservable, toJS} from "mobx";

export type Node = { id: string, label: string, value: number };
export type Edge = { from: string, to: string, label?: string, value: number };
export type GraphData = { nodes: Node[], edges: Edge[] };
