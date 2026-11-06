import { GraphData, Node, SequenceGroup } from "../type";
import { isRecord } from "./parse-state";

// the sequences' states once each, and each sequence as places in that table, which take about half the room of labels
export interface SavedOutputs {
  // a state as a string where its id is its label, otherwise [id, label]
  states: (string | [string, string])[];
  groups: {
    delimiter: string, lengthLimit: number, startingState: string, start?: number, orderMatters?: boolean,
    sequences: number[][],
  }[];
}

// what outputs and the drawing may take between them, a share of the 1 MB the Activity Player's answer document holds
export const maxOutputBytes = 140 * 1024;

// generator settings sit outside that limit, so a delimiter needs a limit of its own
export const maxDelimiterLength = 100;

// what a value costs as the Activity Player stores it: JSON held inside JSON
export const savedBytes = (value: unknown) =>
  new Blob([JSON.stringify(JSON.stringify(value))]).size - 2;

const isSavedState = (value: unknown) => typeof value === "string" ||
  (Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "string"));

export const isSavedOutputs = (value: unknown): value is SavedOutputs =>
  isRecord(value) && Array.isArray(value.states) && value.states.every(isSavedState) && Array.isArray(value.groups);

export const encodeOutputs = (sequenceGroups: SequenceGroup[]): SavedOutputs => {
  const states: SavedOutputs["states"] = [];
  const places = new Map<string, number>();
  // a state renamed between outputs is two entries with one id
  const placeOf = ({ id, label }: Node) => {
    const key = JSON.stringify([id, label]);
    let place = places.get(key);
    if (place === undefined) {
      place = states.length;
      places.set(key, place);
      states.push(id === label ? id : [id, label]);
    }
    return place;
  };
  const groups = sequenceGroups.map(group => ({
    delimiter: group.delimiter, lengthLimit: group.lengthLimit, startingState: group.startingState,
    orderMatters: group.orderMatters,
    start: group.startingNode && placeOf(group.startingNode),
    sequences: group.sequences.map(sequence => sequence.map(placeOf)),
  }));
  return { states, groups };
};

export const outputsFull = (outputs: SequenceGroup[][], drawing: GraphData) =>
  savedBytes([outputs.map(encodeOutputs), drawing]) >= maxOutputBytes;

const isSavedGroup = (value: unknown): value is SavedOutputs["groups"][number] =>
  isRecord(value) && typeof value.delimiter === "string" && typeof value.lengthLimit === "number" &&
  typeof value.startingState === "string" && Array.isArray(value.sequences) &&
  (value.orderMatters === undefined || typeof value.orderMatters === "boolean");

export interface DecodedOutputs {
  sequenceGroups: SequenceGroup[];
  // by each group's and sequence's saved place, which leaving one out doesn't move
  places: ({ group: SequenceGroup, sequences: (Node[] | undefined)[] } | undefined)[];
}

// nodes carry no value, which nothing reads from a sequence once it is generated; a group or sequence that names a
// place outside the table is left out
export const decodeOutputs = ({ states, groups }: SavedOutputs): DecodedOutputs => {
  const nodes = states.map<Node>(state => typeof state === "string"
    ? { id: state, label: state, value: 0 }
    : { id: state[0], label: state[1], value: 0 });
  const nodeAt = (place: unknown) => Number.isInteger(place) ? nodes[place as number] : undefined;
  const places = groups.map(saved => {
    if (!isSavedGroup(saved)) {
      return undefined;
    }
    const { delimiter, lengthLimit, startingState, start, orderMatters } = saved;
    const startingNode = nodeAt(start);
    if (start !== undefined && !startingNode) {
      return undefined;
    }
    const sequences = saved.sequences.map(sequence => Array.isArray(sequence) && sequence.every(nodeAt)
      ? sequence.map(place => nodes[place])
      : undefined);
    const group: SequenceGroup = {
      delimiter, lengthLimit, startingState, startingNode, orderMatters,
      sequences: sequences.filter((sequence): sequence is Node[] => sequence !== undefined),
    };
    return { group, sequences };
  });
  const sequenceGroups = places.map(place => place?.group).filter((group): group is SequenceGroup => !!group);
  return { sequenceGroups, places };
};
