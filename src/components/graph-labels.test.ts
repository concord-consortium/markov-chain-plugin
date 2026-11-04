import { chainOutgoing, LabelState, percentOf, probabilityLabels } from "./graph-labels";
import { Edge, Node } from "../type";

const node = (id: string): Node => ({ id, label: id, value: 1 });
const edge = (from: string, to: string, value = 1): Edge => ({ from, to, value });

const state = (edges: Edge[], rest: Partial<LabelState>): LabelState => ({
  outgoing: chainOutgoing(edges), animating: false, highlightAllNextNodes: false, ...rest
});
const summary = (s: LabelState) =>
  probabilityLabels(s).map(({ from, to, text, strength }) => `${from}>${to} ${text} ${strength}`);

describe("percentOf", () => {
  it("rounds to a whole percent", () => {
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(1, 3)).toBe(33);
  });

  it("gives 0 for a total of 0", () => {
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("probabilityLabels", () => {
  // "the cat the mat the"
  const sentence = [edge("the", "cat"), edge("cat", "the"), edge("the", "mat"), edge("mat", "the")];

  it("labels nothing with nothing chosen", () => {
    expect(summary(state(sentence, {}))).toEqual([]);
  });

  it("labels a chosen state's outgoing arrows", () => {
    expect(summary(state(sentence, { selectedNodeId: "the" }))).toEqual(["the>cat 50% full", "the>mat 50% full"]);
  });

  it("counts a chosen state's loop among its arrows, and labels it", () => {
    const edges = [edge("a", "a", 1), edge("a", "b", 3)];
    expect(summary(state(edges, { selectedNodeId: "a" }))).toEqual(["a>a 25% full", "a>b 75% full"]);
  });

  it("treats an empty output as no output", () => {
    expect(summary(state(sentence, { highlightOutputNodes: [], selectedNodeId: "the" })))
      .toEqual(["the>cat 50% full", "the>mat 50% full"]);
  });

  it("labels a generating step's candidates only while it shows them", () => {
    const step = { animating: true, highlightNode: node("the"), selectedNodeId: "cat" };
    expect(summary(state(sentence, { ...step, highlightAllNextNodes: true })))
      .toEqual(["the>cat 50% full", "the>mat 50% full"]);
    expect(summary(state(sentence, { ...step, highlightAllNextNodes: false }))).toEqual([]);
  });

  describe("for a chosen output", () => {
    const edges = [edge("a", "b", 2), edge("a", "c"), edge("b", "a"), edge("b", "d"), edge("c", "a")];

    it("labels the steps full, other arrows from path states faded, and nothing from the last state", () => {
      const highlightOutputNodes = [node("a"), node("b"), node("a"), node("c")];
      expect(summary(state(edges, { highlightOutputNodes }))).toEqual([
        "a>b 67% full", "a>c 33% full", "b>a 50% full", "b>d 50% faded",
      ]);
    });

    it("labels every step taken from a state the path repeats", () => {
      const highlightOutputNodes = [node("a"), node("b"), node("a"), node("c"), node("a")];
      expect(summary(state(edges, { highlightOutputNodes })).filter(label => label.startsWith("a>")))
        .toEqual(["a>b 67% full", "a>c 33% full"]);
    });

    it("gives a step missing from the graph no label", () => {
      const highlightOutputNodes = [node("c"), node("d"), node("a")];
      expect(summary(state(edges, { highlightOutputNodes }))).toEqual(["c>a 100% faded"]);
    });

    it("takes precedence over a chosen state", () => {
      const highlightOutputNodes = [node("c"), node("a")];
      expect(summary(state(edges, { highlightOutputNodes, selectedNodeId: "b" }))).toEqual(["c>a 100% full"]);
    });

    it("gives way to the generator", () => {
      const highlightOutputNodes = [node("c"), node("a")];
      expect(summary(state(edges, { highlightOutputNodes, animating: true }))).toEqual([]);
    });

    it("leaves out the faded labels with stepsOnly", () => {
      const highlightOutputNodes = [node("a"), node("b")];
      expect(summary(state(edges, { highlightOutputNodes, stepsOnly: true }))).toEqual(["a>b 67% full"]);
    });
  });
});
