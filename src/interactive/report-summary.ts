import { clampLengthLimit } from "../components/app-utils";
import type { MarkovToolStart } from "../hooks/use-markov-tool";
import { readAuthoredState } from "./authored-state";
import { readInteractiveState } from "./interactive-state";
import { restoreWork } from "./workspace/restore-work";
import { workspaceConfig } from "./workspace/workspace-config";

// the most characters of a student's text a line shows
export const maxSummaryText = 60;

// what the generator shows for no starting state, and the Max Length it opens at when none is saved
export const anyStartLabel = "(any)";
export const defaultMaxLength = 5;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// by code point, so a surrogate pair isn't split
const cutShort = (text: string) => {
  const characters = [...text];
  return characters.length > maxSummaryText ? `${characters.slice(0, maxSummaryText).join("")}…` : text;
};

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

// The three lines for a saved moment, read as the teacher's read-only view reads it, so the two agree. An output counts
// when its heading's settings match the third line; a delimiter changes only how it is written.
export const reportSummaryLines = (interactiveState: unknown, authoredState: unknown): string[] => {
  const authored = readAuthoredState(authoredState);
  const restored = restoreWork(readInteractiveState(interactiveState), authored, {
    useData: workspaceConfig(authored, "useData"), draw: workspaceConfig(authored, "draw"),
  }, { readOnly: true });
  const inData = restored.mode === "useData";
  // restoreWork always fills these in
  const { graph, generator, sequenceGroups } = restored[restored.mode].tool as Required<MarkovToolStart>;
  const startingState = generator.startingState ?? "";
  const lengthLimit = clampLengthLimit(generator.lengthLimit) ?? defaultMaxLength;
  const orderMatters = !inData || restored.orderMatters;

  const outputs = sequenceGroups
    .filter(group => (group.startingNode?.id ?? "") === startingState && group.lengthLimit === lengthLimit &&
      (group.orderMatters !== false) === orderMatters)
    .flatMap(group => group.sequences.map(sequence => sequence.map(node => node.label).join(group.delimiter)));
  const latest = outputs[outputs.length - 1];
  const start = graph.nodes.find(node => node.id === startingState)?.label ?? anyStartLabel;
  const words = graph.nodes.reduce((count, node) => count + node.value, 0);

  return [
    inData
      ? `Data: ${counted(words, "word")}, ${counted(graph.nodes.length, "state")}`
      : `Drawing: ${counted(graph.nodes.length, "state")}, ${counted(graph.edges.length, "arrow")}`,
    `Outputs: ${outputs.length}${latest ? `, latest: ${cutShort(latest)}` : ""}`,
    `Settings: start ${cutShort(start)}, max length ${lengthLimit}` +
      (inData ? `, order matters ${orderMatters ? "on" : "off"}` : ""),
  ];
};

// The dashboard shows one block or the other. Each holds a single child so its paragraphs stack in the row the wide
// block is, and the student's text is escaped because the dashboard draws this in a frame on its own origin.
export const reportSummaryHtml = (interactiveState: unknown, authoredState: unknown) => {
  const lines = reportSummaryLines(interactiveState, authoredState).map(escapeHtml).join("<br>");
  const content = "<div style=\"overflow-wrap: anywhere\"><p>The student has saved work in the interactive.</p>" +
    `<p>${lines}</p></div>`;
  return `<div class="tall">${content}</div><div class="wide">${content}</div>`;
};
