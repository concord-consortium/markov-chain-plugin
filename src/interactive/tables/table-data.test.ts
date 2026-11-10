import { GraphData, Node, SequenceGroup } from "../../type";
import { graphFromValues } from "../../utils/chain-graph";
import { tokenize, tokensToValues } from "../input/tokenizer";
import {
  buildTable, maxTableBytes, outputsTableFull, storedBytes, TableSource, tableChoices, tableWords,
} from "./table-data";

const node = (id: string, label: string, value = 1): Node => ({ id, label, value });

const tokens = tokenize("a b a b a c", "lowercase");
const dataGraph = graphFromValues(tokensToValues(tokens));

const drawGraph: GraphData = {
  nodes: [node("2", "sun"), node("1", "rain"), node("3", "wind")],
  edges: [
    { from: "1", to: "2", value: 1 }, { from: "1", to: "3", value: 2 },
    { from: "2", to: "1", value: 0 }, { from: "2", to: "3", value: 0 },
  ],
};

const group = (overrides: Partial<SequenceGroup>): SequenceGroup => ({
  startingState: "", startingNode: undefined, delimiter: " ", lengthLimit: 5, sequences: [], ...overrides,
});

const groups = [
  group({ sequences: [[node("a", "a"), node("b", "b")], [node("c", "c")]] }),
  group({
    startingState: "b", startingNode: node("s", "b"), delimiter: "", lengthLimit: 9, orderMatters: false,
    sequences: [[node("b", "b"), node("a", "a")]],
  }),
];

const dataSource: TableSource = { mode: "useData", tokens, graph: dataGraph, sequenceGroups: groups };
const drawSource: TableSource = { mode: "draw", tokens: [], graph: drawGraph, sequenceGroups: [] };

describe("the Input table", () => {
  const input = buildTable("Input", { ...dataSource, tokens: tokenize("The cat.\n\nthe [a b]", "lowercase") });

  it("has a row per token as typed, with no row for a blank line", () => {
    expect(input.rows).toEqual([["The", 1], ["cat", 2], [".", 3], ["the", 4], ["a b", 5]]);
  });

  it("has its columns", () => {
    expect(input.word).toBe("Input");
    expect(input.cols).toEqual(["Word", "Position"]);
    expect(input.colTypes).toEqual(["categorical", "numeric"]);
  });
});

describe("the States table", () => {
  it("has sorted states with counts in Data mode", () => {
    const states = buildTable("States", dataSource);
    expect(states.cols).toEqual(["State", "Count"]);
    expect(states.colTypes).toEqual(["categorical", "numeric"]);
    expect(states.rows).toEqual([["a", 3], ["b", 2], ["c", 1]]);
  });

  it("has sorted states with no counts in Draw mode", () => {
    const states = buildTable("States", drawSource);
    expect(states.cols).toEqual(["State"]);
    expect(states.colTypes).toEqual(["categorical"]);
    expect(states.rows).toEqual([["rain"], ["sun"], ["wind"]]);
  });
});

describe("the Transitions table", () => {
  it("has sorted transitions with counts and probabilities in Data mode", () => {
    const transitions = buildTable("Transitions", dataSource);
    expect(transitions.cols).toEqual(["From", "To", "Count", "Probability"]);
    expect(transitions.colTypes).toEqual(["categorical", "categorical", "numeric", "numeric"]);
    expect(transitions.rows).toEqual([["a", "b", 2, 0.6667], ["a", "c", 1, 0.3333], ["b", "a", 2, 1]]);
  });

  it("has no counts in Draw mode, and 0 where a state's arrows total 0", () => {
    const transitions = buildTable("Transitions", drawSource);
    expect(transitions.cols).toEqual(["From", "To", "Probability"]);
    expect(transitions.colTypes).toEqual(["categorical", "categorical", "numeric"]);
    expect(transitions.rows).toEqual([
      ["rain", "sun", 0.3333], ["rain", "wind", 0.6667], ["sun", "rain", 0], ["sun", "wind", 0],
    ]);
  });
});

describe("the Outputs table", () => {
  it("numbers outputs across groups and says how each was made", () => {
    const outputs = buildTable("Outputs", dataSource);
    expect(outputs.cols).toEqual(
      ["Output number", "Output", "Starting state", "Max length", "Delimiter", "Order matters"]);
    expect(outputs.colTypes).toEqual(
      ["numeric", "categorical", "categorical", "numeric", "categorical", "categorical"]);
    expect(outputs.rows).toEqual([
      [1, "a b", "(any)", 5, "(space)", "Yes"],
      [2, "c", "(any)", 5, "(space)", "Yes"],
      [3, "ba", "b", 9, "(none)", "No"],
    ]);
  });

  it("names a delimiter of only spaces, and keeps any other as typed", () => {
    const delimiters = ["  ", " - ", "-"];
    const sequenceGroups = delimiters.map(delimiter =>
      group({ delimiter, sequences: [[node("a", "a"), node("b", "b")]] }));
    const outputs = buildTable("Outputs", { ...dataSource, sequenceGroups });
    expect(outputs.rows.map(row => row[4])).toEqual(["(space)", " - ", "-"]);
    expect(outputs.rows.map(row => row[1])).toEqual(["a  b", "a - b", "a-b"]);
  });

  it("has the same columns in Draw mode", () => {
    const outputs = buildTable("Outputs", { ...drawSource, sequenceGroups: groups });
    expect(outputs.cols).toEqual(
      ["Output number", "Output", "Starting state", "Max length", "Delimiter", "Order matters"]);
    expect(outputs.colTypes).toEqual(
      ["numeric", "categorical", "categorical", "numeric", "categorical", "categorical"]);
    expect(outputs.rows).toHaveLength(3);
  });
});

describe("column names", () => {
  const cols = [dataSource, drawSource].flatMap(source => tableWords.flatMap(word => buildTable(word, source).cols));

  // the Datalog plugin refuses a snapshot with one of these
  it.each(["__objectId", "__id__", "__proto__"])("never uses %s", reserved => {
    expect(cols.length).toBeGreaterThan(0);
    expect(cols).not.toContain(reserved);
  });
});

describe("outputsTableFull", () => {
  const oneOutput = (label: string) => [group({ sequences: [[node("a", label)]] })];
  const emptyLabelBytes = storedBytes(buildTable("Outputs", { ...dataSource, sequenceGroups: oneOutput("") }));

  it("is false just under the limit and true at it", () => {
    const fits = maxTableBytes - emptyLabelBytes;
    expect(outputsTableFull(oneOutput("x".repeat(fits - 1)))).toBe(false);
    expect(outputsTableFull(oneOutput("x".repeat(fits)))).toBe(true);
  });

  it("counts bytes, not characters", () => {
    const characters = Math.ceil((maxTableBytes - emptyLabelBytes) / 2);
    expect(outputsTableFull(oneOutput("é".repeat(characters)))).toBe(true);
    expect(outputsTableFull(oneOutput("x".repeat(characters)))).toBe(false);
  });
});

describe("tableChoices", () => {
  const rules = { orderMatters: true, hasGenerator: true };
  const offered = (source: TableSource, options = rules) => tableChoices(source, options).map(({ word }) => word);
  const emptyOnes = (source: TableSource) =>
    tableChoices(source, rules).filter(({ empty }) => empty).map(({ word }) => word);

  it("offers every table in order in Data mode", () => {
    expect(offered(dataSource)).toEqual(["Input", "States", "Transitions", "Outputs"]);
  });

  it("offers no Input in Draw mode", () => {
    expect(offered(drawSource)).toEqual(["States", "Transitions", "Outputs"]);
  });

  it("offers no Transitions with order off in Data mode", () => {
    expect(offered(dataSource, { ...rules, orderMatters: false })).toEqual(["Input", "States", "Outputs"]);
  });

  it("offers Transitions in Draw mode with order off", () => {
    expect(offered(drawSource, { ...rules, orderMatters: false })).toEqual(["States", "Transitions", "Outputs"]);
  });

  it("offers no Outputs without a generator", () => {
    expect(offered(dataSource, { ...rules, hasGenerator: false })).toEqual(["Input", "States", "Transitions"]);
  });

  it("marks nothing empty when every table has rows", () => {
    expect(emptyOnes(dataSource)).toEqual([]);
  });

  it("marks only Outputs empty with no outputs", () => {
    expect(emptyOnes({ ...dataSource, sequenceGroups: [] })).toEqual(["Outputs"]);
  });

  it("marks Transitions empty too with one word", () => {
    const oneWord = tokenize("a", "lowercase");
    expect(emptyOnes({
      ...dataSource, tokens: oneWord, graph: graphFromValues(tokensToValues(oneWord)), sequenceGroups: [],
    })).toEqual(["Transitions", "Outputs"]);
  });
});
