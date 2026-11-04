import { bagArrows, bagOutgoing, chainOutgoing, LabelState, percentOf, probabilityLabels } from "./graph-labels";
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

  describe("in a drawing, whose values are weights", () => {
    const weights = [edge("a", "b", 0.25), edge("a", "c", 0.75), edge("b", "a", 2)];

    it("labels a chosen state's arrows by their share", () => {
      expect(summary(state(weights, { selectedNodeId: "a" }))).toEqual(["a>b 25% full", "a>c 75% full"]);
    });

    it("labels a generating step's candidates by their share", () => {
      expect(summary(state(weights, { animating: true, highlightNode: node("a"), highlightAllNextNodes: true })))
        .toEqual(["a>b 25% full", "a>c 75% full"]);
    });

    it("labels a chosen output by its shares", () => {
      expect(summary(state(weights, { highlightOutputNodes: [node("a"), node("b")] })))
        .toEqual(["a>b 25% full", "a>c 75% faded"]);
    });
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

describe("the bag of words", () => {
  // "the cat the mat the"
  const nodes = [{ ...node("the"), value: 3 }, node("cat"), node("mat")];
  const outgoing = bagOutgoing(nodes);
  const bag = (rest: Partial<LabelState>): LabelState => ({
    outgoing, animating: false, highlightAllNextNodes: false, stepsOnly: true, ...rest
  });

  describe("bagOutgoing", () => {
    it("goes from any state to every state, itself included, weighted by count", () => {
      const percents = ["the>the 60% full", "the>cat 20% full", "the>mat 20% full"];
      expect(summary(bag({ selectedNodeId: "the" }))).toEqual(percents);
      expect(summary(bag({ selectedNodeId: "cat" }))).toEqual(percents.map(label => label.replace("the>", "cat>")));
    });

    it("goes nowhere from a state the graph doesn't have", () => {
      expect(outgoing("dog")).toEqual([]);
    });
  });

  it("labels a generating step's candidates", () => {
    expect(summary(bag({ animating: true, highlightNode: node("cat"), highlightAllNextNodes: true })))
      .toEqual(["cat>the 60% full", "cat>cat 20% full", "cat>mat 20% full"]);
  });

  describe("a chosen output's labels", () => {
    it("label exactly its steps, with stepsOnly", () => {
      const highlightOutputNodes = [node("the"), node("cat"), node("the")];
      expect(summary(bag({ highlightOutputNodes }))).toEqual(["the>cat 20% full", "cat>the 60% full"]);
    });

    it("skip a step from a state the input no longer has", () => {
      const highlightOutputNodes = [node("dog"), node("the"), node("cat")];
      expect(summary(bag({ highlightOutputNodes }))).toEqual(["the>cat 20% full"]);
    });
  });

  describe("bagArrows", () => {
    const arrows = (rest: Partial<Parameters<typeof bagArrows>[0]>) =>
      bagArrows({ ...bag({}), ...rest }).map(({ from, to, kind }) => `${from}>${to} ${kind}`);

    it("draws nothing with nothing chosen", () => {
      expect(arrows({})).toEqual([]);
    });

    it("draws a chosen state's arrows to every state, and none into it", () => {
      expect(arrows({ selectedNodeId: "cat" })).toEqual(["cat>the chosen", "cat>cat chosen", "cat>mat chosen"]);
    });

    it("draws a generating step's candidates, and then only the step taken", () => {
      const animating = { animating: true, selectedNodeId: "mat" };
      expect(arrows({ ...animating, highlightNode: node("cat"), highlightAllNextNodes: true }))
        .toEqual(["cat>the candidate", "cat>cat candidate", "cat>mat candidate"]);
      expect(arrows({ ...animating, highlightNode: node("the"), highlightEdge: { from: "cat", to: "the", value: 3 } }))
        .toEqual(["cat>the step"]);
      expect(arrows({ ...animating, highlightNode: node("the") })).toEqual([]);
    });

    it("draws a chosen output's steps once each, over a chosen state", () => {
      const highlightOutputNodes = [node("the"), node("cat"), node("the"), node("cat")];
      expect(arrows({ highlightOutputNodes, selectedNodeId: "mat" })).toEqual(["the>cat step", "cat>the step"]);
    });

    it("draws no step from or to a state the input no longer has", () => {
      const highlightOutputNodes = [node("dog"), node("the"), node("bird")];
      expect(arrows({ highlightOutputNodes })).toEqual([]);
    });
  });
});
