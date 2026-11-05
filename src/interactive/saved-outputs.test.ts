import { Node, SequenceGroup } from "../type";
import { defaultAuthoredState, maxStartingTextLength } from "./authored-state";
import { interactiveStateVersion, maxInputLength } from "./interactive-state";
import {
  decodeOutputs, encodeOutputs, isSavedOutputs, maxOutputBytes, outputsFull, savedBytes, SavedOutputs
} from "./saved-outputs";
import { maxSavedPositions } from "./workspace/build-state";

const node = (id: string, label = id): Node => ({ id, label, value: 3 });

const group = (sequences: Node[][], settings: Partial<SequenceGroup> = {}): SequenceGroup =>
  ({ delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined, sequences, ...settings });

const labels = (groups: SequenceGroup[]) => groups.map(g => g.sequences.map(s => s.map(n => n.label)));
const ids = (groups: SequenceGroup[]) => groups.map(g => g.sequences.map(s => s.map(n => n.id)));

describe("encodeOutputs and decodeOutputs", () => {
  it("gives back no groups for no groups", () => {
    expect(encodeOutputs([])).toEqual({ states: [], groups: [] });
    expect(decodeOutputs({ states: [], groups: [] })).toEqual([]);
  });

  it("gives back the settings, labels and ids of two groups that share a state", () => {
    const [the, cat, dog] = [node("the"), node("cat"), node("dog")];
    const groups = [
      group([[the, cat], [cat, the]], { delimiter: "-", lengthLimit: 2, startingState: "the", startingNode: the }),
      group([[the, dog]], { orderMatters: false }),
    ];
    const encoded = encodeOutputs(groups);
    expect(encoded.states).toEqual(["the", "cat", "dog"]);
    expect(encoded.groups[0].sequences).toEqual([[0, 1], [1, 0]]);
    const decoded = decodeOutputs(encoded);
    expect(labels(decoded)).toEqual(labels(groups));
    expect(decoded[0]).toMatchObject({ delimiter: "-", lengthLimit: 2, startingState: "the" });
    expect(decoded[0].startingNode?.label).toBe("the");
    expect(decoded[1].startingNode).toBeUndefined();
    expect(decoded[1].orderMatters).toBe(false);
    expect(decoded[0].orderMatters).toBeUndefined();
  });

  it("keeps an orderMatters of true, which a new sequence compares to join the group", () => {
    const decoded = decodeOutputs(encodeOutputs([group([[node("a")]], { orderMatters: true })]));
    expect(decoded[0].orderMatters).toBe(true);
  });

  it("writes a pair only for a state whose id isn't its label, and gives both back", () => {
    const groups = [group([[node("n1", "State 1"), node("same")]])];
    const encoded = encodeOutputs(groups);
    expect(encoded.states).toEqual([["n1", "State 1"], "same"]);
    const decoded = decodeOutputs(encoded);
    expect(ids(decoded)).toEqual([[["n1", "same"]]]);
    expect(labels(decoded)).toEqual([[["State 1", "same"]]]);
  });

  it("keeps both labels of a state renamed between outputs", () => {
    const groups = [group([[node("n1", "old")], [node("n1", "new")]])];
    const encoded = encodeOutputs(groups);
    expect(encoded.states).toEqual([["n1", "old"], ["n1", "new"]]);
    expect(labels(decodeOutputs(encoded))).toEqual([[["old"], ["new"]]]);
  });

  it("makes one node for each table entry", () => {
    const [decoded] = decodeOutputs(encodeOutputs([group([[node("a"), node("a")]])]));
    expect(decoded.sequences[0][0]).toBe(decoded.sequences[0][1]);
    expect(decoded.sequences[0][0].value).toBe(0);
  });

  it("gives back the same outputs after a trip through JSON", () => {
    const groups = [group([[node("a")]], { startingState: "a", startingNode: node("a"), orderMatters: false })];
    const encoded = encodeOutputs(groups);
    expect(decodeOutputs(JSON.parse(JSON.stringify(encoded)))).toEqual(decodeOutputs(encoded));
  });
});

describe("decodeOutputs with damaged groups", () => {
  const good = { delimiter: " ", lengthLimit: 5, startingState: "", sequences: [[0]] };

  it("drops only the sequence with a place outside the table", () => {
    const saved: SavedOutputs = { states: ["a"], groups: [{ ...good, sequences: [[0], [0, 1], [-1], [0.5], [0, 0]] }] };
    expect(labels(decodeOutputs(saved))).toEqual([[["a"], ["a", "a"]]]);
  });

  it("drops a sequence or place of the wrong type, without taking a list's own fields for places", () => {
    const sequences = [[0], "a", ["length"]] as unknown as number[][];
    expect(labels(decodeOutputs({ states: ["a"], groups: [{ ...good, sequences }] }))).toEqual([[["a"]]]);
  });

  it("drops a group whose starting state is outside the table, or that isn't a group", () => {
    const groups = [
      { ...good, start: 4 }, "a", { ...good, lengthLimit: "5" }, { ...good, delimiter: 3 },
      { ...good, startingState: 3 }, { ...good, sequences: "a" }, { ...good, orderMatters: "yes" }, good,
    ] as SavedOutputs["groups"];
    expect(decodeOutputs({ states: ["a"], groups })).toHaveLength(1);
  });
});

describe("isSavedOutputs", () => {
  it("takes a table and a list of groups", () => {
    expect(isSavedOutputs({ states: ["a", ["b", "c"]], groups: [] })).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isSavedOutputs(undefined)).toBe(false);
    expect(isSavedOutputs({ states: [] })).toBe(false);
    expect(isSavedOutputs({ groups: [] })).toBe(false);
    expect(isSavedOutputs({ states: [3], groups: [] })).toBe(false);
    expect(isSavedOutputs({ states: [["a"]], groups: [] })).toBe(false);
    expect(isSavedOutputs({ states: [], groups: {} })).toBe(false);
  });
});

describe("savedBytes", () => {
  it("counts a value as JSON in JSON", () => {
    expect(savedBytes({})).toBe(2);
    expect(savedBytes("a")).toBe(5);
  });

  it("counts a quote's two escapes, and a character's UTF-8 bytes", () => {
    expect(savedBytes("\"")).toBe(8);
    expect(savedBytes("é")).toBe(6);
  });
});

describe("outputsFull", () => {
  const noDrawing = { nodes: [], edges: [] };
  // a sequence of a hundred places is about 200 bytes
  const sequences = (count: number) =>
    Array.from({ length: count }, () => Array.from({ length: 100 }, () => node("a")));

  it("is false with nothing saved", () => {
    expect(outputsFull([[], []], noDrawing)).toBe(false);
  });

  it("counts outputs in either mode, and in both together", () => {
    const half = [group(sequences(400))];
    expect(outputsFull([half, []], noDrawing)).toBe(false);
    expect(outputsFull([[], half], noDrawing)).toBe(false);
    expect(outputsFull([half, half], noDrawing)).toBe(true);
    expect(outputsFull([[group(sequences(800))], []], noDrawing)).toBe(true);
    expect(outputsFull([[], [group(sequences(800))]], noDrawing)).toBe(true);
  });

  it("counts the drawing", () => {
    const nodes = Array.from({ length: 2000 }, (_, i) =>
      ({ id: `state${i}`, label: `State ${i}`, value: 1, x: 100, y: 100 }));
    expect(outputsFull([[], []], { nodes: nodes.slice(0, 100), edges: [] })).toBe(false);
    expect(outputsFull([[], []], { nodes, edges: [] })).toBe(true);
  });
});

describe("outputsFull at the limit", () => {
  const drawingOf = (labelLength: number) =>
    ({ nodes: [{ id: "a", label: "x".repeat(labelLength), value: 1 }], edges: [] });
  const bytes = (labelLength: number) => savedBytes([[[], []].map(encodeOutputs), drawingOf(labelLength)]);

  it("is true at exactly the limit, and false a byte under it", () => {
    const labelLength = maxOutputBytes - bytes(0);
    expect(bytes(labelLength)).toBe(maxOutputBytes);
    expect(outputsFull([[], []], drawingOf(labelLength))).toBe(true);
    expect(outputsFull([[], []], drawingOf(labelLength - 1))).toBe(false);
  });
});

describe("the largest state", () => {
  // the Activity Player's getAnswerWithMetadata keeps the report state twice in one answer document, with some 600
  // bytes of other fields
  const answerDocumentBytes = (state: unknown, authoredState: unknown) => {
    const reportState = JSON.stringify({
      mode: "report", authoredState: JSON.stringify(authoredState), interactiveState: JSON.stringify(state),
      interactive: { id: "interactive_1234", name: "Markov" }, version: 1,
    });
    return 2 * new Blob([reportState]).size + 600;
  };

  const fullOutputs = () => {
    const sequence = Array.from({ length: 100 }, () => 0);
    const groups: SavedOutputs["groups"] = [
      { delimiter: "\"", lengthLimit: 100, startingState: "", sequences: [] },
    ];
    const saved: SavedOutputs = { states: ["\""], groups };
    while (savedBytes(saved) < maxOutputBytes) {
      groups[0].sequences.push(sequence);
    }
    return saved;
  };

  const fullMode = {
    panes: { input: true, graph: true, inspect: true, generator: true },
    controlsOpen: true,
    sizes: { input: 280.123456789, inspect: 260.123456789, top: 315 },
    inspect: {
      tab: "transitions",
      sorts: { states: { column: "count", ascending: true }, transitions: { column: "probability", ascending: true } },
    },
    generator: { startingState: "the", lengthLimit: 100, delimiter: "-", delimiterType: "other", fast: true },
    selection: { kind: "output", group: 100, sequence: 1000 },
    view: { x: -1234.56, y: -1234.56, k: 12.3456 },
  };

  it("fits the answer document beside the largest authored state", () => {
    const state = {
      version: interactiveStateVersion,
      input: { text: "\"".repeat(maxInputLength) },
      mode: "useData",
      probabilities: true,
      orderMatters: true,
      caseSensitive: true,
      useData: {
        ...fullMode, outputs: fullOutputs(), inputSplit: 0.123456789,
        positions: Array.from({ length: 2 * maxSavedPositions }, () => -12345),
      },
      draw: { ...fullMode, drawing: { nodes: [], edges: [] } },
    };
    const authoredState = { ...defaultAuthoredState, startingText: "\"".repeat(maxStartingTextLength) };
    expect(savedBytes(state.useData.outputs)).toBeGreaterThanOrEqual(maxOutputBytes);
    expect(answerDocumentBytes(state, authoredState)).toBeLessThan(1048576);
  });
});
