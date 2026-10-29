# Implementation Plan: Update React and the Markov plugin's runtime libraries

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-12
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Before starting

The branch is rebased onto MARK-11's branch first, so it sits on master, MARK-6, MARK-20, MARK-8, MARK-9, MARK-10 and MARK-11. The plan assumes what those stories land: MARK-20's Reset, which rebuilds a dataset-mode graph from the attribute's values; Node 24 (`.nvmrc`), TypeScript 6.0.3 with `"moduleResolution": "bundler"`, Jest 30.5 with jsdom 26, Cypress 16.2, `@testing-library/jest-dom` pinned to 6.9.1, and no `@testing-library/react-hooks` (MARK-8); ESLint 9 with three flat configs (MARK-9); MARK-10's unit tests; and MARK-11's Cypress rendering tests with the fake-CODAP parent page R16 needs (`cypress/fake-codap/`, its commands in `cypress/support/`, and a `cypress` CI job that `s3-deploy` waits for). Line numbers below are as MARK-10 leaves the code (MARK-11 changes no source), and the code they point at is what matters: MARK-10 moves generation and the saved-state logic out of `app.tsx` and `use-codap.ts` into `utils/`, and `translateOrigin`, beside the `done` the fit fix edits, calls `moveOriginToCenter` (MARK-10's closed spec, "What MARK-11 and MARK-12 inherit").

Run `npm ci`, `npm run build`, `npm run lint`, `npm run lint:style`, `npx tsc --noEmit -p .`, `npx tsc --noEmit -p cypress`, `npm test` and, with `npm start` running (the Cypress tests need the dev server), `npm run test:cypress` on the rebased branch before the first commit, and keep the output: it is the baseline every later step is compared with. (`npm run build` runs `lint:build` first; if port 8080 is taken, start the dev server on another port and set `CYPRESS_baseUrl`, as the README says.) On MARK-11's head (2026-10-29, Node 24.14, npm 11.9) `npm ci` succeeds, the build compiles with no warnings, both `tsc` commands and the three lint commands print nothing, Jest passes 56 tests in 9 suites, and Cypress passes 27 tests in 7 files in Chrome.

## Implementation Plan

### Pass an initial value to every `useRef`

**Summary**: `@types/react` 19 requires an argument to `useRef`. Passing `undefined` explicitly type-checks on React 17's types too, so this lands first, as a source-only commit that builds and changes nothing at runtime (R8).

**Files affected**:
- `src/components/app.tsx`: 3 calls
- `src/components/drawing.tsx`: 1 call
- `src/components/graph.tsx`: 4 calls
- `src/hooks/use-codap.ts`: 1 call

**Estimated diff size**: ~18 lines

Each `useRef<T>()` becomes `useRef<T | undefined>(undefined)`:

```tsx
// app.tsx
const currentAnimatedSequenceGroup = useRef<SequenceGroup | undefined>(undefined);
const animationInterval = useRef<number | undefined>(undefined);
const datasetValuesRef = useRef<string[] | undefined>(undefined);

// drawing.tsx
const transformRef = useRef<Transform | undefined>(undefined);

// graph.tsx
const transformRef = useRef<Transform | undefined>(undefined);
const zoomRef = useRef<d3.ZoomBehavior<any, any> | undefined>(undefined);
const lastFitViewAtRef = useRef<number | undefined>(undefined);
const lastRecenterViewAtRef = useRef<number | undefined>(undefined);

// use-codap.ts
const valuesRef = useRef<string[] | undefined>(undefined);
```

Find them with `grep -rn "useRef<.*>()" src`; it must print nothing afterward. Checked on MARK-11's head: both `tsc` commands and the three lint commands pass on `@types/react` 17 with this step and the next applied.

---

### Fit the view after a graph change has rendered

**Summary**: The R9 fix. `app.tsx` stops setting `fitViewAt` in the same breath as the graph change; it sets a flag, and an effect on `graph` sets `fitViewAt` after the new graph has committed. That puts the fit in the render after the graph component's `setD3Graph`, so the fit measures the new drawing whether or not React batches. It lands before the React bump: on React 17 it gives the same transforms as today, and it is what React 19 needs.

**Files affected**:
- `src/components/app.tsx`: one ref, one effect, three call sites

**Estimated diff size**: ~22 lines

Add after the `fitViewAt` state (`app.tsx:101`):

```tsx
  // fit in the render after the graph change, once Graph has drawn the new graph
  const fitAfterGraphChangeRef = useRef(false);
  useEffect(() => {
    if (fitAfterGraphChangeRef.current) {
      fitAfterGraphChangeRef.current = false;
      setFitViewAt(Date.now());
    }
  }, [graph]);
```

Then replace `setFitViewAt(Date.now())` at the three sites that follow a graph change:

```tsx
  const onCODAPDataChanged = (values: string[]) => {
    datasetValuesRef.current = values;
    updateGraph(values);
    fitAfterGraphChangeRef.current = true;
  };
```

```tsx
    const done = () => {
      setGraph(data);
      fitAfterGraphChangeRef.current = true;
    };
```

```tsx
        setTimeout(() => {
          const restoredGraph = graphToRestore(viewMode, initialGraph, datasetValuesRef.current);
          if (restoredGraph) {
            setGraph(restoredGraph);
            fitAfterGraphChangeRef.current = true;
          } else {
            setFitViewAt(Date.now());
          }
          setGraphOpacity(1);
        }, 1);
```

In `handleReset` only the branch that sets a graph uses the flag. In dataset mode that branch needs no fix (Reset unmounts `Graph` and the new one fits itself; see the requirements' Background), but the flag is harmless there and keeps Reset's two branches simple. With nothing to restore (`graphToRestore` returns `undefined`: a drawing not loaded from a saved document, or dataset mode before an attribute is dropped) the graph stays empty, no graph change follows, and the effect would never fire, so the `else` keeps today's direct request. That request fails on the empty drawing (`fitOrCenter` returns `false` for an empty bounding box) and stays pending until the fit effect next runs, which a resize of the plugin triggers: a resize after the user draws a new chain fits the view. Dropping the request would remove that, a visible change R10 does not allow. `handleFitView` (the toolbar button) keeps calling `setFitViewAt` directly, since it changes no graph.

The effect must be declared after `useGraph()` (`app.tsx:99`), which it reads. It is lint-clean under MARK-9's flat configs (checked with this step and the previous one applied on MARK-11's head: both `tsc` commands and all three lint commands print nothing), because MARK-9 enables only `exhaustive-deps` and `rules-of-hooks` from react-hooks 7, not the React Compiler rules (such as `set-state-in-effect`) that would flag a state update inside an effect. It relies on `graph` getting a new object on every change: `updateGraph` and `graphToRestore`'s dataset branch always build one, and `setGraph(data)` and `setGraph(restoredGraph)` always follow a different graph (the empty one, in Reset's case).

The R16 tests check it on React 17 and React 19.3.1 (results under "Add fit-to-view rendering tests"). The alternative, wrapping the graph update in `flushSync`, also passed, but it forces a synchronous render from inside callbacks React now batches and adds a `react-dom` import to `app.tsx` for what is a render-ordering problem.

---

### Add fit-to-view rendering tests

**Summary**: R16. One Cypress test per R9 case (four), plus one for Reset's `else` branch, on the fake-CODAP parent page MARK-11 provides: it starts the plugin with given saved state and sends it `dragDrop[attribute]` and case-change notifications. Its commands are listed in MARK-11's closed spec ("The page's commands") and typed in `cypress/support/index.d.ts`. MARK-11's `afterEach` fails a test on any error or unhandled rejection in the plugin's frame, from the moment the frame is added, so these tests also catch an error React 19 throws while the plugin starts.

**Files affected**:
- `cypress/e2e/fit-view.test.ts`: new, beside MARK-11's `fit.test.ts` (MARK-11's one-file-per-area decision)
- `cypress/support/graph.ts`, `cypress/e2e/fit.test.ts`: `rootTransform` moves from `fit.test.ts` into `graph.ts` as an export, and both test files import it

**Estimated diff size**: ~65 lines

The helper has to move, not be copied: `fit.test.ts` has no import, so it is a script, and a second file declaring `const rootTransform` at its top level fails `npx tsc --noEmit -p cypress` with TS2451 in both files, and the dev server reports the same errors (measured on MARK-11's page).

Assertions, chosen to hold on React 17 with or without the fix and to fail on React 19 without it:

| Test | Setup | Assertion |
|---|---|---|
| unversioned drawing | `cy.startPlugin({savedState})` with the `ela/geDiXLf2GyHsWCF2QFnU.json` fixture minus its `version` key | the root transform has a `scale`, and clicking Fit View leaves it unchanged |
| Reset | `cy.startPlugin({savedState})` with the same fixture as saved (`version: 2`), read the transform, click `.plusButton` twice, Reset, Ok | the transform equals the one read before zooming |
| cases change | `cy.startPlugin({attribute: "Word"})` (5 states), click Fit View, read the transform, `cy.setAttributeValues("Word", ...)` with 3 distinct values, `cy.notifyCases("createCases")`, wait for 3 states | the transform differs from the one read before |
| second drop | `cy.startPlugin()`, the Dataset button, `cy.dropAttribute("Word")` (5 states), click Fit View, read the transform, `cy.dropAttribute("Letter")`, wait for 3 states | the transform differs from the one read before |
| Reset, then resize | `cy.startPlugin()`, the Drawing button, Add State, click the graph, Reset, Ok, click the graph again without pressing Add State (it stays selected after Reset, and pressing it again turns it off), `cy.resizePlugin` to a new size | the root transform has a `scale` |

Read the transform with `rootTransform` (`.graph > svg g.root`'s `transform` attribute), and wait for it with Cypress's retrying `should` rather than a fixed delay. Dataset assertions compare with a transform read earlier, never with an expected value, since the force layout races the fit (see the requirements' note on the first drop). The two dataset-change tests click Fit View before reading that transform. The draw effect creates the nodes at their starting positions and the DOM gets the laid-out ones on the simulation's next tick (`graph.tsx`, draw effect), so an automatic fit measures either and lands on one of two transforms from run to run. On React 19 without the fix, the change's fit measures the old, laid-out drawing, which is what Fit View measures, so the two match exactly. With an automatic baseline both tests sometimes passed without the fix; with the Fit View baseline they failed in every React 19 run without it.

These tests pass when added (React 17 with the fix). To confirm each one guards something, after the React bump run `git revert --no-commit <fit commit>` and check that the four R9 tests fail, then `git revert --abort` (the revert is staged and in progress, so `git checkout -- src` does not undo it). Then delete only the `else` in `handleReset`, check that the Reset-then-resize test fails, and `git checkout -- src/components/app.tsx`. Revert with git rather than by hand: code that fails lint makes the dev server's error overlay cover the plugin, and every test fails for that reason alone. The Reset-then-resize test still passing in the reverted run shows the overlay is not up. Wait about 30 s after each edit before running, since the dev server's rebuild can lag and an early run tests the old code. The PR records that check.

Checked as throwaway code on MARK-11's head (2026-10-29, Chrome), with the tests written exactly as in the table: on React 17 with the fix all five pass; on React 19.3.1 without the fix the four R9 tests fail and Reset-then-resize passes, in 2 of 2 runs; with the fix the whole suite passes 32 of 32, three runs in a row; with only Reset's `else` deleted, only Reset-then-resize fails.

---

### Install React 19 and its testing library

**Summary**: R1 to R3 and R6. Dependencies and lockfile only. This commit does not type-check: React 19 removes `render`, which `index.tsx` imports. The next commit is the first that builds again (R17).

**Files affected**:
- `package.json`: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, new `@testing-library/dom`
- `package-lock.json`

**Estimated diff size**: ~12 lines in `package.json`; the lockfile diff is generated

```bash
npm install react@^19.3.1 react-dom@^19.3.1
npm install --save-dev @types/react@^19.3.0 @types/react-dom@^19.3.0 \
  @testing-library/react@^16.3.3 @testing-library/dom@^10.4.1
```

(Use the newest 19.x and 16.x at implementation time; these were newest on 2026-10-26.) The first command prints `ERESOLVE overriding peer dependency` warnings for `@testing-library/react` 12, whose peer is `react <18`; that is expected, and the second command clears them. The order matters: run the other way round, npm refuses `@testing-library/react` 16 beside React 17 with `ERESOLVE unable to resolve dependency tree`. One combined command also installs cleanly but puts the new `@testing-library/dom` under `dependencies`. Then `rm -rf node_modules && npm ci`, and check its output has no `ERESOLVE`, `EBADENGINE` or peer-dependency warnings (R6). Checked in a scratch copy on Node 22, and on Node 24.14 with npm 11.9: none, and the lockfile stays at `lockfileVersion` 2.

---

### Mount the app with `createRoot`

**Summary**: R7. The one code change React 19 forces. After this commit the build, `tsc`, lint and both test suites pass again.

**Files affected**:
- `src/index.tsx`

**Estimated diff size**: ~6 lines

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/app";

import "./index.scss";

createRoot(document.getElementById("app") as HTMLElement).render(<App />);
```

No `<StrictMode>` wrapper (R7). The cast keeps today's behavior if `#app` were missing: `createRoot` throws, as `render` did.

Then run the full baseline set from "Before starting". The build, `tsc` and lint pass at this commit. The tests pass here too, or after the next step if a testing-library change is needed. Compare with the baseline: the same unit and rendering tests pass, the build has the same warnings, and the development build logs nothing new in the console.

---

### Adjust tests for testing-library 16, if any fail

**Summary**: R14. Only if a MARK-10 or MARK-11 test fails after the previous step for a testing-library reason. Skip the step otherwise. Expected to be skipped: on MARK-11's head with React 19.3.1 and `@testing-library/react` 16.3.3, MARK-10's 56 Jest tests pass with no `act` warnings, and MARK-11's 27 Cypress tests pass. The usual causes from `@testing-library/react` 13+: `render` now uses `createRoot`, so a state update after an `await` may need `findBy` or `waitFor` where a synchronous query used to pass, and updates outside `act` warn.

**Files affected**: the failing test files only

**Estimated diff size**: unknown until the tests exist; expected small

Each change gets one line in the PR naming the test and the API reason. A test whose assertion about plugin behavior has to change is not adjusted here: that is a regression, and it is fixed in the source the way R9 was.

---

### Update the other runtime libraries

**Summary**: R4 and R5. Dependencies and lockfile only; the build and tests pass before and after. The lockfile already has `tslib` 2.8.1, so for it only the `package.json` range changes.

**Files affected**:
- `package.json`: `d3`, `@types/d3`, `nanoid`, `clsx`, `tslib`, and `iframe-phone` pinned exactly
- `package-lock.json`

**Estimated diff size**: ~7 lines in `package.json`; the lockfile diff is generated

```bash
npm install d3@^7.9.0 nanoid@^6.0.2 clsx@^2.1.1 tslib@^2.8.1
npm install --save-exact iframe-phone@1.3.1
npm install --save-dev @types/d3@^7.4.3
```

`iframe-phone` stays on 1.3.1 (R5), the story's one deliberate exception to "all runtime dependencies on supported versions"; the PR says so and why. The exact pin keeps `npm update` from installing 1.4.0, which fails `tsc` with TS7016 (measured with `^1.3.1`: `npm update iframe-phone` installed 1.4.0; with `1.3.1`, `npm update` kept it). Checked in a scratch copy: `tsc`, the build and the CODAP run are unchanged with these versions, and `tsc` also passes with them under TypeScript 6.0.3 and `bundler` resolution, and `nanoid` 6's `node ^22 || ^24 || >=26` is met by MARK-8's Node 24.

---

### Verify and write up the PR

**Summary**: R11 to R15. No commit unless the check finds something.

1. The baseline commands from "Before starting", all green, with the counts compared with the baseline: Jest 56 tests in 9 suites, Cypress 32 tests in 8 files (MARK-11's 27 plus these five). On the push, CI's `build_test` and `cypress` jobs (Chrome) run them too, and `s3-deploy` runs only after both pass.
2. Revert the fit fix locally and confirm the four R9 fit tests fail; delete only the `else` in `handleReset` and confirm the Reset-then-resize test fails; restore both (see "Add fit-to-view rendering tests").
3. Manual check in CODAP 3.1.2, side by side with the branch build of the branch MARK-12 sits on (MARK-11's), since MARK-20 changed what users see and master is no longer the comparison. Open a branch build as `https://codap.concord.org/app/?di=https://models-resources.concord.org/markov-chain-plugin/branch/<branch name without the Jira prefix>/index.html` (this story's is `branch/react-and-runtime-libraries/`; add `&sample=mammals` for a dataset to drop). The branch build is a production build, so for R13 repeat the checklist on `npm start` loaded into the same CODAP with the browser console open: no new React warnings or errors.
   - Dataset mode: drop an attribute; add, edit and delete cases in it; drop a second attribute; zoom in, then Reset. The view refits each time, and Reset rebuilds the graph.
   - Drawing mode: add, edit and delete states and transitions; change a probability with the selector; create from text; Reset on a drawing loaded from a saved document (the view refits to the saved drawing; on a drawing started in the session, Reset empties it, as on the base branch, and after adding a state, resizing the plugin fits the view); Back to Main.
   - Generating: Play, Pause, Resume, Step, Cancel, at both speeds; click an output to highlight it; check the "Sequence Data" table gets one item per state.
   - The graph: node sizes, edge widths, loops, zoom in and out, Fit View, Recenter.
   - Saved documents: the five ELA documents MARK-5 loaded (`version: 2` drawings), an unversioned drawing (one made by deleting `version` from a saved document's plugin state), and a dataset document. Each loads, fitted, as it does on the base branch. Open an ELA document with the branch build by adding `&url=https://cfm-shared.concord.org/<id>/file.json&di-override=markov-chain-plugin` to the branch build's URL, for each id: `lr1YsZHAZ1KYXxk67jD2`, `pnRUlM27cXXrJrofZAXx`, `4gqlICXB3YqN3AfivyZZ`, `geDiXLf2GyHsWCF2QFnU`, `9nsC6KpuDstv2N9eGndM`.
   - Not regressions: on an empty dataset view, the first drop's fit varies between two zoom levels from run to run, on the base branch and on React 19 alike; and on load the plugin renames its tile "Markov Chain" and resizes it to 600x420, as every earlier version does.
4. PR body: the checklist and results, the commit that first builds after the React install, the test adjustments if any, and the production bundle size before and after from `npm run build` on the head commit.

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: fix the fit order with an effect, not `flushSync`
**Options considered**:
- A) A flag plus an effect on `graph` that sets `fitViewAt` after the graph change commits
- B) `flushSync(() => setGraph(...))` before `setFitViewAt` at each site

**Decision**: A. Both restored the React 17 transforms in the harness. A keeps the fit in a normal React render and fixes the ordering where it is decided. B forces synchronous renders from callbacks React now batches, which React's docs treat as a last resort.

### RESOLVED: Judgment call: land the fit fix before the React bump
**Options considered**:
- A) Fix first, on React 17, then bump
- B) Bump, then fix the regression it caused

**Decision**: A. The fix gives the same transforms on React 17 (measured), so the commit can be checked against today's behavior on its own, and no commit in the branch has the regression. The cost is that the R16 tests never fail in the branch's history, which the revert check in the verify step covers.

### RESOLVED: Judgment call: cast in `index.tsx` instead of guarding
**Options considered**:
- A) `document.getElementById("app") as HTMLElement`
- B) `if (container) { createRoot(container).render(<App />); }`

**Decision**: A. A guard would render nothing, silently, if `#app` were missing; the cast fails loudly, as `render` does today. A non-null assertion (`!`) would behave the same; typescript-eslint 8's `recommended`, which MARK-9 lands, no longer enables `no-non-null-assertion`, so lint does not decide between them.

## Self-Review

Roles: commit reviewer (does each step stand on its own), test writer (can each named test be written on the harness the stack provides), senior engineer, the PR's reviewer (a developer newer to the repo), QA engineer, and operator (CODAP integrator).

### Senior Engineer

#### RESOLVED: the Reset change was described as dropping a no-op
With no initial graph, today's fit request is not quite a no-op: it fails on the empty graph and stays pending until the plugin is resized. The step now says so.

#### RESOLVED: Reset with no initial graph lost a fit that master performs
The pending request from Reset fires on the next resize even after the user has drawn a new chain, so dropping it was visible. The Reset code keeps `setFitViewAt` in an `else` branch. Checked by rendering the real `Graph` under React 19 in jsdom (stubbed `getBBox` and `ResizeObserver`): Reset, draw, resize refits on master and with the `else`, and does not without it.

### Commit Reviewer

#### RESOLVED: the `createRoot` step claimed green tests before the step that may fix them
If MARK-10 or MARK-11 tests need testing-library changes, they fail at the `createRoot` commit and pass after the next one. The step now says the build, `tsc` and lint pass there, and the tests there or one step later.

### Test Writer

#### RESOLVED: RTL 16 had only been run under Jest 28
MARK-8 lands Jest 30. Re-run under Jest 30.5.2 with jsdom 30 and jest-dom 6.9: the smoke test passes, and jsdom still has no `getBBox`, which keeps R16's tests in Cypress. Recorded under "Before starting".

### Reviewer

#### RESOLVED: the first install command prints ERESOLVE warnings
Installing React 19 while `@testing-library/react` 12 is still listed succeeds with `ERESOLVE overriding peer dependency` warnings, which a reviewer following the step could take for a failure. The step now says to expect them, and why the order and the two commands stay as they are. Measured with npm 11.9 on Node 24.14.

#### RESOLVED: the cast judgment call relied on a rule MARK-9 turns off
typescript-eslint 8's `recommended` has no `no-non-null-assertion` (checked in `typescript-eslint` 8.72), and MARK-9 deletes the disable comment that rule needed. The decision stands on failing loudly; the lint reason is removed.

### QA Engineer

#### RESOLVED: the manual Reset check assumed a saved drawing
`initialGraph` is set only when a drawing is loaded from saved state, so Reset on a drawing started in the session empties it rather than refitting. The checklist now runs Reset on a loaded drawing and says what Reset does otherwise.

### Operator (CODAP integrator)

#### RESOLVED: the R13 console check was planned on a production build
The CI deploy runs `npm run build` (`webpack --mode production`), and React's production bundle logs no warnings, so the branch build cannot show R13. The verify step now repeats the checklist on `npm start` for R13.

### Second pass (test writer)

#### RESOLVED: install and library checks predated MARK-8's toolchain
Replayed the install commands on Node 24.14 and npm 11.9 (same warnings, clean `npm ci`, `lockfileVersion` 2 kept), and type-checked the other runtime libraries under TypeScript 6.0.3 with `bundler`. Both steps now say so.

#### RESOLVED: no automated test guards Reset's `else` branch
Deleting the `else` leaves the R9 tests green; a jsdom harness shows it removes the refit on resize after Reset. Options were (A) a Cypress test of its own, (B) the manual check only. Decided (A): the branch was nearly dropped once in review, and the shared-component refactor planned after this stack is where it would be lost. The test resizes the plugin iframe, which MARK-11's page has to allow (noted for MARK-11's spec).

### Third pass

Roles: test writer (does each R16 test fail without what it guards), senior engineer, MARK-11's integrator (does the plan match MARK-11's final spec), and dependency maintainer. Each finding was checked on MARK-11's fake-CODAP page in a scratch copy of MARK-9's branch, on React 17 and React 19.3.1.

#### RESOLVED: dataset-mode Reset is not a React 19 regression, so its test cannot fail
It passes on React 19 without the fix, and with Reset's fit request deleted, because Reset unmounts `Graph` (`dataset.tsx`, `if (graphEmpty)`) and the rebuilt one fits itself. Options were to drop it, keep it outside the revert check, or keep it and have the revert check fail. Dropped (Doug, 2026-10-28): five fit tests in all, with the behavior left to R11's manual check and MARK-11's modes test.

#### RESOLVED: the two dataset-change tests passed without the fix in some runs
With the transform read after the automatic fit, cases change passed on React 19 without the fix in 1 of 9 runs and second drop in 3 of 5: the automatic fit sometimes measures the nodes before the layout's first tick moves them, and the unfixed refit then measures the laid-out drawing and differs. Both tests now click Fit View before reading; failed 6 of 6 runs without the fix, passed every run with it.

#### RESOLVED: a second top-level `rootTransform` breaks the Cypress type check
MARK-11's `fit.test.ts` is a script, so `fit-view.test.ts` declaring the same helper fails `tsc -p cypress` with TS2451 in both files. The helper moves to `cypress/support/graph.ts`; the file location follows MARK-11's decision (`fit-view.test.ts`), replacing "or MARK-11's rendering spec file".

#### RESOLVED: a hand-made revert can fail every test through the dev server's overlay
A lint error in the reverted code put webpack-dev-server's error overlay over the plugin and failed tests on "covered by another element". The revert check now uses `git revert --no-commit` and reads the Reset-then-resize pass as proof the overlay is down.

#### RESOLVED: `^1.3.1` does not hold iframe-phone on 1.3.1
`npm update iframe-phone` installs 1.4.0 under `^1.3.1`, and `tsc` fails with TS7016. R5 and the libraries step pin `1.3.1` exactly.

#### RESOLVED: "MARK-10 and MARK-11 add tests" was stale
MARK-10 moves generation and saved-state code out of `app.tsx` and `use-codap.ts`, shifting the `useRef` lines by one and editing `translateOrigin` next to `done`. "Before starting" now says so, and that `test:cypress` needs `npm start`.

#### RESOLVED: React 19 also varies on the first dataset fit
On MARK-11's page the first dataset fit landed on `scale(1.45)` or `scale(2.27)` on React 19, fix or not. The Background and the manual check's "not regressions" note no longer say React 19 picks one every time.

### Fourth pass (MARK-11 as shipped)

#### RESOLVED: the test setups pointed at a list MARK-11's closed spec no longer has
MARK-11's closed spec lists the page's commands but not MARK-12's setups, so the table now gives each setup in those commands and names the fixture. Each one was written and run on MARK-11's head; results are under "Add fit-to-view rendering tests". `fit.test.ts` still declares `rootTransform` at its top level with no import, so the move to `graph.ts` stands, and its changed Recenter test does not touch that line.

### Fifth pass

Roles: commit reviewer (Maureen Zitouni, who reads commit by commit), dependency maintainer, and the engineer following the commands. Each command was replayed in a scratch clone with the planned commits applied.

#### RESOLVED: the revert check had no restore command that works
`git revert --no-commit` stages the revert and leaves `REVERT_HEAD`, so `git checkout -- src` leaves the fix reverted. The test step now gives `git revert --abort` for the revert and `git checkout -- src/components/app.tsx` for the deleted `else`, in that order.

#### RESOLVED: `tslib` needs no lockfile change
The lockfile already resolves it to 2.8.1; the libraries step now says only its range moves. Replayed the step's three commands: `package.json` gets `"iframe-phone": "1.3.1"`, nothing prints a peer or engine warning, and `tsc` (both projects), the build, the three lint commands and Jest's 56 tests pass on React 19.3.1.

#### RESOLVED: repeated scratch-check results
The "Before starting" check of MARK-8's versions repeated the requirements' TypeScript and Jest notes, the fit step cited a pre-MARK-20 harness the R16 run supersedes, and the dataset-Reset entry carried its full option list. Each is cut to one source or a line or two.
