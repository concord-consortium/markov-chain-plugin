# Shared Components for the CODAP Plugin and the AP Interactive

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-14

**Status**: **Closed**

## Overview

This story separates the Markov plugin's interface and Markov logic from its CODAP wiring, so the same components can run in CODAP and, from MARK-15 on, in the Activity Player interactive. The CODAP plugin is rebuilt on the shared components, with no change that students or saved documents can see. That includes the ELA module ("SY25-26: AI Text Generation for ELA"), which loads the plugin. The story also folds in four small cleanups that reviewers asked for on earlier pull requests.

MARK-13 (PR #88, the branch this one is cut from) added the Markov Interactive as a second app beside the plugin, and imports none of the plugin's code. The Jira story also asked for the AP interactive's runtime to show the shared components and to log its interactions. Doug moved both to MARK-15, so MARK-14 verifies the shared core with unit tests against a test host.

The four review follow-ups are:
- From Ethan McElroy's review of PR #85 (MARK-10), three of them:
  - the type move;
  - the duplicate `applyStatePercentages` test;
  - shared state and transition counting.
- From Maureen E. Zitouni's review of PR #87 (MARK-12): the dead drag writes in `graph.tsx`.

## Requirements

### The shared core and its host

- **R1.** A shared core renders the whole Markov tool: the mode menu, the dataset view, the drawing view (toolbar, graph, state editor, Create From Text), the sequence generator, the output, Reset and Back to Main Menu.
  - It imports nothing that talks to CODAP: not `use-codap.ts`, `codap-interface.ts`, `codap-helper.ts` or `output-dataset.ts`, and not the CODAP request in `attribute-values.ts`.
  - The generator (its settings, Play/Pause/Resume and Step) and the output (its sequence groups, Clear Output and Cancel) are separate components that take their values and handlers as props, so a host's layout can place them. The CODAP plugin composes them in today's layout.
- **R1a.** The core's state, effects and handlers live in a hook, `useMarkovTool(host)`, apart from any layout. That covers the graph, the selection and highlighting, generation and its animation, the output's sequence groups, the generator's settings, and the host calls.
  - The hook returns a `MarkovToolApi`. `MarkovTool` calls it and renders the CODAP plugin's layout from what it returns, with no change in behavior (R4). Another layout can call the hook to place the same graph, generator and output in its own panes.
  - The hook also returns the handle's functions, as one object that keeps its identity for the hook's lifetime. A layout that calls the hook directly therefore needs no ref, and can call the handle from an effect that runs once.
  - It takes only the host interface: the loading state and the drag highlight stay `MarkovTool`'s props (R2).
- **R2.** The core talks to its host only through a host interface, passed in as a prop. The interface covers these, and only these:
  - **Load state:** the host hands the core a saved view mode, with either a drawing (graph and version) or nothing more.
  - **Save state:** the host can ask the core for its current graph at any time, and builds the saved values from it with `pluginStateValues`, unchanged.
  - **View mode:** the host holds the view mode, and the core asks it to change it (R3).
  - **Mark dirty:** the core tells the host its state changed, at every point where it called `notifyStateIsDirty`.
  - **Output a sequence:** the core hands the host the state labels of each finished sequence (not a canceled one), at the point where it called `outputToDataset`.
  - **Input data changed:** the host hands the core a new list of values for dataset mode. The core rebuilds the graph from them and fits the view, as `onCODAPDataChanged` did.

  Two values that only the CODAP plugin's layout shows are props of `MarkovTool` rather than part of the interface: whether loading is done, and whether something is being dragged over the plugin.
- **R3.** The host holds the view mode, as `useCODAP` did. The core reads it, and asks the host to set it from the mode menu and from Back to Main Menu. The host sets it from a loaded state.
  - The CODAP host needs the mode to ignore drops outside dataset mode, to pass on case changes only in dataset mode, and to save it.
  - The dropped attribute belongs to the host too. It is CODAP's, and the core sees only the values the host derives from it.
- **R4.** The core keeps every interaction it had. The split adds, removes or changes no control, label, tool, default, keyboard behavior or URL parameter (`fastSpeed`, `normalSpeed`).

### The CODAP plugin

- **R5.** The CODAP plugin is a CODAP host around the shared core. It owns `codap-interface.ts`, `codap-helper.ts`, `output-dataset.ts` and the CODAP request in `attribute-values.ts`, and it registers the same handlers on CODAP.
  - It sends CODAP the same requests as before, in the same order, for the same user actions, with one exception: repeated `notify interactiveFrame` (dirty) requests.
  - Every change that marked the document dirty still marks it dirty. The difference is that the core no longer re-sends the notice on renders that change nothing it saves, such as each frame of a sequence's animation.
  - `src/index.tsx` mounts the CODAP host.
- **R6.** The plugin's behavior in CODAP is unchanged, across the list in MARK-12's R11:
  - dataset mode, with drop, case edits and Reset;
  - drawing mode, with states and transitions, the probability selector, Create From Text, Reset and Back to Main;
  - generating, with Play, Pause, Resume, Step, Cancel, both speeds, output highlighting and "Sequence Data" items;
  - the graph's sizes, widths, loops, highlighting, zoom, fit and recenter.
- **R7.** Saved documents are unchanged in both directions. The plugin loads `version: 2` drawings, unversioned drawings and dataset documents as before, including the ELA module's, and saves the same values (`pluginStateValues`'s shape is unchanged).

### Review follow-ups

- **R8.** `ViewMode` and `CODAPAttribute` are defined in `src/type.ts`, and no file imports a type from the CODAP hook or host.
- **R9.** MARK-20's test "keeps the state's values when its percentages are unchanged" (`state-editor.test.ts`) is deleted. The `NodeModal` test "keeps the state's values when saved unchanged" stays.
- **R10.** `wordsToGraph` and `graphFromValues` count states and transitions with one shared function, and each returns exactly what it returned before.
  - `wordsToGraph` keeps its state order and stays safe for words like `constructor`. The order puts words that are array indexes first, in ascending numeric order: `0` and `12` count, `02` and `-1` don't. The rest follow in order of first appearance, so `b 2 a 1 b` gives `1, 2, b, a`.
  - `graphFromValues` keeps first-appearance order and treats an empty value as a break in the chain.
- **R11.** In `graph.tsx`, `dragEnd` names the d3 event `event`, `dragStart` takes no parameter because it reads nothing from the event, and neither writes to the event. A dropped state stays where it is dropped, in auto-arrange and otherwise.

### Verification

- **R12.** Every existing test, Jest and Cypress, passes unchanged except for R9's deletion. That covers MARK-10's, MARK-11's, MARK-12's, MARK-20's and MARK-13's tests. A test file may change only its import paths, and only where R8, R10 or the split moves what it imports.
- **R13.** The shared core has Jest tests that render `MarkovTool`, and through it R1a's hook, with a recording test host. They check each host call in R2:
  - load state and input data changed drive the core;
  - the handle's `getGraph` returns the core's current graph;
  - mark dirty and output a sequence are called for the actions that call them, and not for the others.
- **R14.** R10's sharing has tests that fail if either function's state order, empty-value breaks or prototype safety changes.
- **R15.** A headless check in CODAP 3.1.2 covers R6 and R7 against the branch build beside master's, including the ELA module's documents, and is recorded in the PR. Browser checks run headless only.
  - *Done with headless Playwright against https://codap3.concord.org/version/3.1.2/. The branch matched master on R6's list; the gaps are listed after this list.*
  - *The five ELA documents, an unversioned drawing and a dataset document saved identical plugin state on both.*
  - *A development build logged no React warning on either side.*
  - *A state dragged with the mouse saved byte-identical positions.*
  - *Screenshots of fixed-position documents differed by 0%.*
  - *Not checked: the two speeds' timing, and a drag with auto-arrange in drawing mode, which has no toggle for it.*
- **R15a.** R5's "same requests" is checked on MARK-11's fake CODAP page. The requests the fake records over the existing plugin specs' sessions must match master's once consecutive repeats of the dirty notice are collapsed, apart from dirty notices master sends while a sequence animates. The result is recorded in the PR.
  - *Done: over the 36 plugin tests, 31 sessions match exactly once dirty notices are collapsed.*
  - *The other 5 differ only in the dirty notices master sends while animating: master sends 10 to 32, the branch 1.*
- **R16.** The build, both `tsc` checks and the three lint commands are clean.

## Technical Notes

### Where the code is

- `src/components/host.ts`: `MarkovHost` (`viewMode`, `setViewMode`, `markDirty`, `outputSequence`) and `MarkovToolHandle` (`getGraph`, `loadDrawing`, `dataChanged`).
  - A host keeps each function's identity across renders, unless whatever depends on it should run again.
  - A playing sequence keeps the `outputSequence` it started with.
  - A new `markDirty` re-sends drawing mode's dirty notice.
- `src/hooks/use-markov-tool.tsx`: `useMarkovTool(host): MarkovToolApi`.
  - The API's members are `handle`, `graph`, `graphEmpty`, `animating`, `graphHighlights`, `setSelectedNodeId`, `generatorProps`, `outputProps` and `view`.
  - The file is `.tsx` because the Reset and Back to Main Menu dialog messages are JSX. The animation delays and defaults stay at module level, so the URL parameters are read once.
- `src/components/markov-tool.tsx`: `MarkovTool`, the CODAP plugin's layout over the hook. It takes the `host`, `loadState` and `dragging` props and passes the handle to its ref.
- `src/components/generator.tsx` and `sequence-output.tsx`: `Generator` and `SequenceOutput`, with `GeneratorProps` and `SequenceOutputProps` exported for the hook. `GenerationMode`, `SequenceGroup` and `DelimiterType` are in `src/type.ts`.
- `src/codap/codap-app.tsx`: `CodapApp`, which builds the host from `useCODAP(toolRef)` and mounts `MarkovTool`. `src/codap/use-codap.ts` calls the tool through the ref.
- `src/utils/chain-graph.ts`: `chainsToGraph`, and `graphFromValues`, moved here from `attribute-values.ts`.
- `eslint.config.js`: a `no-restricted-imports` rule keeps the CODAP modules out of `src/components/**`, `src/hooks/**` and the four core utilities. With `src/codap/` deleted, `tsc` reports errors only in `src/index.tsx`.

### The stable handle

- The hook builds `handle` once with `useMemo`.
- `getGraph` reads a graph ref that a layout effect updates after each graph change, so it returns the current graph by the time a host's or parent's effect calls it.
- `onSetGraph` and `onDataChanged` are `useCallback`s over `setGraph` and `updateGraph`, so the handle's dependencies never change.
- A layout can list `tool.handle` in an effect's dependencies, and an effect that calls `dataChanged` on mount runs once. Without the stable handle, MARK-15's prototype mount effect looped until Jest crashed.

### Dirty notices and CODAP

- `notifyStateIsDirty` stays unmemoized. The core's drawing-mode effect, with dependencies `[graph, viewMode, markDirty]`, therefore fires on each graph or mode change, and on each render of the CODAP host, which now happens only when the hook's own state changes.
- Master also fired it on every render of `App`, including each frame of an animation.
- CODAP 3.1.2 does nothing with a dirty notice (its handler leaves `dirty` as a TODO). It asks the plugin for `interactiveState` when it saves, so fewer notices change nothing CODAP saves or shows.
- Each notice draws random numbers for its message id, so the branch's fewer notices shift a seeded `Math.random` sequence. Step's own draws are the same on both sides.

### Timing and order

- CODAP's `update interactiveState` arrives after `initializePlugin`, which runs in `useCODAP`'s effect. React sets the child's imperative handle before the parent's effects run, so `tool.current` is set by the time `setPluginState` calls it.
- `SequenceOutput`'s scroll-to-bottom effect skips its mount, using a ref of the groups last seen. That way a remounted output opens at the top, as it did when the effect lived in `App`.
- Reset on a drawing saved without a `version` restores its states at the old top-left origin, because the Reset copy is taken before the origin moves. That is MARK-21's second bug. The split keeps the order (R4), and MARK-21's fix belongs in the hook's `loadDrawing`, which holds the copy.

### Tests

- Jest cannot load `d3` 7 or `nanoid`, both ESM-only, under the repo's `ts-jest` setup. `markov-tool.test.tsx` therefore mocks `nanoid` and replaces `Graph` with a stub that renders a `div` and hands its callbacks to the test. It runs animation on Jest's fake timers.
- The test file's nine tests:
  - Loading, then the mode menu.
  - Choosing Dataset, then choosing Drawing.
  - A version 2 drawing loaded, with Reset after a drag.
  - An unversioned drawing's origin moving once the graph reports its size.
  - Dataset values without `markDirty`, then Reset, with the handle's identity kept.
  - The `dragging` class.
  - Play outputting once, and Cancel outputting nothing.
  - A drawing change calling `markDirty`. The mock is cleared after mount, so the test fails without `graph` in the effect's dependencies.
- testing-library's lint rules forbid `container.firstChild` and `act` around `fireEvent`. The `dragging` test therefore reads `container.innerHTML`, and the Play test wraps only the timer advance in `act`.
- Counts on the head: Jest has 131 tests in 17 suites (118, less R9's one, plus R14's five and R13's nine). Cypress has 86 in Chrome; in Electron, 85 pass and the Chrome-only standalone-link test is pending.

## Out of Scope

- The AP interactive's runtime showing the components, its host, and its logging to the Activity Player (MARK-15). MARK-13's runtime placeholder, report item and demo page are unchanged.
- Applying any authored setting, including the starting text (MARK-15 onward).
- The new layout and features (MARK-15 to MARK-19), saved student work (MARK-17), and Send to CODAP from the AP interactive (MARK-18).
- Logging, in either app. The Jira story's host interface lists a log call; it arrives with MARK-15.
- The dead code that MARK-10's and MARK-20's specs left to MARK-14, which moves to MARK-15 along with the `graph.tsx` split that MARK-10's spec named:
  - `registerObservers` and its call;
  - `codap-helper.ts`'s unused exports, including `getCaseValues` with its unchecked `.success`.

## Decisions

### MARK-14 verifies the shared core with unit tests; MARK-15 shows it in the AP runtime
**Options**: A) the runtime shows the shared drawing view, generator and output; B) unit tests against a test host, with MARK-15 building the AP host.
**Decision**: B (Doug). The runtime part of the story, its done-when clause and all logging, including the host interface's log call, move to MARK-15. MARK-14's done-when is that the CODAP plugin is unchanged for students and the core's host calls are covered by unit tests.

### Every existing test passes unchanged, with R9's deletion the one exception
**Options**: A) MARK-10 and MARK-11 tests only; B) every existing test.
**Decision**: B. Doug's decision named MARK-10 and MARK-11. The same rule applies to MARK-12's, MARK-20's and MARK-13's tests, since they all check behavior that must not change. Import paths may change where R8, R10 or the split moves a module, which covers `attribute-values.test.ts` importing `graphFromValues` from `chain-graph.ts`.

### The host keeps the view mode
**Options**: A) the host keeps it and the core asks it to change; B) the core owns it and reports it.
**Decision**: A, changed from B by the self-review. The CODAP host reads the mode in its drop and case-change handlers and in the saved values, so a core-owned mode would have to be mirrored back to it. `ViewMode` is the plugin's two modes and the saved document's field. The AP interactive's Data and Draw modes don't map onto it one to one, so MARK-15 decides how its modes reach the core.

### Save state is built by the host from the core's graph
**Decision**: `pluginStateValues` takes the CODAP attribute, which the core never sees. So the host asks the core for its graph and builds the values itself.

### The generator and output become components in MARK-14
**Options**: A) move `App` whole, and MARK-15 extracts the pieces; B) extract `Generator` and `SequenceOutput` here.
**Decision**: B (Doug). Otherwise MARK-15 would have to pull them out of the component that holds MARK-14's ref handle and host wiring, and re-check what MARK-14's tests target.

### The core's state moves into a hook in MARK-14
**Options**: A) MARK-15 extracts the hook; B) MARK-14 extracts it, right after the split.
**Decision**: B (Doug). MARK-14 already moves every line involved and has the tests that guard it, so the code moves once. MARK-15 adds transition selection to it.

### The hook's result is `MarkovToolApi`
**Decision**: so it doesn't share the component's name. Its members are the ones MARK-15's spec lists.

### The loading state and the drag highlight are `MarkovTool` props, not host members
**Decision**: only `MarkovTool`'s layout reads them, never the hook, so a layout that calls the hook directly never needs them.

### The handle is one stable object
**Options**: A) build it once with `useMemo`, reading the graph through a ref; B) keep a handle that is new on each render, and document it.
**Decision**: A (Doug). A new handle on each render made a layout's mount effect either warn under `exhaustive-deps` or loop. A probe looped until Jest crashed. With the stable handle the same probe runs its effect once. The `dataChanged` test asserts the handle's identity with `toBe`.

### A ref handle for the host's calls into the core
**Options**: A) `useImperativeHandle`, with the host holding the ref; B) the core registers callbacks with the host on mount; C) the graph state moves into the host.
**Decision**: A. It keeps `App`'s state in the core, which is what MARK-15 reuses, and it is React's own mechanism for a parent calling into a child. B reimplements a ref by hand; C would put the tool's main state in every host.

### Only `use-codap.ts` and the new host move into `src/codap/`
**Options**: A) move those two and enforce R1 with a lint rule; B) move every CODAP file and its test.
**Decision**: A. B would move four test files, which R12 keeps where they are, and the lint rule enforces the boundary either way.

### The lint boundary covers the core's four utilities
**Decision**: `chain-graph.ts`, `text-to-graph.ts`, `generate-sequence.ts` and `plugin-state.ts` join `src/components/**` and `src/hooks/**` in the rule's `files`. Probe imports from both directories are each reported.

### `notifyStateIsDirty` stays unmemoized
**Options**: A) keep it as it is; B) memoize it, so dirty notices follow only graph and mode changes.
**Decision**: A. It is the version measured against master. B would probably send fewer notices still, but nothing has checked it, and it isn't this story's change to make.

### Request-for-request equality with master does not hold
**Decision**: building the split showed master re-sends the dirty notice on each animation frame. R5 and R15a allow for repeated dirty notices, which Doug accepted. Every other request matches in content and order.

### The host's functions keep their identity
**Decision**: the animation interval keeps the `outputSequence` it started with, and the drawing-mode effect re-sends the dirty notice when `markDirty` changes, so the `MarkovHost` comment tells hosts to keep them. Reading them through a ref was rejected, because it changes the dirty notices R15a measured.

### The hook returns the memoized `createSequenceOutput` result
**Decision**: a wrapper made on each render would rebuild `finishAnimating` while the animation interval keeps the first one. Since `createSequenceOutput` already takes labels, the core maps states to labels and `outputToDataset` goes.

### Edge keys are JSON pairs
**Decision**: `from|to` keys would merge `a|b → c` with `a → b|c`, since dataset values can contain `|`. Words never contain `|`, so `wordsToGraph`'s results don't change. The shared counter matched both old functions on 3,000 random chains.

### `SequenceOutput`'s scroll effect skips its mount
**Decision**: moved as it was, the effect ran on mount. After Back to Main Menu and choosing Drawing, the output then opened at `scrollTop` 116 instead of master's 0. A ref of the groups last seen keeps the old behavior.

### Dead code and the `graph.tsx` split move to MARK-15
**Decision** (Doug): MARK-10's and MARK-20's specs left MARK-14 `registerObservers` and its call (shadowed by the hook's own `get interactiveState` handler, so it does nothing), `codap-helper.ts`'s unused exports, and the `graph.tsx` split. All three move to MARK-15.

### The split orphans the hook's option types
**Decision**: `UseCODAPOptions`, `OnCODAPDataChanged` and `GetGraphCallback` go with the callbacks they described. So do `OutputTextMode`, which nothing imported, and the hook's graph type imports. `doc/deploy.md`'s example no longer names `components/app.tsx`.

### `compareStateLabels` stays in `app-utils.ts`
**Decision**: `app-utils.test.ts` imports it there (R12), so only its import moves into `generator.tsx`.

### R13's tests are written to pass lint without an `eslint-disable`
**Decision**: `toHaveClass` on `container.firstChild` breaks `testing-library/no-node-access`, and `act` around `fireEvent` breaks `no-unnecessary-act`. A test id on the root was rejected, because it would change the markup for a test.

### The loaded-drawing Reset check doesn't claim to guard `loadDrawing`'s copy
**Decision**: the version 2 test restores the drawing after a drag. It passes whether `loadDrawing` keeps a copy or the graph itself, because the drag replaces node objects. A test that could tell would pin MARK-21's known Reset bug, so the test list claims only what the test checks.
