# Implementation Plan: Saved Work in the AP Interactive, and the Teacher's History Scrubber

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-17
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Seven steps, one commit each, each leaving the build, lints and tests green. No dependency or lockfile changes. Shared code (`src/hooks`, `src/components`) only gains optional arguments and props the plugin doesn't pass. A step's tests go in its commit.

### Read a saved state

**Summary**: The state's types and a reader that never throws, plus the output encoding, all pure functions, so the rest builds on tested ground. Nothing calls them yet.

**Files affected**:
- `src/interactive/interactive-state.ts`: the types and `readInteractiveState`; `readSavedInput` stays until the reopening step.
- `src/interactive/saved-outputs.ts` (new): `encodeOutputs`, `decodeOutputs`, `savedBytes`.
- `src/interactive/workspace/inspect-pane.tsx`, `inspect-rows.ts`: `InspectTab` and `Sort` move.
- Their test files.

**Estimated diff size**: ~350 lines, about half tests

```ts
// interactive-state.ts
export interface SavedView { x: number, y: number, k: number }
export type SavedSelection =
  | { kind: "state", id: string }
  | { kind: "transition", from: string, to: string }
  | { kind: "output", group: number, sequence: number };

export interface SavedMode {
  panes?: Partial<Record<WorkspacePaneId, boolean>>;
  controlsOpen?: boolean;
  sizes?: Partial<PaneSizes>;
  inspect?: { tab: InspectTab, sorts: Record<InspectTab, Sort> };
  generator?: {
    startingState: string, lengthLimit?: number, delimiter: string, delimiterType: DelimiterType, fast: boolean,
  };
  outputs?: SavedOutputs;
  selection?: SavedSelection;
  view?: SavedView;
}

export interface MarkovInteractiveState {
  version: typeof interactiveStateVersion;
  input?: { text: string };
  mode?: ModeId;
  probabilities?: boolean;
  orderMatters?: boolean;
  caseSensitive?: boolean;
  useData?: SavedMode & { inputSplit?: number, positions?: number[] };
  draw?: SavedMode & { drawing?: GraphData };
}
```

`InspectTab` and `Sort` move from `inspect-pane.tsx` to `inspect-rows.ts`, so `interactive-state.ts` imports types only.

`readInteractiveState(raw: unknown): MarkovInteractiveState` starts from `copyState(parseState(raw))`, since the library deep-freezes the init message and the workspace goes on to edit what it reads, and removes each known field that fails a small checker (`isRecord`, `typeof`, `Number.isFinite`, a list of allowed values), so fields it doesn't know stay (R14). `copyState` is `JSON.parse(JSON.stringify(state))`: a state is JSON, and `structuredClone` isn't defined in Jest's jsdom, where `standalone.test.tsx` renders the real `Runtime`. A drawing is kept only with arrays of nodes (string `id` and `label`, numeric `value`, `x` and `y` numbers or absent) and edges, dropping bad entries and edges to missing nodes. `positions` must be an even-length list of finite numbers, and a `view`'s `k` above 0.

```ts
// saved-outputs.ts
export interface SavedOutputs {
  // a state as a string where its id is its label, otherwise [id, label]
  states: (string | [string, string])[];
  groups: {
    delimiter: string, lengthLimit: number, startingState: string, start?: number, orderMatters?: boolean,
    sequences: number[][],
  }[];
}
export const savedBytes = (value: unknown) =>
  new Blob([JSON.stringify(JSON.stringify(value))]).size - 2;
```

`Blob` rather than `TextEncoder`, which Jest's jsdom doesn't define; `Workspace` runs this under `standalone.test.tsx` too.

`encodeOutputs` keys the table on id and label together, since a state renamed between outputs is two entries with one id. `decodeOutputs` rebuilds `SequenceGroup[]` with nodes of `value: 0` and one `Node` object per table entry, and skips any group or sequence with a place outside the table.

Jest: every field wrong on its own, leaving the others; a deep-frozen state reads back unfrozen; `null`, `{}`, `{ version: 1 }`, MARK-15's state and a JSON string; decoding what was encoded gives the same labels, ids and settings, for a group with `orderMatters` false, a state whose id isn't its label, two groups sharing a state, and one id with two labels; a bad place drops only its sequence; `savedBytes` of a string with a quote counts it as JSON in JSON.

---

### Start the tool from saved values

**Summary**: The shared hook and graph accept starting values, which the plugin never passes. Restoring by starting values rather than a `loadSnapshot` call means a saved selection survives the first render and no save fires for what was restored.

**Files affected**:
- `src/hooks/use-graph.ts`: `useGraph(initial?: GraphData)`.
- `src/hooks/use-markov-tool.tsx`: a second, optional argument.
- `src/components/graph.tsx`: an `initialView` prop.
- `src/components/drawing.tsx`: passes `initialView` on, and calls a new optional `onTransformed` from `handleTransformed`.
- `src/components/generator.tsx`: `delimiterAutoFocus?: boolean`, default true.
- `src/components/sequence-output.tsx`: `openAtNewest?: boolean`, which `GeneratorPane` passes, scrolling to the end the first time the output has a height, through a `ResizeObserver` made in an effect only with the prop. An output in a hidden mode or a collapsed pane has no height at mount, and a `scrollTop` written then is lost. The plugin's opens at the top as it does today, and the comment above the groups effect changes to say so.
- `src/hooks/use-markov-tool.test.tsx`, `src/components/generator.test.tsx`, `src/components/sequence-output.test.tsx`.

**Estimated diff size**: ~170 lines

```ts
export interface MarkovToolStart {
  graph?: GraphData;
  values?: string[];
  generator?: { startingState: string, lengthLimit?: number, delimiter: string, delimiterType: DelimiterType,
                fast: boolean };
  sequenceGroups?: SequenceGroup[];
  selection?: Exclude<Selection, undefined>;
}
export const useMarkovTool = (host: MarkovHost, start?: MarkovToolStart): MarkovToolApi => { ... }
```

Each `useState` default reads `start`, as do `fastSimulationRef`, `loggedLengthLimitRef`, `loggedDelimiterRef` (so a blur on a restored value logs nothing) and `datasetValuesRef`. `initialGraph` stays undefined, so Draw mode's Reset clears a reopened drawing (R15).

`generatorProps` gains `delimiterAutoFocus`, true unless the tool started with `start` and the student hasn't changed the delimiter's type since.

In `Graph`'s zoom effect, once `zoomRef.current` is attached:

```ts
if (initialView && !viewAppliedRef.current) {
  viewAppliedRef.current = true;
  svg.call(zoomRef.current.transform, new d3.ZoomTransform(initialView.k, initialView.x, initialView.y));
}
```

The event has no `sourceEvent`, so it isn't a student's zoom. Jest: with no `start` every default is as before; each `start` field reads back through the API; a Max Length field blurred unchanged after a start logs nothing; Reset after a started drawing leaves an empty graph; `Generator` with `delimiterAutoFocus` false leaves focus where it was; `SequenceOutput` with `openAtNewest`, under a stub `ResizeObserver` and `clientHeight`, writes `scrollTop` when it first has a height and not while it has none, and without the prop makes no observer.

---

### Reopen a saved workspace

**Summary**: The workspace opens from a saved state under the page's settings. It is tested with hand-written states, since nothing writes them yet.

**Files affected**:
- `src/interactive/workspace/restore-work.ts` (new) and its test.
- `src/interactive/runtime.tsx`, `workspace.tsx`, `data-workspace.tsx`, `draw-workspace.tsx`, `use-pane-layout.tsx`, `inspect-pane.tsx`, `graph-pane.tsx`.
- `src/interactive/interactive-state.ts`: `readSavedInput` and its test go.
- `cypress/e2e/interactive-saved-work.test.ts` (new).

**Estimated diff size**: ~480 lines

`restoreWork(saved: MarkovInteractiveState, authoredState, configs, { readOnly })` applies R17 and returns what each part starts from:

```ts
export interface RestoredWork {
  mode: ModeId;
  probabilities: boolean;
  orderMatters: boolean;
  capitalization: Capitalization;
  text: string;
  inputSplit: number;
  useData: RestoredMode;
  draw: RestoredMode;
}
interface RestoredMode {
  tool: MarkovToolStart;
  panes: Record<string, boolean>;
  controlsOpen: boolean;
  sizes: PaneSizes;
  inspect?: { tab: InspectTab, sorts: Record<InspectTab, Sort> };
  view?: SavedView;
}
```

- `text` is `saved.input.text ?? startingText`, or `startingText` with no Input pane, as `DataWorkspace` does today. Tokens come from `tokenize(text, capitalization)`, the values from `tokensToValues`, and `tool.graph` from `graphFromValues(values)`.
- Data mode always starts from this graph, saved or not. The `dataChanged(firstValues)` mount effect goes, replaced by a mount effect in `usePaneLayout`, through `toolRef` so its dependencies are honest: with no starting view, `toolRef.current.view.onFitView()`. Throwaway code confirmed this fits a graph present at first render, in the shown mode and, once shown, the hidden one.
- `positions` are applied to `tool.graph.nodes` in order when `positions.length === 2 * nodes.length` and `saved.caseSensitive` matches the rule in use, so a hand-written test state needs that field.
- `view` is kept only for the starting mode, and never with `readOnly`.
- `selection` is mapped to a `Selection` (an output through the decoded groups), dropped when R17 says so.
- `sizes` clamp to `minPaneSizes` and the row's maximum; `inputSplit` to between 0 and 1.

`Workspace` takes `savedState: MarkovInteractiveState` in place of `savedInput`, computes `restored` once in `useState`, starts its state from it, and passes `restored.useData.tool` and `restored.draw.tool` to the hooks. `usePaneLayout` takes a `start: RestoredMode` for `open`, `controlsOpen`, `paneSizes` and `followRef` (`useRef(!start.view)`). `GraphPane` takes `initialView`. `InspectPane` takes `start` for `tab` and `sorts`. `DataWorkspace` takes `text`, `capitalization` and `inputSplit`, and loses `authoredState`, which it read only for the starting text.

`Runtime` passes `readInteractiveState(interactiveState)`.

Cypress, on the fake Activity Player page: a hand-written state reopens panes, sizes, split, Inspect's tab and sort, toggles, mode, generator settings, outputs and a chosen state in each mode; positions read back in the ellipses' `cx`, `cy`; `rootTransform` matches a saved view, and a wheel zoom then continues from it; no view fits; a chosen output is pink and its row chosen; the delimiter field doesn't take focus; outputs too long for their box sit at their newest in the mode showing, in the other mode once it shows, and in a Generator pane that started collapsed once it opens; no `interactiveState` is posted and nothing logged. Jest on `restoreWork`: each R17 rule with authored states that differ from the save, positions refused on count and on case rule, no view with `readOnly`.

---

### Save the whole state at meaningful moments

**Summary**: One builder, one trigger, and the save on open goes.

**Files affected**:
- `src/interactive/workspace/build-state.ts` (new) and its test.
- `src/interactive/workspace/use-saved-work.ts` (new).
- `src/interactive/workspace/ap-host.ts`: the saving events.
- `src/interactive/runtime.tsx`, `workspace.tsx`, `data-workspace.tsx`, `draw-workspace.tsx`, `use-pane-layout.tsx`, `inspect-pane.tsx`, `input-pane.tsx`, `graph-pane.tsx`.
- `src/interactive/host-messages.ts`: `interactiveState ?? undefined`, so it is left out for none.
- `src/interactive/demo.tsx`: a restart keeps only the saved input.
- `cypress/fake-ap/fake-ap.ts`, `cypress/support/fake-ap.d.ts`, `fake-ap-commands.ts`: `requestInteractiveState(options)`.
- `cypress/e2e/interactive-runtime.test.ts`, `interactive-workspace.test.ts`, `interactive-demo.test.ts`, `interactive-saved-work.test.ts`.

**Estimated diff size**: ~480 lines

```ts
// ap-host.ts: the logged actions that change the student's work; layout changes ride along with the next of these
const savingEvents: ReadonlySet<LogEvent> = new Set<LogEvent>([
  "SequenceGenerated", "SequenceCanceled", "OutputCleared", "GeneratorSettingChanged", "StateMoved", "StateAdded",
  "TransitionAdded", "StateDeleted", "TransitionDeleted", "StateEdited", "GraphReset", "CaseSensitivityChanged",
  "OrderMattersToggled", "ProbabilitiesToggled",
]);
```

`useApHost(hosted, mode, { requestSave, markActive }, orderMatters?)` calls `markActive` after logging any event, since every event is a student's action, and `requestSave` after logging one of these. `usePaneLayout`'s `handleUserZoom` calls `markActive` too, as a zoom or pan logs nothing.

```ts
// use-saved-work.ts
export const useSaveRequest = () => {
  const [request, setRequest] = useState(0);
  const activeRef = useRef(false);
  return {
    request, activeRef,
    requestSave: useCallback(() => setRequest(n => n + 1), []),
    markActive: useCallback(() => { activeRef.current = true; }, []),
  };
};

export interface Saver {
  save: (state: MarkovInteractiveState) => void;
  // what to answer the host's page-leave request with
  setFinalState: (build?: () => MarkovInteractiveState | undefined) => void;
}

export const useSavedWork = ({ saver, request, activeRef, animating, build }) => {
  const handledRef = useRef(0);
  const awaitingDrawRef = useRef(false);
  const buildRef = useLatest(build);
  const animatingRef = useLatest(animating);

  useEffect(() => {
    if (request !== handledRef.current && !animating) {
      handledRef.current = request;
      awaitingDrawRef.current = true;
      saver?.save(buildRef.current());
    }
  }, [saver, request, animating, buildRef]);

  // the drawing that follows a change holds its states' positions, and the library posts only the last state it gets
  const afterDraw = useCallback(() => {
    if (awaitingDrawRef.current && !animatingRef.current) {
      awaitingDrawRef.current = false;
      saver?.save(buildRef.current());
    }
  }, [saver, buildRef, animatingRef]);

  useEffect(() => {
    saver?.setFinalState(() => activeRef.current ? buildRef.current() : undefined);
    return () => saver?.setFinalState(undefined);
  }, [saver, activeRef, buildRef]);

  return { afterDraw };
};
```

The request is state, not a direct call, because several actions log before they set their state; the effect runs once the render has both. `SequenceGenerated` logs before the sequence's last group is stored, and `animating` holds the save until `finishAnimating` has finished.

`Runtime` makes the `Saver` with `useMemo` when hosted, from `setInteractiveState` and `setOnUnload`, and passes nothing otherwise, so the workspace never touches the library. Its `save` and a built final state go through `copyState`, since the library deep-freezes what it is handed and the built state shares objects with live React state, such as the drawing's edges, which `Drawing` edits. The final state is undefined when the student did nothing, and `copyState` can't take that. `setOnUnload`'s type wants a function returning `Promise<{}>`, so a function that may answer undefined needs `async` and a cast to compile; the library itself takes undefined. `setFinalState(undefined)` calls `setOnUnload(undefined)`.

What the builder reads that lives in the bodies is reported into a ref owned by `Workspace`, written in effects so it never renders anything:

```ts
export interface ModeReport {
  layout?: { open: Record<string, boolean>, controlsOpen: boolean, sizes: PaneSizes };
  following?: () => boolean;
  inspect?: { tab: InspectTab, sorts: Record<InspectTab, Sort> };
  view?: SavedView;
  // Data mode: the committed text, which the graph shows
  text?: string;
  capitalization?: Capitalization;
  inputSplit?: number;
  // the states as last drawn, which dragging moves
  arranged?: { x: number, y: number, fx?: number | null, fy?: number | null }[];
}
```

Children's effects run before `Workspace`'s, so the report is current when the save effect runs. `GraphPane` adds a stable `onAutoArrangeEnd` that stores the nodes and calls `afterDraw`, and `onTransformed`, in the data variant on `Graph` and in the draw variant on `Drawing`. `Drawing`'s own `handleAutoArrangeEnd` is untouched: the draw variant needs no positions from it.

`buildInteractiveState(previous, parts)` is pure:

```ts
{
  ...previous,
  ...(hasInputPane ? { input: text === authoredText ? undefined : { text } } : {}),
  mode, probabilities,
  ...(offered.useData ? { orderMatters, caseSensitive } : {}),
  ...(offered.useData ? { useData: { ...previous.useData, ...modeFields, inputSplit, positions } } : {}),
  ...(offered.draw ? { draw: { ...previous.draw, ...modeFields, drawing } } : {}),
}
```

`previous` is the state read at open, which is what keeps R14's fields, at both levels; `authoredText` is the authored starting text. `input` is written as undefined rather than left out so that going back to the starting text clears a previous edit, and `JSON` drops it. For the same reason `modeFields` and `positions` always name every field the builder owns, as undefined when there is none, or a `view` given back or a `positions` left out would keep its old value. `positions` is omitted above `maxSavedPositions` (6,000) and when the mode has no graph; each is `Math.round(node.fx ?? node.x)`, since a dragged state's `x` trails its pin until the next tick. `view` is written for the mode showing when `following()` is false, rounded to 2 places (`k` to 4). A `drawing`'s `x` and `y` are rounded. The builder is deterministic, so a page leave after a save compares equal in the Activity Player.

A page leave builds a state only for a student who did something this session: every layout change logs or is a zoom, so `markActive` already covers them, and a student who did nothing gets the library's own copy of what they opened with, whatever the page has changed since.

In `DataWorkspace`, `onSaveInput` and its prop go; `commitText` calls `requestSave` when the text differs from `lastSavedRef`, which stays. `Runtime`'s save-on-open effect, `handleSaveInput` and `hasState` go, with the header comment in `interactive-state.ts` that describes them.

The demo page restarts the runtime with each authoring change. Handed the whole saved state, R17 would make every saved pane, switch and mode win over the form, so nothing an author changed would show after a student's first save. `getInteractiveState` gives back only `{ version: 1, input }` from the state saved under that starting text, which is what it keeps today, and its comment changes to match.

Cypress: nothing posted on open past the debounce, with an authored starting text; `requestInteractiveState({ unloading: true })` with nothing done posts undefined; after collapsing a pane, or after only a wheel zoom, it posts the state, and nothing was posted before it; each R9 moment posts once, in a table of actions; a post after typing a word holds that word's state's position, equal to its ellipse; a pane collapsed then a word typed holds both; a page-leave after a pane collapse on a student with work posts it; a student with work who reopens under a changed starting text and does nothing gets back at a page leave exactly the state they opened with; a save then reopened gives the same state back, in both modes; a save with no Input pane keeps the saved input; no post while playing, and one after; a page leave mid-sequence saves it as far as it got (R4); a word typed after reopening keeps the other states where they were and places the new one (R15). `interactive-runtime.test.ts`'s "saves a version when it opens" tests become "saves nothing when it opens". `interactive-workspace.test.ts`'s "saves the input when it commits, and shows it when it opens again" and "saves an edit that leaves the states as they were" `deep.include` a state that is now only part of what is posted, so they read `input` from the last post. `interactive-demo.test.ts`'s "restarts the runtime with each authoring change, keeping its interactive state" waits for the save on open, and becomes one that saves nothing on a restart with nothing done; a new test there changes the starting mode after a save and sees it take effect. Jest on the builder: reading what it builds through `readInteractiveState` and `restoreWork` gives back the parts; an unedited input is left out, and a reopened state then reads a changed starting text; an edited input is kept over it; more than 6,000 states leave out positions; unknown fields stay.

---

### Stop outputs at the limit

**Summary**: The 140 KiB budget, its message, its log event, and the test that the worst case fits.

**Files affected**:
- `src/interactive/saved-outputs.ts`: `maxOutputBytes = 140 * 1024`, `outputsFull`.
- `src/interactive/workspace/workspace.tsx`, `data-workspace.tsx`, `draw-workspace.tsx`, `generator-pane.tsx`, `workspace.scss`.
- `src/components/generator.tsx`: `limitReached?: boolean`.
- `src/components/log-events.ts`, `LOGGED-EVENTS.md`.
- `src/interactive/saved-outputs.test.ts`, `src/components/generator.test.tsx`, `cypress/e2e/interactive-saved-work.test.ts`.

**Estimated diff size**: ~200 lines

`Workspace` measures `savedBytes` of both modes' encoded outputs and the rounded drawing in a `useMemo` on the two `sequenceGroups` and the drawing, holding its last answer while a sequence runs, and passes `limitReached` to both bodies. A mode the page doesn't offer still counts, since R14 keeps its outputs and a fixed budget has to hold for the whole document, though its Clear Output can't be reached there. `Generator` adds `limitReached` to Play's and Step's `disabled`; because the answer holds, it is never true while a sequence runs, so a running sequence can always finish. `GeneratorPane` keeps a `<p role="status" className="output-limit">` in the output's column, empty until the limit is reached. When `limitReached` goes from false to true, `Workspace` logs `OutputLimitReached` with the output count from the mode showing's host; a state reopened over the limit starts true and logs nothing.

R21's Jest test builds the budget table's worst state: 50,000 `"`, 6,000 states at `-12345`, outputs filling `maxOutputBytes`, every layout field, beside an authored state of 20,000 `"`. It runs them through a copy of the Activity Player's `getAnswerWithMetadata` arithmetic and asserts the document is under 1,048,576 bytes. It fails if `maxOutputBytes` grows past about 150 KiB or `maxSavedPositions` past about 6,700.

Cypress, from a saved state built with `encodeOutputs` to sit just under the limit, its outputs mostly in Draw mode: one more output in Data mode disables Play and Step in both modes and shows the message; the log has `OutputLimitReached`; Clear Output in Draw mode brings it under, and enables them in both; a sequence stepped past the limit keeps its Step button to its end, and only then is it disabled (R19); a state saved over the limit reopens whole, with the message, logging nothing (R20).

---

### Show saved work read-only

**Summary**: The real report view, in place of the placeholder.

**Files affected**:
- `src/interactive/app.tsx`: passes `interactiveState` in report mode.
- `src/interactive/runtime.tsx`: `ReportPlaceholder` goes; the report note.
- `src/interactive/settings-summary.ts`, its test: deleted. `interactive.scss`: `.runtime-placeholder` goes.
- `src/interactive/workspace/workspace.tsx`, `data-workspace.tsx`, `draw-workspace.tsx`, `generator-pane.tsx`, `graph-pane.tsx`, `workspace.scss`.
- `src/components/drawing.tsx`: `readOnly?: boolean`.
- `src/components/sequence-output.tsx`: `readOnly?: boolean`.
- `cypress/e2e/interactive-runtime.test.ts`, `interactive-saved-work.test.ts`.

**Estimated diff size**: ~300 lines, about 100 of it removed

`Workspace` takes `readOnly` and passes it to both bodies; `restoreWork` already leaves out views. `hosted` is false, so logging is off, and there is no `Saver`.

- `DataWorkspace`: `readOnly={tool.animating || readOnly}` on `InputPane`, `disabled={tool.animating || readOnly}` on both switches.
- `GraphPane`: `allowDragging={!tool.animating && !readOnly}`, and `Drawing`'s `readOnly`, which also keeps `allowDragging` off and skips the state editor in `handleNodeDoubleClicked`.
- `DrawWorkspace`: `tools={readOnly ? dataTools : drawModeTools}`, with `dataTools` exported from `graph-pane.tsx`.
- `GeneratorPane`: with `readOnly` alone, `<fieldset disabled aria-label="Generator settings">` around `Generator`, which disables every control in it without touching `Generator`, styled with no border, padding or margin and `min-width: 0`: the browser's margin and `min-inline-size` otherwise shift the controls and widen their column by about 3px. `SequenceOutput`'s `readOnly` disables Clear Output.

`Runtime` shows `<p className="report-note">` above the workspace in report mode.

Cypress: a saved state in report mode, in both forms the dashboard sends (parsed, and a string) shows the student's work with the graph fitted whatever `view` was saved; the note; the text box, table, switches, generator and Draw's tools as R25 says; choosing a state, an output, a pane toggle, Inspect's tabs and the mode switch work; a double click in Draw opens no editor; no `interactiveState` or `log` message arrives past the debounce; report mode with no state shows the authored workspace.

---

### Report item, demo page and docs

**Summary**: A teacher reaches the view inline, Rebecca can try it, and the prose matches.

**Files affected**:
- `src/interactive/report-item-answer.ts` and its test: `hideViewInline` and its comment go; the placeholder's wording.
- `src/interactive/demo.tsx`, `demo.scss`: a read-only frame.
- `cypress/e2e/interactive-report-item.test.ts`, `interactive-demo.test.ts`.
- `README.md`.

**Estimated diff size**: ~100 lines

The demo keeps a `reportState` set with `savedRef`, and renders `<HostedFrame title="Teacher's view" mode="report" key={saveCount} ...>` under the runtime once there is a state, restarting with each save as a scrubber step does. `README.md`: the interactive's description now says what is saved, `report-item.html`'s line says what the links do, and a sentence notes "Save Answer History" for the scrubber.

## Verification

Before the PR: `npm run build`, the three lints, both `tsc`, Jest, Cypress in Chrome and Electron. The compiled plugin CSS is compared byte for byte with the base (R30). R33 runs on learn staging with the branch deploy.

## Open Questions

### RESOLVED: Judgment call: starting values, or a load call after mount?
**Options considered**:
- A) `getSnapshot` and `loadSnapshot` on `MarkovToolHandle`, as the forward-check notes planned.
- B) An optional starting argument to the hook, and read the tool's existing API.

**Decision**: B. A load call runs after the first render, when `useClearGoneSelection` has already cleared a saved selection, and it would have to tell itself apart from a student's change to avoid a save. Throwaway code confirmed B.

### RESOLVED: Judgment call: trigger saves from log events, or from watching values?
**Options considered**:
- A) An effect on the tool's values.
- B) The events already logged for each meaningful action.

**Decision**: B. The Max Length and delimiter fields change on every keystroke and log only when committed, which is the distinction R9 wants, and the workspace can't see that from values. Throwaway code confirmed one post per commit, holding the new state's position, and the final output after Play.

### RESOLVED: Judgment call: report body state through a ref, or lift it to `Workspace`?
**Options considered**:
- A) Lift the panes, Inspect and split state into `Workspace`.
- B) Leave it where MARK-15 and MARK-16 put it, and report it into a ref.

**Decision**: B. Layout changes must not save or render the shell, and lifting would rewrite reviewed code on two open branches this one rebases onto.

## Self-Review

Reviewed as senior engineer, commit reviewer, test writer and operator, each finding checked against the code or by throwaway code and fixed above:

- Operator: `ManagedState` deep-freezes the state it is handed and the init message, which would freeze live graph objects on a save and restored ones on reopening, and `Drawing` edits them. Both ends clone.
- Commit reviewer: moving `InspectTab` and `Sort` wasn't in the first step's file list.
- Test writer: the limit test needs a state it can build, so it uses `encodeOutputs`; the R21 margin figure was recomputed.
- Senior engineer: the mount fit shouldn't need an `exhaustive-deps` disable, so it goes through `toolRef`.
- Test writer: `structuredClone` and `TextEncoder` are undefined in Jest's jsdom, which failed step one's tests and `standalone.test.tsx`; a JSON copy and `Blob` work there. A sequence can't be paused while the other mode generates, as the mode switch is disabled, so that test couldn't be written and the guard it covered is gone. `sequence-output.test.tsx` wasn't listed. Three existing Cypress tests depend on the save on open or an exact post.
- Commit reviewer: `interactive-demo.test.ts` breaks at the saving step, not the last one. `DataWorkspace`'s `authoredState` is orphaned at the reopening step, and `lastSavedRef` has to stay for "the text changed".
- Senior engineer: `hadWork` is redundant once every layout change marks the student active, and only rebuilt a state nobody changed; it goes. `setOnUnload`'s type refuses a function that can answer undefined. The builder dropped unknown fields inside `useData` and `draw`, and wrote `orderMatters` and `caseSensitive` without Data mode.
- Teacher: the demo page would have stopped showing authoring changes after a student's first save, so a restart keeps only the input.
- Accessibility expert: the generator's `fieldset` needs a name, and only the read-only view needs it at all.
