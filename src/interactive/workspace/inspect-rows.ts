import { GraphData } from "../../type";
import { compareStateLabels } from "../../components/app-utils";
import { ModeId } from "../authored-state";
import { percentOf } from "../../components/graph-labels";

export interface StateRow { id: string, label: string, count: number }
export interface TransitionRow {
  from: string, to: string, fromLabel: string, toLabel: string,
  // "the → cat"
  label: string,
  count: number,
  // the count of every transition out of the from state
  outOf: number,
  // the whole percent the graph's labels show too
  percent: number,
  // "2 of 3 = 67%"
  probability: string,
}
export type SortColumn = "state" | "count" | "transition" | "probability";
export type InspectTab = "states" | "transitions";
export interface Sort { column: SortColumn, ascending: boolean }

export const bagOfWordsExplanation = "All states are connected to all other states. " +
  "States that appear multiple times in the input data have higher probabilities of being selected.";

// a drawing's values are weights, not counts, so it shows no counts and a bare percent
export const inspectColumns = (mode: ModeId) => mode === "draw"
  ? { states: ["state"], transitions: ["transition", "probability"], probability: "percent" } as const
  : {
      states: ["state", "count"], transitions: ["transition", "count", "probability"], probability: "ofTotal"
    } as const;

const compareLabels = (a: string, b: string) => compareStateLabels({ label: a }, { label: b });

const compareStateRows = (a: StateRow, b: StateRow) => compareLabels(a.label, b.label);

const compareTransitionRows = (a: TransitionRow, b: TransitionRow) =>
  compareLabels(a.fromLabel, b.fromLabel) || compareLabels(a.toLabel, b.toLabel);

export const stateRows = (graph: GraphData): StateRow[] =>
  graph.nodes.map(node => ({ id: node.id, label: node.label, count: node.value })).sort(compareStateRows);

export const transitionRows = (graph: GraphData): TransitionRow[] => {
  const labels = new Map(graph.nodes.map(node => [node.id, node.label]));
  const outOf = new Map<string, number>();
  graph.edges.forEach(edge => outOf.set(edge.from, (outOf.get(edge.from) ?? 0) + edge.value));
  return graph.edges.map(edge => {
    const total = outOf.get(edge.from) ?? 0;
    const percent = percentOf(edge.value, total);
    const fromLabel = labels.get(edge.from) ?? edge.from;
    const toLabel = labels.get(edge.to) ?? edge.to;
    return {
      from: edge.from, to: edge.to, fromLabel, toLabel, label: `${fromLabel} → ${toLabel}`, count: edge.value,
      outOf: total, percent, probability: `${edge.value} of ${total} = ${percent}%`,
    };
  }).sort(compareTransitionRows);
};

const isTransitionRow = (row: StateRow | TransitionRow): row is TransitionRow => "outOf" in row;

const alphabetical = (a: StateRow | TransitionRow, b: StateRow | TransitionRow) =>
  isTransitionRow(a) && isTransitionRow(b) ? compareTransitionRows(a, b) : compareLabels(a.label, b.label);

const columnValue = (row: StateRow | TransitionRow, column: SortColumn) =>
  column === "probability" && isTransitionRow(row) ? (row.outOf > 0 ? row.count / row.outOf : 0) : row.count;

// a column's order, ascending or descending; equal values keep alphabetical order
export const sortRows = <T extends StateRow | TransitionRow>(
  rows: T[], column: SortColumn, ascending: boolean
): T[] => {
  const direction = ascending ? 1 : -1;
  if (column === "state" || column === "transition") {
    return [...rows].sort((a, b) => direction * alphabetical(a, b));
  }
  return [...rows].sort((a, b) =>
    direction * (columnValue(a, column) - columnValue(b, column)) || alphabetical(a, b));
};
