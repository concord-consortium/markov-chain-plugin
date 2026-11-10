import { AnyStartingState } from "../../components/generator";
import { GraphData, SequenceGroup } from "../../type";
import { ModeId, yesNo } from "../authored-state";
import { Token } from "../input/tokenizer";
import { toPlaces } from "../workspace/build-state";
import { inspectColumns, stateRows, transitionRows } from "../workspace/inspect-rows";

export type ColumnType = "categorical" | "numeric";
export type Cell = string | number;

export const tableWords = ["Input", "States", "Transitions", "Outputs"] as const;
export type TableWord = typeof tableWords[number];

export const tableLabels: Record<TableWord, string> = {
  Input: "Input data", States: "States", Transitions: "Transitions", Outputs: "Outputs",
};

export interface TableData {
  word: TableWord;
  cols: string[];
  colTypes: ColumnType[];
  rows: Cell[][];
}

export interface TableSource {
  mode: ModeId;
  tokens: Token[];
  graph: GraphData;
  sequenceGroups: SequenceGroup[];
}

type Column = [string, ColumnType];

const table = (word: TableWord, columns: Column[], rows: Cell[][]): TableData =>
  ({ word, cols: columns.map(([col]) => col), colTypes: columns.map(([, type]) => type), rows });

const inputTable = ({ tokens }: TableSource) => {
  const words = tokens.flatMap(token => token.kind === "word" ? [token.text] : []);
  return table("Input", [["Word", "categorical"], ["Position", "numeric"]],
    words.map((word, index) => [word, index + 1]));
};

const statesTable = ({ mode, graph }: TableSource) => {
  const counted = inspectColumns(mode).states.some(column => column === "count");
  const columns: Column[] = [["State", "categorical"], ...(counted ? [["Count", "numeric"] as Column] : [])];
  return table("States", columns,
    stateRows(graph).map(row => counted ? [row.label, row.count] : [row.label]));
};

const transitionsTable = ({ mode, graph }: TableSource) => {
  const counted = inspectColumns(mode).transitions.some(column => column === "count");
  const columns: Column[] = [
    ["From", "categorical"], ["To", "categorical"],
    ...(counted ? [["Count", "numeric"] as Column] : []),
    ["Probability", "numeric"],
  ];
  return table("Transitions", columns, transitionRows(graph).map(row => {
    const probability = row.outOf > 0 ? toPlaces(row.count / row.outOf, 4) : 0;
    return [row.fromLabel, row.toLabel, ...(counted ? [row.count] : []), probability];
  }));
};

// CODAP shows a value of only spaces as empty
const delimiterLabel = (delimiter: string) => {
  if (delimiter === "") {
    return "(none)";
  }
  return delimiter.trim() === "" ? "(space)" : delimiter;
};

const outputsTable = ({ sequenceGroups }: Pick<TableSource, "sequenceGroups">) => {
  let number = 0;
  const rows = sequenceGroups.flatMap(group => group.sequences.map(sequence => [
    ++number, sequence.map(node => node.label).join(group.delimiter), group.startingNode?.label ?? AnyStartingState,
    group.lengthLimit, delimiterLabel(group.delimiter), yesNo(group.orderMatters !== false),
  ]));
  return table("Outputs", [
    ["Output number", "numeric"], ["Output", "categorical"], ["Starting state", "categorical"],
    ["Max length", "numeric"], ["Delimiter", "categorical"], ["Order matters", "categorical"],
  ], rows);
};

const builders: Record<TableWord, (source: TableSource) => TableData> = {
  Input: inputTable, States: statesTable, Transitions: transitionsTable, Outputs: outputsTable,
};

export const buildTable = (word: TableWord, source: TableSource) => builders[word](source);

// inside Firestore's 1 MiB for a document, with room for the fields beside the table and for the last sequence
export const maxTableBytes = 1000000;

export const storedBytes = ({ rows }: TableData) => new Blob([JSON.stringify({ rows })]).size;

export const outputsTableFull = (sequenceGroups: SequenceGroup[]) =>
  storedBytes(outputsTable({ sequenceGroups })) >= maxTableBytes;

export interface TableChoice {
  word: TableWord;
  // a table with nothing in it yet is offered, off, and can't be chosen
  empty: boolean;
}

interface ChoiceRules {
  orderMatters: boolean;
  hasGenerator: boolean;
}

// the tables the popup offers for what is showing, in order
export const tableChoices = (source: TableSource, { orderMatters, hasGenerator }: ChoiceRules): TableChoice[] => {
  const offered = tableWords.filter(word => {
    switch (word) {
      case "Input":
        return source.mode === "useData";
      case "Transitions":
        return source.mode === "draw" || orderMatters;
      case "Outputs":
        return hasGenerator;
      default:
        return true;
    }
  });
  return offered.map(word => ({ word, empty: buildTable(word, source).rows.length === 0 }));
};
