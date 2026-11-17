# Implementation Plan: Sequence Output Labeling Bug

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-37
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

### Put a starting state that leaves the graph back to any

**Summary**: `useMarkovTool` clears its starting state when the graph stops containing it, so the select, generation, output grouping and saved work agree (R1 to R8, R11). One commit with its tests (R9) and the MARK-19 spec notes it makes untrue (R12). The code and every test below were run on master before the plan was written: the seven new-behavior tests fail without the fix and all 48 tests in the file pass with it; `npm run lint`, the style config and `tsc --noEmit` are clean.

**Files affected**:
- `src/hooks/use-markov-tool.tsx`: a layout effect that clears a gone start; the `startingLabel` comment.
- `src/hooks/use-markov-tool.test.tsx`: a new `describe("useMarkovTool's starting state")`, one new start test, the existing start test's graph, the `MarkovToolApi` import, and the deletion of the log test "logs no starting state for a play whose starting state the input has taken out".
- `specs/MARK-19-dashboard-summary.md`: three notes that describe a kept gone start as current behavior (R12).

**Estimated diff size**: ~137 lines (7 added and 1 removed in the hook; 108 added and 15 removed in the tests; 3 added and 3 removed in the MARK-19 spec).

#### `src/hooks/use-markov-tool.tsx`

After `graphEmpty`:

```tsx
  const graphEmpty = useMemo(() => graph.nodes.length === 0, [graph]);
  // a starting state that leaves the graph goes back to any, and stays there if it returns
  useLayoutEffect(() => {
    if (startingState && !graph.nodes.some(node => node.id === startingState)) {
      setStartingState(defaultStartingState);
    }
  }, [graph, startingState]);
```

The `startingLabel` comment, whose "or one no longer in the graph" case the effect removes:

```tsx
  // the starting state's label, "" for any
```

Notes:

- **One rule for every source of graph change.** `onDataChanged`, `onSetGraph`, the drawing's `setGraph` calls, Reset and Back To Main Menu all reach the graph state, and the effect reads that state, so no caller needs a change. It also covers a `MarkovToolStart` whose start isn't in its graph (R11), on the first render.
- **Layout effect.** It runs before the browser paints and before any click can reach Play, so a Play never sees the gone id. `useLayoutEffect` is already imported.
- **Ids, not labels.** The comparison is by id, so a drawing's rename keeps the start (R5) and a Data mode word's id is the word under the current capitalization rule.
- **Logs nothing (R7).** It calls `setStartingState` directly, not `handleChangeStartingState`.
- **A running sequence (R6)** keeps its group: the group, its sequences and the logged settings come from `currentAnimatedSequenceGroup`, `prevSequences` and `startingLabelRef`, not from `startingState`.
- **Lint.** The repo enables only `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` from `eslint-plugin-react-hooks` 7.1.1, and the dependency list is complete, so no disable is needed.

#### `src/hooks/use-markov-tool.test.tsx`

Import `MarkovToolApi` beside `MarkovToolStart`:

```tsx
import { MarkovToolApi, MarkovToolStart, useMarkovTool } from "./use-markov-tool";
```

New block, before `describe("useMarkovTool's start")`, using the file's `recordingHost` and `drawing` (states `a` and `b`):

```tsx
describe("useMarkovTool's starting state", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const chooseStart = (result: { current: MarkovToolApi }, id: string) =>
    act(() => result.current.generatorProps.onStartingStateChange({ target: { value: id } } as any));
  const play = async (result: { current: MarkovToolApi }) => {
    await act(async () => result.current.generatorProps.onPlay());
    await act(async () => jest.advanceTimersByTime(30000));
  };
  const groupStarts = (result: { current: MarkovToolApi }) =>
    result.current.outputProps.sequenceGroups.map(group => [group.startingState, group.startingNode?.label]);

  it("goes back to any when the input takes its state out, and the next play starts an (any) group", async () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("dataset")));
    act(() => result.current.handle.dataChanged(["the", "cat", "the", "dog"]));
    chooseStart(result, "the");
    await play(result);

    act(() => result.current.handle.dataChanged(["a", "cat", "a", "dog"]));
    expect(result.current.generatorProps.startingState).toBe("");
    await play(result);
    expect(groupStarts(result)).toEqual([["the", "the"], ["", undefined]]);
  });

  it("goes back to any when its state is deleted from a drawing", async () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("drawing")));
    act(() => result.current.handle.loadDrawing(drawing, 2));
    chooseStart(result, "a");
    await play(result);

    act(() => result.current.view.setGraph(graph => ({
      nodes: graph.nodes.filter(n => n.id !== "a"), edges: graph.edges.filter(e => e.from !== "a" && e.to !== "a"),
    })));
    expect(result.current.generatorProps.startingState).toBe("");
    await play(result);
    expect(groupStarts(result)).toEqual([["a", "a"], ["", undefined]]);
  });

  it("finishes a stepped sequence in its own group when its state leaves the graph", async () => {
    const host = recordingHost("dataset");
    const { result } = renderHook(() => useMarkovTool(host));
    act(() => result.current.handle.dataChanged(["the", "cat", "the", "dog"]));
    chooseStart(result, "the");
    await act(async () => result.current.generatorProps.onStep());
    act(() => result.current.handle.dataChanged(["a", "cat", "a", "dog"]));
    for (let i = 0; i < 12 && result.current.animating; i++) {
      await act(async () => result.current.generatorProps.onStep());
    }
    expect(result.current.animating).toBe(false);
    expect(result.current.outputProps.sequenceGroups.map(group => group.sequences.map(s => s[0].label)))
      .toEqual([["the"]]);
    expect(host.log).toHaveBeenCalledWith("SequenceGenerated", expect.objectContaining({ startingState: "the" }));

    await play(result);
    expect(groupStarts(result)).toEqual([["the", "the"], ["", undefined]]);
  });

  it("stays at any when its state comes back", () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("dataset")));
    act(() => result.current.handle.dataChanged(["the", "cat", "the"]));
    chooseStart(result, "the");
    act(() => result.current.handle.dataChanged(["a", "cat", "a"]));
    act(() => result.current.handle.dataChanged(["the", "cat", "the"]));
    expect(result.current.generatorProps.startingState).toBe("");
  });

  it("logs nothing when it goes back to any", () => {
    const host = recordingHost("dataset");
    const { result } = renderHook(() => useMarkovTool(host));
    act(() => result.current.handle.dataChanged(["the", "cat", "the"]));
    chooseStart(result, "the");
    host.log.mockClear();
    act(() => result.current.handle.dataChanged(["a", "cat", "a"]));
    expect(result.current.generatorProps.startingState).toBe("");
    expect(host.log).not.toHaveBeenCalled();
  });

  it("goes back to any when Back To Main Menu empties the graph", () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("drawing")));
    act(() => result.current.handle.loadDrawing(drawing, 2));
    chooseStart(result, "a");
    act(() => result.current.view.onReturnToMainMenu());
    act(() => result.current.view.confirmModal?.onOk?.());
    expect(result.current.graph.nodes).toEqual([]);
    expect(result.current.generatorProps.startingState).toBe("");
  });

  it("keeps a drawn state that is renamed", () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("drawing")));
    act(() => result.current.handle.loadDrawing(drawing, 2));
    chooseStart(result, "a");
    act(() => result.current.view.setGraph(graph => ({
      ...graph, nodes: graph.nodes.map(n => n.id === "a" ? { ...n, label: "A" } : n),
    })));
    expect(result.current.graph.nodes.map(n => n.label)).toContain("A");
    expect(result.current.generatorProps.startingState).toBe("a");
  });
});
```

In `describe("useMarkovTool's start")`, the existing test "starts from generator settings, and takes the default of any left out" gives its start a graph containing `a` (R11):

```tsx
    const tool = startedTool({ graph: drawing, generator: {
      startingState: "a", lengthLimit: 9, delimiter: "-", delimiterType: "other", fast: true,
    } });
```

and a new test follows it:

```tsx
  it("starts at any with a starting state its graph doesn't have, or with no graph", () => {
    expect(startedTool({ graph: drawing, generator: { startingState: "gone" } }).current.generatorProps.startingState)
      .toBe("");
    expect(startedTool({ generator: { startingState: "a" } }).current.generatorProps.startingState).toBe("");
  });
```

In `describe("useMarkovTool's log")`, delete the test "logs no starting state for a play whose starting state the input has taken out". With the effect, the start is `""` before that Play, so the test passes whether or not `startingLabel` and `startingLabelRef` handle a gone id; the new tests guard the clear, and "logs a played sequence and the sequence it generates" covers the `""` an "(any)" Play logs.

What each test catches:

| Test | Fails without the fix | Catches |
|---|---|---|
| input takes its state out | yes | R1, R2 in Data mode and the CODAP plugin's dataset mode |
| deleted from a drawing | yes | R1, R2 in drawings |
| finishes a stepped sequence in its own group | yes, at the next Play | R6: the running sequence keeps its group, start and logged start (this part passes today and guards the refs it depends on), and R2 after it |
| stays at any when it comes back | yes | R4 (a fix that derives "(any)" only while the state is missing) |
| Back To Main Menu empties the graph | yes | R1 for Back To Main Menu (a fix that skips an empty graph) |
| logs nothing | yes | R7 (a fix that routes through `handleChangeStartingState`); asserts the clear first |
| renamed drawn state | no, guard | R5 (a fix that compares labels); asserts the rename happened first |
| starts at any with a start its graph lacks, or with no graph | yes | R11, including the no-graph start (a fix that skips an empty graph) |

**Manual check (done condition):** in `interactive.html` from `npm start`, Rebecca's path: type `The cat saw the dog. The dog saw the cat.`, turn Case sensitive on, choose "The", play twice, turn Case sensitive off, play; the output shows a `The` group and then an `(any)` group, and turning Case sensitive back on leaves the list at "(any)". Then in Draw mode, choose a state, play, delete that state, play: a new `(any)` group.

#### `specs/MARK-19-dashboard-summary.md`

Under "Other notes", the first note about a kept start becomes:

```markdown
- A chosen state that leaves the graph puts the generator back to `(any)` (MARK-37). Work saved before then can still hold the gone id as `startingState` on the generator and on a group, with no `start`, so a group's `startingState` isn't always what it started from; its `startingNode` is what the heading shows (R6).
```

the next one:

```markdown
- A group's `startingNode` is set once, and `generateNewSequence` adds to the last group when `startingState` matches. In work saved before MARK-37 that can leave an output under the wrong heading (`a c`, generated after `cat` left, under `cat`), and the count follows the headings a teacher can open.
```

and under "What the spec reviews changed", the second sentence of the `group.startingState` entry:

```markdown
In work saved before MARK-37, a shared group can still leave a heading wrong for a later output, and the count follows the heading (Other notes).
```

The dashboard's filter and its tests stay as they are: old saves still need them.

## Open Questions

### RESOLVED: Judgment call: an effect in the hook, or clear at each place the graph changes?
**Context**: The graph changes in `onDataChanged`, `onSetGraph`, the drawing's `setGraph` updates, Reset and Back To Main Menu.
**Options considered**:
- A) One layout effect on `[graph, startingState]`.
- B) Clear in each graph-changing path.
- C) Derive the start during render without storing the clear.

**Decision**: A. B misses any future path that changes the graph, and the drawing's updates live in `drawing.tsx`. C brings the start back when the state returns, which R4 rules out. The effect matches `useClearGoneSelection`, which clears a gone selection the same way.

### RESOLVED: Judgment call: one commit, or a failing test first?
**Context**: The reviewer is a newer developer; small, independent steps help.
**Options considered**:
- A) One commit with the fix and its tests.
- B) A test commit, then the fix.

**Decision**: A. The change is 8 lines of code; a commit of tests that fail would leave the branch red between commits, and the table above records which tests fail without the fix.

## Self-Review

Stage 8 cross-reference: every requirement maps to the step; R6 had only reasoning behind it, and on Doug's answer the step now has its test, run with and without the fix. No step lacks a requirement.

Roles: Senior Engineer, Commit Reviewer, Test Writer, Operator. Checks run with the step's code applied and then removed: the hook test file (48 pass; the six tests the table marks fail without the fix), the full Jest suite with the fix (only the start test the step edits failed, before its edit), lint with all three configs and `tsc --noEmit`, and `cypress/e2e/interactive-saved-work.test.ts` against the dev server (107 pass), which covers a saved start that is gone on reopen and a chosen start being saved.

### Operator

#### RESOLVED: The requirements said the saved start is never a gone id
A save can run in the same commit as the change that removed the state (`useSavedWork` saves from a passive effect), before the layout effect's re-render, so that one save may still carry the id. The note in `requirements.md` now says so, and why it is harmless: `restoredMode` reopens a gone id as "(any)", and the next save carries `""`.

### Commit Reviewer

No findings: the step is one commit that builds, lints and passes on its own, with no dependency or lockfile change.

### Test Writer

No findings: every test in the step was run as written against the file's existing `recordingHost`, `drawing`, `loadDrawing`, `dataChanged` and `view.setGraph`.

### Test Writer (second pass)

#### RESOLVED: No test told the planned effect from one that skips an empty graph
With the effect's condition changed to `startingState && graph.nodes.length > 0 && !graph.nodes.some(...)`, all 48 planned tests in the file passed, so neither Back To Main Menu (which empties the graph) nor a start given with no graph was guarded. The step now adds "goes back to any when Back To Main Menu empties the graph" and extends the R11 test with a no-graph start; both fail on that mutant and on master. With the step applied: 49 tests in the file pass, the full suite passes, and lint (all three configs) and `tsc --noEmit` are clean.

### QA Engineer (third pass)

#### RESOLVED: The existing log test for a gone start could no longer fail
"logs no starting state for a play whose starting state the input has taken out" plays after the start's state leaves the graph. With the effect, the start is already `""` at that Play, so the test exercises the "(any)" path. Throwaway mutants with the step applied confirmed it: `startingLabel` falling back to the id (`?? startingState`), `startingLabelRef` doing the same, and both together each left all 49 tests in the file green. The test passes on master too, so it guards nothing either way. The step now deletes it, and the requirements' Technical Notes no longer say it still holds. With the step applied: 48 tests in the file pass (seven fail without the fix), the full suite passes (803), and lint (all three configs) and `tsc --noEmit` are clean.

### WCAG Accessibility Expert (third pass)

No findings. In the interactive with the step applied, after Rebecca's path the select's DOM value is `""` with "(any)" the selected option, which is what assistive technology reads today too, since the browser already shows the first option for a stale id; focus stays on the Case sensitive switch, and the select is disabled while a sequence runs.

### Education Researcher (third pass)

No findings. Every sequence event takes its start from `startingLabel` or `startingLabelRef`, both `""` after the clear; the only change in the log is that a returning word no longer brings back a start the log never recorded choosing (R4). The dashboard summary's "(any)" for a gone start comes from `restoredMode`'s filter, which stays.

### Newer Developer (third pass)

No findings. The step's code and tests, applied exactly as written, compile, lint and pass, and each placement ("after `graphEmpty`", before `describe("useMarkovTool's start")`, after the edited start test) names one spot.

### Adversarial Reviewer (third pass)

No findings. `setStartingState` is called only by the student's choice, Reset and the effect; every graph change goes through `useGraph`'s `setGraph` or `updateGraph`, which the effect reads. `MarkovToolStart` is built only by `restoredMode` (the CODAP plugin saves no start, and `loadDrawing` is its only drawing path), and `report-summary.ts` reads `restoredMode`'s output without the hook.

### Spec Coherence Reviewer (fourth pass)

#### RESOLVED: The Manual check ended with a record of which half was run
"Ran against this exact code: the Data mode path behaves as described" was an archive of the work, and it left the Draw mode half reading as unchecked. Run in the CODAP plugin's drawing mode (the same `Drawing` component as Draw mode) through the fake CODAP page with the step applied: start "b", Play, delete "b", Play gives a `b` group and then an `(any)` group, with the select at `""`. The sentence is deleted. Every other number in this file was re-measured with the step applied as written: 48 tests in the file pass, the same seven the table marks fail with the hook as on master, the full suite passes (803 in 50 suites), the diff is 131 lines (7 added and 1 removed in the hook, 108 added and 15 removed in the tests), and lint with all three configs and `tsc --noEmit` are clean. The first pass's "six tests" predates the Back To Main Menu test; seven is current.

### CODAP Plugin UX Reviewer (fourth pass)

No findings. With the step applied, in the plugin's dataset mode through the fake CODAP page: start "cat", two Plays, then new values for the attribute without "cat" and an `updateCases` notice; the select shows "(any)" with value `""`, and the next Play starts an `(any) / 5 / " "` group below the `cat` group, laid out like any other group. The plugin calls `dataChanged` only with the whole attribute's values, never an empty interim graph, so no start is cleared that the student did not lose.

### PR Reviewer, code diff only (fourth pass)

No findings. Both new code comments hold for the code as it stands: the effect's comment names both what it does and R4, and `startingLabel`'s `?? ""` is reached only for `""`, since the effect clears any start not in the graph before a Play can run. No other file's comment or test header describes a start that outlives its state.

### Closed-Spec Editor (fifth pass)

#### RESOLVED: The diff estimate's parts did not add up to its total
With the step applied as written, `git diff --numstat` gives 7 and 1 in the hook, 108 and 15 in the tests and 3 and 3 in the MARK-19 spec: 137 lines, as stated. The parenthetical counted the MARK-19 edit as "3 lines changed", so its parts summed to 134. It now gives each file's added and removed lines.

The rest of R12's plan held against the code with the step applied. Each replacement matches the line it replaces (lines 112 and 113 under "Other notes", and the second sentence of the `group.startingState` entry, whose first sentence stays), and each is true: no Play can start a group from a gone id, while reopened work saved before MARK-37 can still hold a group with a gone `startingState` and no `start`, and a later output can still join a group whose heading is wrong. No other text in the repo is made untrue: MARK-19's R6, MARK-17's "a saved starting state not in the graph reads as (any)", MARK-23's R10 ("generates from any state"), MARK-20's deferral of bug 12, `LOGGED-EVENTS.md`, the README, the Cypress tests and the comments in `report-summary.ts`, `restore-work.ts` and their tests all still hold. With the step applied: 48 tests in the file pass and seven fail with the hook as on master, the full suite passes (803 in 50 suites), and lint with all three configs and `tsc --noEmit` are clean.
