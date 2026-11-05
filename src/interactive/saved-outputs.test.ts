import { Node, SequenceGroup } from "../type";
import { decodeOutputs, encodeOutputs, isSavedOutputs, savedBytes, SavedOutputs } from "./saved-outputs";

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
