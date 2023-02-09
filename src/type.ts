// import {makeAutoObservable, toJS} from "mobx";

export type Node = { id: string | number, label: string, value: number, title?: string, fixed?: boolean } | null;
export type Edge = { from: string | number, to: string | number, value: number, label?: string };
export type GraphData = { nodes: Node[], edges: Edge[] };
