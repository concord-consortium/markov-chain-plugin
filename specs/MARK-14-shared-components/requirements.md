# Shared Components for the CODAP Plugin and the AP Interactive

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-14
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Separate the Markov plugin's interface and Markov logic from its CODAP wiring, so the same components can run in CODAP and, from MARK-15 on, in the Activity Player interactive. The CODAP plugin is rebuilt on the shared components with no change students or saved documents can see.

## Project Owner Overview

The Markov tool students use today lives inside CODAP, and its screens are tied to CODAP's messages throughout. The Activity Player version (MARK-13 to MARK-19) needs the same graph, text input, sequence generator and output without CODAP. This story moves everything that is not about CODAP into a shared core that talks to whatever hosts it through a small, fixed set of calls, and gives the CODAP plugin its own host. The next story, MARK-15, builds the Activity Player host and is the first to show the shared components to students there.

Nothing changes for students or teachers using the CODAP plugin, including the ELA module ("SY25-26: AI Text Generation for ELA") that loads it: the same modes, the same documents, the same behavior. The story also folds in four small clean-ups that reviewers asked for on earlier pull requests.

## Background

MARK-13 (PR #88, which this branch is cut from) added the Markov Interactive as a second app beside the plugin, with authoring, a report item, a demo page, and a runtime placeholder that lists the authored settings. MARK-13 deliberately imports none of the plugin's code.

The plugin's `App` (`src/components/app.tsx`, 690 lines) holds all of the tool's state and UI: the mode menu, the dataset and drawing views, sequence generation and its animation, the output, Reset and Back to Main Menu. It gets CODAP through one hook, `useCODAP` (`src/hooks/use-codap.ts`), which owns the view mode, the dropped attribute, CODAP drag highlighting, the load state, the saved-state handlers, `notifyStateIsDirty`, and `outputToDataset`. Below the hook sit `codap-interface.ts` (the iframe-phone client), `codap-helper.ts` (`initializePlugin`, `registerObservers` and unused table helpers), `output-dataset.ts` (the "Sequence Data" output) and `attribute-values.ts` (the CODAP case request and `graphFromValues`). `plugin-state.ts` defines the saved document's shape.

The Jira story also asked for the AP interactive's runtime to show the shared components working, and for it to log its interactions. Doug moved both to MARK-15 (see Resolved Questions): MARK-14 verifies the shared core with unit tests against a test host, and MARK-13's runtime placeholder stays as it is.

Four review follow-ups are in scope, recorded against this story:

- From Ethan McElroy's review of PR #85 (MARK-10): `ViewMode` and `CODAPAttribute` move from `hooks/use-codap.ts` into `src/type.ts`, ending the `import type` loop between `utils/plugin-state.ts` and `use-codap.ts`; MARK-20's first `applyStatePercentages` test is deleted, because the `NodeModal` "keeps the state's values when saved unchanged" test checks the same thing through the real component; and `wordsToGraph` and `graphFromValues` share one copy of their state and transition counting.
- From Maureen E. Zitouni's review of PR #87 (MARK-12): in `graph.tsx`, `dragStart` and `dragEnd` take one parameter, but d3 passes the event first, so their `d.fx`/`d.fy` writes land on the event and do nothing. The writes go and the parameter is named `event`. The drop stays sticky: states stay pinned after auto-arrange.

## Requirements

### The shared core and its host

- **R1.** A shared core renders the whole Markov tool: the mode menu, the dataset view, the drawing view (toolbar, graph, state editor, Create From Text), the sequence generator, the output, Reset and Back to Main Menu. It imports nothing that talks to CODAP: not `use-codap.ts`, `codap-interface.ts`, `codap-helper.ts`, `output-dataset.ts`, nor the CODAP request in `attribute-values.ts`. The generator (its settings with Play, Pause or Resume, and Step) and the output (its sequence groups with Clear Output and Cancel) are components of their own that take their values and handlers as props, so a host's layout can place them; the CODAP plugin composes them in today's layout.
- **R1a.** The core's state, effects and handlers (the graph, the selection and highlighting, generation and its animation, the output's sequence groups, the generator's settings, and the host calls) live in a hook, `useMarkovTool(host)`, apart from any layout; the hook returns a `MarkovToolApi`. `MarkovTool` calls it and renders the CODAP plugin's layout from what it returns, with no change in behavior (R4); another layout can call it to place the same graph, generator and output in its own panes. The hook returns the handle's functions too, as one object that keeps its identity for the hook's lifetime, so a layout that calls it directly needs no ref and can call the handle from an effect that runs once. It takes only the host interface: the loading state and the drag highlight stay `MarkovTool`'s props (R2).
- **R2.** The core talks to its host only through a host interface, passed in as a prop. The interface covers, and is limited to:
  - **Load state:** the host hands the core a saved view mode with either a drawing (graph and version) or nothing more.
  - **Save state:** the host can ask the core for its current graph at any time, and builds the saved values from it with `pluginStateValues`, unchanged.
  - **View mode:** the host holds the view mode and the core asks it to change it (R3).
  - **Mark dirty:** the core tells the host its state changed, at every point it calls `notifyStateIsDirty` today.
  - **Output a sequence:** the core hands the host each finished (not canceled) sequence's state labels, at the point it calls `outputToDataset` today.
  - **Input data changed:** the host hands the core a new list of values for dataset mode; the core rebuilds the graph from them and fits the view, as `onCODAPDataChanged` does today.

  Two values that only the CODAP plugin's layout shows are props of `MarkovTool` rather than part of the interface: whether loading is done (the layout shows "Loading ..." until then) and whether something is being dragged over the plugin (the yellow background in dataset mode).
- **R3.** The host holds the view mode, as `useCODAP` does today: the core reads it and asks the host to set it from the mode menu and Back to Main Menu, and the host sets it from a loaded state. The CODAP host needs it to ignore drops outside dataset mode, to pass on case changes only in dataset mode, and to save it. The dropped attribute is the host's too: it is CODAP's, and the core sees only the values the host derives from it.
- **R4.** The core keeps every interaction it has today. No control, label, tool, default, keyboard behavior or URL parameter (`fastSpeed`, `normalSpeed`) is added, removed or changed by the split.

### The CODAP plugin

- **R5.** The CODAP plugin is a CODAP host around the shared core. It owns `codap-interface.ts`, `codap-helper.ts`, `output-dataset.ts` and the CODAP request in `attribute-values.ts`, registers the same handlers on CODAP, and sends CODAP the same requests it sends today, in the same order, for the same user actions, apart from repeated `notify interactiveFrame` (dirty) requests: every change that marks the document dirty today still marks it dirty, but the core no longer re-sends the notice on renders that change nothing it saves, such as each frame of a sequence's animation. `src/index.tsx` mounts the CODAP host.
- **R6.** The plugin's behavior is unchanged in CODAP: the list in MARK-12's R11 (dataset mode with drop, case edits and Reset; drawing mode with states and transitions, the probability selector, Create From Text, Reset and Back to Main; generating with Play, Pause, Resume, Step, Cancel, both speeds, output highlighting and "Sequence Data" items; the graph's sizes, widths, loops, highlighting, zoom, fit and recenter).
- **R7.** Saved documents are unchanged in both directions: the plugin loads `version: 2` drawings, unversioned drawings and dataset documents as before, including the ELA module's, and saves the same values (`pluginStateValues`'s shape is unchanged).

### Review follow-ups

- **R8.** `ViewMode` and `CODAPAttribute` are defined in `src/type.ts`, and no file imports a type from the CODAP hook or host.
- **R9.** MARK-20's test "keeps the state's values when its percentages are unchanged" (`state-editor.test.ts`) is deleted; the `NodeModal` "keeps the state's values when saved unchanged" test stays.
- **R10.** `wordsToGraph` and `graphFromValues` count states and transitions with one shared function, and each returns exactly what it returns today: `wordsToGraph` keeps its state order (words that are array indexes, such as `0` and `12` but not `02` or `-1`, first in ascending numeric order, then the rest in first appearance; checked: `b 2 a 1 b` gives `1, 2, b, a`) and stays safe for words like `constructor`; `graphFromValues` keeps first-appearance order and treats an empty value as a break in the chain.
- **R11.** In `graph.tsx`, `dragEnd` names the d3 event `event`, `dragStart` takes no parameter because it reads nothing from the event, and neither writes to the event; a dropped state stays where it is dropped, in auto-arrange and otherwise.

### Verification

- **R12.** Every existing test passes unchanged, Jest and Cypress, except R9's deletion. This covers MARK-10's and MARK-11's tests, and also MARK-12's, MARK-20's and MARK-13's. A test file may change only its import paths, and only where R8, R10 or the split moves what it imports (R10 moves `graphFromValues`, which `attribute-values.test.ts` imports).
- **R13.** The shared core has Jest tests that render `MarkovTool`, and through it R1a's hook, with a recording test host and check each host call in R2: that load state and input data changed drive the core, that the handle's `getGraph` returns the core's current graph (the saved values themselves stay covered by `plugin-state.test.ts`), and that mark dirty and output a sequence are called for the actions that call them, and not for the others (for example, a canceled sequence is not output).
- **R14.** R10's sharing has tests that fail if either function's state order, empty-value breaks or prototype safety changes.
- **R15.** A headless check in CODAP 3.1.2 covers R6 and R7 against the branch build beside master's, including the ELA module's documents, and is recorded in the PR. Browser checks run headless only.
- **R15a.** R5's "same requests" is checked on MARK-11's fake-CODAP page: the requests the fake records over the existing plugin specs' sessions match master's once consecutive repeats of the dirty notice are collapsed, apart from dirty notices master sends while a sequence animates, and the result is recorded in the PR.
- **R16.** The build, both `tsc` checks and the three lint commands are clean.

## Technical Notes

- `App`'s CODAP touch points: `useCODAP` returns `dragging`, `outputToDataset`, `viewMode`, `setViewMode`, `notifyStateIsDirty` and `loadState`; `App` passes it `onCODAPDataChanged`, `getGraph`, `setGraph` (`onSetGraph`, which moves an unversioned drawing's origin) and `setInitialGraph`. The host interface and `MarkovTool`'s `loadState` and `dragging` props replace exactly these.
- `notifyStateIsDirty` is called on every graph change in drawing mode (an effect in `App`), on choosing a mode, and in the hook after a drop.
- `finishAnimating` is where a sequence goes to `outputToDataset`; a cancel skips it.
- CODAP 3.1.2 does nothing with a `notify interactiveFrame` dirty request (its handler leaves `dirty` as a TODO); it asks the plugin for `interactiveState` when it saves the document. Fewer repeated dirty notices (R5) therefore change nothing CODAP 3 saves or shows.
- `codap-helper.ts` has unused helpers (`openTable`, `guaranteeTableOrCardIsVisibleFor`, `datasetExists`, `getNumChildAttributesInContext`, `getDatasetInfoWithFilter` and more). Moving it behind the host does not require changing them.
- `wordsToGraph` uses null-prototype objects, whose `Object.values` order puts integer-like keys first; `graphFromValues` uses arrays and `find`. R10's shared function must keep both orders.
- Reset on a drawing saved without a `version` restores its states at the old top-left origin, because the Reset copy is taken before the origin moves. That is MARK-21's second bug; under R4 the split keeps the order, and MARK-21's fix then belongs in the `loadDrawing` that `useMarkovTool` returns, which holds the copy.
- Jest on the current head: 118 tests in 15 suites.
- Jest cannot load `d3` 7 or `nanoid`, both ESM-only, under the repo's `ts-jest` setup, so nothing that imports `graph.tsx` or `drawing.tsx` has had a Jest test before. R13's tests therefore mock `nanoid` and replace `Graph` with a stub that renders a placeholder and lets the test call its callbacks (`onDragStop`, `onNodeClick` and the rest); the graph's own drawing stays covered by MARK-11's Cypress tests. jsdom also has no `ResizeObserver`; with `Graph` stubbed, nothing else needs one. *(Checked with throwaway code: the current `App`, with `codap-interface` mocked, `nanoid` mocked and `Graph` stubbed, renders a loaded drawing in Jest, plays a sequence to the output on fake timers, and sends the same CODAP requests the plugin sends in CODAP. Without the stubs the suite fails to load on `nanoid`, then on `d3`.)*

## Out of Scope

- The AP interactive's runtime showing the components, its host, and its logging to the Activity Player (MARK-15). MARK-13's runtime placeholder, report item and demo page are unchanged.
- Applying any authored setting, including the starting text (MARK-15 onward).
- The new layout and features (MARK-15 to MARK-19), saved student work (MARK-17), Send to CODAP from the AP interactive (MARK-18).
- Logging, in either app: the Jira story's host interface lists a log call, and it arrives with MARK-15, which logs the AP interactive's interactions.
- The dead code MARK-10's and MARK-20's specs left to MARK-14 (`registerObservers` and its call, and `codap-helper.ts`'s unused exports, including `getCaseValues` with its unchecked `.success`), and the `graph.tsx` split MARK-10's spec named: all move to MARK-15.

## Open Questions

### RESOLVED: Does the AP interactive's runtime show the shared components in MARK-14?
**Context**: The Jira story says the runtime shows the existing components working, and its done-when says a student can type text and generate sequences there.
**Options considered**:
- A) The runtime shows the shared drawing view, generator and output.
- B) MARK-14 verifies the shared core with unit tests against a test host; MARK-15, the next story and the first to use the shared components, builds the AP host.

**Decision**: B, Doug's decision. The runtime part of the story, its done-when clause and all logging, including the log call in the host interface, move to MARK-15. MARK-14's done-when becomes: the CODAP plugin is unchanged for students, and the shared core's host calls are covered by unit tests.

### RESOLVED: Which tests may change?
**Context**: The story says MARK-10's and MARK-11's tests pass unchanged, but follow-up (2) deletes a test.
**Options considered**:
- A) MARK-10 and MARK-11 tests only.
- B) Every existing test, with R9's deletion the one exception.

**Decision**: B. Doug's decision names MARK-10 and MARK-11; the same rule applies to MARK-12's, MARK-20's and MARK-13's tests, since all of them check behavior that must not change. Import paths may change where R8, R10 or the split moves a module.

### RESOLVED: Judgment call: does the view mode belong to the core or the host?
**Context**: `useCODAP` owns the view mode today, but the mode menu and Back to Main Menu are UI.
**Options considered**:
- A) The host keeps the view mode and the core asks it to change (R3).
- B) The core owns it and reports it to the host.

**Decision**: A, changed from B by the self-review: the CODAP host reads the view mode in its drop and case-change handlers and in the saved values, so a core-owned mode would have to be mirrored back to it. `ViewMode` is the CODAP plugin's two modes, and also the saved document's `viewMode` field. The AP interactive's modes don't map onto it one to one: its Data mode is text and a table, and its Draw mode has no text input. So MARK-15 decides how its modes reach the core, with a core setting or new mode values kept apart from the saved document's type, rather than just setting `viewMode` from authored settings.

### RESOLVED: Does MARK-14 split the generator and output into components?
**Context**: `App` renders the generator and the output with inline render functions in one fixed layout. MARK-15's layout puts the generator below side-by-side panels, with collapsible controls, while the CODAP plugin keeps today's layout.
**Options considered**:
- A) Move `App` whole; MARK-15 extracts the pieces it lays out differently.
- B) Extract `Generator` and `SequenceOutput` components in MARK-14, with no change in behavior.

**Decision**: B, Doug's decision. Otherwise MARK-15 would pull them out of the component that holds MARK-14's ref handle and host wiring, and re-check what MARK-14's tests target.

### RESOLVED: Does MARK-14 move the core's state out of `MarkovTool` into a hook?
**Context**: MARK-15's workspace lays out the same graph, generator and output in its own panes, and reads the selection, so it needs the core's state without `MarkovTool`'s CODAP layout. The ref handle lets a host call in, but not lay the tool out.
**Options considered**:
- A) MARK-15 extracts the hook from `MarkovTool`.
- B) MARK-14 extracts it (R1a), right after the split; MARK-15 adds transition selection to it.

**Decision**: B, Doug's decision. MARK-14 already moves every line involved and has the tests that guard it, so the code moves once.

## Self-Review

### Senior Engineer

#### RESOLVED: The CODAP host needs the view mode
`handleDrop` returns early outside dataset mode, `handleDataChanged` passes values on only in dataset mode, and `getPluginState` saves the mode, all in `use-codap.ts`. A core-owned mode (the first draft of R3) would have to be mirrored back. R3 now keeps the mode in the host, as today.

#### RESOLVED: Save state is built from the host's attribute
`pluginStateValues(viewMode, attribute, getGraph)` takes the CODAP attribute, which the core never sees. R2 now has the host ask the core for its graph and build the values itself.

### QA Engineer

#### RESOLVED: "Exactly the requests it sends today" had no check
No existing test compares the whole request sequence. R15a compares the fake CODAP's recorded requests with master's over the existing sessions. Building the split as throwaway code showed request-for-request equality is not achievable (see the implementation spec's Self-Review), and R5 and R15a allow for repeated dirty notices, which Doug accepted.

#### RESOLVED: R12 forbade the import change R10 needs
R10 moves `graphFromValues` out of `attribute-values.ts`, so `attribute-values.test.ts` must import it from the new module, but R12 allowed import changes only for R8 and the split. R12 and the resolved question on tests now name R10 too.

#### RESOLVED: R5's dirty-notice allowance did not say what CODAP does with the notice
Checked in CODAP's source at the 3.1.2 tag: the `interactiveFrame` notify handler ignores `dirty`, and the web view requests `interactiveState` when the document is snapshotted. Recorded in Technical Notes, so the allowance rests on CODAP's behavior and not only on the fake's request log.

#### RESOLVED: Rendering the core in Jest needs `Graph` stubbed
`Graph` imports `d3` and the drawing view imports `nanoid`, neither of which Jest can load here, and `Graph` creates a `ResizeObserver`, which jsdom lacks. Checked by running it; R13's approach is in Technical Notes.

### Technical Editor

#### RESOLVED: R11 and the implementation disagreed on `dragStart`'s parameter
R11 said both functions take the d3 event as `event`; the implementation gives `dragStart` no parameter, since it reads nothing from the event. R11 now says what the code does: `dragEnd` names the event `event`, `dragStart` takes none, and neither writes to it.

### Product Manager

#### RESOLVED: Earlier specs hand MARK-14 dead-code removal that this spec leaves out
MARK-10's and MARK-20's specs leave MARK-14 `registerObservers` and its call (shadowed by the hook's own `get interactiveState` handler, so it does nothing; checked with throwaway code), `codap-helper.ts`'s unused exports including `getCaseValues`, and the `graph.tsx` split. Doug's decision: all three move to MARK-15, named in Out of Scope, rather than bringing the dead code, or it and the split, into MARK-14.

### Forward Compatibility

#### RESOLVED: The view-mode decision assumed the AP's modes map onto `ViewMode`
The decision said MARK-15's host would set the mode from authored settings, but the AP interactive's Data mode (text and a table) and Draw mode (no text input) are not the core's `dataset` and `drawing`, and `ViewMode` is also the saved document's field (`plugin-state.ts`). The decision now says MARK-15 chooses how its modes reach the core; MARK-14's types are unchanged.
