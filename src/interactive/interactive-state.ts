import { isRecord, parseState } from "./parse-state";

// What the interactive saves for a student. The class dashboard counts a student as having opened the interactive
// once their state isn't empty, so it always holds the version.
export const interactiveStateVersion = 1;

// the most text the input takes, in the text box and through the table's edits
export const maxInputLength = 50000;

export interface MarkovInteractiveState {
  version: typeof interactiveStateVersion;
  // the text the table and the graph are rebuilt from
  input?: { text: string };
}

// whatever the Activity Player hands back, read as the saved input text, or undefined for none; it never throws
export const readSavedInput = (raw: unknown): string | undefined => {
  const { input } = parseState(raw);
  return isRecord(input) && typeof input.text === "string" ? input.text : undefined;
};
