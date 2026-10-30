# Implementation Plan: Shared Components for the CODAP Plugin and the AP Interactive

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-14
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The four review follow-ups come first, each its own commit, so the split starts from cleaned-up code. Then the generator and output become components, then the host interface and the split, with the core's tests, and last the core's state moves out of `MarkovTool` into a hook. Every step builds, lints and passes the existing tests on its own.

Toolchain: Node 24 (`.nvmrc`). Each step ends with `npm run build` (which runs `lint:build`), `npm run lint`, `npm run lint:style`, `npx tsc --noEmit -p .`, `npx tsc --noEmit -p cypress` and `npx jest`; steps that touch the plugin's UI also run `npm run test:cypress` (headless).

### Move `ViewMode` and `CODAPAttribute` into `src/type.ts`

**Summary**: R8. Ends the `import type` loop between `plugin-state.ts` and `use-codap.ts`, and means the core will never import a type from the CODAP hook.

**Files affected**:
- `src/type.ts`: add `CODAPAttribute` and `ViewMode`, as defined in `use-codap.ts` today.
- `src/hooks/use-codap.ts`: delete both definitions; they join its existing `Edge, GraphData, Node` import from `../type`.
- `src/utils/plugin-state.ts`, `src/components/app-utils.ts`, `src/components/graph.tsx`, `src/components/drawing/node-modal.tsx`, `src/components/drawing/probability-selector.tsx`: import from `../type` (or `../../type`). The first four already import from it, so the names join that import; a second import line from the same module fails `no-duplicate-imports`.

**Estimated diff size**: ~25 lines

```ts
// src/type.ts
export type Node = { id: string, label: string, value: number, x?: number, y?: number };
export type Edge = { from: string, to: string, value: number };
export type GraphData = { nodes: Node[], edges: Edge[] };

export type ViewMode = "dataset"|"drawing";

// the CODAP attribute dropped on the plugin in dataset mode, saved in the plugin's state
export type CODAPAttribute = {
  datasetName: string;
  collectionName: string;
  attributeName: string;
};
```

The commented-out mobx import at the top of `type.ts` stays as it is. Check: `grep -rn "hooks/use-codap" src` lists only `app.tsx`'s import of `useCODAP`.

---

### Delete the duplicate `applyStatePercentages` test

**Summary**: R9. One deletion, in its own `test:` commit so R12's single exception is easy to find.

**Files affected**:
- `src/components/drawing/state-editor.test.ts`: delete `it("keeps the state's values when its percentages are unchanged", ...)` (lines 4 to 12 on this branch).

**Estimated diff size**: ~10 lines

The remaining `applyStatePercentages` tests and the `movePairedPercentage` tests are untouched. Jest goes from 118 tests to 117.

---

### Share the state and transition counting

**Summary**: R10 and R14. One function counts states and transitions over chains of labels; `wordsToGraph` and `graphFromValues` both call it and return exactly what they return today.

**Files affected**:
- `src/utils/chain-graph.ts` (new): `chainsToGraph` and `graphFromValues`.
- `src/utils/chain-graph.test.ts` (new): R14's tests.
- `src/utils/text-to-graph.ts`: `wordsToGraph` calls `chainsToGraph`. Its comment about null-prototype objects and not using a Map goes, since the code it describes goes; the type import narrows to `GraphData`.
- `src/utils/attribute-values.ts`: `graphFromValues` moves out to `chain-graph.ts`, so the module that sends CODAP's case request no longer holds graph logic the core needs. Its `Edge`, `GraphData` and `Node` import goes, since only `graphFromValues` used it.
- `src/hooks/use-graph.ts`: import `graphFromValues` from `../utils/chain-graph`.
- `src/components/app-utils.ts`: import `graphFromValues` from `../utils/chain-graph`; `graphToRestore` rebuilds dataset mode's graph with it.
- `src/utils/attribute-values.test.ts`: its import line splits in two, `graphFromValues` from `./chain-graph`; no test body changes (R12).

**Estimated diff size**: ~140 lines

```ts
// src/utils/chain-graph.ts
import { Edge, GraphData, Node } from "../type";

// Counts each label as a state and each pair of neighbors in a chain as a transition, in the order they first
// appear. Maps rather than plain objects, so a label like "constructor" can't find an inherited property.
export const chainsToGraph = (chains: string[][]): GraphData => {
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();

  chains.forEach(chain => chain.forEach((label, index) => {
    const node = nodes.get(label) ?? { id: label, label, value: 0 };
    node.value++;
    nodes.set(label, node);

    if (index > 0) {
      const from = chain[index - 1];
      const key = JSON.stringify([from, label]);
      const edge = edges.get(key) ?? { from, to: label, value: 0 };
      edge.value++;
      edges.set(key, edge);
    }
  }));

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
};

// a dataset's values as chains: an empty value breaks the chain, like an empty cell
export const graphFromValues = (values: string[]): GraphData => {
  const chains: string[][] = [[]];
  values.forEach(value => value === "" ? chains.push([]) : chains[chains.length - 1].push(value));
  return chainsToGraph(chains);
};
```

```ts
// src/utils/text-to-graph.ts
import { GraphData } from "../type";
import { chainsToGraph } from "./chain-graph";

// ...textToWords is unchanged...

// text's states come in a plain object's key order: words that are array indexes ("0", "12") first in numeric
// order, then the rest as they first appear
const isArrayIndex = (word: string) => /^(0|[1-9]\d*)$/.test(word) && Number(word) < 2 ** 32 - 1;

export const wordsToGraph = (words: string[]): GraphData => {
  const { nodes, edges } = chainsToGraph([words]);
  const indexes = nodes.filter(n => isArrayIndex(n.id)).sort((a, b) => Number(a.id) - Number(b.id));
  return { nodes: [...indexes, ...nodes.filter(n => !isArrayIndex(n.id))], edges };
};
```

Edge keys use `JSON.stringify([from, to])`, not `wordsToGraph`'s `from|to`: a dataset value can contain `|`, and `graphFromValues` compares `from` and `to` separately today, so `from|to` would merge `a|b → c` with `a → b|c`. Words never contain `|` (`textToWords` strips it), so `wordsToGraph`'s results don't change. Edge order is first appearance in both, as today, since `wordsToGraph`'s edge keys always contain `|` and are never array indexes.

R14's tests in `chain-graph.test.ts`, each named for what it guards:
- `wordsToGraph` puts array-index words first in numeric order: `["b", "2", "a", "1", "b"]` gives states `1, 2, b, a` (checked against today's code). Fails if the reorder is deleted.
- `graphFromValues` keeps first-appearance order for the same values: `b, 2, a, 1`. Fails if the reorder is applied to it.
- `graphFromValues(["a", "b", "", "c", "a"])` has no `b → c` transition and has `c → a`. Fails if the break is dropped.
- `wordsToGraph(["constructor", "toString", "constructor"])` gives two states with values 2 and 1, and `graphFromValues` likewise. Fails if the Maps become plain objects.
- `graphFromValues(["a|b", "c", "", "a", "b|c"])` gives two separate transitions. Fails if the key goes back to `from|to`.

The existing `text-to-graph.test.ts` and `attribute-values.test.ts` tests, including both self-loop tests, pass unchanged. *(Checked with throwaway code: the two blocks above, compared with today's functions on 3,000 random chains drawn from `a`, `b`, `1`, `02`, `10`, `0`, `constructor`, `toString`, `__proto__`, `x|y`, an empty value, `4294967294` and `4294967295`, and on a sentence through `textToWords`, gave equal results every time.)*

---

### Delete the dead drag writes in `graph.tsx`

**Summary**: R11. `dragStart` and `dragEnd` take the d3 event, which they wrongly call `d`; their `fx`/`fy` writes land on the event and do nothing. The drop stays sticky, because nothing unpins a state after auto-arrange or a drag.

**Files affected**:
- `src/components/graph.tsx`: `dragStart` and `dragEnd`.

**Estimated diff size**: ~12 lines

```ts
const dragStart = () => {
  simulation?.alphaTarget(0.5).restart();
  draggedRef.current = false;
};

// ...dragging is unchanged...

const dragEnd = (event: any) => {
  simulation?.alphaTarget(0);
  // a press without a drag must not redraw, or the click that follows lands on a removed state
  if (draggedRef.current) {
    onDragStop?.(event.subject.id, { x: event.x, y: event.y });
  }
};
```

`dragStart` reads nothing from the event, so it takes no parameter, and the `no-unused-vars` lint stays clean. `dragEnd` saves `event.x` and `event.y` where it saved `d.x` and `d.y`; `d` was the event, so the values are the same. MARK-11's and MARK-12's drag and click tests (`clicks.test.ts`) cover the behavior and pass unchanged.

---

### Extract the generator and the output into components

**Summary**: R1's last clause. The generator's controls and the output become components of their own, so a host's layout can place them; `App` keeps all the state and composes them exactly where `uiForGenerate()` and `sequenceOutput()` render today. The markup, class names and behavior are unchanged (R4), so the existing Cypress specs cover the move.

**Files affected**:
- `src/components/generator.tsx` (new): `Generator`, from `uiForGenerate`, and `AnyStartingState`, exported because `SequenceOutputHeader` reads it too. The imports of the `step`, `play` and `pause` icons, `SpeedToggle` and `compareStateLabels` move here from `app.tsx`; `compareStateLabels` itself stays in `app-utils.ts`, where `app-utils.test.ts` imports it (R12).
- `src/components/sequence-output.tsx` (new): `SequenceOutput`, from `sequenceOutput`, and `SequenceOutputHeader`, moved as it is. It imports `AnyStartingState` from `./generator`; the two dropdown arrow icons move here from `app.tsx`.
- `src/type.ts`: `GenerationMode`, `SequenceGroup` and `DelimiterType`, moved from `app.tsx` unchanged, since `App` and both components use them.
- `src/components/app.tsx`: the two render functions, `handleLengthLimitKeyDown`, `innerOutputRef`, its scroll effect and the moved types go; `App` renders `<Generator .../>` and `<SequenceOutput .../>` in their places. The three types join `App`'s existing `../type` import, since a second import line fails `no-duplicate-imports`, and `App` drops the imports that moved with the JSX.

**Estimated diff size**: ~480 lines (about 280 added and 195 removed), most of it moved JSX

```tsx
// src/components/generator.tsx
export interface GeneratorProps {
  nodes: Node[];
  graphEmpty: boolean;
  generationMode: GenerationMode;
  startingState: string;
  lengthLimit?: number;
  delimiter: string;
  delimiterType: DelimiterType;
  fastSimulation: boolean;
  onStartingStateChange: React.ChangeEventHandler<HTMLSelectElement>;
  onLengthLimitChange: React.ChangeEventHandler<HTMLInputElement>;
  onLengthLimitCommit: () => void;
  onDelimiterTypeChange: React.ChangeEventHandler<HTMLSelectElement>;
  onDelimiterChange: React.ChangeEventHandler<HTMLInputElement>;
  onSpeedChange: (fast: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
}
```

```tsx
// src/components/sequence-output.tsx
export interface SequenceOutputProps {
  sequenceGroups: SequenceGroup[];
  graphEmpty: boolean;
  generationMode: GenerationMode;
  lengthLimit?: number;
  highlightOutput?: { group: SequenceGroup, sequence: Node[] };
  onToggleHighlight: (group: SequenceGroup, sequence: Node[]) => void;
  onClear: () => void;
  onCancel: () => void;
}
```

- Both props interfaces are exported, for the hook that returns them (the last step).
- The props are the values and handlers each render function reads from `App` today, under prop names; `App` passes its existing handlers (`handleChangeStartingState`, `handlePlay` and the rest) unchanged.
- `Generator` and `SequenceOutput` each derive `animating` from `generationMode`, and `Generator` holds `handleLengthLimitKeyDown`, which only calls `onLengthLimitCommit` on Enter; it sorts `nodes` with `compareStateLabels` as `uiForGenerate` does.
- `SequenceOutput` owns `innerOutputRef` and the effect that scrolls the output to the bottom when `sequenceGroups` changes, moved out of `App`, which no longer reads the ref. The effect must skip the component's mount. `App`'s effect only ran when the groups changed, so after Back to Main Menu (which keeps the groups) and choosing a mode, or when a dataset's graph empties and refills, the remounted output opens scrolled to the top; an effect that also ran on mount would scroll it to the bottom, against R4. A ref holding the groups last seen keeps the old behavior:

```tsx
const innerOutputRef = useRef<HTMLDivElement | null>(null);
const scrolledGroupsRef = useRef(sequenceGroups);
useEffect(() => {
  if (scrolledGroupsRef.current === sequenceGroups) {
    return;
  }
  scrolledGroupsRef.current = sequenceGroups;
  if (innerOutputRef.current && sequenceGroups.length > 0) {
    innerOutputRef.current.scrollTop = innerOutputRef.current.scrollHeight;
  }
}, [sequenceGroups]);
```

- No new tests: the components render the same markup in the same place, and `generation.test.ts` and `highlighting.test.ts` (Play, Step, Pause, Resume, Cancel, Clear Output, output highlighting) pass unchanged. The split step's `MarkovTool` tests then drive them through `MarkovTool`.

---

### Split `App` into a shared core and a CODAP host

**Summary**: R1 to R7, R8 and R13. The core renders the tool and talks to its host through a `MarkovHost` prop and a `MarkovToolHandle` ref; the CODAP host wraps `useCODAP` and mounts the core. The core's behavior is `App`'s, moved, with each CODAP touch point replaced by a host call.

**Files affected**:
- `src/components/host.ts` (new): the host interface.
- `src/components/app.tsx` → `src/components/markov-tool.tsx` (`git mv`, then edit): `App` becomes `MarkovTool`.
- `src/hooks/use-codap.ts` → `src/codap/use-codap.ts` (`git mv`, then edit): takes the core's handle instead of `App`'s callbacks.
- `src/codap/codap-app.tsx` (new): `CodapApp`, the CODAP host.
- `src/index.tsx`: mount `CodapApp`.
- `eslint.config.js`: R1's boundary, as a `no-restricted-imports` rule.
- `doc/deploy.md`: its public-path example names `components/app.tsx`, which no longer exists; it says "a component" instead.
- `src/components/markov-tool.test.tsx` (new): the host-call tests (R13).

**Estimated diff size**: ~450 lines, most of it the moved `App` and its new test

```ts
// src/components/host.ts
import { GraphData, ViewMode } from "../type";

// What the Markov tool needs from whatever hosts it: CODAP for the plugin, the Activity Player for the interactive.
// Keep each function's identity across renders unless what depends on it should run again: a playing sequence
// keeps the outputSequence it started with, and a new markDirty re-sends drawing mode's dirty notice.
export interface MarkovHost {
  viewMode?: ViewMode;
  setViewMode: (viewMode?: ViewMode) => void;
  markDirty: () => void;
  outputSequence: (labels: string[]) => Promise<void>;
}

// What a host can ask of the tool, through its ref.
export interface MarkovToolHandle {
  getGraph: () => GraphData;
  // a saved drawing; drawings before version 2 have their origin at the top left
  loadDrawing: (graph: GraphData, version: number) => void;
  // dataset mode's values, which replace the graph
  dataChanged: (values: string[]) => void;
}
```

`MarkovTool`:

```tsx
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
// ...App's other imports, less useCODAP's...
import { MarkovHost, MarkovToolHandle } from "./host";

interface MarkovToolProps {
  host: MarkovHost;
  // the tool shows "Loading ..." until the host has its saved state
  loadState: "loading" | "loaded";
  // something is being dragged over the tool, which dataset mode shows
  dragging: boolean;
}

export const MarkovTool = forwardRef<MarkovToolHandle, MarkovToolProps>(({ host, loadState, dragging }, ref) => {
  const { viewMode, setViewMode, markDirty, outputSequence } = host;
  // ...App's state, unchanged...

  useImperativeHandle(ref, () => ({
    getGraph: () => graph,
    loadDrawing: (data, version) => {
      onSetGraph(data, version);
      setInitialGraph({ nodes: data.nodes.map(n => ({ ...n })), edges: data.edges.map(e => ({ ...e })) });
    },
    dataChanged: onDataChanged,
  }));
  // ...
});
MarkovTool.displayName = "MarkovTool";
```

In the moved code:
- `onCODAPDataChanged` is renamed `onDataChanged`; its body is unchanged.
- `loadDrawing` holds the node and edge copy that `setPluginState` makes in the hook today, so `setInitialGraph` stays inside the core.
- `outputToDataset(currentSequence.current)` becomes `outputSequence(currentSequence.current.map(state => state.label))`, the mapping the hook does today.
- `notifyStateIsDirty` becomes `markDirty`, at the same three call sites (the drawing-mode effect, and choosing either mode).

`useCODAP` keeps its body, with `App`'s four callbacks replaced by the handle:

```ts
import { CODAPAttribute, ViewMode } from "../type";
import { MarkovToolHandle } from "../components/host";
// ...the other imports are unchanged...

export const useCODAP = (tool: React.RefObject<MarkovToolHandle | null>) => {
  // ...
  const getPluginState = useCallback(() => ({
    success: true,
    values: pluginStateValues(viewMode, attribute, () => tool.current?.getGraph() ?? { nodes: [], edges: [] })
  }), [attribute, viewMode, tool]);
  // handleDataChanged calls tool.current?.dataChanged(values) where it called onCODAPDataChanged(values),
  // and its dependencies become [tool, viewMode];
  // setPluginState calls tool.current?.loadDrawing(graph, version) where it called setGraph and setInitialGraph,
  // and its dependencies become [setAttribute, handleDataChanged, tool]
  // ...
  const outputSequence = useMemo(() => createSequenceOutput(request => codapInterface.sendRequest(request)), []);
  // ...
  return { dragging, viewMode, setViewMode, notifyStateIsDirty, loadState, outputSequence };
};
```

`createSequenceOutput`'s result already takes labels, so the hook returns it as it is and its `outputToDataset` wrapper goes. The option types `UseCODAPOptions`, `OnCODAPDataChanged` and `GetGraphCallback` go with the callbacks they described, and `OutputTextMode`, which nothing imports, goes too; with the graph copy in the core, the hook imports only `CODAPAttribute` and `ViewMode` from `../type`. It must stay the memoized function: `finishAnimating` depends on it, and the animation interval holds the `finishAnimating` it started with.

The handle has no dependency array: `onSetGraph` and `onDataChanged` are new functions on every render, so `[graph]` fails `react-hooks/exhaustive-deps`, and React recreates a handle without deps on each render, which is what `getGraph` needs anyway. The hook step replaces this with one stable handle.

`CodapApp`:

```tsx
// src/codap/codap-app.tsx
import React, { useRef } from "react";
import { MarkovTool } from "../components/markov-tool";
import { MarkovHost, MarkovToolHandle } from "../components/host";
import { useCODAP } from "./use-codap";

// The Markov plugin in CODAP: CODAP keeps its saved state, receives its sequences and supplies dataset mode's values.
export const CodapApp = () => {
  const tool = useRef<MarkovToolHandle>(null);
  const { dragging, viewMode, setViewMode, notifyStateIsDirty, loadState, outputSequence } = useCODAP(tool);
  const host: MarkovHost = { viewMode, setViewMode, outputSequence, markDirty: notifyStateIsDirty };
  return <MarkovTool ref={tool} host={host} loadState={loadState} dragging={dragging} />;
};
```

Keeping the request stream the same (R5, R15a):
- `notifyStateIsDirty` stays unmemoized, as today. The core's drawing-mode effect (`[graph, viewMode, markDirty]`) then fires on each graph or mode change and on each render of the host, which now happens only when the hook's own state changes. Master also fires it on every render of `App`, including each frame of an animation; those extra notices are the one difference R5 allows.
- `useCODAP`'s registration effect still depends on `getPluginState`, which no longer changes with the graph. `codapInterface.clear()` and `on()` only change local handler lists and send nothing, so registering less often changes no request.
- Timing: CODAP's `update interactiveState` arrives after `initializePlugin`, which runs in `useCODAP`'s effect; React sets the child's imperative handle before the parent's effects run, so `tool.current` is set by the time `setPluginState` calls it.

R1's boundary, in `eslint.config.js`:

```js
{ // the shared Markov tool reaches CODAP only through its host
  files: ["src/components/**", "src/hooks/**", "src/utils/chain-graph.ts", "src/utils/text-to-graph.ts",
          "src/utils/generate-sequence.ts", "src/utils/plugin-state.ts"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [{
      group: ["**/codap/**", "**/codap-interface", "**/codap-helper", "**/output-dataset", "**/attribute-values"],
      message: "The Markov tool reaches CODAP only through its MarkovHost."
    }] }]
  }
},
```

The check: delete `src/codap/` and `npx tsc --noEmit -p .` reports errors only in `src/index.tsx`.

`markov-tool.test.tsx` renders `<MarkovTool ref={handle} host={host} loadState="loaded" dragging={false} />` with a recording host (each method a `jest.fn()`, `viewMode` as the test needs), changing the two props where a test needs to. It mocks `nanoid` and replaces `Graph` with a stub that renders a `div` and exposes its callbacks to the test (requirements, Technical Notes), and runs animation on Jest's fake timers. Nine tests, one per bullet except the mode bullet's two:
- shows "Loading ..." while `loadState` is `loading`, and the mode menu once it is `loaded` with no view mode;
- choosing Dataset calls `setViewMode("dataset")` and `markDirty`, and choosing Drawing calls `setViewMode("drawing")` and `markDirty`, one test each, since each handler makes its own call;
- `loadDrawing` with a `version: 2` graph shows its states in the Starting State list, and `getGraph` returns it;
- `loadDrawing` with an unversioned graph moves its origin to the center once the graph reports its size (the stub calls `onDimensions`);
- `dataChanged` in dataset mode replaces the graph without calling `markDirty`, and Reset restores it from the last values;
- `dragging={true}` in dataset mode gives the tool the `dragging` class, and `false` does not;
- one test for both: Play outputs the finished sequence's labels once, and Cancel outputs nothing;
- a drawing-mode graph change calls `markDirty`. The drawing-mode effect also fires once on mount, so the test clears the mock after the first render and then changes the graph; asserting only that `markDirty` was called passes on the mount call alone, even with `graph` deleted from the effect's dependencies.

Deleting the host call a test checks fails that test.

Jest files lint under testing-library's rules, where `no-node-access` and `no-container` are errors and `no-unnecessary-act` rejects `act` around `fireEvent`. The `dragging` test therefore reads the root's class from `container.innerHTML` (`/^<div class="app dragging">/`, and `/^<div class="app">/` when `false`) rather than `toHaveClass` on `container.firstChild`, which needs neither a test id in the markup nor an `eslint-disable`; the Play and Cancel tests click with a bare `fireEvent.click`, wait with `findByRole` (Play becomes Pause), and wrap only the timer advance in `act`.

---

### Move the core's state into `useMarkovTool`

**Summary**: R1a. `MarkovTool`'s state, effects and handlers move into `useMarkovTool(host)`, which returns them grouped for a layout, with one stable handle; `MarkovTool` becomes the CODAP layout over it, rendering the same markup from the hook's result. Nothing a user sees changes, so the existing tests and R13's cover the move, and one R13 test gains a check of the handle's identity.

**Files affected**:
- `src/components/markov-tool.tsx` → `src/hooks/use-markov-tool.tsx` (`git mv`, then edit): everything from the first `useState` to the last handler becomes the hook's body, and the module's constants (the animation delays and defaults) stay at module level in the hook's file; the render goes, and the hook returns the groups below. It is `.tsx` because the Reset and Back to Main Menu dialogs' messages are JSX.
- `src/components/markov-tool.tsx` (new, about 110 lines): `MarkovTool`, the render moved back over the hook's result. It keeps `MarkovToolProps`, `import "./app.scss"` and the imports of what it renders (`Drawing`, `Dataset`, `Generator`, `SequenceOutput`, `ConfirmModal`, `clsx`); the hook keeps the rest, with its relative paths fixed for `src/hooks/`. From React, the hook imports `useLayoutEffect` and no longer needs `forwardRef` or `useImperativeHandle`; `markov-tool.tsx` imports `React`, `forwardRef` and `useImperativeHandle`, `useMarkovTool` from `../hooks/use-markov-tool`, and `MarkovHost` and `MarkovToolHandle` from `./host`.

**Estimated diff size**: ~970 lines, nearly all moved code (`git diff -C` shows the hook as a copy of `markov-tool.tsx` with about 240 lines changed)

```tsx
// src/hooks/use-markov-tool.tsx
// The Markov tool's state and handlers, apart from any layout: MarkovTool lays them out for the CODAP plugin.
export interface MarkovToolApi {
  handle: MarkovToolHandle;
  graph: GraphData;
  graphEmpty: boolean;
  animating: boolean;
  // what the graph draws: the animation's highlights and the chosen state or output
  graphHighlights: {
    highlightNode?: Node, highlightLoopOnNode?: Node, highlightEdge?: Edge, highlightAllNextNodes: boolean,
    highlightOutputNodes?: Node[], selectedNodeId?: string,
  };
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
  generatorProps: GeneratorProps;
  outputProps: SequenceOutputProps;
  view: {
    fitViewAt?: number, recenterViewAt?: number, resetViewAt?: number, graphOpacity: number,
    onFitView: () => void, onRecenterView: () => void, onReset: () => void,
    onDimensions: (dimensions: { width: number, height: number }) => void,
    setGraph: React.Dispatch<React.SetStateAction<GraphData>>,
    setHighlightNode: React.Dispatch<React.SetStateAction<Node | undefined>>,
    onClearHighlightOutput: () => void, confirmModal?: IConfirmModal,
    onSelectDatasetMode: () => void, onSelectDrawingMode: () => void, onReturnToMainMenu: () => void,
  };
}

export const useMarkovTool = (host: MarkovHost): MarkovToolApi => {
  const { viewMode, setViewMode, markDirty, outputSequence } = host;
  // ...MarkovTool's state, effects and handlers, unchanged except that onSetGraph and onDataChanged become
  // useCallback, with [setGraph] and [updateGraph]...

  // one handle for the tool's lifetime; getGraph reads the graph the last render committed
  const graphRef = useRef(graph);
  useLayoutEffect(() => {
    graphRef.current = graph;
  }, [graph]);
  const handle = useMemo<MarkovToolHandle>(() => ({
    getGraph: () => graphRef.current,
    loadDrawing: (data, version) => {
      onSetGraph(data, version);
      setInitialGraph({ nodes: data.nodes.map(n => ({ ...n })), edges: data.edges.map(e => ({ ...e })) });
    },
    dataChanged: onDataChanged,
  }), [onSetGraph, onDataChanged]);
  return {
    handle, graph, graphEmpty, animating,
    graphHighlights: {
      highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes, highlightOutputNodes, selectedNodeId,
    },
    setSelectedNodeId,
    generatorProps: { nodes: graph.nodes, graphEmpty, generationMode, /* ...the rest of what MarkovTool passed */ },
    outputProps: { sequenceGroups, graphEmpty, generationMode, /* ...the rest of what MarkovTool passed */ },
    view: { /* the values and handlers above, under these names */ },
  };
};
```

```tsx
// src/components/markov-tool.tsx
export const MarkovTool = forwardRef<MarkovToolHandle, MarkovToolProps>(({ host, loadState, dragging }, ref) => {
  const { viewMode } = host;
  const { handle, graph, graphEmpty, animating, graphHighlights, setSelectedNodeId, generatorProps, outputProps, view }
    = useMarkovTool(host);
  useImperativeHandle(ref, () => handle, [handle]);
  // ...the render, unchanged, reading from these: <Generator {...generatorProps} />,
  // <SequenceOutput {...outputProps} />, <Drawing graph={graph} {...graphHighlights} ... /> and the same for Dataset
});
```

- The result's type is `MarkovToolApi`, so it doesn't share the component's name. Its members are the ones MARK-15's spec lists, so its workspace calls `useMarkovTool(host)` and lays out `graphHighlights`, `generatorProps`, `outputProps` and `view` as they are. Some are there for the CODAP layout: `setSelectedNodeId` (which MARK-15's `selectState` wraps), and in `view` the drawing view's `setHighlightNode` and `onClearHighlightOutput` and the mode menu's two handlers.
- The hook takes only the host; `loadState` and `dragging` stay `MarkovTool`'s props, as in the split step, so a layout that calls the hook directly never needs them.
- `handle` keeps its identity for the hook's lifetime, so a layout can list `tool.handle` in an effect's dependencies, and an effect that calls `dataChanged` on mount runs once. Its dependencies never change: `onSetGraph` and `onDataChanged` use only `setGraph`, `updateGraph` and refs, and `setInitialGraph` is a state setter. `getGraph` reads `graphRef`, which a layout effect sets after each graph change, so it returns the current graph by the time a host or a parent's effect calls it; deleting that update fails three R13 tests.
- `src/hooks/**` is already inside R1's lint boundary.
- No new test file: R13's tests render `MarkovTool`, so every host call they check now runs in the hook. The `dataChanged` test gains one assertion: the ref's `current` after the change is the same object (`toBe`) as before it. It can only join here: the split step's handle is new on every render. Deleting the `useMemo`, or the `useCallback` around `onDataChanged`, fails it. *(Checked with throwaway code, built on the steps before it: the checks under Verification pass, and with `markDirty()` deleted from the hook's Dataset handler, or the hook's `outputSequence` call deleted, one R13 test fails each time.)*

## Verification

Run on the head commit, Node 24, all headless:

- `npm run build`, `npm run lint`, `npm run lint:build`, `npm run lint:style`, both `tsc` checks: clean (R16).
- Jest: every existing test passes, with R9's deletion the one removed test (R12): 131 tests in 17 suites (118, less R9's one, plus R14's five and R13's nine). Cypress: all existing specs pass, unchanged (R12): 86 tests in Chrome, and in Electron 85 with the Chrome-only standalone-link test pending.
- R15a: a throwaway Cypress support hook writes the fake CODAP's `requests` to a file after each test; run the existing plugin specs on master and on the branch, and diff. Delete the hook; record the result in the PR.
- R15: headless Playwright in CODAP 3.1.2, the branch build beside master's, through MARK-12's R11 list and the five ELA documents in `cypress/fixtures/ela/`; record the result in the PR.
- Mutation checks for each new test: delete the line it guards and confirm it fails.

## Open Questions

### RESOLVED: Judgment call: a ref handle or callbacks for the host's calls into the core?
**Options considered**:
- A) The core exposes `getGraph`, `loadDrawing` and `dataChanged` through `useImperativeHandle`; the host holds the ref.
- B) The core registers callbacks with the host on mount (`host.attach(...)`).
- C) The graph state moves into the host.

**Decision**: A. It keeps `App`'s state in the core, which is what MARK-15 reuses, and is React's own mechanism for a parent calling into a child. B reimplements a ref by hand; C would put the tool's main state in every host.

### RESOLVED: Judgment call: move the CODAP files into `src/codap/`?
**Options considered**:
- A) Move `use-codap.ts` and the new host into `src/codap/`, leave the CODAP utilities in `src/utils/` beside their tests, and enforce R1 with a lint rule.
- B) Move every CODAP file and its test into `src/codap/`.

**Decision**: A. B would move four test files, which R12 keeps where they are; the lint rule enforces the boundary either way.

### RESOLVED: Judgment call: keep `notifyStateIsDirty` unmemoized?
**Options considered**:
- A) Keep it as it is.
- B) Memoize it, so dirty notices follow only graph and mode changes.

**Decision**: A. It is the version measured against master (Self-Review); B would probably send fewer notices still, but nothing has checked it, and it is not this story's change to make.

## Self-Review

Each entry was confirmed in the code or with throwaway code built on the plan, then deleted; Verification gives the counts on the head.

### Commit Reviewer

#### RESOLVED: The type move's imports fail lint as separate lines
Four of the five files, and `use-codap.ts`, already import from `../type`, and a second import line fails `no-duplicate-imports`; the names join the existing import.

### Senior Engineer

#### RESOLVED: `useImperativeHandle(..., [graph])` fails `exhaustive-deps`
Confirmed by lint. The split step's handle has no dependency array and no `eslint-disable`; the hook step makes it stable.

#### RESOLVED: The hook's output function must stay stable
A wrapper made on each render would rebuild `finishAnimating` while the animation interval keeps the first one, so the hook returns the memoized `createSequenceOutput` result.

#### RESOLVED: Moving `graphFromValues` missed one importer
`app-utils.ts` imports it for `graphToRestore`; it is in the counting step's files.

#### RESOLVED: The lint boundary left out one of the core's utilities
The core uses four `src/utils/` modules, and `plugin-state.ts` joined the rule's `files`. Run against throwaway files, the rule reports each restricted import from `src/components` and `src/hooks`.

#### RESOLVED: The split orphans the hook's option types
`UseCODAPOptions`, `OnCODAPDataChanged`, `GetGraphCallback`, the unimported `OutputTextMode` and the hook's `Edge`, `GraphData` and `Node` imports go with the split.

#### RESOLVED: `doc/deploy.md` names `components/app.tsx`
The public-path example cites the file the split renames; the step edits the line.

#### RESOLVED: The extraction step moved `compareStateLabels` out of `app.tsx`
It stays in `app-utils.ts`, where `app-utils.test.ts` imports it (R12); only its import moves.

### QA Engineer

#### RESOLVED: R13's tests left out the drag highlight and a negative dirty check
Added the `dragging` class test, and `dataChanged` in dataset mode not calling `markDirty`, which fails without the effect's drawing-mode guard.

#### RESOLVED: R15a's request-for-request equality does not hold
Over the 36 plugin tests, 31 sessions match master once consecutive dirty notices collapse; the other five differ only in the dirty notices master re-sends on each animation frame. Every other request matches in content and order, and R5 and R15a allow for the difference.

### Maintainer

#### RESOLVED: The counting step left unused imports and a comment that contradicts the new code
The move left five `no-unused-vars` warnings and a "not a Map" comment the new code reverses; the step narrows both imports and deletes the comment.

#### RESOLVED: The new `wordsToGraph` comment narrated history
It states the order as a plain object's key order.

### Test Designer

#### RESOLVED: No test guarded choosing Dataset's `markDirty`
With `markDirty()` deleted from `handleSelectDatasetMode`, every existing test passed; the list has one test per mode.

#### RESOLVED: The drawing-mode `markDirty` test could pass without a graph change
The effect also fires on mount, so a bare "was called" check survives deleting `graph` from its dependencies; the test clears the mock after mount.

#### RESOLVED: R13's Play and Cancel bullet read as two tests
It is one test, as Verification's 131 counts it.

### Build Verifier

#### RESOLVED: R13's `dragging` and Play tests, written the obvious way, fail `npm run lint`
`toHaveClass` on `container.firstChild` breaks `testing-library/no-node-access` and `act` around `fireEvent` breaks `no-unnecessary-act`; the step's versions lint clean and pass. A test id on the root was rejected because it changes the markup for a test.

#### RESOLVED: The split's code blocks left out their imports and the hook's dependency arrays
The blocks show the imports and `handleDataChanged`'s and `setPluginState`'s new dependency arrays; built, they type-check with no `exhaustive-deps` warning.

#### RESOLVED: The output's moved scroll effect scrolled a remounted output to the bottom
Moved unchanged, the effect also ran on mount, so after Back to Main Menu and Drawing the output opened at `scrollTop` 116, not master's 0. The ref of the groups last seen skips the mount, and both scroll positions then match master.

#### RESOLVED: The step did not say where the moved code's imports go
`AnyStartingState` is exported for `SequenceOutputHeader`, the moved types join `App`'s `../type` import, and the step names the imports that leave `app.tsx`.

#### RESOLVED: The plan was not rebuilt after `loadState` and `dragging` became props
Rebuilt, it gives Verification's counts, R14's five tests included. Deleting the loading check, the `dragging` class, the dirty effect's `graph` dependency or its guard, either mode's `markDirty`, the `outputSequence` call or the cancel check each fails one R13 test.

#### RESOLVED: The diff estimate counted about half the lines
Measured on the throwaway build: 282 lines added and 194 removed, so ~480.

#### RESOLVED: Each step's checks left out `lint:style`, which R16 requires
Each step runs it; `npm run build` runs `lint:build`.

#### RESOLVED: The hook step did not say what stays with the layout
A `git mv` carries `MarkovToolProps`, `import "./app.scss"` and the view imports into `src/hooks/`; the step lists what `markov-tool.tsx` keeps.

### Technical Editor

#### RESOLVED: R13's list did not say how many tests its bullets make
It says nine, one per bullet except the mode bullet's two.

#### RESOLVED: The hook step did not say which React imports move
The hook needs `useLayoutEffect` and no longer `forwardRef` or `useImperativeHandle`; the step lists each file's React and host imports.

#### RESOLVED: R10 called the reordered words "integer-like"
Only array-index keys come first in a plain object (`02`, `-1` and `1.5` keep first-appearance order, checked in Node); R10 says array indexes.

#### RESOLVED: Stale and duplicated test counts
Counts outside Verification were stale or partial; they defer to Verification.

#### RESOLVED: The verification list pointed at a rule outside the repo
The mutation-check line says what to do without the reference.

#### RESOLVED: `MarkovToolApi`'s note called some members extra to MARK-15's list
MARK-15's spec lists `setSelectedNodeId` and every `view` member as MARK-14's; the note says the members match it and which ones the CODAP layout needs.

#### RESOLVED: The hook step said the module's constants become the hook's body
They stay at module level in the hook's file, so the URL parameters are still read once.

### Forward Compatibility

#### RESOLVED: Nothing told a host its functions must keep their identity
The animation interval keeps the `outputSequence` it started with, and the drawing-mode effect re-sends the dirty notice when `markDirty` changes, so the `MarkovHost` comment says to keep them. Reading them through a ref was rejected: it changes the dirty notices R15a measured.

#### RESOLVED: `MarkovToolApi.handle` changed identity on every render
A layout's mount effect then warned under lint or looped (a probe looped until Jest crashed). Doug's decision: one stable handle (`useMemo`, the graph read through a ref), rather than documenting the instability; the same probe then runs its effect once.

#### RESOLVED: No test guarded the stable handle, and R1a did not state it
The `dataChanged` test asserts the ref's identity with `toBe`, which fails with the `useMemo` or `onDataChanged`'s `useCallback` deleted (checked with a probe); R1a states the identity.
