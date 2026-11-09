import { clampLengthLimit } from "../components/app-utils";
import type { MarkovToolStart } from "../hooks/use-markov-tool";
import { caseSensitiveLabel, orderMattersLabel, readAuthoredState, yesNo } from "./authored-state";
import { readInteractiveState } from "./interactive-state";
import { restoreWork } from "./workspace/restore-work";
import { workspaceConfig, WorkspacePaneId } from "./workspace/workspace-config";

export const maxSummaryText = 60;

// what the generator shows for no starting state, and the Max Length it opens at when none is saved
export const anyStartLabel = "(any)";
export const defaultMaxLength = 5;

// copies of the Simulation Speed switch's two settings, in lower case, held to them by a test
export const speedNames = { normal: "normal", fast: "fast" };

// copies of the workspace's pane titles, held to them by a test
export const paneTitles: Record<WorkspacePaneId, string> = {
  input: "Input", graph: "Graph", inspect: "Inspect", generator: "Sequence Generator"
};

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// by code point, so a surrogate pair isn't split
const cutShort = (text: string) => {
  const characters = [...text];
  return characters.length > maxSummaryText ? `${characters.slice(0, maxSummaryText).join("")}…` : text;
};

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

// The lines for a saved moment, read as the teacher's read-only view reads it, so the two agree. An output counts when
// its heading's start, Max Length and order match the moment's; a delimiter changes only how it is written.
export const reportSummaryLines = (interactiveState: unknown, authoredState: unknown): string[] => {
  const authored = readAuthoredState(authoredState);
  const configs = { useData: workspaceConfig(authored, "useData"), draw: workspaceConfig(authored, "draw") };
  const restored = restoreWork(readInteractiveState(interactiveState), authored, configs, { readOnly: true });
  const inData = restored.mode === "useData";
  const shown = restored[restored.mode];
  // restoreWork always fills these in
  const { graph, generator, sequenceGroups } = shown.tool as Required<MarkovToolStart>;
  const startingState = generator.startingState ?? "";
  const lengthLimit = clampLengthLimit(generator.lengthLimit) ?? defaultMaxLength;
  // a drawing is always ordered, and with order off Data mode's graph has no arrows and Inspect lists no transitions
  const ordered = !inData || restored.orderMatters;

  const outputs = sequenceGroups
    .filter(group => (group.startingNode?.id ?? "") === startingState && group.lengthLimit === lengthLimit &&
      (group.orderMatters !== false) === ordered)
    .reduce((count, group) => count + group.sequences.length, 0);
  const open = configs[restored.mode].panes.filter(({ id }) => shown.panes[id]).map(({ id }) => paneTitles[id]);
  const speed = generator.fast ? speedNames.fast : speedNames.normal;
  const start = graph.nodes.find(node => node.id === startingState)?.label ?? anyStartLabel;

  return [
    `View: ${open.length > 0 ? open.join(", ") : "none"}`,
    `Probabilities: ${restored.probabilities ? "On" : "Off"}`,
    // a drawing has neither switch
    ...(inData ? [
      `${orderMattersLabel}: ${yesNo(restored.orderMatters)}`,
      `${caseSensitiveLabel}: ${yesNo(restored.capitalization === "asTyped")}`,
    ] : []),
    `${inData ? "Data" : "Drawing"}: ${counted(graph.nodes.length, "state")}, ` +
      counted(ordered ? graph.edges.length : 0, "transition"),
    `Settings: start ${cutShort(start)}, max length ${lengthLimit}, speed ${speed}`,
    `Outputs: ${outputs}`,
  ];
};

// The dashboard shows one block or the other. Each holds a single child so its paragraphs stack in the row the wide
// block is, and the student's text is escaped because the dashboard draws this in a frame on the dashboard's origin.
export const reportSummaryHtml = (interactiveState: unknown, authoredState: unknown) => {
  const lines = reportSummaryLines(interactiveState, authoredState).map(escapeHtml).join("<br>");
  const content = "<div style=\"overflow-wrap: anywhere\"><p>The student has saved work in the interactive.</p>" +
    `<p>${lines}</p></div>`;
  return `<div class="tall">${content}</div><div class="wide">${content}</div>`;
};
