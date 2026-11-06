import { Node, SequenceGroup } from "../../type";
import { tokenize } from "../input/tokenizer";
import { highlightsFor, transitionKey } from "./highlights";

const tokens = tokenize("The cat sat.\n\ncat the cat cat", "lowercase");
// indexes: 0 The, 1 cat, 2 sat, 3 ., 4 break, 5 cat, 6 the, 7 cat, 8 cat
const node = (id: string): Node => ({ id, label: id, value: 1 });

describe("highlightsFor", () => {
  it("lights nothing with nothing chosen", () => {
    expect(highlightsFor(undefined, tokens)).toEqual({ tokens: new Set(), states: new Set(), transitions: new Map() });
  });

  it("lights a state's words, whatever their case, its row, and the rows into and out of it", () => {
    expect(highlightsFor({ kind: "state", id: "the" }, tokens)).toEqual({
      kind: "selected",
      tokens: new Set([0, 6]),
      states: new Set(["the"]),
      transitions: new Map([[transitionKey("the", "cat"), "out"], [transitionKey("cat", "the"), "in"]]),
    });
  });

  it("lights a self-loop's row for its state", () => {
    expect(highlightsFor({ kind: "state", id: "cat" }, tokens).transitions.get(transitionKey("cat", "cat")))
      .toBe("out");
  });

  it("lights a transition's word pairs, its two rows and its own row, but not across a break", () => {
    expect(highlightsFor({ kind: "transition", from: ".", to: "cat" }, tokens).tokens).toEqual(new Set());
    expect(highlightsFor({ kind: "transition", from: "the", to: "cat" }, tokens)).toEqual({
      kind: "selected",
      tokens: new Set([0, 1, 6, 7]),
      states: new Set(["the", "cat"]),
      transitions: new Map([[transitionKey("the", "cat"), "chosen"]]),
    });
  });

  it("lights a self-loop's word pairs", () => {
    expect(highlightsFor({ kind: "transition", from: "cat", to: "cat" }, tokens).tokens).toEqual(new Set([7, 8]));
  });

  it("lights an output's words, its states' rows and its steps' rows", () => {
    const sequence = [node("the"), node("cat"), node("sat")];
    const group: SequenceGroup = { delimiter: " ", lengthLimit: 3, startingState: "", startingNode: undefined,
      sequences: [sequence] };
    expect(highlightsFor({ kind: "output", group, sequence }, tokens)).toEqual({
      kind: "output",
      tokens: new Set([0, 1, 2, 5, 6, 7, 8]),
      states: new Set(["the", "cat", "sat"]),
      transitions: new Map([[transitionKey("the", "cat"), "output"], [transitionKey("cat", "sat"), "output"]]),
    });
  });
});
