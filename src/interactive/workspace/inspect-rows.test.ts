import { graphFromValues } from "../../utils/chain-graph";
import { tokenize, tokensToValues } from "../input/tokenizer";
import { bagOfWordsExplanation, inspectColumns, sortRows, stateRows, transitionRows } from "./inspect-rows";

// two sentences that share their first pair of words
const graph = graphFromValues(tokensToValues(tokenize("the cat sat on the mat. the cat ran.", "lowercase")));

describe("inspectColumns", () => {
  it("shows Data mode's counts and its count of the total", () => {
    expect(inspectColumns("useData")).toEqual({
      states: ["state", "count"], transitions: ["transition", "count", "probability"], probability: "ofTotal"
    });
  });

  it("shows a drawing no counts and a bare percent", () => {
    expect(inspectColumns("draw")).toEqual({
      states: ["state"], transitions: ["transition", "probability"], probability: "percent"
    });
  });
});

describe("bagOfWordsExplanation", () => {
  it("is the author's wording", () => {
    expect(bagOfWordsExplanation).toBe("All states are connected to all other states. States that appear multiple " +
      "times in the input data have higher probabilities of being selected.");
  });
});

describe("stateRows", () => {
  it("lists each state's count, alphabetically", () => {
    expect(stateRows(graph).map(row => [row.label, row.count])).toEqual([
      [".", 2], ["cat", 2], ["mat", 1], ["on", 1], ["ran", 1], ["sat", 1], ["the", 3],
    ]);
  });
});

describe("transitionRows", () => {
  it("gives a drawing's weights their whole percents", () => {
    const drawing = {
      nodes: [{ id: "a", label: "a", value: 1 }, { id: "b", label: "b", value: 1 }],
      edges: [{ from: "a", to: "a", value: 0.25 }, { from: "a", to: "b", value: 0.75 }],
    };
    expect(transitionRows(drawing).map(row => [row.label, row.percent])).toEqual([["a → a", 25], ["a → b", 75]]);
  });

  it("lists each transition's count and probability, by its first state and then its second", () => {
    expect(transitionRows(graph).map(row => [row.label, row.count, row.probability])).toEqual([
      [". → the", 1, "1 of 1 = 100%"],
      ["cat → ran", 1, "1 of 2 = 50%"],
      ["cat → sat", 1, "1 of 2 = 50%"],
      ["mat → .", 1, "1 of 1 = 100%"],
      ["on → the", 1, "1 of 1 = 100%"],
      ["ran → .", 1, "1 of 1 = 100%"],
      ["sat → on", 1, "1 of 1 = 100%"],
      ["the → cat", 2, "2 of 3 = 67%"],
      ["the → mat", 1, "1 of 3 = 33%"],
    ]);
  });
});

describe("sortRows", () => {
  it("counts a transition of no value from a state of no value as 0, whatever order the rows arrive in", () => {
    const rows = transitionRows({
      nodes: [],
      edges: [
        { from: "a", to: "x", value: 3 }, { from: "a", to: "y", value: 1 }, { from: "b", to: "y", value: 0 },
        { from: "c", to: "x", value: 3 }, { from: "c", to: "z", value: 1 },
      ],
    });
    const percents = (list: typeof rows) => sortRows(list, "probability", true).map(row => row.percent);
    expect(percents(rows)).toEqual([0, 25, 25, 75, 75]);
    expect(percents([...rows].reverse())).toEqual([0, 25, 25, 75, 75]);
  });

  const labels = (rows: { label: string }[]) => rows.map(row => row.label);

  it("sorts states by count both ways, equal counts alphabetically", () => {
    // from the reverse of alphabetical order, so a sort that kept equal rows where they were would show it
    const rows = stateRows(graph).reverse();
    expect(labels(sortRows(rows, "count", true))).toEqual(["mat", "on", "ran", "sat", ".", "cat", "the"]);
    expect(labels(sortRows(rows, "count", false))).toEqual(["the", ".", "cat", "mat", "on", "ran", "sat"]);
  });

  it("sorts states by name in reverse", () => {
    expect(labels(sortRows(stateRows(graph), "state", false))).toEqual(
      ["the", "sat", "ran", "on", "mat", "cat", "."]);
  });

  it("sorts transitions by probability, not count, equal probabilities alphabetically", () => {
    expect(labels(sortRows(transitionRows(graph), "probability", true))).toEqual([
      "the → mat", "cat → ran", "cat → sat", "the → cat",
      ". → the", "mat → .", "on → the", "ran → .", "sat → on",
    ]);
  });

  it("sorts transitions by count descending, and by name in reverse", () => {
    expect(labels(sortRows(transitionRows(graph), "count", false))).toEqual([
      "the → cat", ". → the", "cat → ran", "cat → sat", "mat → .", "on → the", "ran → .", "sat → on", "the → mat",
    ]);
    expect(labels(sortRows(transitionRows(graph), "transition", false))).toEqual(
      labels(transitionRows(graph)).reverse());
  });
});
