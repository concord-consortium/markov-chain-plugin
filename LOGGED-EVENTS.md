# Logged Events Reference

All events are logged with `@concord-consortium/lara-interactive-api`'s `log()` function, and only when the Markov Interactive runs inside the Activity Player. The CODAP plugin and the interactive opened on its own log nothing.

Every event's data also carries `mode`, `useData` or `draw`, the mode it came from.

A state is named by its label. The generator's settings, which several events carry, are `{ startingState, maxLength, delimiter, fast, orderMatters }`: the starting state (`""` for any), the maximum length, the delimiter, whether the fast speed is on, and whether order mattered (false for a bag of words).

## Generator

| Event | Parameters | When |
|-------|-----------|------|
| `SequencePlayed` | `{ startingState, maxLength, delimiter, fast, orderMatters }` | The student clicks Play |
| `SequenceStepped` | `{ startingState, maxLength, delimiter, fast, orderMatters }` | The student clicks Step, once per click |
| `SequencePaused` | `{ startingState, maxLength, delimiter, fast, orderMatters }` | The student clicks Pause |
| `SequenceResumed` | `{ startingState, maxLength, delimiter, fast, orderMatters }` | The student clicks Resume |
| `SequenceCanceled` | `{ startingState, maxLength, delimiter, fast, orderMatters }` | The student clicks Cancel while a sequence plays or steps |
| `SequenceGenerated` | `{ sequence, startingState, maxLength, delimiter, fast, orderMatters }` | A sequence finishes, played or stepped to its end; `sequence` is its states |
| `GeneratorSettingChanged` | `{ setting: "startingState" \| "maxLength" \| "delimiterType" \| "delimiter" \| "fast", value }` | The student changes a generator setting: the starting state, the delimiter's type and the speed when chosen, Max Length and the "other" delimiter's text when their field loses focus with a changed value |
| `OutputCleared` | `{ mode }` | The student clicks Clear Output |
| `OutputLimitReached` | `{ outputs }` | A sequence ending or a drawing growing reaches the limit on what is saved, or where Send to CODAP shows, a mode's Outputs table reaches the size a snapshot can store; either stops new sequences; `outputs` is how many are saved, in both modes |
| `OutputSelected` | `{ sequence }` | The student clicks an output to highlight it; `sequence` is its states |

## Selection and highlighting

| Event | Parameters | When |
|-------|-----------|------|
| `StateSelected` | `{ state, source: "graph" \| "inspect" \| "table" }` | The student chooses a state in the graph, an Inspect States row, or the input table |
| `TransitionSelected` | `{ from, to, source: "graph" \| "inspect" }` | The student chooses a transition by its arrow in the graph or its Inspect Transitions row |
| `SelectionCleared` | `{ via: "toggle" \| "background" \| "escape" \| "button" \| "table" }` | A chosen state, transition or output is cleared: by choosing it again, clicking the graph's background, pressing Escape, the Clear highlight button, or focusing an empty input table row |
| `StateDialogOpened` | `{ state }` | The student double-clicks a state to see its probabilities, or in Draw mode to edit it. With "Order matters" off, a double-click in Data mode opens no dialog and logs nothing |
| `StateMoved` | `{ state }` | The student drags a state to a new place |

## Drawing

| Event | Parameters | When |
|-------|-----------|------|
| `StateAdded` | `{ state }` | The student adds a state |
| `TransitionAdded` | `{ from, to }` | The student adds a transition that wasn't there |
| `StateDeleted` | `{ state }` | The student deletes a state |
| `TransitionDeleted` | `{ from, to }` | The student deletes a transition |
| `StateEdited` | `{ state, transitions: [{ to, value }] }` | The student saves a state's label and probabilities in its dialog |
| `GraphReset` | `{ mode }` | The student confirms Reset |

## Input

| Event | Parameters | When |
|-------|-----------|------|
| `InputCommitted` | `{ view: "text" \| "table", how: "separator" \| "insert" \| "remove" \| "pause" \| "blur" \| "row", tokens, states }` | The input commits and the graph changes: `tokens` (the words, plus one for each run of blank lines between words) and `states` are the counts after it |
| `CaseSensitivityChanged` | `{ caseSensitive, states }` | The student changes the "Case sensitive" switch, which reads the input again; `states` is the count after it |
| `TableRowAdded` | `{ mode }` | The student adds a row to the input table |
| `TableRowDeleted` | `{ mode }` | The student deletes a row from the input table |
| `CsvUploaded` | `{ rows, tokens, states }` | A CSV file replaces the input: `rows` is the file's rows after the header, `tokens` the table's rows after the upload (words and breaks), `states` the graph's states. It takes the place of `InputCommitted`. The file's name is not logged |
| `CsvUploadRefused` | `{ reason: "tooLong" \| "tooLarge" \| "noValues" \| "unreadable" }` | A CSV file is refused, leaving the input as it was: its text would pass the input's limit, the file is over 2 MB, its column has no values, or it couldn't be read or isn't text (`unreadable`). The file's name is not logged |

## Panes and Inspect

| Event | Parameters | When |
|-------|-----------|------|
| `PaneOpened` | `{ pane: "input" \| "graph" \| "inspect" \| "generator" \| "generatorControls" }` | The student opens a collapsed pane |
| `PaneClosed` | `{ pane: "input" \| "graph" \| "inspect" \| "generator" \| "generatorControls" }` | The student collapses a pane |
| `PaneResized` | `{ divider: "input" \| "inspect" \| "rows" \| "inputSplit", sizes }` | A divider drag ends, or a divider moved with the arrow keys loses focus: `sizes` is `{ input, inspect, top }` in px for the pane dividers (fitted to a narrow row, so a column divider's can be fractional), and `{ inputSplit }`, the text box's share of the linked view's height, for the split |
| `InspectTabChosen` | `{ tab: "states" \| "transitions" }` | The student chooses an Inspect tab |
| `InspectSorted` | `{ tab, column, direction: "ascending" \| "descending" }` | The student sorts an Inspect table by a column |

## Modes and views

| Event | Parameters | When |
|-------|-----------|------|
| `ModeSwitched` | `{ mode }` | The student switches between Data and Draw; `mode` is the mode switched to |
| `ProbabilitiesToggled` | `{ on }` | The student presses "Show probabilities" |
| `OrderMattersToggled` | `{ on }` | The student changes the "Order matters" switch |

## Tables

`action` is `send` or `download`, the button pressed. `tables` is the table words chosen: `Input`, `States`, `Transitions` and `Outputs`.

| Event | Parameters | When |
|-------|-----------|------|
| `TablesDialogOpened` | `{ action }` | The student presses Send to CODAP or Download tables, and the popup opens |
| `TablesDialogCanceled` | `{ action }` | The student closes the popup with Cancel or Escape, before anything is saved |
| `TablesSent` | `{ name, tables }` | The chosen tables are saved as a snapshot; `name` is the name the student chose |
| `TablesSendFailed` | `{ name, tables }` | The popup stops waiting: a save fails or takes over 30 seconds. A write still going at 30 seconds can finish later, so the snapshot may exist |
| `TablesDownloaded` | `{ name, tables }` | The popup's files have all started downloading; `name` is the name the student chose |
