# Logged Events Reference

All events are logged with `@concord-consortium/lara-interactive-api`'s `log()` function, and only when the Markov Interactive runs inside the Activity Player. The CODAP plugin and the interactive opened on its own log nothing.

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
| `OutputCleared` | None | The student clicks Clear Output |
| `OutputSelected` | `{ sequence }` | The student clicks an output to highlight it; `sequence` is its states |

## Selection and highlighting

| Event | Parameters | When |
|-------|-----------|------|
| `StateSelected` | `{ state, source: "graph" \| "inspect" \| "table" }` | The student chooses a state in the graph, an Inspect States row, or the input table |
| `TransitionSelected` | `{ from, to, source: "graph" \| "inspect" }` | The student chooses a transition by its arrow in the graph or its Inspect Transitions row |
| `SelectionCleared` | `{ via: "toggle" \| "background" \| "escape" \| "button" \| "table" }` | A chosen state, transition or output is cleared: by choosing it again, clicking the graph's background, pressing Escape, the Clear highlight button, or focusing an empty input table row |
| `StateDialogOpened` | `{ state }` | The student double-clicks a state to see its probabilities |
| `StateMoved` | `{ state }` | The student drags a state to a new place |

## Drawing

| Event | Parameters | When |
|-------|-----------|------|
| `StateAdded` | `{ state }` | The student adds a state |
| `TransitionAdded` | `{ from, to }` | The student adds a transition that wasn't there |
| `StateDeleted` | `{ state }` | The student deletes a state |
| `TransitionDeleted` | `{ from, to }` | The student deletes a transition |
| `StateEdited` | `{ state, transitions: [{ to, value }] }` | The student saves a state's label and probabilities in its dialog |
| `TextToGraph` | `{ words }` | Create From Text builds a graph from changed text; `words` is the number of words |
| `GraphReset` | None | The student confirms Reset |

## Input

| Event | Parameters | When |
|-------|-----------|------|
| `InputCommitted` | `{ view: "text" \| "table", how: "separator" \| "insert" \| "remove" \| "pause" \| "blur" \| "row", tokens, states }` | The input commits and the graph changes: `tokens` (the words, plus one for each run of blank lines between words) and `states` are the counts after it |
| `CaseSensitivityChanged` | `{ caseSensitive, states }` | The student changes the "Case sensitive" switch, which reads the input again; `states` is the count after it |
| `TableRowAdded` | None | The student adds a row to the input table |
| `TableRowDeleted` | None | The student deletes a row from the input table |

## Panes and Inspect

| Event | Parameters | When |
|-------|-----------|------|
| `PaneOpened` | `{ pane: "input" \| "graph" \| "inspect" \| "generator" \| "generatorControls" }` | The student opens a collapsed pane |
| `PaneClosed` | `{ pane: "input" \| "graph" \| "inspect" \| "generator" \| "generatorControls" }` | The student collapses a pane |
| `PaneResized` | `{ divider: "input" \| "inspect" \| "rows" \| "inputSplit", sizes }` | A divider drag ends, or a divider moved with the arrow keys loses focus: `sizes` is `{ input, inspect, top }` in px for the pane dividers (fitted to a narrow row, so a column divider's can be fractional), and `{ inputSplit }`, the text box's share of the linked view's height, for the split |
| `InspectTabChosen` | `{ tab: "states" \| "transitions" }` | The student chooses an Inspect tab |
| `InspectSorted` | `{ tab, column, direction: "ascending" \| "descending" }` | The student sorts an Inspect table by a column |
