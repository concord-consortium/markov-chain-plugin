// Every event the Markov tool and the AP workspace log. LOGGED-EVENTS.md describes each, and a test keeps
// the two equal.
export const logEvents = [
  "SequencePlayed", "SequenceStepped", "SequencePaused", "SequenceResumed", "SequenceCanceled", "SequenceGenerated",
  "GeneratorSettingChanged", "OutputCleared", "OutputSelected", "OutputLimitReached",
  "StateSelected", "TransitionSelected", "SelectionCleared", "StateDialogOpened", "StateMoved",
  "StateAdded", "TransitionAdded", "StateDeleted", "TransitionDeleted", "StateEdited", "GraphReset",
  "InputCommitted", "CaseSensitivityChanged", "TableRowAdded", "TableRowDeleted", "PaneOpened", "PaneClosed",
  "PaneResized", "InspectTabChosen", "InspectSorted", "ModeSwitched",
  "ProbabilitiesToggled", "OrderMattersToggled", "TablesDialogOpened", "TablesDialogCanceled", "TablesDownloaded",
] as const;
export type LogEvent = typeof logEvents[number];
