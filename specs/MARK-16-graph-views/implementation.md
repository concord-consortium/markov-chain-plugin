# Implementation Plan: Graph Views in the AP Interactive

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-16
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The branch starts from MARK-15's finished code. The shared-core changes come first, each opt-in so the CODAP plugin is unchanged and its tests pass as they are, apart from the expectations R30 names: count-only generation, the graph's probability labels, the graph's bag of words, and the drawing view in any layout. The AP side follows: Inspect's new views, then the workspace's modes, then its two switches. Every step builds, lints and passes Jest and Cypress on its own.

Toolchain: Node 24 (`.nvmrc`). Each step ends with `npm run build`, `npm run lint`, `npm run lint:build`, `npm run lint:style`, `npx tsc --noEmit -p .`, `npx tsc --noEmit -p cypress` and `npx jest`; steps that touch rendering also run `npm run test:cypress` headless against `npm start`.

File names are those MARK-14 and MARK-15 built (PR #89 and PR #90): `src/components/host.ts`, `src/hooks/use-markov-tool.tsx`, `src/components/sequence-output.tsx`, `src/components/graph.tsx` with `graph-draw.ts`, `graph-highlight.ts` and `graph-geometry.ts`, `src/components/drawing.tsx`, `src/components/log-events.ts`, and `src/interactive/workspace/`.

Logged events join `logEvents` and `LOGGED-EVENTS.md` in the step that first logs them, so MARK-15's list test (R35) passes at every step.

### Count-only generation in the shared core

**Summary**: R10, R15, R29's `orderMatters`. The generator can pick every next state by count, and the hook does so when its host says order doesn't matter. Absent in the CODAP host, so the plugin is unchanged.

**Files affected**:
- `src/utils/generate-sequence.ts`: `orderMatters` option.
- `src/utils/generate-sequence.test.ts`: two tests.
- `src/components/host.ts`: `orderMatters?: boolean` on `MarkovHost`.
- `src/type.ts`: `orderMatters?: boolean` on `SequenceGroup`.
- `src/hooks/use-markov-tool.tsx`: passes it to the generator, starts a new group when it changes, supplies the animation's chosen step, adds it to the generator's logged settings.
- `src/components/sequence-output.tsx`: `SequenceOutputHeader` marks an orderless group.
- `LOGGED-EVENTS.md`: `orderMatters` in the generator's settings.
- `src/hooks/use-markov-tool.test.tsx` (MARK-15's): one test, and `orderMatters: true` in two tests' expected settings.

**Estimated diff size**: ~110 lines

```ts
// src/utils/generate-sequence.ts
export type GenerateOptions = {
  startingNode?: Node;
  lengthLimit: number;
  // false: a bag of words, where every next state is picked from all the states by count
  orderMatters?: boolean;
};

// in the loop, after generatedResult.push(currentNode):
if (orderMatters === false) {
  currentNode = chooseRandomNode();
  continue;
}
```

```ts
// src/components/host.ts, in MarkovHost
// false makes the tool a bag of words; absent, as in the CODAP plugin, order matters
orderMatters?: boolean;
```

- The hook reads `host.orderMatters` and passes it to `generateSequence`. `generateNewSequence` starts a new group when the last group's `orderMatters` differs, beside its delimiter, length and starting-state checks, and records it on the group. In the CODAP host both are `undefined`, so no new group starts that didn't before.
- `animateCurrentSequenceIndex`'s after-step: with `orderMatters === false` the chosen step is `{ from: currentNode.id, to: nextNode.id, value: nextNode.value }` rather than a lookup in `graph.edges`, which a bag-of-words step is usually not in. `orderMatters` joins its dependencies. Generation can't start or change while the switch changes (R16), so an animation never sees two values.
- The generator's logged settings (MARK-15's `{ startingState, maxLength, delimiter, fast }`) gain `orderMatters`, true unless order is off: `sequenceSettings` reads the group's (`group?.orderMatters !== false`), as it reads `maxLength` and `delimiter`, so its empty dependency list stays right, and `handlePlay`'s own settings literal reads `host.orderMatters !== false`. `LOGGED-EVENTS.md`'s settings line and its six generator rows gain the field here, where it is first logged. MARK-15's two hook tests that match the settings exactly ("logs a played sequence and the sequence it generates" and "names states by their labels, not their ids") gain `orderMatters: true`; without it both fail (checked with throwaway code).
- `SequenceOutputHeader`: when `group.orderMatters === false`, the collapsed header adds `<span>/</span><span>Orderless</span>` before the expand icon and the expanded one adds `<div>Order matters: No</div>` (mockup question 18).
- Tests, each naming the mutation it catches: `generateSequence` with `orderMatters: false` from `a` in a graph where `a` goes only to `b`, `Math.random` stubbed to 0.9, picks `c` (by count) at each step and returns `lengthLimit` states (fails if the early `continue` goes or the transition lookup is kept); with `orderMatters` absent the existing tests pass unchanged. The hook test: a host with `orderMatters: false` and values `a`, `b`, Play to the end on fake timers, logs `SequenceGenerated` with five states and `orderMatters: false` (fails if the hook doesn't pass the option, since the chain stops at `b`).

---

### Probability labels in the shared graph

**Summary**: R3, R4, R5, R6, R7, R8, R22. One pure function decides which arrows carry which labels; `Graph` draws them in a layer rebuilt by the highlight effect and moved by the layout's `tick`. Off unless `probabilityLabels` is passed. The arrow-width rule becomes an option, defaulting to today's.

**Files affected**:
- `src/components/graph-labels.ts` (new): `percentOf`, `chainOutgoing`, `probabilityLabels`.
- `src/components/graph-labels.test.ts` (new).
- `src/components/graph-overlay.ts` (new): `drawOverlay(root, d3Graph, options)`, the label layer (and the next step's arrows), and `moveOverlay(root)`, which repositions what it drew.
- `src/components/graph.tsx`: the `probabilityLabels` prop, an overlay ref called from the highlight effect and from `tick`.
- `src/components/graph-draw.ts`: `tick` calls the overlay callback it is given.
- `src/interactive/workspace/inspect-rows.ts`: `TransitionRow` gains `percent`, from `percentOf`, which its `probability` text uses too, so the graph and Inspect round alike (R3).
- `src/components/graph-utils.ts` and `graph-utils.test.ts`: `ArrowWidths` and `edgeWeights`; `graphSignature` includes whether an arrow has value, since equal widths no longer reveal that change.

**Estimated diff size**: ~280 lines, about 110 of them tests

```ts
// src/components/graph-labels.ts
import { Edge, Node } from "../type";

export type Outgoing = (id: string) => Edge[];
export interface ProbabilityLabel { from: string, to: string, text: string, strength: "full" | "faded" }
export interface LabelState {
  outgoing: Outgoing;
  animating: boolean;
  selectedNodeId?: string;
  highlightNode?: Node;
  highlightAllNextNodes: boolean;
  highlightOutputNodes?: Node[];
  // a chosen output labels only its steps, as the bag of words does
  stepsOnly?: boolean;
}

// a share as Inspect and the graph show it: a whole percent
export const percentOf = (value: number, total: number) => total > 0 ? Math.round(100 * value / total) : 0;

// a Markov chain's arrows leaving a state, loops included
export const chainOutgoing = (edges: Edge[]): Outgoing => id => edges.filter(e => e.from === id);

const labelsFrom = (outgoing: Outgoing, id: string, strength: (to: string) => ProbabilityLabel["strength"]) => {
  const edges = outgoing(id);
  const total = edges.reduce((sum, e) => sum + e.value, 0);
  return edges.map(e => ({ from: id, to: e.to, text: `${percentOf(e.value, total)}%`, strength: strength(e.to) }));
};

// C while a step shows its candidates; D for a chosen output; A for a chosen state
export const probabilityLabels = (s: LabelState): ProbabilityLabel[] => {
  if (s.animating) {
    return s.highlightNode && s.highlightAllNextNodes ? labelsFrom(s.outgoing, s.highlightNode.id, () => "full") : [];
  }
  const path = s.highlightOutputNodes;
  if (path && path.length > 0) {
    const steps = new Set(path.slice(1).map((n, i) => JSON.stringify([path[i].id, n.id])));
    const from = [...new Set(path.slice(0, -1).map(n => n.id))];
    const labels = from.flatMap(id =>
      labelsFrom(s.outgoing, id, to => steps.has(JSON.stringify([id, to])) ? "full" : "faded"));
    return s.stepsOnly ? labels.filter(label => label.strength === "full") : labels;
  }
  return s.selectedNodeId ? labelsFrom(s.outgoing, s.selectedNodeId, () => "full") : [];
};
```

- `Graph` gains `probabilityLabels?: boolean`. When set, `drawOverlay` draws `g.probability-labels` (`pointer-events: none`) with one `text.probability-label` per label (`data-from`, `data-to`, class `faded`: fill #767676, 4.5:1 on white, where the arrows' 0.35 opacity would give black text about 2.4:1; full-strength labels are black; mockup question 19). A label sits a third of the way along its arrow, 8 px to the right of its direction of travel, which is the side `calculateEdges` already moves each arrow of a two-way pair to, so the pair's labels part (requirements, Technical Notes); a loop's label sits outside the loop's left edge. Each has a white halo (`paint-order: stroke`, white stroke 3 px) so it reads over arrows.
- The overlay reads the latest props through a ref the component sets on each render (`overlayRef.current = () => drawOverlay(...)`). The draw effect calls it after its `highlightSelected`, and the highlight effect calls it last, after `unhighlightNonOutput` and `highlightSelected`: `unhighlightNonOutput` sets the opacity of every `line` in the SVG (`graph-highlight.ts:160`), so an overlay drawn before it would have its arrows faded. `drawGraph`'s `tick`, after moving the lines, calls `moveOverlay`, which recomputes the places of the layer's existing labels (and the bag of words' arrows) from their states without rebuilding them, so labels follow a drag. A rebuild per tick costs too much: a drag in Data mode restarts the layout's simulation (`dragStart`'s `alphaTarget(0.5).restart()`), which ticks every frame until it cools, about 250 ticks after a one-second drag, and measured headless with throwaway d3, rebuilding 700 arrows and labels takes about 11 ms and moving them about 4 ms (2,800: 51 ms and 21 ms). *(Checked with throwaway code in `graph.tsx` before MARK-15's split: a label layer built this way gave a chosen `a` in "a b a c a b" its "67%" and "33%", and the labels moved during a drag, before the drop redrew the graph.)*
- Without the prop, `drawOverlay` removes the layer and returns, so the plugin's SVG is unchanged.
- Arrow widths (R5):

```ts
// src/components/graph-utils.ts
// "byState": an arrow's share of its own state's outgoing arrows; "equal": every arrow the thinnest width
export type ArrowWidths = "byState" | "equal";
export const edgeWeights = (edges: Edge[], widths: ArrowWidths) =>
  widths === "equal" ? () => settings.minStroke : stateEdgeWeights(edges);
```

  `Graph` takes `arrowWidths?: ArrowWidths` (default `"byState"`) and its d3-graph effect calls `edgeWeights(graph.edges, arrowWidths)` where it calls `stateEdgeWeights` today; `arrowWidths` joins that effect's dependencies, so a change redraws. The plugin passes nothing. Tests: `edgeWeights` with `"equal"` gives 2 for a 1-of-4 and a 3-of-4 arrow, and with `"byState"` the same widths as `stateEdgeWeights` (fails if either branch is dropped).
- Tests (`graph-labels.test.ts`), expected values written out: A on "the cat the mat the"'s `the` (`cat` 50%, `mat` 50%); a loop labeled; C only with `highlightAllNextNodes`, none after the step chooses; D on `a b a c` (steps `a→b`, `b→a`, `a→c` full, `b`'s other arrows faded, nothing from the last state); a state repeated in the path with both its steps full; a step missing from the graph unlabeled; output taking precedence over a chosen state; and `percentOf(2, 3)` is 67. Each fails on deleting the branch it names.

---

### The bag of words in the shared graph

**Summary**: R11, R12's graph side, R14's graph side. With `orderMatters={false}`, `Graph` draws no transitions and places states without them; the overlay draws R11's arrows, to every state, from the chosen state, the generator's current state and the chosen output's states. Absent in the plugin.

**Files affected**:
- `src/components/graph-labels.ts`: `bagOutgoing`, and `bagArrows`, which of those arrows are drawn.
- `src/components/graph-overlay.ts`: the arrow layer.
- `src/components/graph.tsx` and `graph-highlight.ts`: the `orderMatters` prop; the d3-graph effect builds no edges or loops when it is `false`; `highlightSelected` fades no state or label then (every state follows the chosen one; it would otherwise fade by the chain's `graph.edges`, which `Graph` still receives).
- `src/components/graph-labels.test.ts`: `bagOutgoing`, labels over it, and `bagArrows`.
- `src/components/graph-overlay.test.ts`: `drawnBagArrows`, the arrows' widths and places.

**Estimated diff size**: ~200 lines

```ts
// src/components/graph-labels.ts
// a bag of words' arrows leaving a state: one to every state, itself included, weighted by that state's count; none
// from a state the graph doesn't have, such as a chosen output's state the input no longer holds
export const bagOutgoing = (nodes: Node[]): Outgoing => id => nodes.some(n => n.id === id)
  ? nodes.map(n => ({ from: id, to: n.id, value: n.value }))
  : [];
```

- `Graph` takes `orderMatters?: boolean`. When `false`, the d3-graph effect skips `graph.edges`, so `d3Graph.edges` is empty, no node `loops`, and the layout has no links; `orderMatters` joins that effect's dependencies, as `arrowWidths` does, since the switch changes nothing else it reads. With MARK-15's `keepPositions`, switching either way changes only edges, every state is placed and pinned, and no tick runs (R11's last sentence).
- `drawOverlay` with `orderMatters === false` draws `g.bag-arrows` below the nodes: for each arrow it needs, a `D3Edge` built from the two `D3Node`s and run through `calculateEdges` (MARK-15's `graph-geometry.ts`), width from `edgeWeights(bagOutgoing(nodes)(id), arrowWidths)`, loops from `nodeLoopPath`. Which arrows: the chosen state's (not animating; orange, `outgoingArrow` marker); while animating, the current state's when `highlightAllNextNodes` (pink, dashed), and `highlightEdge` (pink); a chosen output's steps (pink), each only when both its states are drawn, so a step from or to a state the input no longer has gets no arrow (R7). It never draws arrows into a chosen state. None has a click handler, so arrows can't be chosen, and they keep catching clicks, so a click on one does nothing rather than reaching the background and clearing the choice (R12); a loop has no fill, so only its line catches them. Labels use `bagOutgoing` as their `outgoing`, with `stepsOnly`, so a chosen output draws and labels only its steps (R7), a few arrows however many states there are.
- The arrows and labels rebuild on each highlight change: at 700 states a chosen state draws 700 arrows and, with probabilities on, 700 labels, against the 700 states and the chain's arrows the graph already draws. A chosen output draws and labels only its steps (`stepsOnly`, Self-Review, Performance Engineer).
- Tests: `bagOutgoing` over `the cat the mat the` gives `the` 60%, `cat` 20%, `mat` 20% from any state, itself included; labels over it for the chosen output `the cat the` with `stepsOnly` are exactly `the → cat` 20% and `cat → the` 60%, both full (fails if `stepsOnly` is ignored, which adds four faded labels); with the input changed to `the cat the mat the`, the output `dog the cat` labels only `the → cat` (fails without `bagOutgoing`'s check, which labels `dog → the` 60%).

---

### The drawing view in any layout

**Summary**: R18's tool list, toolbar zoom and toolbar state, R19, R21's and R24's drawing-view side. `Drawing` takes the tools to show, zooms from its toolbar when given the zoom tools, places a click from its SVG's position rather than the plugin's fixed offsets, passes the workspace's selection and following props to `Graph`, ignores keys and mouse moves while hidden, and its drag icon follows the pointer in any layout. The plugin passes none of the new props and keeps its positions, its toolbar and its corner zoom buttons.

**Files affected**:
- `src/components/drawing.tsx`: `tools` prop; toolbar zoom; `translateToGraphPoint` from the SVG's bounding box in place of its fixed `- 50` and `- 10`; passes `probabilityLabels`, `arrowWidths`, `selectedEdge`, `onEdgeSelect` and `onBackgroundClick` through to `Graph` (the last two only in the Select tool), and `onUserZoom` and `fitTransitionMs` too; `handleDimensionChange` keeps its identity; its Escape and rubber-band listeners ignore a hidden drawing; `closeEditorOnEscape`.
- `src/components/drawing.scss`: `.dragIcon` is `position: fixed`.
- `src/components/toolbar.tsx`: an optional `selectedTool`, which, when given, is the pressed tool in place of the toolbar's own state, and gives the drawing tools `aria-pressed`.
- `src/hooks/use-zoom-request.ts` (new): MARK-15's `GraphPane` zoom state, moved.
- `src/interactive/workspace/graph-pane.tsx`: uses the hook.
- `src/components/drawing.test.tsx` (new): the new props, with the graph mocked.

**Estimated diff size**: ~140 lines

```ts
// src/hooks/use-zoom-request.ts
// the toolbar's Zoom In and Zoom Out, as a request Graph acts on each time its id changes; onZoom hears each one
export const useZoomRequest = (onZoom?: () => void) => {
  const [zoomRequest, setZoomRequest] = useState<{ id: number, by: number }>();
  const zoom = useCallback((by: number) => {
    onZoom?.();
    setZoomRequest(request => ({ id: (request?.id ?? 0) + 1, by }));
  }, [onZoom]);
  const zoomIn = useCallback(() => zoom(zoomInStep), [zoom]);
  const zoomOut = useCallback(() => zoom(zoomOutStep), [zoom]);
  return { zoomRequest, zoomIn, zoomOut };
};
```

```ts
// src/components/drawing.tsx
interface Props {
  // ...its props as they are...
  // the toolbar's tools; absent, the CODAP plugin's list
  tools?: Tool[];
  probabilityLabels?: boolean;
  arrowWidths?: ArrowWidths;
  selectedEdge?: { from: string, to: string };
  onEdgeSelect?: (edge: { from: string, to: string }) => void;
  onBackgroundClick?: () => void;
  // the student's own zoom or pan, from the graph or the toolbar; absent in the plugin, which has no following
  onUserZoom?: () => void;
  fitTransitionMs?: number;
  // Escape closes an open state editor and does nothing else; absent in the plugin
  closeEditorOnEscape?: boolean;
}

const rootRef = useRef<HTMLDivElement | null>(null);
const translateToGraphPoint = (e: MouseEvent | React.MouseEvent<HTMLDivElement>): Point => {
  const svg = rootRef.current?.querySelector(".graph > svg")?.getBoundingClientRect();
  const { x, y, k } = transformRef.current ?? { x: 0, y: 0, k: 1 };
  return {
    x: ((e.clientX - (svg?.left ?? 0) - (widthRef.current / 2)) - x) / k,
    y: ((e.clientY - (svg?.top ?? 0) - (heightRef.current / 2)) - y) / k,
  };
};
```

- `drawing.tsx`'s module-level `tools` constant stays as it is and is the prop's default, so the plugin's toolbar is unchanged. It is not `allTools`, which MARK-15 extends with `zoomIn` and `zoomOut`.
- Zoom: `Drawing` calls `useZoomRequest(onUserZoom)`, passes `onZoomIn` and `onZoomOut` to `Toolbar`, and passes `zoomRequest`, `onUserZoom`, `fitTransitionMs` and `zoomButtons={!tools.includes("zoomIn")}` to `Graph`. A toolbar with the zoom tools replaces the corner buttons, as MARK-15's Data mode does, and in Draw mode a wheel, background-drag or toolbar zoom stops the view following the graph, so a later divider drag keeps the student's view (MARK-15's R13a and R29c). The plugin's list has no zoom tools and it passes no `onUserZoom` or `fitTransitionMs`, so it keeps its corner buttons and instant fits and never changes the request. `GraphPane` calls `useZoomRequest(onUserZoom)` in place of its own `zoomRequest` state and `zoom`, so a toolbar zoom still stops the view following the graph (MARK-15's R29c); `onUserZoom` is the workspace's stable callback, so the hook's functions keep their identity.
- In the plugin the SVG's top-left is exactly (50, 10), the offsets the old code subtracted (measured with throwaway code), so a click places a state where it did; MARK-11's click and drawing tests pass unchanged. `.drawing`'s root `div` takes `ref={rootRef}`.
- `.dragIcon`'s `position: fixed` matches `absolute` in the plugin, whose `#app` is absolutely positioned at the page's top-left; in the workspace it stays under the pointer inside positioned panes.
- `onEdgeSelect` and `onBackgroundClick` reach `Graph` only when `drawingMode === "select"`, so Delete and Add Transition keep their arrow clicks and Add State's click on the background adds a state without clearing the choice (R21). The plugin passes no `onBackgroundClick`, so its background clicks do what they do today.
- `handleDimensionChange` becomes a `useCallback` that reads `props.onDimensions` through a ref. As a plain function it is new on every render, and `Graph`'s size effect depends on it, so each render re-sends the last size; in the workspace that reaches the Graph pane's `onResized` as a measurement that never happened, which spends MARK-15's fit after a resize (R13a) before the graph has its new size. *(Checked with throwaway code: two renders of `Drawing` hand `Graph` two different `onDimensions`.)* The plugin's `onDimensions` only stores the size.
- The window Escape listener (back to Select, dropping a half-drawn transition) returns when `rootRef.current?.closest("[hidden]")`, so Escape in Data mode leaves the hidden drawing's tool as it was (R24); `Toolbar` keeps its own chosen tool, which the listener never resets, so the two would disagree. The plugin's drawing is never inside a hidden element. With a new `closeEditorOnEscape` prop, which only the Draw body passes, the listener closes an open state editor (`setSelectedNodeForModal(undefined)`) and does nothing else; the Draw body's document listener, which hears the key first, closes Reset's confirmation and stops the key there, and returns while its body holds a `.nodeModal`, so the chosen state stays chosen and no `SelectionCleared` is logged (R21). *(Checked with throwaway code: a window Escape turns a drawing inside a `hidden` element from Add State to Select.)* The window `mousemove` listener that draws a half-drawn transition's rubber band returns the same way: it `flushSync`s a new `rubberBand`, a dependency of `Graph`'s draw effect, so a transition started in Draw mode would otherwise redraw the hidden drawing on every mouse move in Data mode.
- `Toolbar` keeps its own pressed tool, which `Drawing`'s Escape (back to Select) never resets: in the plugin, after Add State and Escape, the toolbar still shows Add State pressed while clicks select, and pressing Add State again toggles it off, so it stays in Select (checked with throwaway Jest on `MarkovTool`). When given `tools`, `Drawing` passes `selectedTool={drawingMode}`, so in Draw mode the toolbar shows the tool in use and one press of Add State after Escape chooses it; the toggle buttons' `aria-pressed` tells a screen reader which tool that is, where today only the button's color does. The plugin passes no `tools`, so its toolbar is unchanged (R30).
- MARK-15's Cypress test of the toolbar's zoom buttons covers the moved hook in Data mode; Draw mode's is in the modes step.

---

### Draw mode's state editor: unique names, and input without a mouse

**Summary**: R18's names and editor. The drawing view's state names stay unique and its state editor takes keys, touch and pen, each behind a prop only Draw mode passes, so the plugin's names and editor are unchanged (R30).

**Files affected**:
- `src/components/drawing/state-labels.ts` (new) and `state-labels.test.ts`: `nextStateLabel`, `labelProblem`.
- `src/components/drawing.tsx`: the `uniqueLabels` and `accessibleEditor` props, used by `addNode` and passed to `NodeModal`.
- `src/components/drawing/node-modal.tsx`: with `uniqueLabels`, shows `labelProblem`'s message and disables Save while there is one; with `accessibleEditor`, names the label field and passes `accessible` to the slider.
- `src/components/drawing/probability-selector.tsx` and `probability-selector.test.tsx` (new): with `accessible`, the thumbs are keyboard and pointer sliders.
- `src/components/drawing/probability-selector.scss`: a focused thumb's ring and `touch-action`, with `accessible`.
- `src/components/markov-panel.scss`: the editor's problem message.
- `src/components/drawing.test.tsx` and `src/components/drawing/node-modal.test.tsx`: the new props.

**Estimated diff size**: ~230 lines, about 110 of them tests

```ts
// src/components/drawing.tsx, in Props
  // every state's label is its own: new states skip names in use, and the editor refuses an empty or taken one
  uniqueLabels?: boolean;
  // the state editor's slider takes keys, touch and pen, and its fields are named; absent in the plugin
  accessibleEditor?: boolean;

// src/components/drawing/state-labels.ts
import { Node } from "../../type";

// the first "State n", counting from one past the number of states, that no state has
export const nextStateLabel = (labels: string[], from = labels.length + 1) => {
  let n = from;
  while (labels.includes(`State ${n}`)) n++;
  return `State ${n}`;
};
// why a state's new label can't be saved, if it can't
export const labelProblem = (label: string, id: string, nodes: Node[]) =>
  label.trim() === "" ? "Give the state a name."
    : nodes.some(node => node.id !== id && node.label === label.trim())
      ? `Another state is already named "${label.trim()}".` : undefined;
```

- Names (R18): with `uniqueLabels`, `addNode` labels a new state `nextStateLabel(graph.nodes.map(n => n.label))`, and `Drawing` passes `uniqueLabels` to `NodeModal`, which renders `labelProblem(label, node.id, graph.nodes)` under the label field (`role="alert"`) and disables Save while it returns a message. Without the prop both behave as today, so the plugin's names stay `State ${count + 1}`. Tests: `nextStateLabel(["State 1", "State 3"])` is "State 4" and `nextStateLabel(["State 1"])` "State 2" (fails if it counts without skipping, which gives "State 3" twice); `labelProblem` for `"  "`, for another state's label, for the state's own label (none) and for a new one (none).
- The editor without a mouse (R18): with `accessibleEditor`, `NodeModal` gives the label field `aria-label="State name"`, passes `accessible` to `ProbabilitySelector`, and holds the last share at 0 or above, since rounding could leave a share a key took to nothing just below it. Its thumb `index` sits between segments `index` and `index + 1` and moves both, so it renders with `role="slider"`, `tabIndex={0}`, `aria-label` "Probability of" segment `index`'s state, `aria-valuemin` 0, `aria-valuemax` the pair's rounded sum, `aria-valuenow` segment `index`'s rounded percent and `aria-valuetext` "40%", and a visible focus ring. Keys go through the selector, not the thumb's pixel math: `stepThumb(index, delta)` adds `delta` (1 for Right and Up, -1 for Left and Down, 10 or -10 with Shift) to segment `index`, clamps it to the pair's total so neither segment goes below 0, and takes the rest from segment `index + 1`, in percentages rather than through `movePairedPercentage`'s probability, whose rounding could put a segment just below 0 at the pair's end, so a key moves exactly 1% from one segment to the other. A thumb past `reversePercent` renders in the reversed list and so remounts, so a stepped thumb takes focus again after the step, and the drag uses `onPointerDown` with `setPointerCapture?.(e.pointerId)` (jsdom has none) and `pointermove`, `pointerup` and `pointercancel` on the window, where a pointer's events bubble whether or not the capture survives, with `touch-action: none` on the SVG, so a finger or pen drags as a mouse does; its pixel math is today's. With the flag the reversed list is a copy: the plugin's `offsets.reverse()` reverses the memoized list in place, which swaps the thumbs on a render that doesn't rebuild it, as typing in the name field does. Without the flag the thumbs are today's circles with `onMouseDown`. Tests (`probability-selector.test.tsx`, React Testing Library): with `accessible`, ArrowRight on the thumb of a 50/50 state makes the selector's `onChange` receive 51 and 49, Shift+ArrowRight 60 and 40, and Shift+ArrowRight at 95/5 100 and 0 (fails without the clamp, which gives 105 and -5); the thumb reports `aria-valuenow` 50; a pointer down, a 20 px move and up calls `onChange` (fails if the handlers stay mouse-only); without `accessible`, no thumb has a role.
- Draw mode's Cypress tests of both are in the modes step, which builds Draw mode.

---

### Inspect for Draw mode and the bag of words

**Summary**: R13, R20. Inspect's columns depend on the mode, and the Transitions tab shows the bag of words' explanation.

**Files affected**:
- `src/interactive/workspace/inspect-rows.ts`: `inspectColumns`, `bagOfWordsExplanation`.
- `src/interactive/workspace/inspect-rows.test.ts` and `inspect-pane.test.tsx` (new): tests.
- `src/interactive/workspace/inspect-pane.tsx`: renders the columns given, or the explanation.
- `src/interactive/workspace/workspace.scss`: the explanation's margin.
- `src/interactive/workspace/workspace.tsx`: MARK-15's `InspectPane` call passes `mode="useData"` and `orderMatters`, `true` until the switch step passes its state, so the step compiles.

**Estimated diff size**: ~120 lines

```ts
// src/interactive/workspace/inspect-rows.ts
export const bagOfWordsExplanation = "All states are connected to all other states. " +
  "States that appear multiple times in the input data have higher probabilities of being selected.";

// a drawing's values are weights, not counts, so it shows no counts and a bare percent
export const inspectColumns = (mode: ModeId) => mode === "draw"
  ? { states: ["state"], transitions: ["transition", "probability"], probability: "percent" } as const
  : { states: ["state", "count"], transitions: ["transition", "count", "probability"], probability: "ofTotal" } as const;
```

- `InspectPane` takes `mode` and `orderMatters`; with `orderMatters === false` the Transitions tabpanel holds a `p` with `bagOfWordsExplanation` in place of the table, and the tab, its sort state and the tablist are unchanged (R13). Draw mode's probability cell is `${row.percent}%`; Data mode's stays `row.probability` ("2 of 3 = 67%").
- Sorting by probability compares `count / outOf`, which is the weight's share for a drawing, and 0 for a transition whose state's weights total 0, which a drawing can reach and Data mode's counts can't.
- Tests: Draw-mode columns for a two-transition drawing with weights 0.25 and 0.75 (25%, 75%, no count); Data mode unchanged; the explanation's exact text.

---

### The pane layout as a shared hook

**Summary**: R24's layout side, ahead of the modes. `DataWorkspace`'s row layout moves into a hook that Draw mode's body will call too, with no change in what the workspace does.

**Files affected**:
- `src/interactive/workspace/use-pane-layout.tsx` (new): the hook.
- `src/interactive/workspace/workspace.tsx`: `DataWorkspace` calls it in place of its own state and handlers.

**Estimated diff size**: ~220 lines, nearly all moved

- `usePaneLayout(config, host, tool, stacked)` (the modes step adds `hidden`) holds what `DataWorkspace` holds for the row (which panes are open, `paneSizes`, the generator's controls column, the resize refs, `fitPaneSizes` from the row's measured width, the dividers, the fit after a resize, and `followRef`) and returns `top`, the dividers, `paneStyle`, `togglePane` and the following callbacks (`handleFit`, `handleUserZoom`, `handleGraphResized`). `DataWorkspace` keeps `inputSplit`, which only it has, and still measures `stacked` itself until the modes step moves that to the shell.
- No test changes: MARK-15's `pane-sizes.test.ts` covers the numbers and its Cypress divider, collapse and following tests cover the behavior, so the step is checked by both passing as they are.

---

### The workspace's modes and Draw mode

**Summary**: R17 to R21, R23 to R26, R27's `ModeSwitched`, R28, R29's `TextToGraph`. The workspace becomes a shell that holds the mode and one host and tool per mode, with MARK-15's `DataWorkspace` as its Data body and a Draw body beside it; each mode's host logs its mode.

**Files affected**:
- `src/interactive/workspace/ap-host.ts`: `useApHost(hosted, mode, orderMatters)`.
- `src/interactive/workspace/workspace.tsx`: the shell (mode state, both hosts and tools, the width measurement and `stacked`).
- `src/interactive/workspace/data-workspace.tsx` (new): MARK-15's `DataWorkspace`, moved out of `workspace.tsx`, taking its host, tool, `stacked` and the shell's controls as props.
- `src/interactive/workspace/draw-workspace.tsx` (new): the Draw body.
- `src/interactive/workspace/mode-switch.tsx` (new).
- `src/interactive/workspace/controls-row.tsx`, `workspace-panes.tsx` and `use-mode-body.ts` (new): what both bodies share, moved from `DataWorkspace`: the row with Clear highlight and its focus handling, the panes' layout, and the Escape listener, the silent clear of a selection a change took out of the graph, and the scroll to what a choice lights up.
- `src/interactive/workspace/use-pane-layout.tsx`: a `hidden` argument, for the fit on showing a mode.
- `src/interactive/workspace/arrow-markers.tsx` (new) and `src/components/graph-highlight.ts`, `graph-draw.ts`: the arrowheads as one list both draw from. Each `Graph` defines them with the same ids, and `url(#arrow)` finds the first in the document, which in a hidden body draws nothing, so the shell renders one set ahead of the bodies; the plugin keeps its ids.
- `src/components/graph.tsx` and `drawing.tsx`: `keepOutputOnRedraw`, which `Drawing` passes when given `tools`: a tool press redraws the graph, and only the highlight effect draws a chosen output, so without it the output's fading and path go while it stays chosen (R21). The plugin's toolbar clears the output, so it never needs this.
- `src/components/speed-toggle.tsx`: its id from `useId`, since a fixed id binds Draw mode's label to Data mode's checkbox.
- `src/components/graph.tsx`: with `onUserZoom`, a fit with a measured size and nothing to fit goes, rather than waiting for the next size change, where it would override a view the student chose (R24, MARK-15's R29c): showing an empty drawing and Reset both ask for one. `onUserZoom` also gives the drawing tools the Select tool's click tolerance, so a press that moves a pixel still clicks. The plugin passes no `onUserZoom`, so it is unchanged.
- `src/interactive/workspace/workspace-config.ts`: `DataWorkspaceConfig` and an overload, `workspaceConfig(state, "useData")` returning it, so the shell hands `DataWorkspace` its narrowed configuration without the `config.mode` check MARK-15's `Workspace` narrows with. `mode` becomes required, since the shell always names it, so its default goes; `workspace-config.test.ts` reads the starting mode through a helper.
- `src/interactive/standalone.test.tsx`: mocks `nanoid`, which the workspace now loads through `Drawing`.
- `src/interactive/workspace/graph-pane.tsx`: a `draw` variant that renders `Drawing`.
- `src/interactive/workspace/pane.tsx`: a `collapsible` prop, default `true`; `false` renders the header without its button (MARK-15's R12).
- `src/interactive/workspace/pane-sizes.ts` and `pane-sizes.test.ts`: `toolbarHeight` and `toolbarColumns` for any number of columns, and `toolbarWidth`.
- `src/interactive/workspace/workspace.scss`: the toolbar grid's column count from `--toolbar-columns`; Draw mode's state editor over the whole interactive.
- `src/components/log-events.ts`, `LOGGED-EVENTS.md`: `ModeSwitched`; the line that every event carries `mode`; `TextToGraph` deleted.
- `src/components/drawing.tsx`: `handleTextChange`'s `TextToGraph` call deleted.
- `src/components/views.test.tsx`: "logs Create From Text only when its words change" deleted; it asserts the `TextToGraph` calls.
- `cypress/e2e/interactive-workspace.test.ts`: Draw mode and switching tests; MARK-15's `start` helper defaults `modes` to Data mode alone; MARK-15's "stacks the panes below 700 px" test, which calls `cy.startInteractive` itself, passes Data mode alone too; MARK-15's expected log data gains `mode: "useData"`.
- `cypress/e2e/interactive-runtime.test.ts`: "shows the default workspace for an interactive never authored" lists only shown panes.

**Estimated diff size**: ~400 lines, beside `DataWorkspace`'s move to its own file

```ts
// src/interactive/workspace/ap-host.ts
// One host per mode: Data mode is the core's dataset view, Draw mode its drawing view. Its functions keep their
// identity when "Order matters" changes, as MARK-14's MarkovHost requires.
export const useApHost = (hosted: boolean, mode: ModeId, orderMatters?: boolean): MarkovHost => {
  const functions = useMemo(() => ({
    setViewMode: noop,
    markDirty: noop,
    outputSequence: resolved,
    log: hosted ? (event: LogEvent, data?: Record<string, unknown>) => log(event, { ...data, mode }) : noop,
  }), [hosted, mode]);
  return useMemo(() => ({
    ...functions, viewMode: mode === "draw" ? "drawing" : "dataset", orderMatters,
  }), [functions, mode, orderMatters]);
};
```

```tsx
// src/interactive/workspace/workspace.tsx, the shell
const [mode, setMode] = useState<ModeId>(authoredState.startingMode);
const [configs] = useState(() => ({
  useData: workspaceConfig(authoredState, "useData"), draw: workspaceConfig(authoredState, "draw"),
}));
const hosts = { useData: useApHost(hosted, "useData"), draw: useApHost(hosted, "draw") };
const tools = { useData: useMarkovTool(hosts.useData), draw: useMarkovTool(hosts.draw) };
const tool = tools[mode];
// ...
{ authoredState.modes.useData && <DataWorkspace hidden={mode !== "useData"} host={hosts.useData}
    tool={tools.useData} config={configs.useData} stacked={stacked} controls={modeControls} ... /> }
{ authoredState.modes.draw && <DrawWorkspace hidden={mode !== "draw"} host={hosts.draw}
    tool={tools.draw} config={configs.draw} stacked={stacked} controls={modeControls} ... /> }
```

- The Data host gets no `orderMatters` here, so order matters, as in MARK-15; the next step adds the switch's state and passes it.
- Both hooks are called on every render, whatever modes are available: hooks can't be conditional, and an unused tool is an empty graph that never runs. Each body is rendered only when its mode is available, and the inactive one has `hidden` and stays mounted, so its graph positions, panes, Inspect state and following survive (R24). On showing a hidden body, its Graph pane fits and the view follows the graph again, as MARK-15's `togglePane` does for a reopened Graph pane: `usePaneLayout` takes `hidden` for that.
- `.controls-row` stays in each body, as MARK-15 renders it in `DataWorkspace`, so the case switch, its label and Clear highlight keep their places and act on that body's tool; the hidden body's row is hidden with it. Each row starts with the shell's `modeControls`. Escape stays each body's document listener, which returns at once while the body is `hidden`, so only the shown mode's dialog closes or choice clears; the Draw body's also returns while the body holds a `.nodeModal`, leaving the key to `Drawing`'s `closeEditorOnEscape` (R21). `ModeSwitch` shows when `configs.useData.modeSwitch`: a `fieldset` with a visually hidden `legend` ("Mode") and two `input type="radio"` labeled from MARK-13's `modeLabels` ("Data", "Draw"), their `name` from `useId`, so the two bodies' copies are separate groups, `disabled` while `tool.animating` (R25). A change sets `mode` and logs `ModeSwitched` with `{ mode }` through the new mode's host. When the switch had focus, the shown body's checked radio takes it after the switch: an arrow key on a radio hides the body holding it, and Chrome then moves focus to the page's body (checked headless with throwaway markup), leaving a keyboard user nowhere.
- Layout: each body calls the previous step's `usePaneLayout`, so a divider, a collapse or a zoom in one mode leaves the other's as it was (R24). The shell measures the workspace's width once for `stacked`, shared by both modes; each body measures its own row for `fitPaneSizes`, so a hidden body's zero width changes only what it renders, never the stored sizes, and its next measurement on showing refits it. Every number comes from `pane-sizes.ts`.
- `DataWorkspace` is MARK-15's body with `host`, `tool`, `config` and `stacked` as props instead of its own `useApHost`, `useMarkovTool` and width measurement, and the pane logic from the hook; its input, tokens, commits, case switch, highlights, presses and state dialog stay as they are. MARK-15's mount effect stays too, still depending on `[tool.handle, firstValues]` and still running once: each tool's handle keeps its identity for the hook's lifetime (MARK-14's R1a), including when the Data host is rebuilt for a new `orderMatters` (the handle depends only on `onSetGraph` and `updateGraph`, which read no host field), and the body stays mounted while hidden, so `firstValues` is never recomputed. Nothing in this plan calls the Draw tool's handle: the drawing starts empty.
- `DrawWorkspace` renders `.controls-row` (the shell's controls and Clear highlight) and the panes `configs.draw` gives (Graph, then Inspect and the generator as authored), through `usePaneLayout`: `GraphPane` with `variant="draw"`, in a `Pane` with `collapsible={false}` (R17), renders `Drawing` with `tools={drawModeTools}` (R18: `["select", "addNode", "addEdge", "delete", "fitView", "recenter", "zoomIn", "zoomOut", "reset"]`, a constant in `draw-workspace.tsx`), the tool's `graphHighlights` and `view` handlers (Reset is `view.onReset`, since R18 keeps Reset), MARK-15's module-level `noop` for `onReturnToMainMenu` (as MARK-15's Data-mode `Toolbar` passes it: R18 drops `home`, so the core's handler would wire a dialog no button opens), `GraphPane`'s own `setSelectedNodeId`, `handleEdgeSelect`, `handleBackgroundClick` and `handleDimensions` (which read the tool through a ref and keep their identity), no `onClearHighlightOutput` (the plugin's `Drawing` calls it on every toolbar press, Fit View and Zoom In included, clearing a chosen output unlogged while a chosen state stays; Data mode's toolbar keeps the choice, and R21 clears it only by Escape, the background or Clear highlight), `selectedEdge`, the layout's `onUserZoom`, `fitTransitionMs={250}`, `closeEditorOnEscape`, `uniqueLabels`, `accessibleEditor` and the Draw host's `log`; `InspectPane` with `mode="draw"`; MARK-15's `GeneratorPane`. A callback rebuilt on each render must not reach `Drawing`'s `Graph`: `onEdgeSelect` is a dependency of its draw effect, which redraws from scratch, and only the highlight effect fades a chosen output's other arrows, so any render would drop that fading. *(Checked with throwaway code against `graph.tsx`: a rerender with a new `onEdgeSelect` redraws once and doesn't run `unhighlightNonOutput`.)* The body also renders `tool.view.confirmModal` with `ConfirmModal`, as `MarkovTool` does: Reset only sets that state, and nothing else in the interactive renders it. `Drawing` renders its own state editor (`NodeModal`), whose background and box are `position: absolute` (`markov-node-modal`), so inside the Graph pane they cover only `.pane-body`, the nearest positioned ancestor, leaving Inspect, the generator and the mode switch clickable behind an open editor; `workspace.scss` makes `.drawing .nodeModalBackground` and `.drawing .nodeModal` `position: fixed` inside the workspace, so the editor covers the interactive as Data mode's dialog does (R18). Highlights in Draw mode come from MARK-15's `highlightsFor(tool.selection, [])`, with no tokens. A state deleted while chosen clears silently, and a choice scrolls Inspect to its row, through the same shared hooks Data mode uses.
- The Draw host's `viewMode: "drawing"` makes the core call `markDirty` on each drawing change, which does nothing here (MARK-17 saves the drawing).
- Toolbar columns (R18): `toolbarHeight(tools, columns = 1)` takes any column count in place of `1 | 2`, `toolbarWidth(columns)` is `columns * toolbarButton + (columns - 1) * toolbarGap + 2 * toolbarPadding` (112 for three; the next step's notes start past it), and

```ts
// the fewest columns whose toolbar fits the Graph pane's body
export const toolbarColumns = (tools: number, bodyHeight: number) => {
  let columns = 1;
  while (columns < tools && toolbarHeight(tools, columns) > bodyHeight) columns++;
  return columns;
};
```

  `GraphPane` sets `--toolbar-columns` on `.graph-pane-content`, and a `columns` class when it is above 1, in place of MARK-15's `two-columns` class; the grid rule becomes `repeat(var(--toolbar-columns), var(--toolbar-button))`, with MARK-15's `display: contents` on the groups unchanged. The height argument stays MARK-15's `graphBodyHeight(top)`, with `top` the drawn row height the body passes (`drawnRowHeight(sizes.top, stacked)`), so Draw mode's stacked toolbar is fitted to the starting row, as Data mode's is. `pane-sizes.test.ts` keeps MARK-15's five-tool cases (one column at a 222 px row, two at 221) and adds, values written out: `toolbarHeight(9)` 328, `toolbarHeight(9, 2)` 184, `toolbarHeight(9, 3)` 112; `toolbarColumns(9, graphBodyHeight(315))` 2, `toolbarColumns(9, graphBodyHeight(222))` 2, `toolbarColumns(9, graphBodyHeight(221))` 3, `toolbarColumns(9, graphBodyHeight(200))` 3 (fails if the count stops at 2, or the comparison is strict), and stacked with a stored 200 px row, `toolbarColumns(9, graphBodyHeight(drawnRowHeight(200, true)))` 2 (3 if the stored height were used).
- `TextToGraph` (R29): its entry in `logEvents`, its row in `LOGGED-EVENTS.md` and `drawing.tsx`'s `handleTextChange` call go together, so MARK-15's list test still passes, and the Jest test of the call in `views.test.tsx` is deleted with it, since it asserts the two `TextToGraph` calls; Create From Text in the plugin is otherwise unchanged.
- MARK-15's Cypress `start` helper passes `modes: { useData: true, draw: false }` unless the test gives `modes`: `defaultAuthoredState` offers both modes, and the hidden Draw body would duplicate what MARK-15's tests click (its Inspect tabs, `Collapse Inspect`), where `click` refuses two elements. MARK-16's tests pass `modes`. Two MARK-15 tests start the default authored state without the helper: "stacks the panes below 700 px" clicks `Collapse Inspect`, which the hidden Draw body duplicates, so it passes `modes: { useData: true, draw: false }`; and `interactive-runtime.test.ts`'s "shows the default workspace for an interactive never authored" reads every pane title with `querySelectorAll`, hidden ones included, so its `panes()` reads `section.pane:visible` and the list stays Data mode's four.
- R28's `mode` changes the data of every logged event, and chai's `deep.include` and `deep.equal` compare the whole data object (checked with throwaway code: `["StateSelected", { state, source }]` no longer matches a message carrying `mode`, nor `["TableRowAdded", undefined]` one carrying `{ mode }`). So each of MARK-15's expected log messages in `interactive-workspace.test.ts` (with `resized()` and `commits()`, which compare the data too) gains `mode: "useData"`, and those expecting no data expect `{ mode: "useData" }`; `loggedEvents()` still returns the data as sent, so the tests also guard R28.
- Cypress, each naming what it guards: with both modes, the switch shows and starts on the authored mode, and is absent with one mode; switching with an arrow key leaves focus on the shown body's checked radio; Draw mode adds a state where clicked (the click's point is inside the new ellipse), adds a transition, opens the state editor on a double-click, whose background covers the generator's Play (an `elementFromPoint` at Play's center is the background; fails without the `position: fixed` rule), and moving its slider and saving changes the transition's Inspect probability and its probability label; Escape with the editor open closes it, the state still chosen and no `SelectionCleared` logged (fails without `closeEditorOnEscape` or the body's check); adding three states, deleting State 2 and adding one gives "State 1", "State 3", "State 4"; the editor's Save is disabled with a message for an empty name and for "State 1" on another state; in the editor, Tab reaches a slider thumb, ArrowRight and Save raise that transition's Inspect probability by 1%, and a touch drag (`pointerType: "touch"`) moves the thumb; Reset asks for confirmation and, on OK, clears the drawing and Draw mode's outputs while Data mode's outputs stay (fails if the body doesn't render `confirmModal`); a chosen output's other arrows stay faded after a tool press (fails without `keepOutputOnRedraw`; the state-editor tests fail with an inline `onEdgeSelect`), and it stays chosen after Zoom In and Fit View (fails if `onClearHighlightOutput` is passed); a click on the drawing's background in the Select tool clears a chosen state; Escape in Data mode leaves Draw mode's Add State tool chosen; in Draw mode, Escape with Add State chosen leaves Select with `aria-pressed="true"` and Add State `false`, and a press of Add State then adds a state where the graph is clicked (fails without `selectedTool`); zooming the drawing with the wheel and then dragging a divider leaves its scale; Draw mode's Graph pane has no collapse button; on the fake page at width 1044, Draw mode's toolbar shows exactly nine buttons, none titled "Create From Text", at two distinct left edges, and with the row divider dragged to `minPaneSizes.top`, at three, all inside the Graph pane's body (fails with the count capped at 2, or the grid's column count fixed); the toolbar's Zoom In changes the drawing's scale, and the graph has no corner zoom buttons; dragging the Graph|Inspect divider in Data mode, switching to Draw and back, leaves Draw's sizes at their defaults and Data's as dragged; typing in Data mode, drawing in Draw mode, generating an output and choosing a state in each, then switching both ways twice, leaves each mode's input, states, output and chosen state as they were; the switch is disabled while playing; a log message from each mode carries its `mode`.

---

### The probabilities toggle and the "Order matters" switch

**Summary**: R1, R2, R3a, R5's workspace side, R9, R9a, R10a, R12 to R16, R22, R27's two toggles. The two controls, wired to the graph, the host, Inspect, the generator and the table, with the read-only label and the Graph pane's notes.

**Files affected**:
- `src/interactive/workspace/workspace.tsx`: `probabilities` and `orderMatters` state, from the configuration's starting values.
- `src/interactive/workspace/probabilities-toggle.tsx` (new).
- `src/interactive/workspace/workspace.scss`: the switch group.
- `src/interactive/workspace/graph-notes.ts` (new) and `graph-notes.test.ts`: which notes apply.
- `src/interactive/input/table-edits.ts` and its test: `insertRow`'s list layout.
- `src/interactive/workspace/input-pane.tsx`: `switches` in place of `caseSwitch`; passes the layout to the table's edits.
- `src/interactive/workspace/data-workspace.tsx`, `draw-workspace.tsx`, `graph-pane.tsx`: pass `probabilityLabels` and, in Data mode, `orderMatters`; Data mode's Graph pane passes no `onEdgeSelect` and opens no state dialog with order off.
- `src/interactive/workspace/inspect-pane.tsx` callers: `orderMatters`.
- `src/components/log-events.ts`, `LOGGED-EVENTS.md`: `ProbabilitiesToggled`, `OrderMattersToggled`.
- `cypress/e2e/interactive-workspace.test.ts`: the tests below; MARK-15's "Case sensitive" tests find their switch and label by name.

**Estimated diff size**: ~380 lines, about 120 of them tests

- `probabilities` is one `useState` in the shell (`configs.useData.probabilities.startsOn`; the two configurations carry the same value), passed to both bodies (R2). `ProbabilitiesToggle` renders when `configs[mode].probabilities.showToggle`, the current mode's (R1, MARK-15's R10: Data mode without a Graph pane hides it, Draw mode always has one): a `button` with `aria-pressed`, "Show probabilities", logging `ProbabilitiesToggled` with `{ on }` through the current mode's host. It is the second of the shell's `modeControls`, after the mode switch, so it starts both bodies' `.controls-row` (mockup question 13).
- `orderMatters` is one `useState` in the shell (`configs.useData.orderMatters.startsOn`), passed as `useApHost`'s third argument for Data mode. With `orderMatters.showSwitch`, Data mode renders MARK-15's `SettingSwitch` with `label="Order matters"`, `value={orderMatters}`, `disabled` while `tools.useData.animating` (R16), and an `onChange` that logs `OrderMattersToggled` with `{ on }`; it adds no switch of its own, so its `role="switch"`, `aria-checked` and Yes or No come from that component (R9, follow-up C). With `showSwitch` off, Data mode's `.controls-row` renders `SettingLabel` with `label="Order matters"` in its place, reading "Order matters: Yes" or "Order matters: No" (R9a, follow-up B).
- Placement beside "Case sensitive" (R9): `InputPane`'s `caseSwitch` prop becomes `switches`, which it renders in a `div.setting-switches` at the top of its body, where MARK-15 renders the case switch alone: the "Order matters" switch and then the "Case sensitive" switch, whichever are shown, and `workspace.scss`'s `align-self: flex-start` for `.input-pane-content > .setting-switch` moves to the group; with no Input pane `.controls-row` renders the same group, and its labels sit together in the same order. `workspace.scss` gives the group `display: flex; flex-wrap: wrap; gap: 4px 12px`. MARK-15's `SettingSwitch` wraps its own name, so at the Input pane's 160 px minimum each switch takes its own line and stays inside the pane, and MARK-15's `.controls-row` wraps where the row doesn't fit. Widths as built: the two switches together 331 px, and the row's widest case about 680 px without MARK-18's buttons.
- Arrow widths (R5): the shell holds `const arrowWidths: ArrowWidths = "byState";` with the comment `// arrows keep their probability widths whether or not probabilities are shown (mockup question 20)`, and both bodies pass it to their graph; equal widths while probabilities are off would be `probabilities ? "byState" : "equal"`.
- Notes (R3a):

```ts
// src/interactive/workspace/graph-notes.ts
export const roundingNote = "Percents are rounded, so they may not add up to 100%";
export const outgoingOnlyNote = "Only arrows out of the chosen word are drawn";

// the notes along the bottom of the Graph pane, each only while it applies
// a chosen state stays chosen while a sequence plays, but its arrows give way to the generator's then
export const graphNotes = (s: {
  probabilities: boolean, orderMatters: boolean, stateChosen: boolean, animating: boolean
}) => [
  ...(s.probabilities ? [roundingNote] : []),
  ...(!s.orderMatters && s.stateChosen && !s.animating ? [outgoingOnlyNote] : []),
];
```

  `GraphPane` renders the result in a `div.graph-notes` with `aria-live="polite"` and `pointer-events: none`, absolutely positioned at the bottom of the body, its left edge past the toolbar's columns (`toolbarWidth(columns)`, beside `toolbarHeight` in `pane-sizes.ts`, plus `paneGap`), one `p` per note on a light translucent background, wrapping in a narrow pane. `stateChosen` is `tool.selection?.kind === "state"` and `animating` is `tool.animating`; Draw mode passes `orderMatters: true`. Tests: each note alone, both together, none, and no outgoing-only note while animating with a state chosen (fails if any condition is dropped or inverted).
- The table's list layout (R10a): `insertRow` gains `layout: "prose" | "list" = "prose"`; with `"list"` it inserts `"\n" + text` for every token, punctuation included, and after a break row `text + "\n"`. `deleteRow` is unchanged, so deleting the first listed word leaves the line break after it, as MARK-15's test pins; a leading line break changes no row or state. Otherwise MARK-15's already deletes a word alone on its line with the line break after it (its test "deletes a word alone on its line without making a blank line"), and a rule removing the line break before the word would join a blank line's break to the next word (MARK-15's "keeps a blank line beside a deleted word" fails). `InputPane` passes `"list"` while Data mode's `orderMatters` is false. Tests: appending `dog` and then `cat` to "the" in list layout gives "the\ndog\ncat", whose rows are `the`, `dog`, `cat` with no break (fails if the layout is ignored); inserting `dog` after row 0 of "the cat" gives "the\ndog cat"; prose layout unchanged. The Cypress test deletes a listed word and checks no blank line is left, R10a's guard against a later change to `deleteRow`.
- Turning order off with a transition chosen (`tool.selection?.kind === "transition"`) clears it with `tool.setSelectedNodeId()`, the non-logging clear `DataWorkspace`'s dropped-selection effect uses, so no `SelectionCleared` is logged (R12). It is called only for a transition, since it also clears a chosen output, which R12 keeps.
- The Data host's new `orderMatters` reaches the hook as a new host object with the same functions, so no animation callback is rebuilt; the switch is disabled while one runs anyway.
- MARK-15's "Case sensitive" Cypress tests find the switch, its `.setting-switch` and its `.setting-label` by the name "Case sensitive": `orderMatters.showSwitch` defaults to on, so "Order matters" shows in those tests and comes first, and `.setting-switch [role='switch']` would match both (`click` refuses two elements, and the wrap test's `setting[0]` would measure "Order matters").
- Cypress, each naming what it guards: probabilities on, choosing `the` in "the cat the mat" shows `50%` twice on its arrows, and off shows none; during Step's first half the candidate lines are labeled, and after the second none are; a chosen output's path labels at full strength and others faded, a faded label's computed `fill` `rgb(118, 118, 118)` with opacity 1 (fails if it takes the arrows' 0.35); the toggle absent and labels fixed on when authored so; with Data mode's Graph pane off, the toggle absent in Data mode and present after switching to Draw; the rounding note present only with probabilities on, and the outgoing-only note only with order off and a state chosen; "Order matters" off shows no arrow until `the` is chosen, then three (to `cat`, to `mat`, and a loop on `the`), with none into it, Inspect Transitions shows the explanation, and Play from `a` on "a b" gives five states in a group headed "Orderless"; a word added in the table with order off appears in the text on its own line, and deleting a listed word leaves no blank line; turning it back on restores the Transitions table with its sort; with a transition chosen, turning order off clears it and logs `OrderMattersToggled` with no `SelectionCleared`, and with an output chosen, the output stays chosen (fails if the clear runs for an output too) (R12); the switch disabled while playing (R16); the switch absent in Draw mode; the switch reading "Yes" and, once switched, "No"; with the switch hidden, "Order matters: No" in `.controls-row` for an author's order off, and "Order matters: Yes" for on; with the Input divider dragged to the pane's 160 px minimum, both switches' boxes inside the Input pane's body (fails without MARK-15's name wrapping) and "Order matters" above "Case sensitive"; with no Input pane, both switches in `.controls-row`, "Order matters" first; with no Input pane, a state chosen and the page at `width: 700`, the row's widest MARK-16 case (both switches, Clear highlight, the toggle and the mode switch, about 680 px as built) stays inside the workspace's width, and narrowed to 500 px the switch group goes onto a second line, which fails without MARK-15's `flex-wrap: wrap` on `.controls-row`. `ProbabilitiesToggled` and `OrderMattersToggled` logged with `on` and `mode`.

## Verification

Run on the head commit, Node 24, all headless:

- The build, all three lints and both `tsc` checks clean (R34).
- Jest: every existing test passes, apart from R30's exceptions (the deleted `TextToGraph` test and the two hook tests whose expected settings gain `orderMatters`) and two changes to MARK-15's interactive tests (`workspace-config.test.ts` names the mode, and `standalone.test.tsx` mocks `nanoid`), with MARK-15's hook test extended; the new pure-module tests. Cypress: the plugin's specs pass unchanged in Chrome and Electron (R30); MARK-15's workspace and runtime specs pass with the changes this plan gives them (the `start` helper's Data-only default, the two tests that start without it, the expected logs' `mode`, and the case-switch selectors by name), plus the new workspace tests.
- R34's CODAP check: MARK-12's R11 list in CODAP 3.1.2, against the branch build, recorded in the PR.
- R33a's timing, recorded in the PR (not asserted): with MARK-15's 20,000-character text and "Order matters" off, choosing a state with probabilities on draws its arrows and labels; measure the time from the click to the drawn arrows in headless Chrome.
- Mutation checks for each new test: delete the line it guards and confirm it fails.

## Open Questions

### RESOLVED: Judgment call: where are labels and bag arrows drawn?
**Options considered**:
- A) An overlay layer rebuilt by the highlight effect and moved by `tick`.
- B) Drawn with the graph in `drawGraph`, one hidden label per arrow, shown by the highlight passes.

**Decision**: A. B can't hold a bag of words' arrows, which exist only for the chosen state, and would add a label per arrow (about 2,000 at MARK-15's largest input) to every redraw. A was prototyped and follows a drag.

### RESOLVED: Judgment call: how do the shell and the bodies share the tools?
**Options considered**:
- A) The shell calls `useMarkovTool` for both modes and passes each body its tool.
- B) Each body calls its own hook.

**Decision**: A. The mode switch's "disabled while generating" and the probabilities toggle's logging read the current mode's tool and host, and the Data host carries the shell's "Order matters" state, none of which the shell could reach if each body called its own hooks.

### RESOLVED: Judgment call: how the drawing view finds its graph's position
**Options considered**:
- A) The SVG's bounding box at the moment of the click.
- B) Offsets passed in by each layout.

**Decision**: A. It is right in any layout, including after a resize or a collapsed neighbor, and equals the plugin's fixed offsets exactly (measured).

## Self-Review

### Commit Reviewer

#### RESOLVED: The modes step used the next step's state
"The workspace's modes and Draw mode" passed `orderMatters` to the Data host, but the state holding it arrives with "The probabilities toggle and the "Order matters" switch", so the earlier step would not compile. The modes step now passes nothing (order matters, as in MARK-15), and the switch step adds the argument.

### Senior Engineer

#### RESOLVED: `unhighlightNonOutput` would fade the overlay's arrows
Checked in `graph.tsx`: `unhighlightNonOutput` selects every `line` in the SVG, not just `line.edge`, and sets its opacity from its bound data. An overlay drawn before it would have the bag of words' arrows faded or left visible by the output rule. The labels step now makes the overlay the last pass in the highlight effect, and calls it at the end of the draw effect too.

#### RESOLVED: A bag of words' chosen state would fade its own followers
`highlightSelected` computes the states to keep from `graph.edges` (`graph-highlight.ts:83`), and in a bag of words `Graph` still receives the chain's graph, so every state not adjacent in the chain would fade, along with its text. The bag-of-words step now says both the states and their labels stay unfaded.

#### RESOLVED: Draw mode's inline callbacks would redraw its graph on every render
`onEdgeSelect` is a dependency of `Graph`'s draw effect, and a redraw doesn't fade a chosen output's other arrows (checked with throwaway code). Draw mode now passes `GraphPane`'s ref-backed callbacks.

#### RESOLVED: `Drawing` re-sends its size on every render
Its `handleDimensionChange` is new each render (checked with throwaway code), so the Graph pane's `onResized` would hear sizes that were never measured and spend MARK-15's fit after a resize. It becomes a stable callback.

#### RESOLVED: Escape in Data mode reset the hidden drawing's tool
`Drawing`'s window listener ran while hidden (checked with throwaway code), against R24. It now ignores a drawing inside a `hidden` element.

#### RESOLVED: Reset's confirmation was never rendered
The hook only sets `view.confirmModal`; `MarkovTool` renders it, and nothing in the interactive did. The Draw body renders it, and the Cypress test presses OK.

#### RESOLVED: A zoom in Draw mode didn't stop the view following
`Drawing` passed `Graph` no `onUserZoom` and called `useZoomRequest()` bare, so a divider drag after a zoom refit the drawing, against MARK-15's R13a. `Drawing` now takes `onUserZoom` and `fitTransitionMs`.

#### RESOLVED: `deleteRow` needed no change, and the planned one broke MARK-15
MARK-15's `deleteRow` already turns "the\ndog\ncat" into "the\ncat"; removing the line break before a word turns "a\n\nb c" without `b` into "a\n c", losing the break (both checked with throwaway Jest). `deleteRow` stays as it is.

#### RESOLVED: `TransitionRow` had no `percent`
Draw mode's Inspect cell read `row.percent`, which doesn't exist; the labels step adds it.

### Build Verifier

#### RESOLVED: Two hook calls in an object literal and the hooks lint
The shell calls `useMarkovTool(useApHost(...))` twice, as values in an object literal. Checked with a throwaway component of the same shape: `npm run lint`'s and `lint:build`'s configurations report nothing, so the shape needs no `eslint-disable`.

### Test Writer

#### RESOLVED: The hook's count-only test can fail
Checked against today's `generateSequence`: from "(any)" on "a b", a Markov chain stops at `b` within two states, so a test expecting five fails if the hook doesn't pass `orderMatters`. Kept as written.

#### RESOLVED: MARK-15's Cypress suite would fail once both bodies render
`defaultAuthoredState` offers both modes and shows "Order matters", so the hidden Draw body duplicates the Inspect tabs and `Collapse Inspect`, and `.setting-switch [role='switch']` matches two switches; `click` refuses two elements. `start` now defaults to Data mode alone, and the case-switch tests find their switch by name.

#### RESOLVED: Deleting the `TextToGraph` call fails a plugin test
`views.test.tsx` asserts the two `TextToGraph` calls, against R30's "passes unchanged". The test goes with the call, and R30 names the exception.

### WCAG Accessibility Expert

#### RESOLVED: Switching modes from the keyboard lost focus
Each body has its own copy of the switch, so an arrow key hides the radio it is on, and Chrome then puts focus on the page's body (checked headless with throwaway markup). The shown body's checked radio now takes focus.

### Cross-reference (stage 8)

#### RESOLVED: Coverage gaps between the two specs
Every requirement has a step and every step a requirement, apart from three, each settled by Doug: R32 asked for Jest tests of the switches' configuration, which MARK-15's `workspaceConfig` tests already cover (R32 now says so); R33's editing of a drawn state's probabilities had no test (the Draw-mode Cypress tests now edit one); and the timing measurement in Verification had no requirement (R33a). Rebecca has since answered the mockup questions (requirements, "The student-view mockup questions"). MARK-15's spec stays as it is; MARK-16 restructures its workspace.

### Performance Engineer (second pass)

#### RESOLVED: The overlay was rebuilt on every layout tick
`tick` called `drawOverlay`, a full rebuild, and Data mode's simulation ticks every frame for about 250 ticks after a drag. Measured headless: a rebuild of 700 arrows and labels about 11 ms, a move about 4 ms. `tick` now calls `moveOverlay`.

#### RESOLVED: A hidden drawing redrew on every mouse move
The rubber band's window `mousemove` listener kept `flushSync`ing a `Graph` redraw while Draw mode was hidden. It now ignores a hidden drawing, as the Escape listener does.

#### RESOLVED: A chosen output in the bag of words labeled every state from every path state
With order off, R7's faded labels meant up to 2,800 arrows and labels at Max Length 5 (about 51 ms a rebuild, measured headless) and more with no bound, each path state repeating the same list. Decision B (Doug): in the bag of words a chosen output draws and labels only its steps (`stepsOnly`), a default Rebecca may revisit; A kept the cost, and C still drew one state's full list.

### Commit Reviewer (second pass)

#### RESOLVED: Logging `orderMatters` broke two hook tests and its doc lagged five steps
Checked with throwaway code: with `orderMatters` in the generator's settings, MARK-15's two hook tests that match the settings exactly fail. The count-only step now updates them, and R30 names them; `sequenceSettings` reads the group's flag so its empty dependency list holds; `LOGGED-EVENTS.md` gains the field in the step that first logs it, not the switch step.

#### RESOLVED: The Inspect step didn't compile on its own
It gave `InspectPane` the `mode` and `orderMatters` props but left MARK-15's caller in `workspace.tsx` out of its files. The step now passes `mode="useData"` and `orderMatters` there.

#### RESOLVED: Verification said every existing Cypress spec passes unchanged
The first review changed MARK-15's `start` helper and its case-switch selectors. Verification now says the plugin's specs pass unchanged and MARK-15's workspace spec passes with those changes.

### Student (second pass)

#### RESOLVED: Draw mode's state editor covered only the Graph pane
`NodeModal`'s background and box are `position: absolute`, and the Graph pane's `.pane-body` is the nearest positioned ancestor, so Play, Inspect and the mode switch stayed clickable behind an open editor. `workspace.scss` now fixes them over the interactive, as Data mode's dialog covers the workspace.

#### RESOLVED: A background click and the toolbar treated Draw mode's choice unlike Data mode's
`Drawing` passes `Graph` no `onBackgroundClick`, so a background click kept the choice (MARK-15's R27 clears it), and its `handleToolSelected` calls `onClearHighlightOutput` on every press, so Zoom In or Fit View dropped a chosen output unlogged. `Drawing` now passes `onBackgroundClick` in the Select tool, Draw mode passes no `onClearHighlightOutput`, and R21 says so.

### QA Engineer (second pass)

#### RESOLVED: R12's quiet clear and R16's disabled switch had no test
Neither spec's tests turned order off with a transition or an output chosen, or tried the switch while playing. The switch step's Cypress tests now do both, and R33 lists them.

### WCAG Accessibility Expert (second pass)

#### RESOLVED: Faded labels failed text contrast
At the arrows' 0.35 opacity a faded label is about #a6a6a6, 2.4:1 on white, below WCAG 1.4.3's 4.5:1. Decision B (Doug): faded labels are #767676 (4.54:1) and full-strength ones black, a default Rebecca may revisit; the faded arrows keep 0.35.

#### RESOLVED: Escape doesn't close Draw mode's state editor
Escape cleared the chosen state behind the editor and left it open, unlike Data mode. Decision A: `Drawing`'s `closeEditorOnEscape`, which the plugin doesn't pass, closes the editor, and the Draw body's listener (it hears the key first, on the document) returns while a `.nodeModal` is open. B would leave keyboard users only Save or Cancel; C changes the plugin (R30).

### Senior Engineer (third pass, cross-step consistency)

#### RESOLVED: The bag of words labeled a step from a state the input no longer has
`bagOutgoing` returned arrows from any id, so a chosen output whose state left the input labeled its step (throwaway Jest: `dog → the` 60%, where the chain gives nothing). It now returns none for an id not in `nodes`, the overlay draws a step only between drawn states, and a test guards it.

#### RESOLVED: `closeEditorOnEscape` was missing where the Draw body is wired
The drawing step described it, but its `Props` block, its files line and the modes step's list of what the Draw body passes `Drawing`, with the body's `.nodeModal` check, left it out. All four now name it.

#### RESOLVED: The shell's Data configuration didn't type-check
`workspaceConfig` returns the union, which `DataWorkspace`'s narrowed `config` refuses (throwaway `tsc`). An overload for `"useData"` returns `DataWorkspaceConfig`; checked with `tsc`, lint and MARK-15's config tests.

#### RESOLVED: `orderMatters` and the d3-graph effect
Only `arrowWidths` was said to join that effect's dependencies; without `orderMatters` there, switching order redraws nothing until the input changes (`graph.tsx`'s deps are `[d3Graph, graph, keepPositions]`).

#### RESOLVED: Two stale lines after the second review
The bag-of-words step still said a chosen output labels 700 arrows per path state, against `stepsOnly`; the outgoing-only note showed while a sequence played with a state chosen, though `highlightSelected` and the overlay skip the chosen state then. The first is deleted; `graphNotes` takes `animating` (R3a).

### Release Engineer

#### RESOLVED: R28's `mode` and the hidden Draw body break MARK-15 Cypress tests the plan didn't list
Every MARK-15 log expectation compares the whole data object, which `mode` changes (checked with chai). "stacks the panes below 700 px" and `interactive-runtime.test.ts`'s default-workspace test start both modes without the `start` helper, so `Collapse Inspect` and the pane list see the hidden Draw body. The modes step updates all three, and Verification says so.

### Teacher

#### RESOLVED: R18 said Reset clears only the drawing
The hook's Reset also clears the mode's outputs and its generator settings. R18 and the Reset test now say so, and that Data mode keeps its outputs.

### Student (third pass)

#### RESOLVED: After Escape, Draw mode's toolbar showed the old tool
`Toolbar` keeps its own pressed tool, so after Add State and Escape it showed Add State while clicks selected, and the next press of Add State gave Select (throwaway Jest on the plugin's `MarkovTool`). `Drawing` with `tools` passes `selectedTool`, with `aria-pressed`; the plugin is unchanged.

### Education Researcher

#### RESOLVED: Draw mode's states could share a label, or have none, and the log names states by label
`addNode` named states from the count ("State 1, State 3, State 3" after a delete, checked with throwaway Jest) and the editor saved any trimmed label, an empty one logging as "(any)". Decision A (Doug): with `uniqueLabels`, which only the Draw body passes, new states take `nextStateLabel` and the editor refuses what `labelProblem` names. B (ids in the log) would change a contract MARK-19 reads and leave students the duplicates; C left both.

### WCAG Accessibility Expert (third pass)

#### RESOLVED: Draw mode's probability slider needed a mouse
Its thumbs had only `onMouseDown`, so no keys and no touch drag (no mouse events fired, checked headless), and the label field had no name. Decision B (Doug): with `accessibleEditor`, which only the Draw body passes, the thumbs are keyboard and pointer sliders and the field is named; the slider looks the same. A left touchscreen students unable to set a probability; C would change the plugin (R30).
