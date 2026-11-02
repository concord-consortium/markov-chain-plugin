// What the interactive saves for a student. The class dashboard counts a student as having opened the interactive
// once their state isn't empty, so it always holds the version.
export const interactiveStateVersion = 1;

export interface MarkovInteractiveState {
  version: typeof interactiveStateVersion;
}
