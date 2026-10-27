# Implementation Plan: Fix the Markov plugin bugs found by the code review

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-20
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Eleven commits on `MARK-20-fix-plugin-bugs`, one per `plugin-bugs.md` row, in the order G1 sets. Each step names its commit subject (the Jira key goes in brackets at the end), its new module and test, and its call-site change. Every step was built for real in a throwaway prototype on this branch (requirements, "Prototype (stage 4)"); the code below is that prototype's.

Conventions for every step:

- **Node 20 or later**, `npm ci` once. After each commit run `npm test`, `npx tsc --noEmit -p .`, `npm run lint` (clean) and `npm run build` (`lint:build` stays at 21 `no-console` warnings).
- **New modules import only `src/type.ts`, other new modules, or (types only) `hooks/use-codap`.** Never `.scss`, d3, nanoid or `utils/codap-interface`. Code that sends CODAP requests takes a `SendRequest` (defined in the bug 2 step), and the hook passes `request => codapInterface.sendRequest(request)`.
- **Tests sit next to their module** as `<module>.test.ts`, use `describe`/`it`/`expect`/`jest.fn`/`jest.spyOn` only, and are named for the behavior, not the bug number.
- **Moved code moves verbatim** apart from the fix, so `git show --color-moved` shows the fix as the only change in the moved block.
- **Comments:** keep existing comments that move with their code; new comments describe the code as it is (the comment audit in the global rules applies before each commit).

---

### Count Create From Text words in prototype-free objects

**Summary**: Bug 1. The parser moves out of `drawing.tsx` into a module and counts in `Object.create(null)` objects. Commit: `fix: stop "constructor" in Create From Text from blanking the plugin [MARK-20]`.

**Files affected**:
- `src/utils/text-to-graph.ts` (new): the two regexes, `textToWords`, `wordsToGraph`.
- `src/utils/text-to-graph.test.ts` (new).
- `src/components/drawing.tsx`: drop the regexes (`:41-42`) and the parse body of `handleTextChange` (`:294-314`); call the module.

**Estimated diff size**: ~85 lines (+60 −25).

```ts
// src/utils/text-to-graph.ts
import { Edge, GraphData, Node } from "../type";

const keepPunctuationRegex = /[.,?!:;]/g;
const removePunctuationRegex = /["(){}[\]_+=|\\/><]/g;

export const textToWords = (text: string) => {
  return text
    .replace(keepPunctuationRegex, (match) => ` ${match} `)
    .replace(removePunctuationRegex, " ")
    .split(/\s/)
    .map(w => w.trim().toLocaleLowerCase())
    .filter(w => w.length > 0);
};

// objects without a prototype, so a word like "constructor" can't find an inherited property
export const wordsToGraph = (words: string[]): GraphData => {
  const nodes: Record<string, Node> = Object.create(null);
  const edges: Record<string, Edge> = Object.create(null);

  words.forEach((word, index) => {
    nodes[word] = nodes[word] ?? {id: word, label: word, value: 0};
    nodes[word].value++;

    if (index > 0) {
      const lastWord = words[index - 1];
      const key = `${lastWord}|${word}`;
      edges[key] = edges[key] ?? {from: lastWord, to: word, value: 0};
      edges[key].value++;
    }
  });

  return { nodes: Object.values(nodes), edges: Object.values(edges) };
};
```

`drawing.tsx` (`handleTextChange`) after:

```ts
  const handleTextChange = useCallback((newText: string) => {
    const words = textToWords(newText);

    if (JSON.stringify(words) !== JSON.stringify(prevWordsRef.current)) {
      setGraph(wordsToGraph(words));
    }
    prevWordsRef.current = words;
    // setTimeout(onFitView) unchanged
```

plus `import { textToWords, wordsToGraph } from "../utils/text-to-graph";`. `Node` and `Edge` stay imported (`:139`, `:149` use them).

Test (`text-to-graph.test.ts`), through `wordsToGraph(textToWords(text))`:
- `the constructor built the house` gives exactly the states `the` (2), `constructor` (1), `built` (1), `house` (1) and the edges `the→constructor`, `constructor→built`, `built→the`, `the→house`, each 1 (`toEqual` on both arrays).
- `go 10 then 2` gives the state ids `["2", "10", "go", "then"]`.

---

### Read dataset values as strings, and keep the graph when the read fails

**Summary**: Bugs 2 and 2b. The values read and the graph built from them move into one module; values become strings at the read; a rejected request resolves to `undefined` and the hook keeps its graph. Commit: `fix: stop missing or numeric values from crashing Use Data mode [MARK-20]`.

**Files affected**:
- `src/utils/codap-request.ts` (new): `export type SendRequest = (request: any) => Promise<any>;`
- `src/utils/attribute-values.ts` (new): `toStateLabel`, `getAttributeValues`, `graphFromValues`.
- `src/utils/attribute-values.test.ts` (new).
- `src/utils/codap-helper.ts`: delete `getValuesForAttribute` and its doc comment (`:196-214`); its only caller moves to the module. `getCaseValues` stays (MARK-14).
- `src/hooks/use-codap.ts`: import `getAttributeValues` instead of `getValuesForAttribute`; delete the commented-out `// getValuesForAttribute,` line in the same import list (`:7`), since the function no longer exists; `handleDataChanged` returns early on `undefined`.
- `src/hooks/use-graph.ts`: `updateGraph` becomes `setGraph(graphFromValues(values))`; the loop moves to the module; the `Node` and `Edge` imports go.

**Estimated diff size**: ~120 lines (+85 −40).

```ts
// src/utils/attribute-values.ts
import { Edge, GraphData, Node } from "../type";
import { SendRequest } from "./codap-request";

// CODAP values can be missing or non-text; an empty string breaks the chain like an empty cell
export const toStateLabel = (value: unknown) => (value === undefined || value === null) ? "" : String(value);

// resolves to undefined when the request gets no reply, so the caller can keep its current graph
export const getAttributeValues = async (sendRequest: SendRequest, datasetName: string,
                                         collectionName: string, attributeName: string) => {
  let result: any;
  try {
    result = await sendRequest({
      action: "get",
      resource: `dataContext[${datasetName}].collection[${collectionName}].caseFormulaSearch[true]`
    });
  } catch (reason) {
    console.log(`Unable to get cases in ${datasetName} because ${reason}`);
    return undefined;
  }
  if (!result?.success) {
    return [];
  }
  return (result.values as any[]).map(iCase => toStateLabel(iCase.values[attributeName]));
};

export const graphFromValues = (values: string[]): GraphData => {
  // the body of today's updateGraph loop, moved verbatim (use-graph.ts:8-39), returning {nodes, edges}
};
```

The `console.log` is the one moved from `getValuesForAttribute`, so `lint:build` stays at 21.

`use-codap.ts` (`handleDataChanged`) after:

```ts
    const values = await getAttributeValues(request => codapInterface.sendRequest(request),
      datasetName, collectionName, attributeName);
    if (!values) {
      return;
    }
```

`use-graph.ts` after:

```ts
import { useCallback, useState } from "react";
import { GraphData } from "../type";
import { graphFromValues } from "../utils/attribute-values";

export const useGraph = () => {
  const [graph, setGraph] = useState<GraphData>({nodes: [], edges: []});

  const updateGraph = useCallback((values: string[]) => {
    setGraph(graphFromValues(values));
  }, []);
  // return unchanged
```

Test (`attribute-values.test.ts`), with `sendRequest = jest.fn()` replying `{success: true, values: [{id, values: {word: v}}, ...]}`:
- values `["a", undefined, "b", null, "", 3, "a", 3]` read as `["a", "", "b", "", "", "3", "a", "3"]`, and `graphFromValues` of them gives states `a` (2), `b` (1), `"3"` (2) and edges `3→a` and `a→3` only.
- a rejected request resolves to `undefined` (silence `console.log` with `jest.spyOn(...).mockImplementation`, then restore it).
- a `{success: false}` reply resolves to `[]`.

---

### Keep a state's total when its editor saves

**Summary**: Bug 3B. `handleSubmit`'s edge update moves into a module and divides the percentage by 100. Commit: `fix: stop the state editor multiplying a state's values by 100 [MARK-20]`.

**Files affected**:
- `src/components/drawing/state-editor.ts` (new): `applyStatePercentages`.
- `src/components/drawing/state-editor.test.ts` (new).
- `src/components/drawing/node-modal.tsx`: `handleSubmit` calls it (`:52-60`).

**Estimated diff size**: ~55 lines.

```ts
// src/components/drawing/state-editor.ts
import { Edge } from "../../type";

// percentages run from 0 to 100, one per edge leaving the state, in edge order
export const applyStatePercentages = (edges: Edge[], nodeId: string, sum: number, percentages: number[]) => {
  let valueIndex = 0;
  return edges.map(edge => {
    if (edge.from === nodeId) {
      const value = sum * percentages[valueIndex++] / 100;
      return { ...edge, value };
    } else {
      return edge;
    }
  });
};
```

`node-modal.tsx` after: `const newEdges = applyStatePercentages(graph.edges, node.id, sum, exactPercentages);` in place of the loop, and the import.

Test (`state-editor.test.ts`):
- `[1, 1, 1]` from state `a` with percentages `[100/3, 100/3, 100 - 2*100/3]` (what the editor holds unchanged) and `sum` 3: every value `toBeCloseTo(1)`.
- edges `a→b` 1, `b→a` 7, `a→c` 3 with `sum` 4 and `[50, 50]`: values `[2, 7, 2]`, and the `b→a` edge is the same object (`toBe`).
- the same edges with `[25, 75]`: values `[1, 7, 3]`, so a percentage applied to the wrong edge, or repeated, fails.

---

### Draw each arrow's width from its own state's probabilities

**Summary**: Bug 3A. The graph's drawing settings move into `graph-utils.ts` with a per-state width function; `maxStroke` becomes 4.5. Commit: `fix: draw arrow widths from each state's own probabilities [MARK-20]`.

**Files affected**:
- `src/components/graph-utils.ts` (new): `GraphSettings`, `settings` (with `maxStroke: 4.5`), `ry`, `stateEdgeWeights`, `graphSignature`.
- `src/components/graph-utils.test.ts` (new).
- `src/components/graph.tsx`: delete `GraphSettings` (`:35-42`), `settings` (`:116-123`) and `ry` (`:125`), import them; in the d3 graph effect delete `totalEdgeValue` (`:403`), take only `minRadius, maxRadius` from `settings` (`:404`), and replace `edgeWeight` (`:426`) with `const edgeWeight = stateEdgeWeights(graph.edges);`, called as `edgeWeight(edge)` at `:431` and `:435`. Delete `graphSignature` (`:200-204`) and import it. `GraphSettings` has no other importer.

**Estimated diff size**: ~125 lines.

```ts
// src/components/graph-utils.ts
import { Edge } from "../type";

export type GraphSettings = { /* moved verbatim */ };

export const settings: GraphSettings = {
  minRadius: 25,
  maxRadius: 75,
  minStroke: 2,
  maxStroke: 4.5,
  marginFactor: 0.8,
  minFontSize: 10,
};

export const ry = (radius: number) => radius / 2;

// an edge's width shows its probability among the edges leaving its own state, loops included
export const stateEdgeWeights = (edges: Edge[]) => {
  const stateTotals = new Map<string, number>();
  edges.forEach(edge => stateTotals.set(edge.from, (stateTotals.get(edge.from) ?? 0) + edge.value));

  const {minStroke, maxStroke} = settings;
  return (edge: Edge) => {
    const total = stateTotals.get(edge.from) ?? 0;
    return total > 0 ? minStroke + ((maxStroke - minStroke) * (edge.value / total)) : minStroke;
  };
};

type SignatureGraph = {
  nodes: {id: string, label: string, weight: number, radius: number, x: number, y: number, loopWeight: number}[];
  edges: {source: {id: string}, target: {id: string}, weight: number}[];
};

// loops are drawn from their nodes, not from the edge list, so a loop's width is part of its node's signature
export const graphSignature = (graph: SignatureGraph) => {
  const nodeSignature = graph.nodes.map(n =>
    `${n.id}/${n.label}/${n.weight}/${n.radius}/${n.x}/${n.y}/${n.loopWeight}`);
  const edgeSignature = graph.edges.map(e => `${e.source.id}/${e.target.id}/${e.weight}`);
  return `${nodeSignature}::${edgeSignature}`;
};
```

`graphSignature` moves verbatim apart from `/${n.loopWeight}` (and the line break it needs to stay under `max-len`); `D3Graph` fits `SignatureGraph` structurally, so the call at `:444` is unchanged. Without it, per-state widths stop a new loop from appearing (requirements, R3A.5): adding a loop to a state with no other outgoing edge changes no edge's width, so the signature is unchanged and the effect keeps the old `d3Graph`, whose node has `loops: false`.

Test (`graph-utils.test.ts`, `describe("stateEdgeWeights")`):
- edges `a→b` 1, `a→c` 1, `b→a` 10, `b→c` 10 give one distinct width.
- `a→b` 1 and the loop `a→a` 3 give 2.625 and 3.875 (`toBeCloseTo`); a single edge gives 4.5.
- changing `a→b` from 1 to 100 leaves `b`'s two widths equal (`toEqual`) to before.
- a state whose only edge has value 0 gives 2.

Test (`describe("graphSignature")`): two node lists that differ only in one node's `loopWeight` (0 and 4.5) give different signatures. Without `loopWeight` in the signature they are equal, so the test fails.

---

### Scale arrowheads with their lines

**Summary**: Bug 3C. Markers switch to `strokeWidth` units with the 4-unit notched head; edge lines and loops end short by the head's reach; loops end on the outline; the highlight and animation selections touch only `line.edge`. Commit: `fix: size arrowheads to their lines [MARK-20]`.

**Files affected**:
- `src/components/graph-utils.ts`: add `arrowHeadReach`, `pullBackLineEnd`, the loop angle constants, `trimmedLoopEndAngle` and `nodeLoopPath` (moved from `graph.tsx:111-112`, `:178-198`, with an optional width).
- `src/components/graph-utils.test.ts`: `describe("pullBackLineEnd")`, `describe("nodeLoopPath")`.
- `src/components/graph.tsx`: delete the loop constants and `nodeLoopPath`; add `lineEnd`; change the marker, the edge lines' `x2`/`y2` (creation `:701-704` and `tick` `:625-629`), the five `nodeLoopPath` uses, and the four `selectAll("line")` calls that set `marker-end`.

**Estimated diff size**: ~155 lines.

```ts
// added to src/components/graph-utils.ts
// arrowhead markers are sized in line widths; the tip is this many widths past the line's end
export const arrowHeadReach = 3;

export const pullBackLineEnd = (x1: number, y1: number, x2: number, y2: number, width: number) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const pullBack = Math.min(arrowHeadReach * width, Math.max(0, length - 1));
  if (pullBack <= 0) {
    return {x: x2, y: y2};
  }
  const ratio = (length - pullBack) / length;
  return {x: x1 + (x2 - x1) * ratio, y: y1 + (y2 - y1) * ratio};
};

const startLoopAngle = 0.25 * Math.PI;
// where a loop (a circle of radius ry centered rx left of its state) crosses back over the state's outline
const endLoopAngle = 2 * Math.PI - Math.acos(2 / 3);

// the arc's end angle that puts the tip of its arrowhead, which points along the arc's tangent, on the state's outline
const trimmedLoopEndAngle = (a: number, arrowWidth: number) => {
  const b = ry(a);
  const reach = arrowHeadReach * arrowWidth;
  const tipOutside = (angle: number) => {
    const tipX = -a + b * Math.cos(angle) - reach * Math.sin(angle);
    const tipY = b * Math.sin(angle) + reach * Math.cos(angle);
    return (tipX / a) ** 2 + (tipY / b) ** 2 > 1;
  };
  // trimming by the arc length of the reach always overshoots, since the tangent cuts the curve short
  let low = 0;
  let high = reach / b;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (tipOutside(endLoopAngle - mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return endLoopAngle - high;
};

export const nodeLoopPath = (node: {x: number, y: number, radius: number}, arrowWidth = 0) => {
  const a = node.radius;
  const b = ry(node.radius);
  const clockwise = false;

  const circle = {x: node.x - a, y: node.y};
  const radius = b;
  const endAngle = trimmedLoopEndAngle(a, arrowWidth);

  const startX = circle.x + radius * Math.cos(startLoopAngle);
  const startY = circle.y + radius * Math.sin(startLoopAngle);
  const endX = circle.x + radius * Math.cos(endAngle);
  const endY = circle.y + radius * Math.sin(endAngle);

  const largeArc = Math.abs(endAngle - startLoopAngle) <= Math.PI ? "0" : "1";
  const sweepFlag = clockwise ? "0" : "1";

  const d = "M " + startX + "," + startY + " A " + radius + "," + radius + " 0 " +
            largeArc + "," + sweepFlag + " " + endX + "," + endY;

  return d;
};
```

`graph.tsx` changes:

```ts
// next to lineDashArray
const lineEnd = (edge: D3Edge) =>
  pullBackLineEnd(edge.sourceX, edge.sourceY, edge.targetX, edge.targetY, edge.weight);

// addArrowMarker: refX 1, refY 2, markerWidth 4, markerHeight 4, markerUnits "strokeWidth",
// orient auto; path "M 0 0 4 2 0 4 1 2 0 0"; keep fill and fill-opacity; drop the path's
// stroke attribute and stroke-opacity style

// edge lines (creation and tick): x2 = lineEnd(d).x, y2 = lineEnd(d).y; the backgrounds keep targetX/targetY
// loops (creation and tick): .attr("d", d => nodeLoopPath(d, d.loopWeight))
// loop backgrounds, ghost loop and its background: .attr("d", d => nodeLoopPath(d))
// highlightSelected (:302, :308, :317) and the animation effect (:839): selectAll("line.edge")
```

`trimmedLoopEndAngle` works in the loop's own frame (the state at the origin), so it needs only the state's radius. With no width it returns the untrimmed end, since the bracket is empty. Its bisection was checked for states of radius 25 to 75 and loop widths 2 to 4.5: the tip at no trim is always inside the ellipse and at the arc-length trim always outside, and 30 halvings land the tip on the outline to well under a hundredth of a pixel.

`nodeLoopPath` must be wrapped (`d => nodeLoopPath(d)`) where it was passed directly, or d3 passes the index as `arrowWidth`. The rubberband line (2 px) and the ghost loop (1 px) keep `arrowUrl`, so their heads are about 8 px and 4 px.

Tests:
- `pullBackLineEnd(0, 0, 100, 0, 2)` is `{x: 94, y: 0}`; for `(0, 0, 30, 40, 4.5)` the end is 13.5 from `(30, 40)`.
- `pullBackLineEnd(0, 0, 5, 0, 4)` is `{x: 1, y: 0}`; `(0, 0, 0.5, 0, 4)` is unchanged.
- the end point of `nodeLoopPath({x: 10, y: 20, radius: 50})` satisfies `((x-10)/50)^2 + ((y-20)/25)^2 ≈ 1` (on the outline).
- for states of radius 25, 50 and 75 with loop widths 2 and 4.5, the tip of the trimmed loop's head (its end point plus `arrowHeadReach * width` along the tangent `(-sin, cos)` of its angle on the loop circle) satisfies the same outline equation (`toBeCloseTo(1, 3)`). Checked: it passes with the bisection and fails with the arc-length trim `3 * width / ry`.

---

### Sort the Starting State list

**Summary**: Bug 4. Commit: `fix: sort the Starting State list [MARK-20]`.

**Files affected**:
- `src/components/app-utils.ts` (new): `compareStateLabels`.
- `src/components/app-utils.test.ts` (new).
- `src/components/app.tsx`: `sortedNodes.sort(compareStateLabels)` (`:401`) and the import.

**Estimated diff size**: ~30 lines.

```ts
// src/components/app-utils.ts
export const compareStateLabels = (a: {label: unknown}, b: {label: unknown}) =>
  String(a.label).localeCompare(String(b.label), undefined, {numeric: true});
```

Test: `["zebra", "apple", "mango"]` sorts to `apple, mango, zebra`; `["i", "love", "class", "!"]` to `!, class, i, love`; `["State 10", "State 2"]` to `State 2, State 10`; `[10, 2]` to `2, 10`. Avoid case-only pairs (`Apple`/`apple`), whose order depends on the locale.

---

### Rebuild the graph on Reset in dataset mode

**Summary**: Bug 8. Reset asks a module function what to restore; the app remembers the last dataset values. Commit: `fix: rebuild the graph on Reset in Use Data mode [MARK-20]`.

**Files affected**:
- `src/components/app-utils.ts`: add `graphToRestore`.
- `src/components/app-utils.test.ts`: `describe("graphToRestore")`.
- `src/components/app.tsx`: `datasetValuesRef`, set in `onCODAPDataChanged` (`:102-104`), cleared in `handleReturnToMainMenu`'s `onOk` (`:556-560`); `handleReset`'s timeout uses `graphToRestore`, and `viewMode` joins its dependencies (`:550`).

**Estimated diff size**: ~45 lines.

```ts
// added to src/components/app-utils.ts
import { GraphData } from "../type";
import type { ViewMode } from "../hooks/use-codap";
import { graphFromValues } from "../utils/attribute-values";

export const graphToRestore = (viewMode: ViewMode|undefined, initialGraph: GraphData|undefined,
                               datasetValues: string[]|undefined) => {
  if (viewMode === "dataset") {
    return datasetValues ? graphFromValues(datasetValues) : undefined;
  }
  return initialGraph;
};
```

`import type` keeps `use-codap` (and through it `codap-interface` and iframe-phone) out of the test's module graph; checked: ts-jest elides it.

`app.tsx` after:

```ts
  const datasetValuesRef = useRef<string[]>();
  const onCODAPDataChanged = (values: string[]) => {
    datasetValuesRef.current = values;
    updateGraph(values);
    // rest unchanged
  };

  // handleReset, inside the existing setTimeout
          const restoredGraph = graphToRestore(viewMode, initialGraph, datasetValuesRef.current);
          if (restoredGraph) {
            setGraph(restoredGraph);
          }
  // dependencies: [viewMode, initialGraph, setGraph, setSelectedNodeId]

  // handleReturnToMainMenu onOk, after setInitialGraph(undefined)
        datasetValuesRef.current = undefined;
```

`viewMode` comes from `useCODAP` (`:138`), declared above `handleReset`. Nothing else in Reset changes, so MARK-12's fit change rebases onto this timeout.

Test: drawing mode gives the initial graph (`toBe`) and `undefined` without one; dataset mode with `["x", "y", "x"]` gives states `x` (2), `y` (1) and edges `x→y`, `y→x`; dataset mode with no values gives `undefined` even when an initial graph is passed.

---

### Measure state labels as text

**Summary**: Bug 9. `calculateNodeFontSize` moves to `graph-utils.ts` and sets `textContent`. Commit: `fix: measure state labels as text, not HTML [MARK-20]`.

**Files affected**:
- `src/components/graph-utils.ts`: add `calculateNodeFontSize`, moved from `graph.tsx:206-243` with its parameter typed `{label: string, radius: number}` and `innerHTML` replaced by `textContent` at both assignments.
- `src/components/graph-utils.test.ts`: `describe("calculateNodeFontSize")`.
- `src/components/graph.tsx`: delete it and import it.

**Estimated diff size**: ~100 lines (mostly the move).

Test, capturing the measuring element with `jest.spyOn(document.body, "appendChild")`:
- `{label: "<b>x</b>", radius: 50}`: the element's `textContent` is `<b>x</b>` and it has no children.
- `{label: "x &amp; y", radius: 50}`: its `textContent` is `x &amp; y`.
- with `jest.spyOn(HTMLElement.prototype, "clientWidth", "get")` returning `textContent.length * 5` (jsdom measures 0), `{label: "<i>abcdefgh</i>", radius: 30}` returns the label `<i>abc...`, the element ends with that text and no children. Restore both spies. (With `innerHTML`, the full label measures as `abcdefgh`, fits, and is returned whole, so the test fails; reverting only the truncation line leaves an `<i>` child.)

---

### Keep Max Length at 1 or more

**Summary**: Bug 11. Commit: `fix: keep Max Length at 1 or more [MARK-20]`.

**Files affected**:
- `src/components/app-utils.ts`: add `clampLengthLimit`.
- `src/components/app-utils.test.ts`: `describe("clampLengthLimit")`.
- `src/components/app.tsx`: `generateNewSequence` (`:192-218`) uses the clamped value for the group and for `generate`; the input (`:417-422`) gets `onBlur` and `onKeyDown`.

**Estimated diff size**: ~40 lines.

```ts
// added to src/components/app-utils.ts
export const clampLengthLimit = (lengthLimit: number|undefined) =>
  lengthLimit === undefined ? undefined : Math.max(1, lengthLimit);
```

`app.tsx` after:

```ts
  // generateNewSequence
    const limit = clampLengthLimit(lengthLimit);
    if (limit !== undefined) {
      // ... the group comparison uses `limit`, and generate gets { startingNode, lengthLimit: limit }
        currentAnimatedSequenceGroup.current =
          { delimiter, lengthLimit: limit, startingState, startingNode, sequences: [] };

  const handleCommitLengthLimit = () => setLengthLimit(prev => clampLengthLimit(prev));

  const handleLengthLimitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommitLengthLimit();
    }
  };

  // the Max Length input
                onBlur={handleCommitLengthLimit}
                onKeyDown={handleLengthLimitKeyDown}
```

The new group's assignment is split after `=` as shown: on one line at its indentation it is 125 characters, over `max-len` (120), and `npm run lint` reports it. The dependency list of `generateNewSequence` already has `lengthLimit`. Test: 0 and −3 give 1, 5 gives 5, `undefined` stays `undefined`.

---

### Create the output dataset only when it is missing

**Summary**: Bug M3. `guaranteeOutputDatasetAndCaseTable` moves to a module that takes `SendRequest`, finds the dataset by name, and starts the table check from nothing. Commit: `fix: create the output dataset only when it is missing [MARK-20]`.

**Files affected**:
- `src/utils/output-dataset.ts` (new): `OutputDatasetName` and `guaranteeOutputDatasetAndCaseTable(sendRequest)`, moved verbatim from `use-codap.ts:152-230` with `codapInterface.sendRequest` replaced by `sendRequest`.
- `src/utils/output-dataset.test.ts` (new).
- `src/hooks/use-codap.ts`: delete the function and `OutputDatasetName` (`:20`); import both; `outputToDataset` calls `guaranteeOutputDatasetAndCaseTable(request => codapInterface.sendRequest(request))`, and its dependency list drops the function.

**Estimated diff size**: ~200 lines, mostly the move (about 80 lines out of `use-codap.ts`, 80 in).

The two changes inside the moved function:

```ts
    tFoundValue = tListResult.values.find((iValue: any) => {
      return iValue.name === OutputDatasetName;
    });
  // ...
  // Verify case table exists
  tFoundValue = null;
  tListResult = await sendRequest({
```

The `tFoundValue = null` keeps a failed `componentList` reply from leaving the dataset entry in place and skipping the table request (requirements, M3 note). The table check itself is unchanged.

Test, with a `jest.fn` that answers by `resource`, using the replies MARK-5 captured in CODAP 3.1.2 (`dataContextList` with `{name: "Sequence Data", guid, title: "Output Sequences", id}`, and the `componentList` with the `game` tile and the `caseTable`):
- dataset listed: the `create` requests are exactly `["component"]`.
- empty `dataContextList`: `["dataContext", "component"]`.
- dataset listed and the `componentList` request rejected (silence `console.log` as in the bug 2 test): `["component"]`. This is the test for `tFoundValue = null`; without it the dataset entry is still in `tFoundValue` and no `create component` is sent.

---

### Continue sequence numbers after a reopen

**Summary**: Bug 7a. Item output and numbering move into `output-dataset.ts`; the first output of a session reads the highest existing number. Commit: `fix: continue sequence numbers after a document is reopened [MARK-20]`.

**Files affected**:
- `src/utils/output-dataset.ts`: `guaranteeOutputDatasetAndCaseTable` returns whether the dataset existed: `const datasetExisted = !!tFoundValue;` after the dataset check and before the table check's `tFoundValue = null`, then `return datasetExisted;` at its early return and its end; add `getNextSequenceNumber` (not exported) and `createSequenceOutput`.
- `src/utils/output-dataset.test.ts`: `describe("createSequenceOutput")`.
- `src/hooks/use-codap.ts`: delete `sequenceNumber` (`:46`), `incrementSequenceNumber` (`:148-150`) and `outputToDataset` (`:232-249`) and the `OutputDatasetName` import; add the `useMemo` below.

**Estimated diff size**: ~90 lines.

```ts
// added to src/utils/output-dataset.ts
const getNextSequenceNumber = async (sendRequest: SendRequest) => {
  const result: any = await sendRequest({
    action: "get",
    resource: `dataContext[${OutputDatasetName}].itemSearch[*]`
  }).catch(() => undefined);
  if (!result?.success) {
    return 0;
  }
  // a student can type anything into the table, so only finite numbers count
  const numbers = (result.values as any[])
    .map(item => Number(item.values?.["Sequence number"]))
    .filter(n => Number.isFinite(n));
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 0;
};

export const createSequenceOutput = (sendRequest: SendRequest) => {
  let nextSequenceNumber: number|undefined;

  return async (states: string[]) => {
    const datasetExisted = await guaranteeOutputDatasetAndCaseTable(sendRequest);
    if (nextSequenceNumber === undefined) {
      nextSequenceNumber = datasetExisted ? await getNextSequenceNumber(sendRequest) : 0;
    }
    const sequenceNumber = nextSequenceNumber++;
    await sendRequest({
      action: "create",
      resource: `dataContext[${OutputDatasetName}].item`,
      values: states.map(state => ({"Sequence number": sequenceNumber, State: state}))
    }).catch((reason) => {
      console.log("unable to create items because " + reason);
    });
  };
};
```

The item request and its `console.log` are the ones moved from `outputToDataset`, so `lint:build` stays at 21. `getNextSequenceNumber` adds no log.

`use-codap.ts` after (`useMemo` joins the React import):

```ts
  const outputToDataset = useMemo(() => {
    const outputSequence = createSequenceOutput(request => codapInterface.sendRequest(request));
    return (sequence: Node[]) => outputSequence(sequence.map(state => state.label));
  }, []);
```

`App` calls `outputToDataset(sequence)` as before, so `app.tsx` doesn't change.

Test, with the same mock plus an `itemSearch[*]` reply shaped as captured for this spec (`{success: true, values: [{id, values: {State, "Sequence number": n}}]}`, numbers 0, 4, 4, 1, 2, 3 and the text `"abc"`, with the 4s before smaller numbers so the highest number isn't also the last):
- dataset listed: two outputs send items numbered 5, then 6.
- dataset listed but the `itemSearch[*]` reply has `success: false`: 0, then 1.
- no dataset: 0, then 1.

### After the last step

Not a commit. Replay the branch: for each commit, `git checkout <commit> && npm ci && npm test && npx tsc --noEmit -p . && npm run lint && npm run build` (21 warnings). Then run G6's manual check in `https://codap.concord.org/app/` with the branch build (MARK-6's results give the branch URL pattern, and `&url=https://cfm-shared.concord.org/<docId>/file.json&di-override=markov-chain-plugin` loads an ELA document with it, read-only): the five ELA documents, a drawn loop, a selected state and a played sequence, a state editor Save, Max Length 0, the Starting State list, and in dataset mode a numeric attribute, an attribute with empty cells, and Reset.

## Open Questions

### RESOLVED: Judgment call: one module per concern, or one module per fix
**Context**: eleven fixes could each get their own module, or related fixes could share one.
**Options considered**:
- A) Share by concern: `graph-utils.ts` (3A, 3C, 9), `app-utils.ts` (4, 8, 11), `output-dataset.ts` (M3, 7a), and one module each for 1, 2 and 3B.
- B) One module per fix.

**Decision**: A. The graph's `settings` and `ry` have to live in one place (3A, 3C and 9 all use them), and M3's and 7a's code is one function and its caller. Later steps add to a module an earlier step created, which is a forward-only dependency.

### RESOLVED: Judgment call: where 7a's counter lives
**Context**: the session counter could stay in React state in `useCODAP` or move into the module.
**Options considered**:
- A) A closure in `createSequenceOutput`, created once per hook with `useMemo`.
- B) Keep `sequenceNumber` state in the hook and pass it in.

**Decision**: A. The test then runs the same code the plugin runs, from the first reply to the item request, and the hook's `sequenceNumber` state and `incrementSequenceNumber` callback go away instead of staying beside a new "already read" flag.

### RESOLVED: Judgment call: M3 resets `tFoundValue` instead of splitting the variable
**Context**: the moved function reuses `tFoundValue` for both checks.
**Options considered**:
- A) Reset it before the table check (one line).
- B) Use two variables.

**Decision**: A. It keeps the moved block nearly verbatim for Mau's review, and the variable's reuse is out of scope.

## Self-Review

Roles: Commit Reviewer (does each step stand alone), Test Writer (can each test be written against what the plan provides, and does it fail without its fix), Operator, Senior Engineer. Each finding was checked against the code or the stage 4 prototype.

### Commit Reviewer

#### RESOLVED: each step's imports exist when it lands
Checked by module: 3C and 9 add to `graph-utils.ts` (created by 3A), and `graph.tsx` imports `settings` and `ry` from it from 3A on, so the still-local `calculateNodeFontSize` and `nodeLoopPath` compile in between. Bug 8 imports `graphFromValues` (bug 2) and extends `app-utils.ts` (bug 4). 7a extends `output-dataset.ts` (M3) and uses `SendRequest` (bug 2). No step imports anything a later step creates. The full replay is the "After the last step" check.

#### RESOLVED: the deleted helper's commented-out import
`use-codap.ts:7` keeps a commented-out `// getValuesForAttribute,` in the import list. Once bug 2 deletes the function, the line names nothing, so the bug 2 step deletes it.

### Test Writer

#### RESOLVED: every test fails without its fix
In the prototype each fix was reverted in its module one at a time (17 mutations, including each half of 2, 3A, 3C, 4, 9 and 7a), and every one turned its test red. The loop-outline test was added after the browser check, and reverting the end angle to `1.75 * PI` also fails it (the end point lands inside the ellipse, at 0.917).

### Operator

#### RESOLVED: nothing said how to check the finished branch
Added "After the last step": the per-commit replay and the manual CODAP check G6 asks for, with the branch-build URL pattern.

### Senior Engineer

#### RESOLVED: 7a's counter if the hook's memo is rebuilt
`useMemo` may drop its value (React allows it, and MARK-12's React 19 move keeps the same rule). A rebuilt `createSequenceOutput` starts with no counter, reads the dataset again on the next output and continues from its highest number, so numbering stays correct either way.

### Graphics Engineer (second review)

Second review roles: Graphics Engineer (the drawn result of 3A and 3C), Senior Engineer, QA Engineer (can each test fail), Commit Reviewer. Each finding was checked against the code and with a throwaway test or script before it was written.

#### RESOLVED: per-state widths stop a new loop from being drawn
`Graph` rebuilds its d3 graph only when `graphSignature` (`graph.tsx:200-204`) changes, and the signature has no loop width. A throwaway Jest test copied the signature and the d3 graph effect: adding a loop to state `a` (no other outgoing edge) in a graph that also has `b→c` changes the signature with today's whole-graph widths, but not with `stateEdgeWeights`, and deleting it doesn't either. So after 3A a loop drawn on such a state never appears and a deleted one stays drawn. (Adding a loop as a graph's very first edge already fails today, since there are no other widths to change.) The 3A step now moves `graphSignature` into `graph-utils.ts` with `loopWeight` added and tests it; R3A.5 and G6's manual check say so.

#### RESOLVED: a trimmed loop's arrowhead tip doesn't reach the outline on small states
R3C.3 says the loop "ends early by an angle of 3 line widths divided by the loop circle's radius, so the head's tip lands on the outline", and `nodeLoopPath` does exactly that (the value `plugin-bugs.md` gives from preview 5). But the marker points along the arc's tangent at the trimmed end, and a straight segment 3 widths long along a tangent doesn't reach the point 3 widths further along a tight arc. A throwaway script placed the tip (trimmed end plus `3 * width` along the tangent, with the sweep direction `nodeLoopPath` uses) and measured its distance from the state's ellipse: 6.5 px outside the outline for a minimum-size state (radius 25, loop radius 12.5) whose only exit is its loop (4.5 px); 3.1 px at radius 25 with a 3.25 px loop; 2.6 px at radius 50 with 4.5 px; 1.5 px at radius 41.7 with 3.25 px or radius 75 with 4.5 px. Straight edges are unaffected (`pullBackLineEnd` trims along the line itself). Preview 5 and the stage 4 browser check never drew a loop on a small state with a heavy loop. This touches the stage 8 decision (loops end on the outline before the trim) only in the trim that follows it, but it changes `plugin-bugs.md`'s exact values, so it is left open.
**Options considered**:
- A) Keep the arc-length trim and reword R3C.3 to say the tip lands near the outline, up to about 6.5 px short on the smallest state with a full-width loop.
- B) Solve for the trim angle that puts the tip on the ellipse: in `nodeLoopPath`, bisect the trim between 0 and `3 * width / radius` (the tip at angle 0 is inside the ellipse and at the arc-length trim outside, in every case measured), about ten lines. The trims come out smaller (0.65 rad instead of 1.08 at radius 25 and width 4.5). R3C.3 keeps its wording, and R3C.5's loop test becomes "the tip of a trimmed loop lies on its state's outline" in place of "the trimmed end is about `3 * width` from the untrimmed end".
- C) Leave the trim and lower the loop's head only on small states (for example cap the trim at the state's size). Not recommended: a second rule for one case.

**Decision**: B (Doug, 2026-10-27). The 3C step's `trimmedLoopEndAngle` bisects the trim between 0 and `3 * width / ry`; a throwaway Jest test put the tip on the outline for radius 25, 50 and 75 and widths 2 and 4.5, and failed with the arc-length trim. R3C.3 and R3C.5 say so.

### Third review

Third review roles: New Engineer (follows the plan literally, step by step), React and Hooks Reviewer, CODAP API Reviewer, Accessibility Reviewer (the Max Length field). Every step was built in order as throwaway code on this branch, one throwaway commit each, and after each `npm test`, `tsc --noEmit`, `npm run lint` and `lint:build` were run; `webpack --mode production` passed on the last. With the corrections below, every step compiled, linted clean, kept `lint:build` at 21 `no-console` warnings and passed its tests on its own, and no test module loads `use-codap` or `codap-interface` (checked by making both throw on load). Reverting each fix in its module turned its test red, apart from the M3 gap below. The throwaway code and commits were removed.

#### RESOLVED: 7a's `datasetExisted` was never defined
The 7a step said to `return datasetExisted;` from `guaranteeOutputDatasetAndCaseTable` but not where the value comes from, and it can't be read from `tFoundValue` at the end, since M3 resets that before the table check. Built as written, the step doesn't compile. The step now says to set `const datasetExisted = !!tFoundValue;` after the dataset check; with that, both 7a tests pass and fail when the value is ignored.

#### RESOLVED: the Max Length step's new group literal fails `npm run lint`
Written on one line at its indentation in `generateNewSequence`, `{ delimiter, lengthLimit: limit, startingState, startingNode, sequences: [] }` makes a 125-character line, and `npm run lint` (and `lint:build`) reports a `max-len` warning, so the step is not lint clean. The snippet now splits the assignment after `=`.

#### RESOLVED: nothing tested M3's `tFoundValue = null`
Deleting the line left both M3 tests green: they never make the `componentList` request fail, which is the only case the line guards. A third test (the dataset listed, `componentList` rejected, `create component` still sent) fails without the line and passes with it.

#### RESOLVED: `GraphSettings` line reference
`GraphSettings` is at `graph.tsx:35-42`, not `:34-41`.

