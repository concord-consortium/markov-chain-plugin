// Every event the Markov tool and the AP workspace log. LOGGED-EVENTS.md describes each, and a test keeps
// the two equal.
export const logEvents = [
  "SequencePlayed", "SequenceStepped", "SequencePaused", "SequenceResumed", "SequenceCanceled", "SequenceGenerated",
  "GeneratorSettingChanged", "OutputCleared", "OutputSelected",
  "StateSelected", "TransitionSelected", "SelectionCleared", "StateDialogOpened", "StateMoved",
  "StateAdded", "TransitionAdded", "StateDeleted", "TransitionDeleted", "StateEdited", "TextToGraph", "GraphReset",
  "InputCommitted", "CaseSensitivityChanged", "TableRowAdded", "TableRowDeleted", "PaneOpened", "PaneClosed",
  "PaneResized", "InspectTabChosen", "InspectSorted",
] as const;
export type LogEvent = typeof logEvents[number];
