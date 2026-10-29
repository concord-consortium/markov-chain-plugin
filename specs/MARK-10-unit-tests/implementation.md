# Implementation Plan: Unit Tests for the Markov Plugin's Logic

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-10
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Seven commits on `MARK-10-unit-tests`, each building, linting and passing every test on its own. The CI commit comes first, so every later commit's tests run in CI from the first push. Test-only commits come before the ones that move code, and each move lands in the same commit as the tests that need it.

Every step was built and run before this plan was written (requirements.md, "Throwaway build of the whole plan"), then replayed as these seven commits in a scratch clone of MARK-9's branch, with every check passing at every commit. The code below is that replay, and the diff sizes and test counts are measured, not estimated.

**Checks after every commit** (Node 24, after `npm ci`):

```bash
npm test
npm run lint && npm run lint:build && npm run lint:style   # each prints nothing past its header
npx tsc --noEmit -p .
npm run build                                              # compiles with no warnings
```

Before each commit, run the comment audit from the team's rules on the staged diff, and keep only comments that stay true for a reader a year from now.

---

### Run Jest in CI

**Summary**: Turn the build job into `build_test`, which builds and then runs Jest, and make the deploy wait for it (R12.1 to R12.3). Say so in the README (R12.4). MARK-20's 32 tests start running in CI with this commit.

**Files affected**:
- `.github/workflows/ci.yml`: rename `only_build` to `build_test` ("Build and Run Jest Tests"), add `CYPRESS_INSTALL_BINARY: 0` to its install and a `npm test` step, delete the commented-out old `build_test` job and its comment, and point `s3-deploy`'s `needs` at `build_test`.
- `README.md`: one sentence in the Testing section.

**Estimated diff size**: 31 lines (+9, -22). Tests: 32, all MARK-20's.

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -3,8 +3,8 @@
 on: push
 
 jobs:
-  only_build:
-    name: Build
+  build_test:
+    name: Build and Run Jest Tests
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7
@@ -14,25 +14,13 @@
           cache: npm
       - name: Install Dependencies
         run: npm ci
+        env:
+          # skip installing cypress since it isn't needed for building and running Jest
+          CYPRESS_INSTALL_BINARY: 0
       - name: Build
         run: npm run build
-  # disable tests during early development as the logic and ui will undergo a lot of changes
-  #build_test:
-  #  name: Build and Run Jest Tests
-  #  runs-on: ubuntu-latest
-  #  steps:
-  #    - uses: actions/checkout@v2
-  #    - uses: actions/setup-node@v2
-  #    - name: Install Dependencies
-  #      run: npm ci
-  #    - name: Build
-  #      run: npm run build
-  #    - name: Run Tests
-  #      run: npm run test:coverage -- --runInBand
-  #    - name: Upload coverage to Codecov
-  #      uses: codecov/codecov-action@v1
-  #      with:
-  #        flags: jest
+      - name: Run Tests
+        run: npm test
   #cypress:
   #  runs-on: ubuntu-latest
   #  strategy:
@@ -75,8 +63,7 @@
   s3-deploy:
     name: S3 Deploy
     needs:
-      - only_build
-      # - build_test
+      - build_test
       # - cypress
     runs-on: ubuntu-latest
     steps:
```

`README.md`, Testing section:

```diff
 ### Testing
 
-Run `npm test` to run jest tests. Run `npm run test:full` to run jest and Cypress tests.
+Run `npm test` to run jest tests. Run `npm run test:full` to run jest and Cypress tests. CI runs the jest tests after the build on every push, and a failing test stops the deploy.
```

The commented-out `cypress` job and the `# - cypress` line under `s3-deploy`'s `needs` stay for MARK-11. The YAML parses to the jobs `build_test` and `s3-deploy`, with `s3-deploy` needing `build_test`. `master` has no branch protection, so the rename breaks no required check. The job itself is checked on the first push (R16).

**Commit**: `ci: run the Jest tests in CI before the deploy [MARK-10]`

---

### Test the text parser's splitting and punctuation

**Summary**: Pin how Create From Text turns text into words and states (R6, area 1). Test-only.

**Files affected**:
- `src/utils/text-to-graph.test.ts`: two `describe` blocks appended, using the file's existing `parse` helper.

**Estimated diff size**: 36 lines. Tests: 38 (+6).

```ts
describe("textToWords", () => {
  it("splits on any whitespace and keeps . , ? ! : ; as words", () => {
    expect(textToWords("one\ntwo\tthree  four")).toEqual(["one", "two", "three", "four"]);
    expect(textToWords("Hello,  World!\nHi:\tthere; ok? yes."))
      .toEqual(["hello", ",", "world", "!", "hi", ":", "there", ";", "ok", "?", "yes", "."]);
  });

  it("treats brackets, quotes, slashes and other symbols as spaces", () => {
    expect(textToWords(`"a" (b) {c} [d] e_f g+h=i j|k l\\m n/o <p>`))
      .toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"]);
  });

  it("keeps apostrophes and hyphens inside words and splits a decimal at its point", () => {
    expect(textToWords("don't well-known 3.5")).toEqual(["don't", "well-known", "3", ".", "5"]);
  });

  it("lowercases every letter, accented ones included", () => {
    expect(textToWords("The CAT École")).toEqual(["the", "cat", "école"]);
  });

  it("gives no words for empty or blank text", () => {
    expect(textToWords("")).toEqual([]);
    expect(textToWords("  \n\t ")).toEqual([]);
    expect(wordsToGraph(textToWords(" "))).toEqual({ nodes: [], edges: [] });
  });
});

describe("wordsToGraph self-loops", () => {
  it("counts a word repeated back to back as a self-loop", () => {
    expect(parse("a a a b").edges).toEqual([
      { from: "a", to: "a", value: 2 },
      { from: "a", to: "b", value: 1 },
    ]);
  });
});
```

**What the tests catch** (each checked by mutation): dropping `:` from `keepPunctuationRegex`; dropping `_` from `removePunctuationRegex`; splitting on `" "` instead of `/\s/` (caught only by the first line, words separated by a bare newline or tab: the punctuation padding and `trim()` hide it everywhere else); removing the lowercasing; and counting a repeated word as a new state or edge rather than a self-loop.

**Commit**: `test: pin how Create From Text splits text into states [MARK-10]`

---

### Test the graph built from CODAP values: self-loops and falsy values

**Summary**: Pin self-loops, repeated transitions and falsy values in dataset mode (R7, area 2). Test-only.

**Files affected**:
- `src/utils/attribute-values.test.ts`: `toStateLabel` added to the import, one `describe` appended.

**Estimated diff size**: 24 lines. Tests: 40 (+2).

```diff
--- a/src/utils/attribute-values.test.ts
+++ b/src/utils/attribute-values.test.ts
@@ -1,4 +1,4 @@
-import { getAttributeValues, graphFromValues } from "./attribute-values";
+import { getAttributeValues, graphFromValues, toStateLabel } from "./attribute-values";
 
 const reply = (values: unknown[]) => ({
   success: true,
@@ -36,3 +36,25 @@
     await expect(getAttributeValues(sendRequest, "Words", "Cases", "word")).resolves.toEqual([]);
   });
 });
+
+describe("graphFromValues", () => {
+  it("counts back-to-back repeats as a self-loop and adds repeated transitions together", () => {
+    expect(graphFromValues(["a", "a", "b", "a", "b"])).toEqual({
+      nodes: [{ id: "a", label: "a", value: 3 }, { id: "b", label: "b", value: 2 }],
+      edges: [
+        { from: "a", to: "a", value: 1 },
+        { from: "a", to: "b", value: 2 },
+        { from: "b", to: "a", value: 1 },
+      ],
+    });
+  });
+
+  it("keeps 0, false and whitespace-only values as states", () => {
+    const values = [0, false, " "].map(toStateLabel);
+    expect(values).toEqual(["0", "false", " "]);
+    expect(graphFromValues(values).edges).toEqual([
+      { from: "0", to: "false", value: 1 },
+      { from: "false", to: " ", value: 1 },
+    ]);
+  });
+});
```

**What the tests catch** (each checked by mutation): `toStateLabel` written as `String(value || "")`, which turns `0` and `false` into chain breaks; trimming values, which turns `" "` into a break; and the self-loop or repeated-transition counting in `graphFromValues`.

**Commit**: `test: pin self-loops and falsy values in graphs from CODAP data [MARK-10]`

---

### Move generation out of the `useGenerator` hook and test it

**Summary**: The generator becomes a plain function in `src/utils/generate-sequence.ts`, because a test can't call a hook (R8.1); `App` calls it directly and `hooks/use-generator.ts` is deleted. Its body is unchanged apart from one level of indentation. Tests stub `Math.random` (R8.2, area 3).

**Files affected**:
- `src/hooks/use-generator.ts`: deleted.
- `src/utils/generate-sequence.ts`: new, the hook's inner `generate` as `generateSequence`, with `GenerateOptions`.
- `src/components/app.tsx`: import and call `generateSequence`; drop the hook call and `generate` from `generateNewSequence`'s dependencies.
- `src/utils/generate-sequence.test.ts`: new.

**Estimated diff size**: 166 lines (+107, -59), of which 104 are the file move (git shows it as a delete and an add, since every line's indentation changes). Tests: 46 (+6).

`src/utils/generate-sequence.ts`:

```ts
import { Node, Edge, GraphData } from "../type";

export type GenerateOptions = {
  startingNode?: Node;
  lengthLimit: number;
};

export const generateSequence = async (graph: GraphData, options: GenerateOptions) => {
  const { startingNode, lengthLimit } = options;
  const generatedResult: Node[] = [];

  const chooseRandomNode = () => {
    const
      sumValues = graph.nodes.reduce((iSum, iNode) => iSum + (iNode?.value ?? 0), 0),
      chosenSum = Math.random() * sumValues;
    let tSum = 0;
    return graph.nodes.find((iNode: Node) => {
      tSum += (iNode?.value ?? 0);
      return tSum >= chosenSum;
    });
  };

  const chooseRandomEdge = (iNode: Node) => {
    const edges = graph.edges.filter((iEdge: Edge) => iEdge.from === iNode?.id),
      sumEdgeValues = edges.reduce((iSum, iEdge) => iSum + (iEdge?.value ?? 0), 0),
      chosenSum = Math.random() * sumEdgeValues;
    let tSum = 0;
    return edges.find((iEdge: Edge) => {
      tSum += (iEdge?.value ?? 0);
      return tSum >= chosenSum;
    });
  };

  if (graph) {
    let currentNode = startingNode || chooseRandomNode();
    while (currentNode && generatedResult.length < lengthLimit) {
      generatedResult.push(currentNode);
      // As a next node, choose one of the edges with a probability proportional to the edge value
      const currentEdge = chooseRandomEdge(currentNode);
      if (currentEdge?.to) {
        currentNode = graph.nodes.find((iNode: Node) => iNode?.id === currentEdge.to);
      } else {
        currentNode = undefined;
      }
    }
  }

  return generatedResult;
};
```

Reviewing the move: `diff -w <(git show HEAD~1:src/hooks/use-generator.ts) src/utils/generate-sequence.ts` shows only the hook wrapper gone (`useGenerator = () => {`, `const generate =`, and the returned object).

`src/components/app.tsx`:

```diff
 import { useCODAP } from "../hooks/use-codap";
 import { useGraph } from "../hooks/use-graph";
-import { useGenerator } from "../hooks/use-generator";
 import { Edge, GraphData, Node } from "../type";
@@
 import { clampLengthLimit, compareStateLabels, graphToRestore } from "./app-utils";
+import { generateSequence } from "../utils/generate-sequence";
@@
-  const { generate } = useGenerator();
@@
-      currentSequence.current = await generate(graph, { startingNode, lengthLimit: limit });
+      currentSequence.current = await generateSequence(graph, { startingNode, lengthLimit: limit });
       currentAnimationStep.current = "before";
     }
-  }, [generate, graph, lengthLimit, startingState, sequenceGroups, delimiter]);
+  }, [graph, lengthLimit, startingState, sequenceGroups, delimiter]);
```

`generateSequence` is a module import, so it leaves the dependency list (`react-hooks/exhaustive-deps` reports outer-scope values listed there).

`src/utils/generate-sequence.test.ts`:

```ts
import { generateSequence } from "./generate-sequence";

const state = (id: string, value = 1) => ({ id, label: id, value });
const ids = (sequence: {id: string}[]) => sequence.map(s => s.id);

describe("generateSequence", () => {
  afterEach(() => jest.restoreAllMocks());

  const a = state("a"), b = state("b", 3), c = state("c");
  // a goes to b with value 1 and to c with value 3; b goes back to a; c has no way out
  const graph = {
    nodes: [a, b, c],
    edges: [{ from: "a", to: "b", value: 1 }, { from: "a", to: "c", value: 3 }, { from: "b", to: "a", value: 1 }]
  };

  it("chooses each next state in proportion to the transitions' values", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.2);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 3 }))).toEqual(["a", "b", "a"]);
    jest.spyOn(Math, "random").mockReturnValue(0.3);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 3 }))).toEqual(["a", "c"]);
  });

  it("chooses the first state in proportion to the states' values when none is given", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.19);
    expect(ids(await generateSequence(graph, { lengthLimit: 1 }))).toEqual(["a"]);
    jest.spyOn(Math, "random").mockReturnValue(0.21);
    expect(ids(await generateSequence(graph, { lengthLimit: 1 }))).toEqual(["b"]);
    jest.spyOn(Math, "random").mockReturnValue(0.81);
    expect(ids(await generateSequence(graph, { lengthLimit: 1 }))).toEqual(["c"]);
  });

  it("stops at a state with no way out, before the length limit", async () => {
    expect(ids(await generateSequence(graph, { startingNode: c, lengthLimit: 5 }))).toEqual(["c"]);
  });

  it("never goes past the length limit", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.2);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 5 }))).toEqual(["a", "b", "a", "b", "a"]);
    expect(ids(await generateSequence(graph, { startingNode: a, lengthLimit: 1 }))).toEqual(["a"]);
    expect(await generateSequence(graph, { startingNode: a, lengthLimit: 0 })).toEqual([]);
  });

  it("gives an empty sequence for an empty graph", async () => {
    expect(await generateSequence({ nodes: [], edges: [] }, { lengthLimit: 5 })).toEqual([]);
  });

  it("never follows a transition with value 0, and follows a self-loop", async () => {
    const zero = {
      nodes: [a, b, c],
      edges: [{ from: "a", to: "b", value: 0 }, { from: "a", to: "a", value: 1 }]
    };
    jest.spyOn(Math, "random").mockReturnValue(1e-9);
    expect(ids(await generateSequence(zero, { startingNode: a, lengthLimit: 3 }))).toEqual(["a", "a", "a"]);
  });
});
```

**What the tests catch** (each checked by mutation): choosing transitions or the first state uniformly instead of by value (0.2 and 0.3 then pick the same transition; 0.19, 0.21 and 0.81 no longer pick a, b and c); `<=` in place of `<` in the length check (five states become six, 0 becomes one); not stopping at a dead end; and treating a 0-value transition as choosable for draws above 0.

**Manual check** (R15): Create From Text, then Play and Step generate sequences.

**Commit**: `refactor: move sequence generation out of its hook and test it [MARK-10]`

---

### Test the state editor through `NodeModal`

**Summary**: Render the state editor and check its percentages and its Save (R9.1, area 4). Test-only: `NodeModal` loads under the existing Jest config. Written to R3's rules (`screen` queries, `findBy*` after the effects that set the percentages, no container access), and checked unchanged on React 19.3.1 and Testing Library 16.3.3.

**Files affected**:
- `src/components/drawing/node-modal.test.tsx`: new.

**Estimated diff size**: 48 lines. Tests: 49 (+3).

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeModal } from "./node-modal";
import { GraphData } from "../../type";

const state = (id: string) => ({ id, label: id, value: 1 });

const renderEditor = (graph: GraphData, onChange = jest.fn()) =>
  render(<NodeModal viewMode="drawing" node={graph.nodes[0]} graph={graph} onChange={onChange} onCancel={jest.fn()} />);

describe("NodeModal", () => {
  const other = { from: "b", to: "a", value: 5 };
  const graph = {
    nodes: [{ ...state("a"), label: "a " }, state("b"), state("c"), state("d")],
    edges: [{ from: "a", to: "b", value: 1 }, other, { from: "a", to: "c", value: 1 }, { from: "a", to: "d", value: 1 }]
  };

  it("shows a state's percentages summing to 100", async () => {
    renderEditor(graph);
    expect(await screen.findByText("To b: 33%")).toBeInTheDocument();
    expect(screen.getByText("To c: 33%")).toBeInTheDocument();
    expect(screen.getByText("To d: 34%")).toBeInTheDocument();
  });

  it("keeps the state's values when saved unchanged", async () => {
    const onChange = jest.fn();
    renderEditor(graph, onChange);
    await screen.findByText("To b: 33%");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [id, node, edges] = onChange.mock.calls[0];
    expect(id).toBe("a");
    expect(node.label).toBe("a");
    expect(edges).toHaveLength(4);
    expect(edges[1]).toBe(other);
    [0, 2, 3].forEach(i => expect(edges[i].value).toBeCloseTo(1));
  });

  it("keeps a single transition's value", async () => {
    const single = { nodes: [state("a"), state("b")], edges: [{ from: "a", to: "b", value: 7 }] };
    const onChange = jest.fn();
    renderEditor(single, onChange);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(screen.queryByText(/^To /)).not.toBeInTheDocument();
    expect(onChange.mock.calls[0][2][0].value).toBeCloseTo(7);
  });
});
```

`renderEditor` returns the render result and takes the mock as an argument: Testing Library's lint rules require a `render*` helper's return value to be the render result (`render-result-naming-convention`).

**What the tests catch** (each checked by mutation): rounding every displayed share separately in `roundPercentages` (`probability-selector.tsx:82-86`) fails the first test (`To d: 33%`); reverting MARK-20's `/ 100` in `applyStatePercentages` fails both Save tests. Deleting `setExactPercentages`' last-share fix-up fails nothing, and R9.3 says why that is not tested.

**Commit**: `test: check the state editor's percentages and Save [MARK-10]`

---

### Move the slider's paired update into `state-editor.ts` and test it

**Summary**: The arithmetic a slider thumb runs moves from `ProbabilitySelector` into `movePairedPercentage` in `state-editor.ts` (R9.2): a test can't reach the thumbs without DOM access. The three small helpers it uses (`percentage`, `probability`, `reduceToSum`) move with it, since `state-editor.ts` importing them back from `probability-selector.tsx` would make an import cycle; `ProbabilitySelector` and `NodeModal` now import them from `state-editor.ts`.

**Files affected**:
- `src/components/drawing/state-editor.ts`: the three helpers and `movePairedPercentage`, moved verbatim apart from returning the new percentages (or `undefined`) instead of calling `onChange`.
- `src/components/drawing/probability-selector.tsx`: the helpers deleted; the thumb handler calls `movePairedPercentage`.
- `src/components/drawing/node-modal.tsx`: imports `percentage` and `reduceToSum` from `state-editor.ts`.
- `src/components/drawing/state-editor.test.ts`: one `describe` appended.

**Estimated diff size**: 61 lines (+40, -21). Tests: 51 (+2).

```diff
--- a/src/components/drawing/state-editor.ts
+++ b/src/components/drawing/state-editor.ts
@@ -1,5 +1,9 @@
 import { Edge } from "../../type";
 
+export const percentage = (n: number) => n * 100;
+export const probability = (n: number) => n / 100;
+export const reduceToSum = (a: number[]) => a.reduce((acc, cur) => acc + cur, 0);
+
 // percentages run from 0 to 100, one per edge leaving the state, in edge order
 export const applyStatePercentages = (edges: Edge[], nodeId: string, sum: number, percentages: number[]) => {
   let valueIndex = 0;
@@ -12,3 +16,21 @@
     }
   });
 };
+
+// moving a slider thumb trades percentage between its share and the next one, so the total stays the same
+export const movePairedPercentage = (exactPercentages: number[], index: number, newProbability: number) => {
+  const prevExactPercentages = exactPercentages
+    .slice(0, index)
+    .reduce((acc, cur) => acc + cur, 0);
+  const pairedPercentageSum = exactPercentages
+    .slice(index, index + 2)
+    .reduce((acc, cur) => acc + cur, 0);
+  const newExactPercentage = Math.min(100, Math.max(0, percentage(newProbability) - prevExactPercentages));
+
+  const newExactPercentages = [...exactPercentages];
+  newExactPercentages[index] = newExactPercentage;
+  newExactPercentages[index+1] = pairedPercentageSum - newExactPercentage;
+
+  const allAboveZero = newExactPercentages.find(n => n < 0) === undefined;
+  return allAboveZero ? newExactPercentages : undefined;
+};
```

```diff
--- a/src/components/drawing/probability-selector.tsx
+++ b/src/components/drawing/probability-selector.tsx
@@ -1,5 +1,6 @@
 import React, { useCallback, useMemo } from "react";
 import { ViewMode } from "../../hooks/use-codap";
+import { movePairedPercentage, probability, reduceToSum } from "./state-editor";
 
 import "./probability-selector.scss";
 
@@ -41,10 +42,6 @@
 ];
 const getDistinctColor = (i: number) => distinctColors[i % distinctColors.length];
 
-export const percentage = (n: number) => n * 100;
-export const probability = (n: number) => n / 100;
-export const reduceToSum = (a: number[]) => a.reduce((acc, cur) => acc + cur, 0);
-
 export const ProbabilitySelectorThumb = (props: ProbabilitySelectorThumbProps) => {
   const { index, offset, onChange } = props;
 
@@ -121,20 +118,8 @@
   }, [offsets]);
 
   const handleProbabilitySelectorThumbChange = useCallback((index: number, newProbability: number) => {
-    const prevExactPercentages = exactPercentages
-      .slice(0, index)
-      .reduce((acc, cur) => acc + cur, 0);
-    const pairedPercentageSum = exactPercentages
-      .slice(index, index + 2)
-      .reduce((acc, cur) => acc + cur, 0);
-    const newExactPercentage = Math.min(100, Math.max(0, percentage(newProbability) - prevExactPercentages));
-
-    const newExactPercentages = [...exactPercentages];
-    newExactPercentages[index] = newExactPercentage;
-    newExactPercentages[index+1] = pairedPercentageSum - newExactPercentage;
-
-    const allAboveZero = newExactPercentages.find(n => n < 0) === undefined;
-    if (allAboveZero) {
+    const newExactPercentages = movePairedPercentage(exactPercentages, index, newProbability);
+    if (newExactPercentages) {
       onChange(newExactPercentages);
     }
   }, [exactPercentages, onChange]);
```

```diff
--- a/src/components/drawing/node-modal.tsx
+++ b/src/components/drawing/node-modal.tsx
@@ -1,8 +1,8 @@
 import React, { useCallback, useEffect, useMemo, useState } from "react";
-import { ProbabilitySelector, percentage, reduceToSum } from "./probability-selector";
+import { ProbabilitySelector } from "./probability-selector";
 import { Node, Edge, GraphData } from "../../type";
 import { ViewMode } from "../../hooks/use-codap";
-import { applyStatePercentages } from "./state-editor";
+import { applyStatePercentages, percentage, reduceToSum } from "./state-editor";
 
 export interface NodeModalProps {
   viewMode: ViewMode;
```

```diff
--- a/src/components/drawing/state-editor.test.ts
+++ b/src/components/drawing/state-editor.test.ts
@@ -1,4 +1,4 @@
-import { applyStatePercentages } from "./state-editor";
+import { applyStatePercentages, movePairedPercentage } from "./state-editor";
 
 describe("applyStatePercentages", () => {
   it("keeps the state's values when its percentages are unchanged", () => {
@@ -26,3 +26,15 @@
     expect(applyStatePercentages(edges, "a", 4, [25, 75]).map(e => e.value)).toEqual([1, 7, 3]);
   });
 });
+
+describe("movePairedPercentage", () => {
+  it("trades percentage between a thumb's share and the next, keeping the total", () => {
+    expect(movePairedPercentage([50, 50], 0, 0.25)).toEqual([25, 75]);
+    // the second thumb sits at 60% of the line, after the first share's 20%
+    expect(movePairedPercentage([20, 30, 50], 1, 0.6)).toEqual([20, 40, 40]);
+  });
+
+  it("ignores a move past the next thumb, which would make a share negative", () => {
+    expect(movePairedPercentage([20, 30, 50], 0, 0.6)).toBeUndefined();
+  });
+});
```

**What the tests catch** (each checked by mutation): setting the next share to `100 - moved` instead of keeping the pair's sum; and dropping the negative-share guard (the third case then returns `[60, -10, 50]`).

**Manual check** (R15): in the state editor, dragging a thumb trades percentage between its share and the next, and Save changes only that state's arrows.

**Commit**: `refactor: move the state editor's slider arithmetic into state-editor.ts [MARK-10]`

---

### Move the saved state's logic into `plugin-state.ts` and test it

**Summary**: What the plugin saves, how it reads a saved state back, and the version-1 origin translation move into `src/utils/plugin-state.ts`, pure functions of plain arguments with no React or CODAP interface import (R10.1). `useCODAP` keeps its state updates and CODAP registration, and `App` keeps the wait for the drawing's dimensions. The tests use ELA document pnRU's saved state (R10.2, area 5).

**Files affected**:
- `src/utils/plugin-state.ts`: new: `pluginStateValues`, `readPluginState`, `moveOriginToCenter`.
- `src/hooks/use-codap.ts`: `getPluginState` and `setPluginState` call them.
- `src/components/app.tsx`: `translateOrigin` calls `moveOriginToCenter`.
- `src/utils/plugin-state.test.ts`: new.

**Estimated diff size**: 162 lines (+120, -42). Tests: 56 (+5).

`src/utils/plugin-state.ts`:

```ts
import { GraphData, Node } from "../type";
import type { CODAPAttribute, ViewMode } from "../hooks/use-codap";

// the saved shape has to stay as it is, so documents students have already saved keep loading
export const pluginStateValues = (viewMode: ViewMode|undefined, attribute: CODAPAttribute|undefined,
                                  getGraph: () => GraphData) => {
  const values: Record<string, unknown> = { attribute, viewMode };
  if (viewMode === "drawing") {
    const { nodes, edges } = getGraph();
    values.nodes = nodes;
    values.edges = edges;
    values.version = 2; // drawings saved before versioning have no version, which readPluginState reads as 1
  }
  return values;
};

export type SavedPluginState = {
  viewMode?: ViewMode;
  drawing?: { graph: GraphData, version: number };
  attribute?: CODAPAttribute;
};

export const readPluginState = (values: any): SavedPluginState => {
  const viewMode: ViewMode|undefined = values?.viewMode;
  if (viewMode === "drawing") {
    const { nodes, edges, version } = values;
    const drawing = (nodes !== undefined && edges !== undefined)
      ? { graph: { nodes, edges }, version: version ?? 1 }
      : undefined;
    return { viewMode, drawing };
  }
  return { viewMode, attribute: values?.attribute };
};

// version 1 drawings were saved with the origin at the top left, but drawings now have the origin in the center
export const moveOriginToCenter = (nodes: Node[], width: number, height: number) => {
  nodes.forEach(n => {
    n.x = (n.x ?? 0) - width / 2;
    n.y = (n.y ?? 0) - height / 2;
  });
};
```

`pluginStateValues` keeps `getPluginState`'s key order (`attribute`, `viewMode`, then the drawing's `nodes`, `edges`, `version`) and calls `getGraph` only in drawing mode, as before. `readPluginState` returns the attribute only for a mode other than drawing, as `setPluginState`'s `else` branch did. `moveOriginToCenter` moves the nodes in place, at the same moment as before (R10.1); `x + (-w / 2)` and `x - w / 2` are the same floating-point result.

`src/hooks/use-codap.ts`:

```diff
--- a/src/hooks/use-codap.ts
+++ b/src/hooks/use-codap.ts
@@ -10,6 +10,7 @@
 import pkg from "../../package.json";
 import { getAttributeValues } from "../utils/attribute-values";
 import { createSequenceOutput } from "../utils/output-dataset";
+import { pluginStateValues, readPluginState } from "../utils/plugin-state";
 
 const PluginName = "Markov Chain";
 const PluginVersion = pkg.version;
@@ -45,24 +46,10 @@
   const [viewMode, setViewMode] = useState<ViewMode|undefined>();
   const valuesRef = useRef<string[]>();
 
-  const getPluginState = useCallback(() => {
-    const state: any = {
-      success: true,
-      values: {
-        attribute,
-        viewMode,
-      }
-    };
-
-    if (viewMode === "drawing") {
-      const { nodes, edges } = getGraph();
-      state.values.nodes = nodes;
-      state.values.edges = edges;
-      state.values.version = 2; // there was no version 1 but set graph returns 1 if there is no version
-    }
-
-    return state;
-  }, [attribute, viewMode, getGraph]);
+  const getPluginState = useCallback(() => ({
+    success: true,
+    values: pluginStateValues(viewMode, attribute, getGraph)
+  }), [attribute, viewMode, getGraph]);
 
   const notifyStateIsDirty = async () => {
     await codapInterface.sendRequest([{
@@ -92,21 +79,18 @@
   const setPluginState = useCallback((values: any) => {
     setLoadState("loaded");
 
-    if (values?.viewMode) {
-      setViewMode(values.viewMode);
-
-      if (values.viewMode === "drawing") {
-        const { nodes, edges, version } = values;
-        if (nodes !== undefined && edges !== undefined) {
-          setGraph({ nodes, edges }, version ?? 1);
-          // save a copy of the graph
-          setInitialGraph({ nodes: nodes.map((n: Node) => ({ ...n })), edges: edges.map((e: Edge) => ({ ...e })) });
-        }
-      } else {
-        if (values?.attribute) {
-          setAttribute(values.attribute);
-          handleDataChanged(values.attribute, values.viewMode);
-        }
+    const saved = readPluginState(values);
+    if (saved.viewMode) {
+      setViewMode(saved.viewMode);
+
+      if (saved.drawing) {
+        const { nodes, edges } = saved.drawing.graph;
+        setGraph(saved.drawing.graph, saved.drawing.version);
+        // save a copy of the graph
+        setInitialGraph({ nodes: nodes.map((n: Node) => ({ ...n })), edges: edges.map((e: Edge) => ({ ...e })) });
+      } else if (saved.attribute) {
+        setAttribute(saved.attribute);
+        handleDataChanged(saved.attribute, saved.viewMode);
       }
     }
   }, [setAttribute, handleDataChanged, setGraph, setInitialGraph]);
```

`src/components/app.tsx`:

```diff
 import { generateSequence } from "../utils/generate-sequence";
+import { moveOriginToCenter } from "../utils/plugin-state";
@@
       if (!widthRef.current || !heightRef.current) {
         setTimeout(translateOrigin, 1);
       } else {
-        // the original data was stored with the origin at the top left
-        // but now data is stored with the origin in the center
-        // so we need to translate the points on load to the center
-        const xOffset = -widthRef.current / 2;
-        const yOffset = -heightRef.current / 2;
-        data.nodes.forEach(n => {
-          n.x = (n.x ?? 0) + xOffset;
-          n.y = (n.y ?? 0) + yOffset;
-        });
+        moveOriginToCenter(data.nodes, widthRef.current, heightRef.current);
         done();
       }
```

`src/utils/plugin-state.test.ts`:

```ts
import { moveOriginToCenter, pluginStateValues, readPluginState } from "./plugin-state";

// the saved plugin state of the ELA document pnRUlM27cXXrJrofZAXx, as CODAP 3.1.2 stores it
const elaState = {
  viewMode: "drawing",
  nodes: [
    { id: "tAtJ9i49ucYSlhkXy0ag8", label: "i", value: 1, x: -230.23797607421875, y: -65.748046875 },
    { id: "PTVhrTsYJnWs8ubsCdzbh", label: "love", value: 1, x: -96.16904640197754, y: -63.09892272949219 },
    { id: "Yfaoh2IH1AthwJiM3OtJd", label: "class", value: 1, x: 91.7048110961914, y: -52.528053283691406 },
    { id: "9QBp3NJN_89cIVDqUD8AT", label: "!", value: 1, x: 219.72821044921875, y: -50.11452507972717 }
  ],
  edges: [
    { from: "tAtJ9i49ucYSlhkXy0ag8", to: "PTVhrTsYJnWs8ubsCdzbh", value: 1 },
    { from: "Yfaoh2IH1AthwJiM3OtJd", to: "9QBp3NJN_89cIVDqUD8AT", value: 1 }
  ],
  version: 2
};
const attribute = { datasetName: "Mammals", collectionName: "Mammals", attributeName: "Diet" };

describe("pluginStateValues and readPluginState", () => {
  it("saves a restored drawing exactly as it was saved", () => {
    const saved = JSON.parse(JSON.stringify(elaState));
    const { viewMode, drawing } = readPluginState(saved);
    expect(drawing?.version).toBe(2);
    const values = pluginStateValues(viewMode, undefined, () => drawing!.graph);
    expect(JSON.stringify(values)).toBe(JSON.stringify(elaState));
  });

  it("saves only the attribute and mode in dataset mode, and restores the attribute", () => {
    const graph = { nodes: [{ id: "a", label: "a", value: 1 }], edges: [] };
    const values = pluginStateValues("dataset", attribute, () => graph);
    expect(values).toEqual({ attribute, viewMode: "dataset" });
    expect(readPluginState(values)).toEqual({ viewMode: "dataset", attribute });
  });

  it("restores a drawing saved with no version as version 1", () => {
    const { nodes, edges } = elaState;
    expect(readPluginState({ viewMode: "drawing", nodes, edges }).drawing?.version).toBe(1);
  });

  it("restores no graph without a mode, nodes or edges", () => {
    expect(readPluginState(undefined)).toEqual({ viewMode: undefined, attribute: undefined });
    expect(readPluginState({ nodes: [], edges: [] }).drawing).toBeUndefined();
    expect(readPluginState({ viewMode: "drawing", nodes: [] }).drawing).toBeUndefined();
    expect(readPluginState({ viewMode: "drawing", edges: [] }).drawing).toBeUndefined();
  });
});

describe("moveOriginToCenter", () => {
  it("moves each node by minus half the width and height, in place", () => {
    const nodes = [{ id: "a", label: "a", value: 1, x: 100, y: 50 }, { id: "b", label: "b", value: 1 }];
    const [first] = nodes;
    moveOriginToCenter(nodes, 600, 400);
    expect(nodes).toEqual([
      { id: "a", label: "a", value: 1, x: -200, y: -150 },
      { id: "b", label: "b", value: 1, x: -300, y: -200 }
    ]);
    expect(nodes[0]).toBe(first);
  });
});
```

`plugin-state.ts` imports `ViewMode` and `CODAPAttribute` from `use-codap.ts` with `import type`, as `app-utils.ts` already does, so `import/no-cycle` reports nothing although `use-codap.ts` imports `plugin-state.ts`.

**What the tests catch** (each checked by mutation): any change to a drawing's saved keys or their order (the pnRU comparison is on the JSON string; the dataset test's `toEqual` ignores order, so `attribute` before `viewMode` is not pinned, and changes nothing CODAP reads); saving `nodes`, `edges` or `version` in dataset mode; a default version other than 1; restoring a drawing with no nodes or edges; and `moveOriginToCenter` returning new nodes or moving by the wrong amount. A change to `App`'s `version < 2` passes them all; R10.2 says what guards it.

**Manual check** (R15): a drawing reopens with its drawing (pnRU, opened from a copy whose plugin URL points at the dev server); a dataset-mode document (an attribute dropped from the Mammals sample) reopens with its graph.

**Commit**: `refactor: move the saved state's logic into plugin-state.ts and test it [MARK-10]`

---

### Done when

After the last commit: 9 suites and 56 tests pass (MARK-20's 32 and 24 new), the three lint commands print nothing, `tsc` passes, and `npm run build` compiles with no warnings (R13). Each of MARK-7's six risk areas has a test (R14): area 1 in `text-to-graph.test.ts`, 2 in `attribute-values.test.ts`, 3 in `generate-sequence.test.ts`, 4 in `node-modal.test.tsx` and `state-editor.test.ts`, 5 in `plugin-state.test.ts`, and 6 in MARK-20's `attribute-values.test.ts` and `output-dataset.test.ts`. The manual checks above (R15) pass in `https://codap.concord.org/app/`. On the first push, `build_test` runs Jest green and `s3-deploy` runs after it (R16).

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: the CI commit first, or last
**Context**: CI could be switched on before the new tests or after them.
**Options considered**:
- A) First, so MARK-20's 32 tests and every later commit's tests run in CI from the first push.
- B) Last, after the tests it runs exist.

**Decision**: A. Only the branch head runs in CI on a push, so the order changes nothing there, but A puts the CI change at the bottom of the stack, where Mau reads it on its own, and leaves no commit in which tests exist that CI doesn't run.

---

### RESOLVED: Judgment call: move the percentage helpers, or repeat `* 100` in `state-editor.ts`
**Context**: `movePairedPercentage` needs `percentage`, which lives in `probability-selector.tsx`; importing it from there into `state-editor.ts` makes an import cycle, since the selector imports `movePairedPercentage`.
**Options considered**:
- A) Move `percentage`, `probability` and `reduceToSum` into `state-editor.ts` and import them from there.
- B) Write `newProbability * 100` in `movePairedPercentage` and leave the helpers where they are.

**Decision**: A. B gives the percentage conversion two definitions, the duplicated value the team's reviewers flag. A changes two import lines and keeps one definition.

---

### RESOLVED: Judgment call: move the generator in one commit, or a pure rename first
**Context**: git shows the generator's move as a delete and an add, because every line loses one level of indentation.
**Options considered**:
- A) One commit, with the `diff -w` command for reviewing the move.
- B) Two commits: a pure rename that git pairs at 100%, then unwrapping the hook.

**Decision**: A. The file is 49 lines, the `diff -w` shows only the three wrapper lines, and B adds a commit in which a hook lives under `utils/` for no reason a reader can see.

## Self-Review

Roles: commit reviewer (does each commit stand alone), test writer (can each named test fail), PR reviewer (Mau, a developer newer to the repo), senior engineer, and DevOps engineer. Every finding was checked against the replayed commits before it was written.

### Test Writer (second pass)

#### RESOLVED: the saved-state step claimed every key-order change fails a test
Swapping `attribute` and `viewMode` in `pluginStateValues` passes all five tests: pnRU's JSON has no `attribute`, and the dataset test uses `toEqual`. The step's claim now covers a drawing's keys only.

---

### Senior Engineer (second pass)

#### RESOLVED: a moved comment pointed at the wrong code for the version default
`pluginStateValues` kept the hook's "set graph returns 1 if there is no version", but the default now lives in `readPluginState` in the same file. The comment now says so.

---

### Commit Reviewer

#### RESOLVED: the diff sizes were estimates, and two were well off
The seven commits were replayed in a scratch clone of MARK-9's branch, each passing `npm test`, the three lint commands, `tsc` and a warning-free build on its own, with the head's `src/` byte-identical to the stage 4 build. Measured, the slider commit is 61 lines, not about 100, and the saved-state commit 162, not about 190. Each step now gives its measured size and its running test count (32, 38, 40, 46, 49, 51, 56).

---

### Test Writer

#### RESOLVED: the whitespace test could not catch splitting on spaces only
Running each "what the tests catch" mutation against the replay, all failed at least one test except one: `split(" ")` in place of `split(/\s/)` passed the text parser's tests, because `keepPunctuationRegex` pads every mark with spaces and `trim()` strips the newline or tab left on a word, so `"World!\nHi:\tthere"` splits correctly either way. The first test now also checks `"one\ntwo\tthree  four"`, which fails under that mutation, and the step names the line that catches it. The other sixteen named mutations (punctuation sets, lowercasing, `||` and `trim` in `toStateLabel`, uniform choice of transitions and states, `<=` in the length check, a choosable 0-value transition, the slider's pair sum and negative guard, a drawing's saved key order, nodes saved in dataset mode, the default version, a drawing without edges, and new node objects from the translation) each fail a test.

---

#### RESOLVED: the slider test named a mutation that wasn't the one it catches
The slider step said its tests catch "changing a share other than the moved one and the next" and "losing the total of 100", neither of which was run as a mutation. What was run, and fails a test, is setting the next share to `100 - moved` instead of keeping the pair's sum, and dropping the negative-share guard. The step now names those two.

---

### Senior Engineer

#### RESOLVED: MARK-12's spec assumes MARK-10 leaves `app.tsx` and `use-codap.ts` alone
MARK-12's implementation spec, re-read from its branch, cites `useRef` lines on MARK-9's branch and says MARK-10 and MARK-11 only add tests. The replay shows those lines one lower after MARK-10 (`app.tsx:93, 98, 104`, `use-codap.ts:47`), and the generation and saved-state steps edit `app.tsx` near `onSetGraph`'s `done`, which MARK-12's fit fix also edits. Nothing here changes MARK-12's plan, whose spec already says the code it points at is what matters; requirements.md ("What MARK-12 and MARK-11 inherit") records the shifts, and the stage 8 channel post tells MARK-12's terminal.
