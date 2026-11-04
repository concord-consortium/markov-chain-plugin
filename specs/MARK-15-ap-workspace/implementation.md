# Implementation Plan: The AP Interactive's Workspace

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-15
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The branch starts from MARK-14's finished code. The plugin-side changes come first, each its own commit with the plugin's tests unchanged: the cleanups, the `graph.tsx` split, the graph's new options, transition selection in MARK-14's `useMarkovTool` hook, and logging. The AP side follows: the pure modules with their Jest tests (tokenizer, input edits, saved state, configuration, Inspect rows, highlights), then the workspace in four steps (shell and host, Input pane, Inspect pane and linked highlighting, resizable panes). Every step builds, lints and passes Jest and Cypress on its own.

Toolchain: Node 24 (`.nvmrc`). Each step ends with `npm run build`, `npm run lint`, `npm run lint:build`, `npm run lint:style`, `npx tsc --noEmit -p .`, `npx tsc --noEmit -p cypress` and `npx jest`; steps that touch rendering also run `npm run test:cypress` headless against `npm start`.

File names below follow MARK-14's spec (`src/codap/use-codap.ts`, `src/components/markov-tool.tsx`, `src/components/host.ts`, `src/components/generator.tsx`, `src/components/sequence-output.tsx`, `src/utils/chain-graph.ts`), plus `src/hooks/use-markov-tool.tsx`, the hook MARK-14's R1a adds (it is `.tsx` because its dialogs' messages are JSX). The pass after MARK-14 is built corrects any that differ.

### 1. Delete the CODAP dead code

**Summary**: R36.

**Files affected**:
- `src/utils/codap-helper.ts`: keep the `codapInterface` import and `initializePlugin`; delete everything else (`entityInfo`, `Case`, `registerObservers`, `openTable`, `guaranteeTableOrCardIsVisibleFor`, `datasetExists`, `getNumChildAttributesInContext`, `getDatasetInfoWithFilter`, `guaranteeAttribute`, `getAttributeNames`, `getCaseValues`, `getSelectedCasesFrom`, `deselectAllCasesIn`, `getCaseCount`, `getCollectionNames`, `getAttributeNameByIndex`, `attributeExists`, `getComponentByTypeAndTitleOrName`, `getIdOfCaseTableForDataContext`, `scrollCaseTableToRight`, and the commented-out `dataSetString`).
- `src/codap/use-codap.ts`: the import becomes `import { initializePlugin } from "../utils/codap-helper";` (the two commented-out names go), and `initializePlugin(...).then(() => registerObservers());` becomes `initializePlugin(...);`.

**Estimated diff size**: ~300 lines, almost all deleted

Checked on this branch's code: `grep -rlw` finds no importer of any deleted name; `datasetExists` in `output-dataset.test.ts` is a parameter of that test's own `mockCODAP`, not the import. MARK-14's spec showed `registerObservers` only registers a `get interactiveState` handler that the hook's own handler shadows, so no request changes. The plugin's Cypress specs pass unchanged.

---

### 2. Split `graph.tsx`

**Summary**: R37. Moves code without changing it, except the dead `mode` prop and the drag handlers' types.

**Files affected**:
- `src/components/graph-geometry.ts` (new): `D3Node`, `D3Edge`, `D3Graph`, `findPointOnEllipse`, `findLineBetweenEllipses`, `calculateEdges`, `lineDashArray`, `lineEnd`, `normalizeAngle` and their argument types. No `d3` import (types only), so Jest can load it.
- `src/components/graph-highlight.ts` (new): the colors and marker URLs, and the three highlight passes as functions of a d3 selection: `highlightSelected(svg, { selectedNodeId, animating, graph })`, `unhighlightNonOutput(svg, { highlightOutputNodes, animating })`, and `highlightAnimation(root, {...})`, the body of the effect that colors the animated node and edges.
- `src/components/graph-draw.ts` (new): `drawGraph(svg, d3Graph, options)`, the body of the draw effect (markers, nodes, drag, labels, layout, edges, loops, rubber band), returning the simulation so the effect can stop it.
- `src/components/graph.tsx`: the component, its state, refs and effects, calling the three modules; `D3Node` re-exported for `drawing.tsx`. The `mode` prop goes from `Props`.
- `src/components/drawing.tsx`, `src/components/dataset.tsx`: drop `mode="..."`.
- Drag types (R37, Ethan McElroy's review): in `drawGraph`, `d3.drag<SVGEllipseElement, D3Node>()`, `dragging(event: d3.D3DragEvent<SVGEllipseElement, D3Node, D3Node>, d: D3Node)`, `dragEnd(event: d3.D3DragEvent<SVGEllipseElement, D3Node, D3Node>)`, and `circles.call(drag)` without `as any`. `D3Node` gains `fx?: number | null` and `fy?: number | null`, which `dragging` already writes and d3's simulation reads. *(Checked with throwaway code on MARK-14's `graph.tsx`: `tsc` and ESLint are clean with these types; without the two fields `tsc` fails on `d.fx`.)*

**Estimated diff size**: ~900 lines moved, ~60 changed

- `highlightSelected` and `unhighlightNonOutput` stay `useCallback`s in the component, wrapping the module functions with the same dependencies, so every effect runs when it does today.
- No new tests: the split changes nothing drawn, and MARK-11's and MARK-12's Cypress specs (arrows, clicks, fit, highlighting, labels, loading, modes, generation) cover it. `graph.tsx` drops to about 300 lines.

---

### 3. The graph's options for the workspace

**Summary**: R29a (saved positions included, and the layout choice), R29b, R29c's graph side, R24 to R27's graph side, R13, R29's zoom tools, R39's `isPlaced` test. One behavior-neutral change for both apps, and opt-in props only the workspace passes.

**Files affected**:
- `src/components/graph-draw.ts`, `src/components/graph.tsx`, `src/components/graph-highlight.ts`.
- `src/components/graph-utils.ts` and `graph-utils.test.ts`: `isPlaced` and its test.
- `src/components/graph.scss`: nothing; the workspace sizes the SVG from its own stylesheet.
- `src/components/toolbar.tsx`: the `zoomIn` and `zoomOut` tools.

**Estimated diff size**: ~140 lines

**Layout runs only on a graph not yet laid out** (R29b, both apps). In `drawGraph`'s auto-arrange branch the ticks run only when some state isn't pinned:

```ts
if (autoArrange) {
  simulation = d3.forceSimulation(d3Graph.nodes)...;
  // the ticks below lay the graph out; the simulation's own timer would run its ticks again in the background
  simulation.stop();
  // a redraw of a graph already laid out (its states are pinned) has nothing to place
  if (d3Graph.nodes.some(d => d.fx == null)) {
    while (simulation.alpha() > simulation.alphaMin()) {
      simulation.tick();
    }
  }
  onAutoArrangeEnd?.(d3Graph.nodes);
  // pin the nodes ... (unchanged)
  // the simulation's timer is stopped, so no tick has moved the states and labels to their laid-out places
  circles.attr("cx", d => d.x).attr("cy", d => d.y);
  labels.attr("x", d => d.x).attr("y", d => d.y);
}
```

A pinned state's `x` is reset to `fx` on every tick, so skipping the ticks changes no position; `onAutoArrangeEnd` is still called with the same positions. The states and their labels are appended before the layout runs, and today only the simulation's timer, on its first frame, dispatches the `tick` that moves them to their laid-out places; with the timer stopped, `drawGraph` sets their positions itself once the layout is done (the edges are drawn after it, from the laid-out positions, as today). `d3.forceSimulation` starts its own timer when created; today the loop drives alpha below `alphaMin`, so the timer stops on its first frame, but with the loop skipped, or cut to 30 ticks (`keepPositions`), it would run about 300 ticks over 5 s with the tick handler's DOM writes. `simulation.stop()` after creating it stops that in every branch, and changes nothing the plugin draws; a drag's `alphaTarget(0.5).restart()` starts it again as today.

**New props, all optional, absent in the plugin:**

```ts
// existing states keep their places when the graph changes; only new ones are laid out (the workspace's input)
keepPositions?: boolean;
// a transition to highlight as chosen, and clicks on arrows in the select tool
selectedEdge?: { from: string, to: string };
onEdgeSelect?: (edge: { from: string, to: string }) => void;
// a click on the SVG's background, which d3-zoom doesn't send after a pan
onBackgroundClick?: () => void;
// a drag that moved a state, for logging in a view that doesn't keep positions itself
onDragStop?: (id: string, pos: Point) => void;   // exists today; the workspace passes it too
// false leaves out the zoom buttons the graph draws in its corner, for a layout whose toolbar zooms
zoomButtons?: boolean;
// scales the graph by `by` each time `id` changes, as the corner buttons do
zoomRequest?: { id: number, by: number };
// a zoom or pan the student made (wheel, background drag), not a fit, a recenter or a zoomRequest
onUserZoom?: () => void;
// fits animate over this many ms; absent, they are instant
fitTransitionMs?: number;
```

- Layout choice and starting positions (R29a), in `graph-utils.ts`:

```ts
// with keepPositions: lay out every state when more than half are new, only the new ones otherwise, none when none is new
export const layoutFor = (placed: number, total: number): "whole" | "new" | "none" =>
  placed === total ? "none" : (total - placed) * 2 > total ? "whole" : "new";
// where a new state starts: beside the first placed state with an arrow to it, else at the origin
export const startPosition = (id: string, edges: { from: string, to: string }[],
  placed: Map<string, { x: number, y: number }>) => { /* ... */ };
```

  `startPosition` returns the placed state's position offset 30 px right and 30 px down, so the new state starts beside it and the ticks move it apart. Jest: `layoutFor(0, 10)` and `(4, 10)` "whole", `(5, 10)` and `(9, 10)` "new", `(10, 10)` "none" (each boundary fails under an off-by-one or a swapped comparison); `startPosition` beside the placed source, at the origin with no placed source, and ignoring an arrow from an unplaced state.
- `keepPositions`: the d3-graph effect marks a `D3Node` as `placed` when `isPlaced` says so: it was built from an old one (`oldD3Node` found), or the node arrived with an `x` and a `y`. Where the position comes from doesn't change (the drawn state's, then the node's, then 0). With `keepPositions`, an unplaced state starts at `startPosition`. In `drawGraph`, when `keepPositions` is set, `layoutFor(placed, total)` decides: `"new"` pins the placed states (`fx = x`, `fy = y`), starts the simulation at `alpha(0.3)`, runs 30 ticks and stops; `"none"` (a commit that only changed counts) pins them all and the ticks are skipped by the rule above; `"whole"` (a first graph, or an input mostly replaced) pins nothing and runs to `alphaMin` as today. Measured (requirements, Technical Notes): 0.46 to 0.59 s per one-word change at 20,000 characters, against 2.1 s.
- Saved positions (R29a): MARK-17 restores Data-mode positions by handing the graph nodes with `x` and `y`, and those states are placed, pinned and kept, so a fully restored graph runs no ticks and only states without a position are laid out. MARK-15 saves none, and its Data-mode nodes, built from the tokens, have no `x` or `y`, so nothing in this story takes the new branch. The plugin never passes `keepPositions`, so its drawings and datasets lay out as today.

```ts
// src/components/graph-utils.ts
// with keepPositions, a state already drawn or given a position keeps it rather than being laid out
export const isPlaced = (keepPositions: boolean, drawn: boolean, node: { x?: number, y?: number }) =>
  keepPositions && (drawn || (node.x != null && node.y != null));
```

- `graph-utils.test.ts` gains an `isPlaced` block: with `keepPositions`, a node with no drawn state and `{ x: 10, y: 20 }` is placed (fails if the position clause is deleted); one with only an `x`, or with neither, is not; a drawn node is placed. Without `keepPositions` none of them is, including the node with a position, which is the plugin's case.
- `selectedEdge`/`onEdgeSelect`: when `onEdgeSelect` is set, the edge lines and their backgrounds call it from a click in any tool but delete (they take clicks today and call `onEdgeClick`, which only the delete tool acts on). Loops and loop backgrounds have `pointer-events: none` outside the delete tool (`loopStyle`); with `onEdgeSelect` set they take clicks and call it with `{ from: id, to: id }` rather than `onNodeClick(id, true)`. `highlightSelected` gains a transition branch: every state faded but the two ends, every arrow faded but this one, drawn in the outgoing color with its marker; a chosen self-loop (`from === to`) is a `path.loop`, not a `line.edge`, so the branch lights that loop in `selectedLoopArrowColor`, as a selected state's loop is drawn today; `selectedEdge` joins the dependencies of `highlightSelected` and of the highlight effect.
- Selection is read, not drawn: the draw effect reads `selectedNodeId`, `setSelectedNodeId` and `highlightSelected` through refs set at each render (the node click handler's `skipToggle` and the draw's closing `highlightSelected(svg)`), and they leave its dependencies, while `animating` joins them. The highlight effect already runs `highlightSelected` when the selection changes, so a selection restyles the graph rather than rebuilding it. Starting and ending a sequence still rebuilds it, as today: both highlight passes return at once while `animating`, so in the plugin's Drawing view, whose `allowDragging` doesn't follow `animating`, only the rebuild clears a selection's or output's fading for Play and Step. Nothing the plugin draws changes. `highlighting.test.ts` gains a case (fails if `animating` leaves the dependencies): in a drawing, choose "b", press Step, and "d" isn't faded; the same after choosing an output. *(Checked with throwaway code on the fake-CODAP page with `chain.json`: without `animating` in the dependencies, "d" stayed faded; with it, the case, `highlighting.test.ts` and `clicks.test.ts` passed.)* *(Checked with throwaway code on the fake-CODAP page: with the callbacks and the selection in the draw effect's dependencies, each re-render rebuilt `g.root`, a 377 ms task at about 700 states with the tick skip applied.)*
- `onBackgroundClick`: the SVG's `click` when its target is the SVG itself. With it set, the zoom gets `clickDistance(4)`, so a press that moves 4 px or less (a hand tremor, a touchscreen tap) is still a click; d3's default of 0 makes any movement a pan and suppresses the click. *(Checked with throwaway code: with 0 px of movement the click arrived, with 2 px it didn't.)*
- Following the graph (R29c): the zoom handler calls `onUserZoom` for a gesture (`e.sourceEvent` set; fits, recenters, `zoomRequest` and transitions have none) whose transform differs from the one recorded on the zoom's `start` by a change of scale or a translation of more than 4 px (the `clickDistance`), so a click that moved a little doesn't stop the following, and a mouse drag, the wheel, a touch pan and a pinch all do. A rule on the pointer's `clientX` would miss touch: a `TouchEvent` has none. *(Checked with throwaway code: driven with DevTools touch events, the start event's `clientX` was `undefined` and a pinch reached scale 4.75 uncounted.)* Cypress: pinch the graph out, type a new word, and the root group's transform is unchanged (fails with a `clientX` rule). The pinch is two `Touch`es dispatched as `TouchEvent`s in the interactive's frame, after the frame's `navigator.maxTouchPoints` is made 5 and a render sets the zoom up again, so d3 binds its touch handlers; a `TouchEvent` has no `clientX` of its own, as a real one doesn't. DevTools' touch input (`Input.dispatchTouchEvent`) can't be used here: with the branch's Cypress, any spec that sends it passes and then never ends, which would hang CI. `fitOrCenter("fit")` applies its transform with `svg.transition().duration(fitTransitionMs).call(zoom.transform, t)` when `fitTransitionMs` is set, and with `svg.call` as today otherwise.
- `MarkovToolHandle.dataChanged` (`host.ts`) gains an optional second argument, `{ fit?: boolean }`, default `true`; `onDataChanged` sets `fitAfterGraphChangeRef.current` from it. The CODAP host passes one argument, so the plugin fits after every change as today.
- Zoom (R29): `zoomButtons` defaults to true, so the plugin keeps its corner buttons. `zoomRequest` is read by an effect beside the fit and recenter ones, with a ref of the last `id` acted on, and calls the existing `scaleBy(by)`; a counter rather than a time, since two clicks can land in the same millisecond. `Toolbar` gains `zoomIn` ("Zoom In", `plus.svg`) and `zoomOut` ("Zoom Out", `minus.svg`) in `allTools`, top-group tools that aren't toggleable, and optional `onZoomIn` and `onZoomOut` props its click handler calls for them. The plugin passes neither tool, so its toolbar is unchanged. `GraphPane` keeps `{ id, by }` in state, adding one to `id` with `by` 1.1 or 0.9, the corner buttons' steps. The toolbar's `disabled` covers them while a sequence plays, as it covers Fit and Recenter; the mouse wheel still zooms.
- `allowDragging` is already a prop; dataset mode passes `!animating`.

**SVG height:** the SVG keeps `height="calc(100vh - 20px)"` as a presentation attribute; the workspace's stylesheet sets `.markov-workspace .graph svg { height: 100%; }`, which overrides it. *(Checked with throwaway code: a CSS `height: 100%` on an SVG with that attribute, in a 123 px box, rendered 123 px tall.)*

---

### 4. Transition selection in the core's hook

**Summary**: R3, R24, R27, R28, R38a. MARK-14's R1a puts the core's state, effects and handlers in `useMarkovTool(host)`, which returns a `MarkovToolApi` and which `MarkovTool` calls for the CODAP layout. This step adds only what the workspace needs on top: a chosen transition, one `selection`, and select and clear functions that carry a source for logging.

**Files affected**:
- `src/hooks/use-markov-tool.tsx`: `selectedEdge` state; `selectedEdge` in `graphHighlights`; `selection`, `selectState`, `selectTransition` and `clearSelection` on `MarkovToolApi`; `setSelectedNodeId` and `toggleHighlightOutput` also clear `selectedEdge`; the unmount cleanup (R38a).
- `src/hooks/use-markov-tool.test.tsx` (new): the unmount tests; step 5 adds the logging tests.
- `src/components/host.ts`: `Selection` types (below).
- `src/components/markov-tool.tsx`: no change. It keeps passing `setSelectedNodeId` to the drawing and dataset views.

**Estimated diff size**: ~100 lines

MARK-14's `MarkovToolApi` already has `handle`, `graph`, `graphEmpty`, `animating`, `graphHighlights`, `setSelectedNodeId`, `generatorProps` (MARK-14's exported `GeneratorProps`), `outputProps` (its exported `SequenceOutputProps`) and `view` (`fitViewAt`, `recenterViewAt`, `resetViewAt`, `graphOpacity`, `onFitView`, `onRecenterView`, `onReset`, `onDimensions`, `setGraph` typed `React.Dispatch<React.SetStateAction<GraphData>>`, `setHighlightNode`, `onClearHighlightOutput`, `confirmModal`, `onSelectDatasetMode`, `onSelectDrawingMode` and `onReturnToMainMenu`). This step adds:

```ts
// src/hooks/use-markov-tool.tsx, added to MARK-14's MarkovToolApi
export interface MarkovToolApi {
  // ...MARK-14's members, unchanged...
  graphHighlights: { /* MARK-14's members */ selectedEdge?: { from: string, to: string } };
  selection: Selection;
  // MARK-14's setSelectedNodeId with a source for the log: it toggles as a graph click does today
  selectState: (id: string | undefined, source: SelectionSource, skipToggle?: boolean) => void;
  selectTransition: (edge: { from: string, to: string }, source: SelectionSource) => void;
  clearSelection: (via: ClearVia) => void;
}

// src/components/host.ts
export type SelectionSource = "graph" | "inspect" | "table";
export type ClearVia = "toggle" | "background" | "escape" | "button" | "table";
export type Selection =
  | { kind: "state", id: string }
  | { kind: "transition", from: string, to: string }
  | { kind: "output", group: SequenceGroup, sequence: Node[] }
  | undefined;
```

- `selection` is derived from the three pieces of state the hook keeps: MARK-14's `selectedNodeId` and `highlightOutput`, and the new `selectedEdge`. Setting one clears the other two: MARK-14's `setSelectedNodeId` and `toggleHighlightOutput` already clear each other, and both now clear `selectedEdge` too, which the CODAP layout never sets, so its behavior is unchanged. All three do nothing while `animating`, as `setSelectedNodeId` does today.
- `selectState(id, source, skipToggle)` calls MARK-14's `setSelectedNodeId(id, skipToggle)` and logs (step 5). The workspace's `Graph` gets `setSelectedNodeId={(id, skipToggle) => tool.selectState(id, "graph", skipToggle)}`, so a graph click toggles as today; the CODAP layout keeps passing the raw `setSelectedNodeId`, whose host logs nothing anyway.
- `selectTransition` toggles: the same transition again clears it.
- Only `selectState`, `selectTransition`, `clearSelection` and a click on an output log (step 5); the core's own clears (Reset, Play and Step clearing the output highlight, `toggleHighlightOutput` clearing the state) call the raw setters and log nothing.
- R28's clearing when a commit drops the chosen state or transition is the workspace's (step 10), not the core's: in the plugin a dataset edit that removes the selected state leaves `selectedNodeId` set and every state faded, and R41 keeps that.
- Unmount (R38a): an effect with no dependencies returns a cleanup that clears `animationInterval.current` and sets an `unmountedRef`, which `onSetGraph`'s `translateOrigin` checks before it acts or polls again. The CODAP host never unmounts the core, so nothing the plugin does changes. Jest, rendering `MarkovTool` as `markov-tool.test.tsx` does (`Graph` stubbed, fake timers): Play, unmount, and `jest.getTimerCount()` is 0 (fails without the `clearInterval`); `loadDrawing` a version 1 drawing before the graph has a size, unmount, advance 10 ms, and the count is 0 (fails without the `unmountedRef` check). *(Checked with throwaway code: both fail on MARK-14's hook and pass with the cleanup.)*
- `MarkovTool`'s render and the plugin's markup are unchanged; MARK-14's tests pass unchanged, as do the plugin's Cypress specs.

---

### 5. Logging

**Summary**: R4, R33, R35, R38b. `log` on the host, one typed list of events, the core's calls, and `LOGGED-EVENTS.md`.

**Files affected**:
- `src/components/log-events.ts` (new): the list.
- `src/components/log-events.test.ts` (new): R35's test.
- `src/components/host.ts`: `log` on `MarkovHost`, named in its comment on keeping identity.
- `src/hooks/use-markov-tool.tsx` (the generator, output, selection and Reset handlers), `src/components/drawing.tsx`, `src/components/dataset.tsx`: the calls. `Drawing` and `Dataset` gain a `log` prop, which `src/components/markov-tool.tsx` passes from its host.
- `src/components/generator.tsx`: `onDelimiterCommit` joins MARK-14's exported `GeneratorProps`, beside its `onLengthLimitCommit`.
- `src/components/generator.test.tsx` (new): R38b's tests.
- `src/codap/codap-app.tsx`: `log` that does nothing, defined outside the component so it keeps its identity, added to the `host` object MARK-14's `CodapApp` builds.
- `src/components/markov-tool.test.tsx`: MARK-14's recording host gains `log: jest.fn()`, the one line R41 allows; `log` is required, so the host must have it to type-check. `log` stays required rather than optional so a host can't leave it out by accident.
- `LOGGED-EVENTS.md` (new), at the repo root.

**Estimated diff size**: ~200 lines

```ts
// src/components/log-events.ts
// Every event the Markov tool and the AP workspace log. LOGGED-EVENTS.md describes each, and a test keeps the two equal.
export const logEvents = [
  "SequencePlayed", "SequenceStepped", "SequencePaused", "SequenceResumed", "SequenceCanceled", "SequenceGenerated",
  "GeneratorSettingChanged", "OutputCleared", "OutputSelected",
  "StateSelected", "TransitionSelected", "SelectionCleared", "StateDialogOpened", "StateMoved",
  "StateAdded", "TransitionAdded", "StateDeleted", "TransitionDeleted", "StateEdited", "TextToGraph", "GraphReset",
  "InputCommitted", "TableRowAdded", "TableRowDeleted", "PaneOpened", "PaneClosed", "PaneResized", "InspectTabChosen",
  "InspectSorted",
] as const;
export type LogEvent = typeof logEvents[number];

// src/components/host.ts, in MarkovHost
log: (event: LogEvent, data?: Record<string, unknown>) => void;
```

- The calls sit in the handlers that already exist: `handlePlay`, `handleStep`, `handlePause`, `handleResume`, `handleCancel` with `{ startingState, maxLength, delimiter, fast }`; `finishAnimating` (not canceled) logs `SequenceGenerated` with `{ sequence: labels, ...settings }`; `handleClearOutput`; `toggleHighlightOutput` (`OutputSelected`, or `SelectionCleared` with `via: "toggle"`); `selectState` and `selectTransition` (a toggle off logs `SelectionCleared`; a call that leaves the selection as it was, such as a double-click's second click or focusing another row of the chosen state, logs nothing, so the log counts only the student's changes); the starting state, delimiter type and speed log `GeneratorSettingChanged` on change, and the length and the "other" delimiter when committed with a changed value. MARK-14's `Generator` calls `onLengthLimitCommit` on both Enter and blur (`generator.tsx`), so the hook's `handleCommitLengthLimit` keeps the last logged length in a ref and logs only when the clamped value differs from it: an Enter and then a blur log once. The delimiter commits on blur through `Generator`'s new `onDelimiterCommit`, compared the same way. Drawing view: `addNode`, `addEdge`, the delete branches, `handleChangeNode`, `handleTextChange` (with `words: words.length`, only when the words changed) and `handleDragStop`; the hook's Reset `onOk` logs `GraphReset`. The dataset view's `handleNodeDoubleClicked` and the drawing view's `select` double-click log `StateDialogOpened`.
- The core reads `host.log` through its hook dependencies: `log` joins the dependencies of every callback that logs (`finishAnimating`, `handlePlay`, `handlePause`, `handleResume`, `handleStep`, `handleCancel`, `handleClearOutput`, `toggleHighlightOutput`, `selectState`, `selectTransition`, `clearSelection`), and `handlePlay` also gains the four settings it logs (`startingState`, `lengthLimit`, `delimiter`, `fastSimulation`). Callbacks that run from the animation's interval (`finishAnimating`, and `handleStep`'s `SequenceStepped`) read the settings the sequence was started with from `currentAnimatedSequenceGroup` (its `startingState`, `lengthLimit` and `delimiter`) and the speed from a `fastSimulationRef` kept beside `fastSimulation`, so a closure from the sequence's start logs the right values; `exhaustive-deps` stays clean with no disable. The CODAP host's `log` is a module-level constant and the AP host's comes from `useMemo`, so neither changes identity and a playing sequence keeps its callbacks (MARK-14's `MarkovHost` rule). The `MarkovHost` comment in `host.ts`, which names the functions whose identity matters, names `log` too.
- `LOGGED-EVENTS.md` follows hurricane-model's: a line that every event is sent with lara-interactive-api's `log()` and only inside the Activity Player, then one table per group (Generator, Selection and highlighting, Drawing, Input, Panes and Inspect) with Event, Parameters and When.
- `log-events.test.ts` (with `/// <reference types="node" />`, since the tsconfig's `types` is empty, and `@types/node` 24 added as a dev dependency in its own commit: the `@types/node` 18 that Jest's packages bring in clashes with TypeScript 6's lib, so `tsc` fails on any file that references it) reads `LOGGED-EVENTS.md` with `fs`, collects the backticked names in each table's first column, and checks that set equals `logEvents`. Deleting an event from either fails it.
- A Jest test in `markov-tool.test.tsx`'s style (the recording host, `Graph` stubbed) checks that Play logs `SequencePlayed` and then `SequenceGenerated` with the sequence's labels, and Cancel logs `SequenceCanceled` and no `SequenceGenerated`. The selection cases can't go through `MarkovTool`, which passes its views the raw `setSelectedNodeId` (`markov-tool.tsx`), so they call the hook directly with `renderHook(() => useMarkovTool(host))` and the recording host, after `dataChanged`: the same state chosen twice with `skipToggle` logs one `StateSelected` (fails if every call logs); a transition chosen twice logs `TransitionSelected` and then `SelectionCleared` with `via: "toggle"` (fails if the toggle doesn't log). *(Checked with throwaway code: `renderHook` runs the hook in Jest with no `Graph` stub.)* It goes in `src/hooks/use-markov-tool.test.tsx`, which step 4 creates: MARK-14 adds no hook test (its R13 tests render `MarkovTool`), so the file is MARK-15's, and MARK-14's `markov-tool.test.tsx` stays unchanged (R41).
- Generator (R38b), in `generator.test.tsx`, rendering `MarkovTool` with a drawing loaded (`Graph` stubbed, fake timers, advanced in 500 ms steps inside `act` so each step's output promise settles):
  - The delimiter field is absent at "space", appears for "other", and a sequence played with "-" typed in it shows `"-"` in its group's header (fails without the field's `onChange`, or with the field always shown); switching to "none" removes the field and the next sequence's header says "(none)" (fails if choosing "none" leaves the delimiter as it was).
  - Max Length set to 0 reads 0 until the field loses focus, then 1 (fails without `onBlur={onLengthLimitCommit}`).
  - *(Checked with throwaway code: each case fails under its mutation and passes on MARK-14's code.)*

---

### 6. Tokenizer, input edits and saved input

**Summary**: R15 to R17, R20's writes, R31, R32. Pure modules, with Jest tests.

**Files affected**:
- `src/interactive/input/tokenizer.ts` (new) and `tokenizer.test.ts`.
- `src/interactive/input/table-edits.ts` (new) and `table-edits.test.ts`.
- `src/interactive/interactive-state.ts`: `input`, `readSavedInput`, `maxInputLength`; `interactive-state.test.ts` (new).

**Estimated diff size**: ~450 lines, about half tests

```ts
// src/interactive/input/tokenizer.ts
export type Token =
  // text as typed (a bracketed token's without its brackets); start..end spans the brackets too, so an edit replaces them
  | { kind: "word", text: string, state: string, start: number, end: number }
  | { kind: "break", start: number, end: number };                            // a blank line

export const tokenize = (text: string, capitalization: Capitalization): Token[] => ...;
// the values the core's dataChanged takes: each word's state, "" for each break
export const tokensToValues = (tokens: Token[]): string[] => ...;
// a table row as a token's text: trimmed, brackets removed; "" is a break
export const rowText = (row: string) => row.replace(/[[\]]/g, "").trim();
// how a row's text is written into the text: as it is when the tokenizer gives it back as one word, else in brackets
export const textForRow = (text: string) => ...;
```

- A break's `start..end` runs from its first blank line to the next word, over any further blank lines and dropped characters between them, so editing or deleting a break row replaces all of them.
- `tokenize` is a single left-to-right scan (the stage-1 prototype, about 40 lines): whitespace runs (a break when they hold two or more line breaks and a word comes before and after), a `[` whose `]` comes before the next `[` or line break, the six punctuation marks, the dropped separators, and word runs. A word's `state` is `text.toLocaleLowerCase()` under `lowercase`. Measured at about 3 ms for 20,000 characters.
- `textForRow(t)`: `t` when `tokenize(t, "asTyped")` gives exactly one word whose text is `t`, else `[${t}]`. So `cat` and `.` stay bare, and `No!`, `ice cream` and `a+b` are bracketed.

```ts
// src/interactive/input/table-edits.ts
// Each returns the new text; tokens are the text's current tokens, and row indexes count breaks as rows.
export const editRow = (text: string, tokens: Token[], row: number, value: string): string => ...;
export const insertRow = (text: string, tokens: Token[], after: number, value: string): string => ...;
export const deleteRow = (text: string, tokens: Token[], row: number): string => ...;
```

- `editRow` replaces the token's `start..end` with `textForRow(rowText(value))`, or, when the row became empty, with a blank line (`"\n\n"` with the whitespace around the word collapsed into it); editing a break row to a word replaces the break's span with `"\n" + word + "\n"`.
- `deleteRow` on a break row replaces the blank line's whitespace with one space, joining the chain.
- `insertRow` inserts after row `after`'s end: `" " + text`, or `text` alone for `. , ? ! : ;`; after a break row, `text + " "` at the break's end, so it doesn't run into the next word; at row -1 (the top) it inserts before the first token with a space after.
- `deleteRow` removes the token and the space before it (after it, when there is none before, as for the first token); a line break beside it stays, so no blank line is lost, except that a word alone on its line goes with the line break after it, so its two line breaks don't become a blank line; and where removing it would leave two words touching (punctuation between them) it leaves a space. Inserted and edited words likewise get a space on a side where they would otherwise run into a word (`[No!]the` edited to `cow the`). An edit that removes what kept a dropped `[` from pairing (another `[`, or a line break) turns that `[` into a `(`, which the tokenizer also drops, so it can't take in the rows after it (`[a [No!] b]` with `No!` deleted gives `(a b]`, rows `a` and `b`). A word's removal that leaves two breaks touching leaves the text's blank lines as they are; the tokenizer reads them as one break.
- Table-only mode uses the same three functions on the hidden text.
- *(Checked with throwaway code: a prototype of the tokenizer and the three edits, run on 4,911 random texts and edits drawn from words, punctuation, blank lines and bracketed tokens, gave back exactly the edited table every time. The first version measured a bracketed token's span inside its brackets, so inserting after `[No!]` wrote `[No! cat]`, and inserted after a break without a space, running into the next word; both are fixed above.)*
- Tests name each rule's mutation: a bracketed row (`No!` → `[No!]`), an unbracketed one, punctuation without a space, the first row, a break row, an emptied row, capitalization kept as typed, and a round trip: every row of `tokenize(editRow(...))` equals the table the student sees.

```ts
// src/interactive/interactive-state.ts
export const maxInputLength = 50000;
export interface MarkovInteractiveState {
  version: typeof interactiveStateVersion;
  input?: { text: string };
}
// whatever the Activity Player hands back, read as the saved input text, or undefined for none
export const readSavedInput = (raw: unknown): string | undefined => ...;
```

- `readSavedInput` takes an object or a JSON string (the same `parseState` as `readAuthoredState`, in a shared `src/interactive/parse-state.ts` both import, with `isRecord`, R32), and returns `input.text` when it is a string, else `undefined`. Tests: `null`, `{}`, `{ version: 1 }`, a JSON string, `input` not an object, `text` not a string, and a good state.

---

### 7. The workspace's configuration, Inspect rows and highlights

**Summary**: R6 to R10, R22, R25. Pure functions the workspace renders from, with Jest tests.

**Files affected**:
- `src/interactive/workspace/workspace-config.ts` (new) and its test.
- `src/interactive/workspace/inspect-rows.ts` (new) and its test.
- `src/interactive/workspace/highlights.ts` (new) and its test.

**Estimated diff size**: ~500 lines, about half tests

```ts
// src/interactive/workspace/workspace-config.ts
export type WorkspacePaneId = "input" | "graph" | "inspect" | "generator";
// Data mode alone has an input view, so the Data-mode workspace takes the useData member and needs no fallback
export type WorkspaceConfig = WorkspaceSettings & ({ mode: "useData", inputView: InputView } | { mode: "draw" });

interface WorkspaceSettings {
  // the panes present, in layout order, and whether each starts open
  panes: { id: WorkspacePaneId, startsOpen: boolean }[];
  capitalization: Capitalization;  // the starting value, which the "Case sensitive" switch changes
  // controls later stories render in their slots
  modeSwitch: boolean;              // MARK-16
  orderMatters: { startsOn: boolean, showSwitch: boolean };  // MARK-16, Data mode only shows the switch
  probabilities: { startsOn: boolean, showToggle: boolean }; // MARK-16
  sendToCodap: boolean;             // MARK-18
  downloadTables: boolean;          // MARK-18
}

export const workspaceConfig = (state: MarkovAuthoredState, mode: ModeId = state.startingMode): WorkspaceConfig => {
  const data = mode === "useData";
  const pane = (id: WorkspacePaneId) => state.panes[id];
  const panes = (["input", "graph", "inspect", "generator"] as const)
    .filter(id => id === "graph" ? (!data || pane(id).available) : (id !== "input" || data) && pane(id).available)
    .map(id => ({ id, startsOpen: id === "graph" && !data ? true : pane(id).startsOpen }));
  return {
    ...(data ? { mode: "useData", inputView: state.inputView } : { mode: "draw" }),
    panes,
    capitalization: state.capitalization,
    modeSwitch: state.modes.useData && state.modes.draw,
    orderMatters: { startsOn: state.orderMatters.startsOn, showSwitch: data && state.orderMatters.showSwitch },
    probabilities: {
      startsOn: !!state.buttons.probabilities.startsOn,
      // its labels are drawn on the graph
      showToggle: state.buttons.probabilities.available && panes.some(p => p.id === "graph"),
    },
    sendToCodap: state.buttons.sendToCodap.available,
    downloadTables: state.buttons.downloadTables.available,
  };
};
```

- The test lists the expected configuration, written out, for each of the four mode rows of the component inventory, each input view, a pane unavailable and one not starting open, the Graph pane in Draw mode with its Data-mode setting off, the Order matters switch hidden in Draw, the probabilities toggle hidden in a Data mode with no Graph pane and shown in that state's Draw mode, the toggle hidden when it isn't available though the Graph pane is present (fails if `showToggle` drops its `available` check), and both buttons. The component inventory in the requirements is this function's output for the defaults (stage 7 regenerates it).

```ts
// src/interactive/workspace/inspect-rows.ts
export interface StateRow { id: string, label: string, count: number }
export interface TransitionRow { from: string, to: string, label: string, count: number, outOf: number,
                                 percent: number, probability: string }   // "2 of 3 = 67%"
export const stateRows = (graph: GraphData): StateRow[] => ...;
export const transitionRows = (graph: GraphData): TransitionRow[] => ...;
export type SortColumn = "state" | "count" | "transition" | "probability";
export const sortRows = <T extends StateRow | TransitionRow>(rows: T[], column: SortColumn, ascending: boolean): T[];
```

- Labels compare with the core's `compareStateLabels`; transitions by `from`'s label, then `to`'s. Count and probability compare numerically (probability by `count / outOf`), ties alphabetical. The test uses the doc's example ("the cat sat on the mat. the cat ran."), whose two tables Rebecca wrote out, as its expected values.

```ts
// src/interactive/workspace/highlights.ts
export type HighlightKind = "selected" | "output";
export interface Highlights {
  kind?: HighlightKind;
  tokens: Set<number>;                       // word token indexes, for table rows and the text box
  states: Set<string>;                       // Inspect States rows
  transitions: Map<string, "in" | "out" | "chosen" | "output">;  // Inspect Transitions rows, keyed from + "\u0000" + to
}
export const highlightsFor = (selection: Selection, tokens: Token[]): Highlights => ...;
```

- A state: tokens whose `state` is the id; its States row; transitions with it as `from` (`out`) or `to` (`in`). A transition: tokens `i` and `j` where `j` is the next token after `i`, both words, with `i`'s state `from` and `j`'s `to`; its two States rows; its row (`chosen`). An output: tokens whose state is in it; its states; each of its steps' rows (`output`). Tests cover each kind, a transition across a break (not lit), a self-loop, and lowercase states lighting differently-cased tokens.

---

### 8. The workspace and its host

**Summary**: R1, R2, R5, R7, R8, R11 to R14, R29 to R31, R29c, R39's toolbar test, R34's pane events, R38, R40's updates to MARK-13's tests and its toolbar and no-data tests. The workspace with its panes, the graph and the generator, the Input pane as a plain text box (the table and the highlight layer follow in step 9), and saving.

**Files affected**:
- `src/interactive/workspace/ap-host.ts` (new): `useApHost(hosted: boolean): MarkovHost`.
- `src/interactive/workspace/workspace.tsx` (new), `pane.tsx` (new), `graph-pane.tsx` (new), `generator-pane.tsx` (new), `input-pane.tsx` (new), `workspace.scss` (new).
- `src/components/markov-panel.scss` (new) and `src/components/app.scss`: the shared styles (R30).
- `src/interactive/workspace/pane-sizes.ts` (new; step 11 adds the dividers' functions) and `pane-sizes.test.ts` (new).
- `src/interactive/runtime.tsx`: `runtime` and standalone render `Workspace`; `report` keeps the placeholder. The placeholder becomes `ReportPlaceholder`, used by `report` mode only.
- `src/interactive/app.tsx`: passes `view` as today.
- `src/interactive/index.html`, `src/interactive/interactive.scss`: Lato (R13b).
- `eslint.config.js`: `"src/interactive/**"` joins MARK-14's boundary rule's `files`, and `"**/codap-request"` its `group` (R38).
- `src/interactive/import-boundary.test.ts` (new, R38): with a `@jest-environment node` docblock and `/// <reference types="node" />` (the tsconfig's `types` is empty), it runs `node_modules/.bin/eslint --stdin --stdin-filename src/interactive/runtime.tsx --format json` through `spawnSync`, with `import { useCodap } from "../codap/use-codap";` as the input, and expects a `no-restricted-imports` message. The file name is an existing one so the type-aware parser finds it in the project. ESLint's API can't run in Jest here: it loads the config with a dynamic `import()`, which Jest refuses without `--experimental-vm-modules`, and requiring `eslint.config.js` clashes with Jest's `jest` global. *(Checked with throwaway code: the test fails on MARK-14's config and passes with `src/interactive/**` added, in about 3 s.)*
- `cypress/e2e/interactive-runtime.test.ts`, `cypress/e2e/interactive-demo.test.ts`, `src/interactive/standalone.test.tsx`: R40's updates.
- `cypress/e2e/interactive-workspace.test.ts` (new).
- `cypress/fake-ap/fake-ap.ts`: `"log"` joins `messageTypes`, so the tests can read the log messages (step 8's `StateDialogOpened` check is the first); the fake page records only the types it lists.
- `README.md`: R43.

**Estimated diff size**: ~650 lines

```ts
// src/interactive/workspace/ap-host.ts
import { log } from "@concord-consortium/lara-interactive-api";
const noop = () => undefined;
const resolved = () => Promise.resolve();

// The Activity Player's side of the Markov tool. Data mode is the core's dataset view: values in, read-only
// probabilities. Standalone, nothing is logged and the library is never called.
export const useApHost = (hosted: boolean): MarkovHost => useMemo<MarkovHost>(() => ({
  viewMode: "dataset",
  setViewMode: noop,
  markDirty: noop,
  outputSequence: resolved,
  log: hosted ? (event, data) => log(event, data) : noop,
}), [hosted]);
```

`useMemo` needs the type argument: without it the type comes from the object literal, so the ternary's arrow gets no parameter types and fails `tsc` with TS7006 *(checked by prototyping on MARK-14's code)*.

`Workspace`:

```tsx
interface WorkspaceProps {
  authoredState: MarkovAuthoredState;
  savedInput?: string;
  // saves the input; absent standalone
  onSaveInput?: (text: string) => void;
  hosted: boolean;
}
```

- It computes `workspaceConfig(authoredState)` once. Draw mode renders the R7 message and nothing else.
- In this step the text box commits on leaving it; step 9 adds the commit on a separator, the pause after a deletion, and the table.
- Data mode: `const tool = useMarkovTool(host)`. The input text is state (`savedInput ?? authoredState.startingText`, or the starting text alone when the Input pane isn't present, `hasInputPane` from the configuration's panes), its live tokens a `useMemo` of `tokenize(text, config.capitalization)`, and a `committed` state, `{ text, tokens }`, set at each commit. Each commit calls `tool.handle.dataChanged(tokensToValues(committed.tokens))` and, when the text differs from the last saved, `onSaveInput(text)`. The table, Inspect and the table's highlights read `committed`, so a word being typed shows nowhere but the text box; the text box's marks come from `highlightsFor` over the live tokens (tokenizing 20,000 characters takes about 3 ms), so they stay on the right words after an uncommitted edit. The first values go in from an effect on mount; React sets the hook's state before that effect reads it. The effect depends only on values that never change, so it runs once with no `eslint-disable`: MARK-14's `tool.handle` keeps its identity for the hook's lifetime (its R1a), and the first values are fixed in state when the workspace mounts. Depending on `tokens` instead would call `dataChanged` at every keystroke, against R18's commit rule. With the Input pane turned off (R21), those first values are the only ones: nothing renders the text, so nothing commits or saves, and a Cypress test checks that the graph shows the starting text's states, and another, with no starting text either, that the Graph pane says "No data was provided for this activity."

```ts
// with no Input pane the student cannot edit the input, so a saved one is ignored
const [firstValues] = useState(() => tokensToValues(tokenize(
  hasInputPane ? savedInput ?? authoredState.startingText : authoredState.startingText, config.capitalization)));
useEffect(() => {
  tool.handle.dataChanged(firstValues);
}, [tool.handle, firstValues]);
```
- Panes: `Pane` renders a `section` with a header (`paneHeader` tall, an `h2` title and a button with `aria-expanded` and `aria-controls`, labeled "Collapse Inspect" or "Expand Inspect") and keeps its body mounted when collapsed (`hidden`), so the input, the Inspect tab and sort, and the generator keep their state (R8). The bodies are flex containers, and an author `display` rule beats the browser's `[hidden]` rule, so `workspace.scss` has `.markov-workspace [hidden] { display: none !important; }` *(checked with throwaway code: without it a `hidden` flex body stayed 100 px tall)*; Cypress checks a collapsed body isn't visible and the collapsed Graph pane's SVG has zero width. The Graph pane is the exception: a hidden `Graph` gets a zero size from its `ResizeObserver`, so on reopening the pane sends a fit (`onFitView`), which is what the plugin does after a graph change.
- Layout values (R11 to R13, R29): `pane-sizes.ts` holds every number the layout needs in both TypeScript and CSS. `Workspace` sets the ones CSS reads as custom properties on its root (`--pane-gap`, `--pane-padding`, `--pane-top` from `defaultPaneSizes.top`, `--collapsed-strip`, `--pane-header`, `--toolbar-button`, `--toolbar-gap`, `--controls-row`), and `workspace.scss` reads them with `var()`, so no size is written in both languages.

```ts
// src/interactive/workspace/pane-sizes.ts
// Pane sizes in px: the graph takes what the row leaves, and the generator what the height leaves.
export interface PaneSizes { input: number, inspect: number, top: number }

export const defaultPaneSizes: PaneSizes = { input: 280, inspect: 260, top: 330 };
export const minPaneSizes = { input: 160, graph: 200, inspect: 220, top: 200, generator: 220 };
// the generator starts at its minimum (R13a)
export const workspaceHeight = defaultPaneSizes.top + minPaneSizes.generator;

export const paneGap = 8;
// every pane's contents keep this padding, which a divider's band, across the gap, covers and no more
export const panePadding = 5;
export const paneBorder = 1;
export const dividerBand = paneGap + 2 * panePadding;
export const collapsedStrip = 32;
export const paneHeader = 26;
// below this workspace width the panes stack (R13)
export const stackBelow = 700;
// the workspace's own row is always one control tall, so a control appearing doesn't move the panes
export const controlsRowHeight = 32;

// the shared toolbar's button size and padding (toolbar.scss), and the workspace's gap between its buttons
export const toolbarButton = 32;
export const toolbarPadding = 4;
export const toolbarGap = 4;
export const toolbarHeight = (tools: number, columns: 1 | 2 = 1) => {
  const rows = Math.ceil(tools / columns);
  return rows * toolbarButton + (rows - 1) * toolbarGap + 2 * toolbarPadding;
};
// the height inside the Graph pane's border, header and padding, in a row top px tall
export const graphBodyHeight = (top: number) => top - paneHeader - 2 * paneBorder - 2 * panePadding;
// the height the row's panes are drawn at, from the stored row height: stacked panes are all the starting row's
// height, whatever row height is stored
export const drawnRowHeight = (top: number, stacked: boolean) => stacked ? defaultPaneSizes.top : top;
// a toolbar taller than the Graph pane's body puts its buttons in two columns
export const toolbarColumns = (tools: number, bodyHeight: number): 1 | 2 =>
  toolbarHeight(tools) <= bodyHeight ? 1 : 2;
```

- Toolbar (R29): `workspace.scss` sets `gap: var(--toolbar-gap)` on `.markov-workspace .toolbar` and its `.top` and `.bottom` groups, overriding `toolbar.scss`'s 10 px without changing it, with `align-self: flex-start` so the toolbar is its own height in the Graph pane's body rather than stretched to it, and `.bottom:empty { display: none }`, since `Toolbar` always renders the `.bottom` group and an empty one would add a gap. Data mode's five tools then need `toolbarHeight(5)`, 184 px, against 208 at 10 px. `GraphPane` puts a `two-columns` class on the Graph pane's body when `toolbarColumns(tools.length, graphBodyHeight(top))` is 2, where `top` is the drawn row height the workspace hands it. Under that class the toolbar is a grid, `grid-template-columns: repeat(2, var(--toolbar-button))` with `width: auto`, and `.top` and `.bottom` take `display: contents`, so the buttons fill two columns in their order and keep their groups' styles. Data mode's five tools go to two columns below a 222 px row (184 px, inside the pane's 1 px borders, its header and the 5 px padding above and below the toolbar); in two columns they are 112 px tall, inside the 162 px a 200 px row leaves. Step 11's Cypress test drags the row to 200 px to reach the two-column rules, and to 215 and 222 px either side of the flip, and MARK-16 checks Draw mode's own toolbar. The rules sit under `.markov-workspace`, so the plugin's toolbar is unchanged.
- Layout CSS: `.markov-workspace .top-row { display: flex; column-gap: var(--pane-gap); }`, and the same gap between the row and the generator. Pane sections and their headers are `box-sizing: border-box`, so a pane's padding and border sit inside its width and height. The pane sections and the row keep `overflow: visible`, so a divider on their edge isn't clipped: a pane's scrolling happens in its body, and no pane takes a `z-index`, `transform`, `opacity` below 1 or `contain`, which would make it a stacking context the next pane's divider couldn't rise above. Input and Inspect take `flex: 0 0 <width>px` and the row `height: <top>px` as inline styles from `defaultPaneSizes`, Graph `flex: 1`, and the generator `height: <workspaceHeight - top>px`, its output scrolling; step 11 makes the sizes state. A collapsed pane is `flex: 0 0 var(--collapsed-strip)` with its title in `writing-mode: vertical-rl`. With the Graph pane collapsed or not present, Input and Inspect take `flex: <width> 0 0` and `min-width: 0` in place of `flex: 0 0 <width>px`: from a zero basis, `flex-grow` shares the row's free space in proportion to the numbers, so the two fill the row in the ratio of their widths, and one open alone takes all of it (R11). With no pane in the row the row isn't rendered. The Graph pane's body is `position: relative`, so the empty-graph message overlays the graph within the pane.
- Stacking (R13): `Workspace` measures its own width with the existing `use-resize-observer` hook and, below `stackBelow`, adds a `stacked` class; it isn't stacked until the first measurement arrives. Stacked, it leaves out the panes' inline widths and the row's height (the generator keeps its height, which its absolutely positioned output needs): the row takes `flex-wrap: wrap` and `row-gap: var(--pane-gap)`, each pane `flex-basis: 100%` and `height: var(--pane-top)`, and a collapsed pane `flex-basis: 100%` and `height: auto`, its header alone with the title running across (mockup question 32). The class follows the workspace's width, not the window's, since the Activity Player sets the iframe's width, and with no inline sizes there is nothing for the stacked rules to override.
- `pane-sizes.test.ts`, values written out: `toolbarHeight(5)` 184, `toolbarHeight(5, 2)` 112; `dividerBand` 18; at the flip, `toolbarColumns(5, graphBodyHeight(222))` 1 and `toolbarColumns(5, graphBodyHeight(221))` 2; `drawnRowHeight(200, false)` 200 and `drawnRowHeight(200, true)` 330, and stacked with a stored 200 px row, `toolbarColumns(5, graphBodyHeight(drawnRowHeight(200, true)))` 1, which fails if `drawnRowHeight` returns the stored height. *(Checked with throwaway code: the cases pass, and each of these fails them: `toolbarColumns` always 1, always 2, or with a strict comparison; `graphBodyHeight` without the header.)*
- `interactive-workspace.test.ts` (Cypress) checks that the Data mode toolbar's measured height is `toolbarHeight(5)`, so `toolbarButton` and `toolbarPadding` agree with `toolbar.scss` and the gap override is applied. The workspace's Cypress tests open the fake Activity Player page at `width: 1044`, the Standard layout, since its default of 435 is below `stackBelow`.
- `GraphPane`: `Toolbar` with `tools={["select", "fitView", "recenter", "zoomIn", "zoomOut"]}`, `disabled={tool.animating}` as the plugin's views pass it, `onFitView` and `onRecenterView` from the core's `view`, `onZoomIn` and `onZoomOut` (step 3), and a module-level `noop` for `onToolSelected`, `onReset` and `onReturnToMainMenu`. `ToolbarProps` requires all three, but `Toolbar` calls `onReset` only for the `reset` tool and `onReturnToMainMenu` only for `home`, which R29 leaves out, and the workspace has no tool state to track. Passing the core's `view.onReset` instead would wire a dialog no button can open. `Graph` takes `autoArrange`, `allowDragging={!tool.animating}`, `zoomButtons={false}`, `zoomRequest`, `onUserZoom`, `fitTransitionMs={250}`, `keepPositions`, `selectedEdge`, `onEdgeSelect`, `onBackgroundClick` and `onDragStop` (for `StateMoved`), and the core's `graphHighlights`. Every callback `GraphPane` hands `Graph` keeps its identity: each is a `useCallback` with no changing dependencies that calls the tool's current function through a ref set at each render, since the tool's functions change with the selection and a new callback reruns `Graph`'s draw effect. Cypress: with `g.root` marked, typing a letter mid-word and then choosing a state leave the same element (fails with an inline callback); double-click opens `NodeModal` with `viewMode="dataset"` and logs `StateDialogOpened` with `{ state }`, since the workspace doesn't render `Dataset`, whose handler logs it in the plugin. With an empty graph it overlays "Type some words in the Input pane to build the chain." (the table view's wording says table), or "No data was provided for this activity." when there is no Input pane (R21).
- Following the graph (R29c): `Workspace` keeps `followRef`, true at the start. `onUserZoom` and the toolbar's Zoom In and Zoom Out set it false; the toolbar's Fit sets it true and fits. Each commit calls `dataChanged(values, { fit: followRef.current || whole })`, where `whole` is `layoutFor` over the states before and after the commit giving `"whole"` (the function `Graph` uses), and a `whole` commit sets it true again. A pane reopening always fits (a hidden graph had no size) and sets it true. Cypress: typing a word refits the graph (the root group's transform changes as the graph grows); after Zoom In, typing new words leaves the transform as it was (fails if commits always fit); after Fit, the next new word changes it again (fails if following never resumes); a wheel zoom stops the following as Zoom In does; after Zoom In, pasting mostly new words refits it, as one commit lays them out whole (typed words commit one at a time, and none is mostly new).
- Shared styles (R30): `app.scss` styles the generator, the output and `NodeModal` only under `.app .split .right` and `.app`, which the workspace doesn't render. Their rules move, unchanged, into mixins in `src/components/markov-panel.scss` (`markov-generator-and-output`, the body of `.right`: its `button`, `label`, `.generate` and `.sequence-output` rules; and `markov-node-modal`, the `.nodeModalBackground` and `.nodeModal` rules). `app.scss` includes them where the rules were, so the plugin's compiled CSS is the same rules in the same order (R41's build comparison checks it), and `workspace.scss` includes them under `.markov-workspace .generator-pane` and `.markov-workspace`.
- `GeneratorPane`: the controls (`Generator`) in a column on the left with its own collapse button (in the column's top corner, beside the first label), at least 160 px wide and as wide as the controls need, and `SequenceOutput` beside them, taking the full width when the controls are collapsed (R12); `workspace.scss` adds `.markov-workspace .sequence-output .sequence:nth-child(even) { background: #f4f8fb; }` and `:nth-child(odd) { background: #fbfaf4; }` under the existing highlighted rule, which keeps priority by coming later with the same specificity plus `.highlighted` (R14).
- Escape in the workspace (a `keydown` listener on the workspace's `ownerDocument`, since a click in the graph's SVG focuses nothing and leaves focus on `body`; the interactive always has a document of its own, the Activity Player's frame, the demo page's `HostedFrame` iframe or the standalone window, so no host page's keys are touched) calls `clearSelection("escape")`, except while `NodeModal` is open, when it closes the dialog (its `onCancel`) and keeps the selection. Cypress: choose a state in the graph, type Escape at `body`, and the selection clears; a Clear highlight button in the workspace's own row, `.controls-row`, shows while `selection` is set, disabled while a sequence is generated, since `clearSelection` does nothing then (R28). When the button goes while it has focus (Enter, Space or Escape on it), focus moves to `.controls-row` (`tabIndex={-1}`), so it isn't dropped to `body` and Tab carries on from the workspace's own row (WCAG 2.4.3). Cypress: focus the button, press Escape on it and then click it, and each time focus is on `.controls-row` (fails without the move). `.controls-row` is `display: flex; flex-wrap: wrap; align-items: center; gap: var(--pane-gap); min-height: var(--controls-row)` (`controlsRowHeight`, 32 px, set as a custom property with the others), so the row keeps its height when Clear highlight is its only control and comes and goes, and wraps its controls onto another line rather than past the workspace's edge (R13); the frame follows the taller workspace through the reported height.
- `runtime.tsx`: in `hosted`, `onSaveInput = text => setInteractiveState({ version: 1, input: { text } })`, and the existing effect still saves `{ version: 1 }` when there is no state. `savedInput` is `readSavedInput(interactiveState)`.
- Pane open and close log `PaneOpened`/`PaneClosed` with `{ pane }`.
- Font (R13b): `index.html` gains `<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">`, the line question-interactives' `shared/index.html` and the Activity Player's `index.html` carry (with their own weights), and `interactive.scss`'s `body` takes `font-family: 'Lato', arial, helvetica, sans-serif` in place of its Helvetica stack. `calculateNodeFontSize` measures labels in a `span` appended to `document.body`, so the graph's labels follow the body's font with no change. With `display=swap` the text shows in Arial until Lato arrives, so the first graph's labels may be measured in Arial and drawn in Lato, a little roomy since Lato is narrower; the next commit measures them again. `interactive-runtime.test.ts` waits for `document.fonts.ready`, then checks, in a retrying `should` since a load can start after `ready` resolves, that `document.fonts` holds a Lato face with `status` `"loaded"` and that the workspace's computed `font-family` starts with Lato; deleting the stylesheet link fails it. `document.fonts.check("14px Lato")` isn't used: for a family no stylesheet declares it can return true. The test needs the network, as CI has.
- `standalone.test.tsx` mocks `../components/graph` (a stub `div`), as MARK-14's `markov-tool.test.tsx` does (`nanoid` is reached only through `drawing.tsx`, which the workspace doesn't import), stubs `globalThis.ResizeObserver` with a class whose methods do nothing (jsdom has none, and the workspace and its rows measure themselves with `use-resize-observer`), and checks the workspace's panes in place of the settings list; the three tests keep their names and what they guard (the library left alone, settings from the link).
- `interactive-runtime.test.ts`: "lists every authored setting" becomes "shows the panes and input view the authored state gives" (Input text only, no Inspect, per its state); "ignores settings in its link" checks the panes; report-mode tests are unchanged; "sizes its frame" checks the frame fits the workspace and that the height messages stop (no more than five in the 3 seconds after load, where the throwaway loop sent 167); "leaves an existing interactive state alone" waits for the workspace's Input pane in place of "coming soon"; "lists the defaults for an interactive never authored" checks, with `{}`, the default workspace (the Input pane in the linked view, the Graph pane and the generator) in place of the placeholder's list, which fails if `workspaceConfig` ignores the defaults. A Cypress check also selects a state and clears it, with the reported height the same throughout (fails without `.controls-row`'s `min-height`).
- `interactive-demo.test.ts`: the round trip compares the standalone window's panes with the hosted runtime's; `runtimeFrameWidth` waits for the workspace in place of `.runtime-placeholder` (its two width tests are otherwise unchanged); "restarts the runtime ..." first types a starting text with both cases (`The cat. the cat`) into the authoring form, since the demo's own text has no capital, then checks the capitalization change through the Graph pane's state labels (one "the", then "The" and "the" once the authored capitalization is case sensitive) in place of the settings list's wording, which fails if the restarted runtime keeps the old capitalization (Inspect arrives in step 10); the standalone round trip waits for the workspace in place of "coming soon".

---

### 9. The Input pane: the table, linking and the highlight layer

**Summary**: R9, R18 to R21, R26, R34's input events.

**Files affected**:
- `src/interactive/workspace/input-pane.tsx`, `text-input.tsx` (new), `input-table.tsx` (new), `commit.ts` (new: the logged commit's view and kind), `workspace.tsx` (commits, presses, row focus), `workspace.scss`.
- `src/interactive/input/tokenizer.ts` and `tokenizer.test.ts`: `textChange` and the characters that commit as they are typed.
- `src/interactive/workspace/workspace-config.ts` and its test: the configuration as a union on the mode (step 7).
- `cypress/e2e/interactive-workspace.test.ts` and `cypress/support/workspace.ts`: the commit, press and table tests, and `pressEvents` and `pressTab`.

**Estimated diff size**: ~450 lines

- `TextInput`: a `div.text-input` holding `div.backdrop` (`aria-hidden`) and the `textarea` (`maxLength={maxInputLength}`, `aria-label="Your text"`), styled as the throwaway that lined up: both `position: absolute; inset: 0`, the same font, padding, border width, `white-space: pre-wrap`, `overflow-wrap: break-word` and `overflow-y: scroll` (the scrollbar must be on both, or the wrap widths differ and the marks drift, as the first throwaway showed); the backdrop's text and border transparent, the textarea's background transparent. The backdrop renders the text as runs split at the highlighted tokens' `start..end`, each highlighted run in a `mark` with the kind's class, and a trailing `"\n"` so a final empty line has height. `onScroll` copies `scrollTop` to the backdrop.
- Commits (R18): `onChange` keeps the text in state and decides from the old and new text: `textChange(old, next)` (in `tokenizer.ts`, tested) strips their common prefix and suffix to get what was inserted and how much was removed. One inserted character that is whitespace, one of `.,?!:;` or `]` commits at once (`how: "separator"`); more than one inserted character (a paste or a drop) commits (`"insert"`); more than one removed with nothing inserted (a cut, or deleting a selection) commits (`"remove"`); one character removed with nothing inserted (Backspace or Delete) (re)starts a one-second timer that commits (`"pause"`); one other character inserted commits nothing and cancels a pending timer, so a word being typed waits for its separator or blur (R18). Cypress: typing "ca" and waiting 1.5 s commits nothing (fails if typing starts the timer); deleting a word's last letter and waiting 1.5 s commits (fails without the timer). `onBlur` commits (`"blur"`), at once unless a press is down on what a commit redraws, the Graph and Inspect panes' bodies: a press moves focus at `pointerdown`, and a commit then would rebuild the graph, or shift the Inspect rows, between `pointerdown` and `pointerup`, so the click never arrives. A press anywhere else commits at once. Play and Step then generate from the committed graph, and in the table, whose rows are keyed by their place and keep their elements through a commit, a row's focus and a delete button's click act on the text as it stands. A table row's blur follows the same rule. `Workspace` notes presses with capturing `mousedown` and `mouseup` listeners on its window (`ownerDocument.defaultView`) (the events that move focus and that `click` follows, for a mouse, a pen and a touch tap alike: a tap's `mousedown` comes after its `pointerup`), and also ends a press on `pointercancel`, `dragend` and `contextmenu`, where no `mouseup` may follow; only the primary button starts one, since a secondary button's menu can swallow its `mouseup` (a touch scroll sends no `mousedown`, so it never starts one). The listeners are added before the graph's own, since d3-drag stops the `mouseup` in the window's capture phase and a listener on the document never hears it. A blur during a press commits from that press's `mouseup` through a `setTimeout(0)`, after the `click` has landed. A blur also clears R18's pending deletion timer, since its commit includes the deletion, so no timer commit lands mid-press (where its animated fit would also join the press's zoom gesture and stop the view following). *(Checked with throwaway code, real mouse events in headless Chrome: a blur that redrew an SVG ellipse at once lost the click on it; deferred this way, the click arrived and then the commit.)* Cypress sends each press as its events dispatched in the frame (`pressEvents` in `cypress/support/workspace.ts`), since DevTools input in the fake page's frame (`Input.dispatchMouseEvent`, `Input.dispatchTouchEvent`, and `cy.press`, which uses DevTools key input) leaves the Cypress run unable to end. Each event goes to the element under the press's point when it fires, focus moves at the `mousedown` to the control pressed (or off the focused element), and the `click` goes to the common ancestor of the `mousedown` and `mouseup` targets, as a browser sends it, so a redraw during the press loses the click as it does for a real one. With a mouse press: type "the cat sat" with no space, press and release on state "cat", and the "cat" node's ellipse has `highlightSelected`'s selected fill, the fake page's log has `StateSelected` with `source: "graph"`, and "sat" is committed (fails if `blur` commits at once). *(Checked with throwaway code: a touch tap's events ran `pointerdown`, `pointerup`, `mousedown`, blur, `mouseup`, so `pointer` tracking lost the tap, and a touch scroll's `pointercancel` left a press down so a later blur never committed; with `mouse` tracking ended also on `pointercancel`, both worked and the mouse cases were unchanged. A timer commit under a held press lost the click, and a fit started during a press sent 16 `zoom` events carrying the press's `sourceEvent`.)* With a touch's events: type "the cat sat", tap state "cat", and it is chosen and "sat" committed (fails with `pointerdown`/`pointerup` tracking); type a word, send a touch scroll's `pointerdown` and `pointercancel` and then a press that becomes a drag (`mousedown`, `pointercancel`, no `mouseup`), leave the text box, and the word is committed (fails if `pointercancel` doesn't end the press: mouse tracking never starts a press on a touch scroll, so the drag is the case it guards); delete a word's last letter, then within the second press on a state, hold past the second and release, and the state is chosen and the deletion committed (fails if the blur leaves the timer running). Also: type "the cat sat" and press Play, and the commit is logged before `SequencePlayed` (fails if every press holds the commit); edit a row and press a state, and the state is chosen and the edit committed (fails if a row's blur commits at once); type a letter and press "Delete row 1", and the letter stays (fails if a press in the table holds the text box's commit). A commit whose values (what `dataChanged` would get) equal the last ones skips `dataChanged` and `InputCommitted`, but still updates `committed` and saves when the text differs from the last saved, so an edit the values don't see ("Cat" to "cat" under `lowercase`, quotes, extra spaces) is kept and the table shows it. Cypress: change "Cat" to "cat" and leave the text box, and the posted `interactiveState` has "cat". *(Checked with throwaway code: Cypress's `type` fires `InputEvent`s with an empty `inputType`, and `data` of `null` for Enter and Backspace, so a rule on `inputType` would pass in browsers and fail every Cypress test.)* The one exception is an input event whose `inputType` is `insertText` with `data`: that is a typed character, taken from `data`, since the diff can't tell a letter typed over a selection that starts with it ("c" over "cat") from deleting the rest of the selection, which would commit a part-word at once. Cypress: select "cat" in "the cat sat" and type "c" (sent as that input event), and after 1.5 s nothing has committed (fails if the diff alone decides).
- `InputTable`: a `table` with one row per token (a break as an empty row), each row a text `input` (`aria-label="Row 3"`) holding the token's `text`, and a delete button (`aria-label="Delete row 3"`); below it an empty row that appends. Enter inserts an empty row below and focuses it; that row is pending, not yet in the text, until it loses focus: with text it calls `insertRow` after the row above and commits (logging `TableRowAdded`), and empty it is dropped with nothing committed. Enter in a pending row with text adds it and opens another below it (Enter that confirms an input method's composition is left to it), and the Tab stop follows an added row into its place; a row of brackets alone adds nothing; Enter in the end row adds its text and leaves it the empty end row, focused. Deleting the last row moves focus to the row now last, so it doesn't fall to the page. An empty pending row left for a press in the table is dropped once the press ends, since dropping it under the press would move the rows below it up a place and the press would land on the row below the one pressed; focus below it then moves up a place with its row. Rows are keyed by their place, so the rows under a press keep their elements when a row above them goes in. The end row that appends is labeled "New row". A row's `onBlur` with a changed value calls `editRow` (or `insertRow` for the appended row) on the text and commits; delete calls `deleteRow` and commits. An edit or new row whose resulting text would pass `maxInputLength` is refused: the row goes back to its committed value and a line under the table, announced with `role="status"`, says the input is at its limit (R32). The line sits below the rows' scroller, so it shows however long the table is, and the region stays in the page while empty; each refusal renders the note as a new element, so a repeat is announced again. `InputTable` is memoized with stable callbacks, so a keystroke in the text box doesn't render its rows. Rows are keyed by index; the table re-derives from the tokens after each commit, so two empty rows in a row become one (R19).
- Tab order (R24): the table is one stop. Roving `tabIndex` puts only the current row's input and delete button in the Tab order; Up and Down move to the row above or below (an `input` that is one line has no use for them), committing the row left first and moving once that commit has rendered, so the row reached is the one in that place afterward and chooses its state from the committed tokens (a pending row dropped empty gives its place to the row below), and Tab goes from the row's input to its delete button and then out of the table. The hint that Up and Down move between rows is the `aria-describedby` of the row input that takes Tab. Cypress: Tab (a move to the next element that takes Tab, made in the frame for the reason above) from the text box reaches the table, and one more Tab after the delete button leaves it, with three rows or thirty; Down moves to the next row and chooses its state.
- Row focus calls `selectState(token.state, "table", true)` for a word (`skipToggle`, so focusing never unchooses), and `clearSelection("table")` for an empty row. Cypress: choose a state, focus an empty table row, and the fake page's log ends with `SelectionCleared` with `via: "table"` (fails if the row passes another `via` or clears through `setSelectedNodeId`, which logs nothing).
- Read-only while generating: `readOnly={tool.animating}` on the textarea and the row inputs, and the buttons disabled.
- Linked mode stacks `TextInput` (`inputSplit` of the Input pane body's height, 0.4 until step 11 makes it state) above `InputTable` (the rest, scrolling); text-only and table-only give the one the whole pane.
- Logs: `InputCommitted` with `{ view, how, tokens, states }` (`how`: `separator`, `insert`, `remove`, `pause`, `blur`, `row`), `TableRowAdded`, `TableRowDeleted`.

---

### 10. The Inspect pane and linked highlighting

**Summary**: R22 to R28, R34's Inspect events.

**Files affected**:
- `src/interactive/workspace/inspect-pane.tsx` (new), `scroll-to-lit.ts` (new: scrolling a pane's own scroller to its first lit row or word), `pane.tsx` (`onInteract`), `input-pane.tsx`, `input-table.tsx`, `workspace.tsx`, `workspace.scss`.
- `cypress/e2e/interactive-workspace.test.ts`: the highlighting tests.

**Estimated diff size**: ~400 lines

- R28: an effect on `tool.graph` clears the selection when its state or transition is no longer in the graph, through `tool.setSelectedNodeId()`, which logs nothing and also clears `selectedEdge` (step 4), not `clearSelection`, which logs; an output selection stays.
- `InspectPane`: a `role="tablist"` with two `role="tab"` buttons (arrow keys move and activate, `aria-selected`, roving `tabIndex`), and a `role="tabpanel"` with a `table`. Headers are buttons in `th`s with `aria-sort`; a first click sorts ascending, a second descending. Each header's button ends in ▲ or ▼ when its column is sorted and ↕ otherwise, `aria-hidden` since `aria-sort` says it. Each body row's first cell holds a button (`aria-pressed` when chosen) that calls `selectState(id, "inspect")` or `selectTransition(edge, "inspect")`; clicking anywhere in the row clicks it. The rows' buttons use roving `tabIndex`, so each table is one Tab stop: Up and Down move focus between rows without choosing, and Enter or Space chooses (R24), with the same `aria-describedby` hint as the input table. Cypress: past the tabs and the two sort buttons, one Tab passes Inspect States whatever its length; Down moves to the second row without choosing it, and a click on its focused button chooses it. Enter and Space choose by the browser's own button activation, which needs trusted key input, and DevTools key input in the fake page's frame leaves the run unable to end (step 9). Tab and sort are `useState` in the pane, which stays mounted while collapsed. Logs `InspectTabChosen` and `InspectSorted`. With no input either tab says there are no states yet; with states and no transitions, the Transitions tab says there are no transitions yet. A lit row scrolled up into view stops below the table's sticky header. The pane is memoized, with its sorted rows in a `useMemo`, for the reason the input table is (step 9).
- `Workspace` computes `highlightsFor(tool.selection, committed.tokens)` for the table and Inspect, and over the live tokens for the text box (step 8), once per render, and passes them to the panes; each lit row or `mark` gets `highlight-selected` or `highlight-output` (and the Transitions rows `in`, `out`, `chosen`), styled with the graph's colors: `#14f49e3f` for chosen, `#FF00877f` for output, the incoming and outgoing arrow colors as a left border on Transitions rows.
- Scrolling (R25): after a selection changes, each pane except the source scrolls its first lit element into view by as little as it takes, setting only the pane's own scroller's `scrollTop` (`scroll-to-lit.ts`), since `scrollIntoView` also scrolls the page around the frame; the text box sets its `scrollTop` from the first `mark`'s `offsetTop`. The source is the pane the student last pressed, focused or typed in (`Pane`'s `onInteract`, kept in a ref), which covers every way of choosing, an output's included, with no wrapper around each `select*` call.
- `onBackgroundClick` and the Clear button call `clearSelection` with their `via`.

**Cypress (`interactive-workspace.test.ts`)**, on the fake Activity Player page, each named for what it guards:
- typing "the cat" adds no row until the space after "cat", and one second later without the space;
- linked: typing makes rows; editing a row to "No!" writes `[No!]` into the text; adding and deleting rows; an emptied row is a blank line;
- table only and text only show only theirs, and a starting text fills the table with a blank line as an empty row;
- choosing a state in each source lights the graph node, its States row, its Transitions rows, its rows and its marks; a transition from the graph's arrow and from Inspect; an output in pink;
- each way of unclicking; a table row stays chosen when clicked again;
- a collapsed and reopened Inspect keeps its tab and sort; a collapsed Graph reopens fitted;
- the saved input: a commit posts `interactiveState` with `input.text`, and reopening with it shows it;
- the log messages for a play, a selection and a commit (`log` messages the fake page records);
- the height messages stop (step 8).

---

### 11. Resizable panes

**Summary**: R13a (the linked Input pane's split included), R11's row with the Graph pane collapsed, R34's `PaneResized`, R39's and R40's divider tests, R40's two-column toolbar test. Dividers between open neighbors, sizes in workspace state, and a pure module for the limits.

**Files affected**:
- `src/interactive/workspace/pane-sizes.ts` and `pane-sizes.test.ts`, from step 8.
- `src/interactive/workspace/divider.tsx` (new), `use-measured-size.ts` (new).
- `src/interactive/workspace/workspace.tsx`, `pane.tsx`, `graph-pane.tsx`, `input-pane.tsx`, `workspace.scss`.
- `cypress/e2e/interactive-workspace.test.ts` and `cypress/support/workspace.ts`: the divider and two-column toolbar tests, and `dragDivider`.

**Estimated diff size**: ~300 lines

```ts
// src/interactive/workspace/pane-sizes.ts, added to step 8's
// the dividers between panes
export type PaneDivider = "input" | "inspect" | "rows";
export interface OpenPanes { input: boolean, graph: boolean, inspect: boolean }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

// the size a divider sets, as the pane before it has it (Graph's width for the Graph/Inspect divider), with the
// limits where either pane beside it reaches its minimum; room is the width the open row panes share
export const dividerLimits = (sizes: PaneSizes, divider: PaneDivider, room: number, open: OpenPanes) => {
  const input = open.input ? sizes.input : 0;
  const inspect = open.inspect ? sizes.inspect : 0;
  switch (divider) {
    case "input":
      return { value: sizes.input, min: minPaneSizes.input, max: room - inspect - minPaneSizes.graph };
    case "inspect":
      return { value: room - input - inspect, min: minPaneSizes.graph, max: room - input - minPaneSizes.inspect };
    case "rows":
      return { value: sizes.top, min: minPaneSizes.top, max: workspaceHeight - minPaneSizes.generator };
  }
};

// a divider moved by delta px (right or down), stopped where either pane beside it reaches its minimum
export const dragDivider = (sizes: PaneSizes, divider: PaneDivider, delta: number, room: number,
  open: OpenPanes): PaneSizes => {
  const { value, min, max } = dividerLimits(sizes, divider, room, open);
  const moved = clamp(value + delta, min, max);
  switch (divider) {
    case "input":
      return { ...sizes, input: moved };
    case "inspect":
      return { ...sizes, inspect: room - (open.input ? sizes.input : 0) - moved };
    case "rows":
      return { ...sizes, top: moved };
  }
};

// the sizes to store for a divider moved by delta px from stored sizes: a column divider moves from the sizes as
// drawn, so in a row too narrow for the stored sizes it follows the pointer; the row divider keeps the stored widths
export const resizedPanes = (stored: PaneSizes, divider: PaneDivider, delta: number, room: number,
  open: OpenPanes): PaneSizes =>
  dragDivider(divider === "rows" ? stored : fitPaneSizes(stored, room, open), divider, delta, room, open);

// the linked Input pane's split: the text box's share of a body bodyHeight px tall, moved by delta px (down),
// stopped where the text box or the table reaches its minimum
export const defaultInputSplit = 0.4;
export const minInputPart = 60;
// each part's minimum, or half the body where it is too short for both
export const inputPartMin = (bodyHeight: number) => Math.min(minInputPart, bodyHeight / 2);
// the split as drawn, within both parts' minimums; an unmeasured body draws it as stored
export const drawnInputSplit = (split: number, bodyHeight: number) => bodyHeight > 0
  ? clamp(split, inputPartMin(bodyHeight) / bodyHeight, 1 - inputPartMin(bodyHeight) / bodyHeight)
  : split;
export const dragInputSplit = (split: number, delta: number, bodyHeight: number) =>
  drawnInputSplit((drawnInputSplit(split, bodyHeight) * bodyHeight + delta) / bodyHeight, bodyHeight);

// in a row narrower than the sizes need, Input and Inspect give up width toward their minimums, so an open
// graph keeps its own; sizes that fit come back unchanged, the same object
export const fitPaneSizes = (sizes: PaneSizes, room: number, open: OpenPanes): PaneSizes => { /* ... */ };
```

- `fitPaneSizes` holds back `minPaneSizes.graph` only when the Graph pane is open (a collapsed one is a strip already counted out of `room`), shares the overflow between Input and Inspect in proportion to the width each has above its minimum, and stops at both minimums. A column divider is drawn only beside an open graph, so `dragDivider` always holds back the graph's minimum. *(The two functions were built as throwaway code with a Jest test of each limit; it passed and linted.)*
- `Workspace` keeps `const [paneSizes, setPaneSizes] = useState(defaultPaneSizes)` beside which panes are open, and measures the row with `useMeasuredSize`. `room` is the row's width less a `paneGap` between each two panes present and a `collapsedStrip` for each collapsed one. When not `stacked`, it renders from `fitPaneSizes(paneSizes, room, open)` in place of step 8's defaults, so the stored sizes stay what the student chose: the same inline styles, Input and Inspect `flex: 0 0 <width>px`, the row `height: <top>px`, the generator `height: <workspaceHeight - top>px`. When `stacked`, it renders as step 8 does, with no inline widths or row height. Every height comes from the drawn row height, `drawnRowHeight(top, stacked)`, so stacked panes and the generator keep step 8's heights whatever row height is stored: the generator's `workspaceHeight - top`, and `GraphPane`'s `top`, for `graphBodyHeight`. A collapsed pane keeps its stored size, so it reopens at that size.
- The linked Input pane's split (R13a): `Workspace` keeps `const [inputSplit, setInputSplit] = useState(defaultInputSplit)` beside `paneSizes`, a fraction so it holds as the pane's height changes, and passes it to `InputPane` with an `inputSplit` divider between the text box and the table, which `InputPane` measures its body for and moves with `dragInputSplit`. The text box and the table sit `var(--pane-gap)` apart, each keeping `var(--pane-padding)` clear on that edge, which the divider's band covers. The split is the text box's share of the height the text box and the table share, the body less the gap and both paddings, so each keeps `minInputPart` itself. The stored split is drawn within the parts' minimums (`drawnInputSplit`), as the pane widths are fitted, and in a body under 120 px each part's minimum is half of it (`inputPartMin`), so the divider's limits never cross; a move that leaves the drawn split within half a pixel (`minDividerMove`) of where it was restores the stored split and logs nothing (`movesInputSplit`, decided at each move against the body as it was then), as `movesDivider` does for the pane dividers. Step 12's switch, above the linked view, leaves 119 px at the row's 200 px minimum, and 99 px when the Input pane's 160 px makes its name wrap. The divider takes Tab between the text box and the table. `dragDivider` never sees this divider; it fits nothing, so its `pointerup` only logs. MARK-17 saves it beside the pane sizes.
- `Divider` is a `div role="separator"` with `aria-orientation`, `aria-label` ("Resize Input and Graph", "Resize Graph and Inspect", "Resize the panes and the generator", "Resize the text box and the table"), `aria-valuenow`, `aria-valuemin` and `aria-valuemax` (the size of the pane before it, from the same limits), and `tabIndex={0}`. Pointer events cover mouse, pen and touch: `pointerdown` captures the pointer and records the start and the stored sizes; each `pointermove` stores `resizedPanes(stored, divider, delta, room, open)` for the total delta. In a row with room for the stored sizes it changes only the dragged pane's size (`input`, `inspect` or `top`), so the other pane keeps the width the student chose (R13a); in a row too narrow for them a column divider moves from the sizes as drawn, `fitPaneSizes(stored, room, open)`, and stores them, since moving one stored size beside an unfitted neighbor could fit the dragged pane narrower while the pointer moves right. The row divider sets only the row height, so it moves from the stored sizes and keeps the widths the student chose. `dividerLimits` gives each divider's value and limits, for both the clamp and the `aria-value*` props, and the arrow keys go through the same path. When the graph measures its new size after a resize while the view follows it, it is fitted again; a zoom since then keeps the student's view. `pointerup`, when the sizes changed, logs `PaneResized` with `{ divider, sizes }` and, while following the graph (R29c), fits it (`onFitView`), for the row divider too, since it changes the graph's height, and fits it again when the graph next measures its size (`GraphPane`'s `onResized`), since it measures the new size only after the drag ends; a student's own view is kept. That second fit is armed only when the graph has not yet measured the resize's last move: `Workspace` counts the graph's layouts (a layout effect on its width and the row height) and records the count at each of the graph's measurements, so a measurement that came before the resize ended leaves no fit waiting for a later, unrelated change of the graph's size. The arrow keys move a divider by plus or minus 10 through `resizedPanes`, storing the same way, and when the divider loses focus after a key moved it, `PaneResized` is logged once and the graph fitted while following. A drag or key move that leaves the divider where it was drawn, to within half a pixel (`movesDivider`, since fitted widths reached by different sums can differ in their last digits), such as one already at a limit in a row too narrow for the stored sizes, restores the stored sizes it started from and logs nothing (each move decides this against the row as it was at that move, so a row that changes width before the divider loses focus can't turn a move that went nowhere into one), so the student's widths still come back when there is room. `touch-action: none` keeps a touch drag from scrolling the page.
- With the Graph pane collapsed or not present, Input and Inspect grow from their fitted widths in proportion (R11, step 8's rule), and no divider joins them; a collapsed graph's stored sizes are untouched, so reopening it gives back the widths the student chose. With no pane in the row, there is no row and no `rows` divider, and the generator keeps its height.
- A `Divider` is rendered only where R13a allows one: `input` when Input and Graph are both open, `inspect` when Graph and Inspect are both open, `rows` when the generator is open and at least one pane in the row is present and open, none of those three when `stacked`, and `inputSplit` in the linked view whenever the Input pane is open, stacked or not. `Workspace` decides which, and passes each to the pane (or the row) before it, which renders it, so the divider is positioned against that element. A divider takes no space in the layout: it is absolutely positioned on the edge of the pane (or the row) before it, which is `position: relative`, centered on the gap, `dividerBand` across, above the panes (`z-index`), and shows a 4 px by 40 px grip in the gap. The band is the gap plus `panePadding` on each side, the 5 px every pane's contents already keep, so it covers that padding and never a control (the Graph toolbar's edge, the text box's scrollbar, the tables' last rows) and the panes take no extra padding beside a divider, which would leave gaps beside their headers. The panes' headers keep `var(--pane-padding)` on the right, so the band ends short of the collapse button. The row's divider covers only the gap and the padding along the bottom of the row's panes, from inside the panes' bottom padding to the generator's top, with its grip on the gap's center, so the generator's header, its toggle included, is outside it and looks like every other pane's. A vertical divider is positioned from inside its pane's border, so its offset includes the border's width (`paneBorder`, which the stylesheet reads as `--pane-border` for both). The row and the linked split are measured with `useMeasuredSize` (`use-measured-size.ts`), the observer's report or, until it comes, the element's size at its first layout, so a divider moved before the first report has the room it lays out with. A resize's `PaneResized` carries the sizes its last move computed, since a quick drag can end before React renders that move.
- `GeneratorPane` takes its height from the workspace; `SequenceOutput` scrolls within it, and so does the controls column (`overflow-y: auto`) when it is taller than the pane's body. Measured with throwaway code in the plugin's generator at the column's 160 px width, in the plugin's Helvetica (the Cypress check runs in Lato): 173 px with the default delimiter (fields 134, Play and Step 32), 199 px with "other". A 220 px generator leaves 192 px below its header and borders, 182 inside the 5 px of padding every pane's contents have above and below.
- In Lato, at the body's 1.43 line height, the default controls measured 189 px. The workspace sets the controls column's `line-height` to 1.2 and its `.generate` gaps to 5 px (4 px inside `.flex-col`), under `.markov-workspace`, so the default controls are 172 px. The generator's contents have the same 5 px padding and white background as the other panes', and its minimum is 220 px, so the default controls fit with 10 px to spare. The plugin's generator is unchanged.
- Cypress (R13a): with the row divider dragged far down, so the generator is at its minimum, the controls column's `scrollHeight` is no more than its `clientHeight` with the default delimiter (fails at 200 px, where it has 166), and choosing "other" makes it scroll rather than clip (its `overflow-y` is `auto`).
- `pane-sizes.test.ts` gains, values written out: `dragInputSplit(0.4, 30, 300)` 0.5; from 0.4 in a 300 px body dragged 200 up, 0.2 (60 px), and 200 down, 0.8 (the table's 60 px), so deleting either bound fails; each divider moved; each stopped at both neighbors' minimums (`input` at 160 and at the room less Inspect and 200; `inspect` at 220 and likewise; `rows` at 200, and from a row of 250 dragged 200 down at 330, `workspaceHeight` less 220, so a bound of the starting height fails); a collapsed Inspect not counted against Input's maximum; `fitPaneSizes` returning the same object when the sizes fit, shrinking in proportion when they don't, stopping at both minimums, and with the graph collapsed leaving the defaults (280 and 260) unchanged in a room of 600, which holding back the graph's 200 would shrink. Deleting either `clamp` bound fails a test. `inputPartMin` 60 for a 300 px body and 50 for 100; in a 100 px body a drag either way stops at 0.5; `drawnInputSplit(0.4, 144)` is 60/144, and 0.4 as stored in a 300 px body or an unmeasured one. `movesInputSplit`: 0.4 to 0.5 is unmoved in a 119 px body and a move in a 300 px one, and 0.6 px is a move where 0.4 px is not. `movesDivider`: a drag right of Input at its limit in a 580.1 px room is unmoved (a strict comparison fails it), and 0.5 px is a move where 0.4 is not. The graph's and the row's minimums are both 200, so no test here can tell a swap between those two; likewise the rows bound, 330, is also `defaultPaneSizes.top`, so a bound written as the default row height passes.
- The headers' collapse buttons draw their − and + as a centered SVG, and the chosen Inspect tab opens into its panel with no line under it. Cypress checks both, the column dividers centered on their gaps, the row divider stopping at the generator, and the generator's padding and background matching the other panes'.
- Cypress drags a divider with pointer events dispatched in the frame (`dragDivider` in `cypress/support/workspace.ts`, step 9's reason), with the mouse's pointer id; it releases the capture its `pointerdown` took, as a real `pointerup` does, or Cypress's own mouse would keep dragging the divider. A drag that moves while the view follows the graph refits it, and one after a zoom keeps the student's view.
- Cypress: dragging the Input/Graph divider 60 px right widens Input by 60 px and narrows Graph by 60 px, the row's width unchanged; dragging it far left stops Input at 160 px; dragging the Graph/Inspect divider far right stops Inspect at 220 px; dragging the row divider far up stops the row at 200 px; the arrow keys move a divider 10 px; in the linked view the text box starts at 40% of the Input pane's body, dragging the split divider 50 px down makes it 50 px taller and the table 50 px shorter, and dragging it far up stops the text box at 60 px (the text box and the table measured, not their parts' padding); dragging the row divider up 100 px shortens the panes and lengthens the generator with the reported height unchanged; with Inspect collapsed, the Input/Graph divider is present and the Graph/Inspect divider is not; a drag logs one `PaneResized`; with the Graph pane collapsed, and again with it turned off, Inspect reaches the row's right edge and Input's measured width is 280/540 of the two panes' together, within 2 px (fixed widths fail the first, and `flex: 1` on the last pane the second); the toolbar's Zoom In and Zoom Out change the graph's scale and there are no corner zoom buttons; with Input, Graph and Inspect turned off, the generator is the first thing in the workspace; with the row divider dragged far up to the 200 px row: exactly five toolbar buttons, at two distinct left edges, every one inside the Graph pane's body; the page opened at `width: 690` stacks the panes, with no dividers and no inline widths, and a collapsed pane there is its header alone; with the row dragged to 200 px and the page then narrowed to 690, the stacked generator is 220 px tall; at 730 px, ArrowRight on the Input/Graph divider (already at its limit) and a blur log nothing, and widening the page to 1044 brings Input back to 280 px; each column divider's band starts right of the collapse button in the pane before it; with the graph narrowed until its width limits the fit, an arrow key on the Input/Graph divider, a blur, and then widening the page to 1150 px leaves the graph's transform unchanged, and dragging a divider fits the graph to its new size.

---

### 12. Case sensitivity: the authoring setting, the switch and the label

**Summary**: R16, R16a, R34's `CaseSensitivityChanged`, R39's and R40's case tests, R40's row-wrapping test (R13). A setting on MARK-13's authored state, a switch or a read-only label in Data mode, and the input re-read when it changes.

**Files affected**:
- `src/interactive/authored-state.ts` and `authored-state.test.ts`: `showCaseSwitch` and the labels.
- `src/interactive/authoring.tsx`, `src/interactive/settings-summary.ts` and `settings-summary.test.ts`: the form's checkbox and the relabeled choice (the test's existing "Capital letters" rows change to the new label and wording too).
- `src/interactive/url-settings.test.ts`: its list of URL settings gains `showCaseSwitch` (boolean).
- `src/interactive/workspace/setting-switch.tsx` (new): `SettingSwitch` and `SettingLabel`.
- `src/interactive/workspace/workspace.tsx`, `input-pane.tsx`, `workspace.scss`.
- `src/interactive/workspace/workspace-config.ts` and its test: `caseSwitch: boolean` (Data mode only) joins `WorkspaceConfig`, set to `data && state.showCaseSwitch`.
- `src/components/log-events.ts` and `LOGGED-EVENTS.md`: `CaseSensitivityChanged`, in the list and in the Input table together, so `log-events.test.ts` passes at every step.
- `cypress/e2e/interactive-workspace.test.ts`, `cypress/e2e/interactive-authoring.test.ts`.

**Estimated diff size**: ~200 lines

```ts
// src/interactive/authored-state.ts
export interface MarkovAuthoredState {
  // ... as MARK-13 has it, with:
  capitalization: Capitalization;   // the "Case sensitive" switch's starting value
  showCaseSwitch: boolean;
}
// defaultAuthoredState: capitalization "lowercase" as MARK-13 has it, showCaseSwitch true
// readAuthoredState: showCaseSwitch: readBoolean(saved.showCaseSwitch, defaultAuthoredState.showCaseSwitch)
export const capitalizationLabels: Record<Capitalization, string> = {
  asTyped: "Yes: \"The\" and \"the\" are different words", lowercase: "No: \"The\" and \"the\" are the same word"
};
// settingLabels: capitalization "Case sensitive at the start", showCaseSwitch "Show students the \"Case sensitive\" switch"
```

- One setting, not two: the existing `capitalization` is the starting value, so nothing holds the same choice twice. `authoredStateVersion` stays 1, as the file's header comment says for a setting added later: `showCaseSwitch` reads its default from activities saved before it, and a saved `capitalization` keeps its meaning. The default stays `lowercase`, so MARK-13's tests of the defaults are unchanged.
- `capitalizations` keeps MARK-13's order, so the form offers No (the default) before Yes. The form puts the checkbox under the case choice in Data settings, as it puts "Show students the \"Order matters\" switch" under ordering; the settings summary lists both through `settingLabels`.
- `SettingSwitch({ label, value, onChange, disabled })` renders a `button` with `role="switch"` and `aria-checked`, its label, and "Yes" or "No" beside it (follow-up C); `SettingLabel({ label, value })` renders the text "Case sensitive: No". `SettingSwitch` is an inline flex row with `max-width: 100%`: the name `flex: 0 1 auto; min-width: 0; white-space: normal`, so it wraps, and the track and the Yes or No `flex: none`, so they keep their size. MARK-16's "Order matters" switch and read-only label use the same two components, so the two controls read alike; MARK-15 owns them.
- `Workspace` keeps `const [capitalization, setCapitalization] = useState(config.capitalization)` and tokenizes with it in place of `config.capitalization`; step 8's first values still come from `config.capitalization`, the same value at mount. Changing the switch sets it and hands the core the text's tokens under the new rule through the same commit path as the text box (`dataChanged`, R18), whose values now differ from the last, so the commit isn't skipped; that leaves the selection rule, Inspect and the outputs to behave as after any commit (R16a). It logs only `CaseSensitivityChanged` with `{ caseSensitive, states }`, not `InputCommitted`, since the input didn't change. It saves nothing new (R31): MARK-17 saves the value beside Data mode's "Order matters" value.
- `yesNo` and the switch's name, `caseSensitiveLabel`, live in `authored-state.ts` beside the other labels, so the settings summary, the authoring checkbox's label and the student's switch and label share them.
- Placement: with `config.caseSwitch`, `InputPane` renders `SettingSwitch` at the top of its body (hidden with the collapsed pane), or with no Input pane the workspace's own row does; without it, the workspace's own row renders `SettingLabel`. Draw mode renders neither. `disabled` while a sequence is generating (R21).
- Jest: `authored-state.test.ts`: the default state is `lowercase` with the switch shown; `{}` reads `showCaseSwitch` true; a saved `false` reads false; a non-boolean reads the default; a saved `lowercase` reads back unchanged; the version is still 1. `settings-summary.test.ts` gains the switch's row and relabels the capitalization rows. `workspace-config.test.ts`: `caseSwitch` true in Data mode with the setting on, false with it off, false in Draw mode.
- Cypress: with the linked view and the text "The cat. the cat", Inspect States lists one "the" with count 2 (not case sensitive, the default); switching to Yes lists "The" and "the", the text box and the table unchanged, and logs `CaseSensitivityChanged`; the switch is disabled while a sequence plays; with `showCaseSwitch` false, the row reads "Case sensitive: No" and there is no switch. With the Input pane collapsed the switch isn't visible; with no Input pane it is in the workspace's own row. An author's `asTyped` starts the switch at Yes with "The" and "the" two states, and switching to No makes them one and logs `caseSensitive: false`; the hidden switch's label reads Yes for `asTyped`. At the 200 px row, a key on the split divider (which can't move) and a blur log nothing, and the row dragged back to 330 px draws the text box at 40% again. With the row and the Input pane at their minimums, the text box and the table each get half the room the switch leaves, and the split divider's `aria-valuemin` is no more than its `aria-valuemax`. Draw mode's absence of both is `workspace-config.test.ts`'s (`caseSwitch` false), since this story's Draw mode renders only a message. The authoring test checks the new checkbox and the relabeled choice save and read back.
- Cypress, the narrow cases (R13, R16a): the Input/Graph divider dragged far left, so the Input pane is at 160 px, leaves the Case sensitive switch's right edge inside the Input pane's body, and its name's `scrollWidth` no more than its `clientWidth` (with `white-space: nowrap` the name's box shrinks but its text overflows, which only the second check catches; the switch is about 151 px against about 140 inside the pane); the page opened at `width: 700`, not stacked, with the Input pane turned off and a state chosen, has `.controls-row`'s computed `flex-wrap` as `wrap`. No check of the controls' edges is made: flex items shrink to fit rather than overflow, so such a check passes with `nowrap` too. MARK-16's Cypress case, its switch group dropping below the mode switch at 700 px, is the behavioral check for the wrap.

---

### 13. Authoring refuses a setup with nothing to work with

**Summary**: R21a, R39's and R40's authoring checks.

**Files affected**:
- `src/interactive/authored-state.ts` and `authored-state.test.ts`: `authoringProblems`.
- `src/interactive/authoring.tsx`, `authoring.scss`: the error and the withheld send.
- `cypress/e2e/interactive-authoring.test.ts`.

**Estimated diff size**: ~80 lines

```ts
// src/interactive/authored-state.ts
// why a setup leaves students nothing to work with, one message per problem; none when it can be saved
export const authoringProblems = (state: MarkovAuthoredState): string[] => {
  const problems: string[] = [];
  if (!paneIds.some(id => state.panes[id].available)) {
    problems.push("Turn on at least one pane, or students will see nothing.");
  }
  if (state.modes.useData && !state.panes.input.available && !state.startingText.trim()) {
    problems.push("With the Input pane off, add starting data, or students will have no words to work with.");
  }
  return problems;
};
```

- `authoring.tsx`'s `update` computes the next state as today, keeps it in the form's state, and calls `setAuthoredState(next)` only when `authoringProblems(next)` is empty. While there are problems, a `div role="alert"` at the top of the form lists them, followed by "Your changes aren't saved until this is fixed." The Activity Player keeps the last setup the form sent, which is the last valid one. A state that arrives invalid (saved before this check) shows the error on load and sends nothing until fixed.
- MARK-13's authoring Cypress tests start from `{}`, whose defaults pass, and none turns the Input pane off with no text, so they are unchanged apart from step 12's.
- Jest (`authored-state.test.ts`): the default state has no problems; Data only with the Input pane off and empty text has the Input problem, and with `"   "` too; with starting text it has none; Draw only with the Input pane off and no text has none; every pane off has the pane problem; both at once give two messages. Deleting either clause, or the `trim`, fails a case.
- Cypress: with Data only, unchecking the Input pane shows the alert and sends no new `authoredState`; typing starting text then clears the alert and sends a state with the Input pane off and that text; with Data only, unchecking all four panes shows the pane message and the last state sent still has a pane on.

## Verification

Run on the head commit, Node 24, all headless:

- The build, all three lints and both `tsc` checks clean (R42).
- Jest: all existing tests pass unchanged except MARK-13's `standalone.test.tsx` (R40), plus the new pure-module tests (`pane-sizes.test.ts` among them), `graph-utils.test.ts`'s `isPlaced` block, `log-events.test.ts`, `use-markov-tool.test.tsx` and `generator.test.tsx`. Cypress: every existing spec passes, MARK-13's runtime and demo specs as updated in step 8, plus `interactive-workspace.test.ts`, in Chrome and Electron.
- R29b: the throwaway timing test from the requirements' Technical Notes (a 20,000-character text through the workspace, a word added) records the redraw time; the result goes in the PR.
- R41: the plugin's production build compared with MARK-14's head shows changes only in the files steps 1 to 5 touch, and its CSS none from step 8's move into `markov-panel.scss`; MARK-12's R11 list checked headless in CODAP 3.1.2 against the branch build, recorded in the PR.
- Mutation checks for each new test: delete the line it guards and confirm it fails. The two-column toolbar's are recorded: `pane-sizes.test.ts`'s flip cases (step 8), and step 11's Cypress check, which fails with the `two-columns` grid rule removed, with `display: contents` removed, or with the class not set, and fails its inside-the-body check in a row too short for two columns. *(Checked with throwaway code: the real `toolbar.scss` compiled with step 8's workspace rules and `Toolbar`'s markup, seven top buttons and one bottom, in a 200 px row, under Cypress headless. Data mode's five buttons sit under the same rules: without the grid they are one column, one left edge, 184 px tall in a 166 px body.)*

## Open Questions

None. The requirements' three are resolved (the hook is MARK-14's; `InputCommitted` logs counts only; students resize the panes with dividers, R13a), and stage 8's three gaps are applied: the table's edits respect the input's limit (step 9), the linked split is mockup question 12, and the shared parser is named in R32.

## Self-Review

Checked against this branch's code, MARK-14's included, and with the throwaway code noted in each step.

### Commit Reviewer

#### RESOLVED: Step 8's text box had no commit rule of its own
Step 8 builds the Input pane as a plain text box and step 9 adds the separator rule, so step 8 as written had nothing that called `dataChanged` after the first input. It now commits on leaving the text box and after a pause, and step 9 adds the rest.

### Senior Engineer

#### RESOLVED: `keepPositions` re-laid out the whole graph when no state was new
A commit that only changes counts (typing a word already in the text) builds new `D3Node`s, all placed but none pinned, and the first draft's "some but not all placed" fell through to a full layout: about 0.7 s, and every state moves. The placed states are now always pinned first, so such a commit runs no ticks.

#### RESOLVED: Loops can't be clicked outside the delete tool
`drawGraph` gives loops and loop backgrounds `pointer-events: none` unless the delete tool is on, and their click calls `onNodeClick(id, true)`. Step 3 now turns them on, and routes them to `onEdgeSelect`, only when that prop is set.

#### RESOLVED: Clearing a dropped selection in the core would change the plugin
In the plugin today, a dataset edit that removes the selected state leaves `selectedNodeId` set, so `highlightSelected` fades every state. Clearing it in the core would change that, against R41; the workspace clears its own (step 10).

#### RESOLVED: The core's internal clears would have logged
`toggleHighlightOutput` calls `setSelectedNodeId()` to clear the state, and Reset clears the selection. Logging in the setters would have logged a `SelectionCleared` the student never asked for. Only the public `select*` and `clearSelection` functions log.

#### RESOLVED: The drawing and dataset views can't reach the host
`Drawing` and `Dataset` take their callbacks as props and never see the host, so their log calls need a `log` prop from `MarkovTool`. Step 5 now lists both files.

### Test Writer

#### RESOLVED: The fake Activity Player page drops log messages
`fake-ap.ts` records only the message types in `messageTypes`, which has no `"log"`, so the Cypress log test could never see one. Step 8 adds it.

#### RESOLVED: The standalone test needs only `Graph` stubbed
`nanoid` is imported only by `drawing.tsx`, which the workspace's import chain doesn't reach (`grep` over `src`), and `d3` only by `graph.tsx` (and step 2's `graph-draw.ts`, which `graph.tsx` imports). Stubbing `Graph` is enough; `graph-highlight.ts` and `graph-geometry.ts` use `import type` for d3's types, so they load in Jest.

#### RESOLVED: Commit detection by `inputType` would fail under Cypress
Checked with throwaway code: Cypress's `type` fires `InputEvent`s with an empty `inputType`, and `data` of `null` for Enter and Backspace. Step 9 now decides from a diff of the old and new text, which behaves the same in browsers and in Cypress, and R18 says "inserts several characters at once" in place of naming paste and cut events.

#### RESOLVED: Table edits wrote inside a bracketed token
Built as throwaway code and property-tested: with a bracketed token's span measured inside its brackets, inserting a row after `[No!]` produced `[No! cat]`, one state, and an insert after a blank line ran into the next word (`xcat`), together 227 failures in 4,899 random edits. Token spans now include the brackets and an insert after a break adds its own space; the same test then passed 4,911 of 4,911.

### Technical Editor

#### RESOLVED: Nothing said how a removed break row behaves
`deleteRow` on an empty row had no rule. It now joins the chain by replacing the blank line with a space.

### Alignment with MARK-14's hook

#### RESOLVED: Step 4 assumed the hook's shape before MARK-14 specced it
Checked against MARK-14's R1a and its step "Move the core's state into `useMarkovTool`": the hook is `src/hooks/use-markov-tool.tsx` (JSX in its dialogs), its result type is `MarkovToolApi`, it already has a top-level `setSelectedNodeId` and a `view` with the drawing view's and mode menu's handlers, and MARK-14 adds no hook test file. Step 4 now adds only transition selection on top (`selectedEdge`, `selection`, `selectState` wrapping `setSelectedNodeId`, `selectTransition`, `clearSelection`) and leaves `markov-tool.tsx` alone; step 5's logging test is a new file in MARK-15, and `onDelimiterCommit` joins MARK-14's exported `GeneratorProps`. MARK-14's recording test host has no `log`, so step 5 adds `log: jest.fn()` to it, the one setup line R41 allows. MARK-14's final `MarkovHost` is `{ viewMode?, setViewMode, markDirty, outputSequence }`, with `loadState` and `dragging` as `MarkovTool`'s layout props, so the AP host implements those four plus R4's `log`, and nothing for the layout it doesn't render. MARK-14's `MarkovToolApi.handle` is one object for the hook's lifetime, with `getGraph` reading the latest graph through a ref, so step 8's mount effect lists `tool.handle` in its dependencies and runs once; nothing in this spec relies on a handle rebuilt each render.

### Third round (Senior Engineer, Student, Accessibility, Education Researcher)

Each checked against the code, most with throwaway code.

#### RESOLVED: The graph was rebuilt at every workspace render
Inline callbacks and the selection in `Graph`'s draw effect rebuilt the SVG at each keystroke and selection (1,355 ms at about 700 states, 377 ms with the tick skip). `GraphPane`'s callbacks keep their identity, and `Graph` reads the selection through refs and restyles (steps 3 and 8).

#### RESOLVED: One `tokens` served the live text box and the committed panes
A word being typed would show in the table, or the text box's marks would drift. `Workspace` keeps a `committed` `{ text, tokens }` beside the live text (steps 8 and 10).

#### RESOLVED: Skipping unchanged-value commits lost text-only edits
Such a commit now skips only `dataChanged` and the log, and still updates `committed` and saves (step 9).

#### RESOLVED: `hidden` lost to the panes' `display: flex`
One `[hidden]` rule under `.markov-workspace`, with a Cypress check (step 8).

#### RESOLVED: A background click that moved a pixel was a pan
`clickDistance(4)` when `onBackgroundClick` is set, and `onUserZoom` only for a wheel or a pan past 4 px (step 3).

#### RESOLVED: Escape after a click in the graph never reached the listener
The listener is on the `ownerDocument`, and closes `NodeModal` while it's open (step 8).

#### RESOLVED: A large input put thousands of stops in the Tab order
About 7,900 in the input table and 714 in Inspect at the 20,000-character limit. Each table is one stop, with Up and Down moving between rows (steps 9 and 10, R24).

#### RESOLVED: Selections were logged when nothing changed
`selectState` and `selectTransition` log only a change (step 5).

### Fourth round (Senior Engineer, Student, Commit Reviewer, Education Researcher, Technical Editor)

#### RESOLVED: Reading the selection through refs left the plugin's Drawing view faded through Play and Step
`animating` stays in the draw effect's dependencies, so a sequence's start and end rebuild the SVG as today, with a plugin Cypress case (step 3).

#### RESOLVED: A commit on leaving the text box lost the click that caused it
A blur during a press on the Graph or Inspect pane commits after the press ends; elsewhere it commits at once (step 9).

#### RESOLVED: A touch pan or pinch never stopped the view following the graph
`onUserZoom` decides from the transform's change since the gesture's start, not the pointer (step 3).

#### RESOLVED: Steps 7 and 8 used what steps 10 and 12 add
`caseSwitch` moves into step 12, and `fake-ap.ts`'s `"log"` into step 8.

#### RESOLVED: Focusing an empty table row had no `via` to clear with
`ClearVia` gains `"table"`, in R33 and `LOGGED-EVENTS.md` too (steps 4, 9).

#### RESOLVED: R41 left out steps 3 to 5
R41 now says what Verification checks.

### Fifth round (review of the fourth round's fixes)

#### RESOLVED: The press tracking missed a touch tap and never ended a canceled press
Presses are noted with primary-button `mousedown` and `mouseup` on the window, and also end on `pointercancel`, `dragend` and `contextmenu` (step 9).

#### RESOLVED: The deletion timer still committed in the middle of a press
A blur clears the pending timer (step 9).

#### RESOLVED: Step 9's deferred-commit test read an Inspect row that step 10 adds
It checks the graph node's fill and the logged `StateSelected` (step 9).

#### RESOLVED: The `via: "table"` test checked the hook, not the row
A step 9 Cypress case checks the row's logged clear.

### Sixth round (Senior Engineer, Commit Reviewer, Test Writer)

Checked against master's code with MARK-14 merged; R38a's and R38b's tests and step 2's drag types hold there.

#### RESOLVED: Step 8's demo test couldn't see a capitalization change, and a runtime test was left reading the placeholder
The demo test types a mixed-case starting text first and checks the graph's state labels; the defaults test joins step 8's list.

#### RESOLVED: Step 5's selection logging test couldn't reach `selectState` through `MarkovTool`
The selection cases use `renderHook(() => useMarkovTool(host))`.
