# Update React and the Markov Plugin's Runtime Libraries

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-12

**Status**: **Closed**

## Overview

Move the plugin's runtime libraries, React above all, from 2022-era versions to current supported ones, with no change a teacher or student can see. The unit tests (MARK-10) and rendering tests (MARK-11) added just before this story are what show nothing changed. Checking the update found one thing it breaks, the graph no longer fitting to view after some changes, and the story fixes it with tests.

The branch sits on MARK-11's (rendering tests), which sits on MARK-10's, MARK-9's, MARK-8's, MARK-20's and MARK-6's. Ownership (#1191): MARK-8 owns Node and test tooling, including `@testing-library/jest-dom`; MARK-9 owns ESLint. MARK-12 owns React, React DOM, their types, `@testing-library/react` and its `@testing-library/dom` peer, and the runtime libraries. "As before" means the branch MARK-12 is stacked on, since MARK-20 changed what users see.

## Requirements

### Library versions

- **R1.** `react` and `react-dom` move to the newest React 19 (19.3.1).
- **R2.** `@types/react` and `@types/react-dom` move to the matching 19.x (19.3.0).
- **R3.** `@testing-library/react` moves to 16.x (16.3.3), and `@testing-library/dom` 10.x (10.4.2) is added to `devDependencies` as its peer.
- **R4.** `d3` moves to the newest 7.x (7.9.0), and `@types/d3` to the newest 7.x (7.4.3).
- **R5.** `nanoid`, `clsx` and `tslib` move to their newest release (6.0.2, 2.1.1, `^2.8.1`). `iframe-phone` stays on 1.3.1, pinned exactly (`"1.3.1"`), the one deliberate exception to "all runtime dependencies on supported versions": 1.4.0's `exports` map has no `types` condition, so it fails TS7016 under `bundler` resolution, and `^1.3.1` lets `npm update` install it.
- **R6.** `npm ci` succeeds with no `ERESOLVE`, `EBADENGINE` or peer-dependency warnings for the packages this story changes, on MARK-8's Node 24.

### Code changes the update requires

- **R7.** `src/index.tsx` mounts the app with `createRoot` from `react-dom/client`, not wrapped in `<StrictMode>`.
- **R8.** Every `useRef` call passes an initial value, so the code type-checks against `@types/react` 19. Ref types and runtime values are unchanged.
- **R9.** The view fits the graph after it is replaced from outside a React event, as on React 17: loading a drawing saved without a `version`, dataset cases changing, a second attribute dropped on an existing graph, and Reset on a loaded drawing.
- **R10.** No other source changes beyond R7 to R9 and what the type check, the build or a failing test requires.

### No visible change

- **R11.** The plugin behaves as before in CODAP: dataset mode (drop, case edits, Reset), drawing mode (states and transitions, the probability selector, create from text, Reset, Back to Main), generating (Play, Pause, Resume, Step, Cancel, both speeds, output highlighting, "Sequence Data" items), and the graph (sizes, widths, loops, highlighting, zoom, fit, recenter).
- **R12.** Saved documents load as before: `version: 2` drawings, unversioned drawings (translated by `onSetGraph`), and dataset documents.
- **R13.** The development build logs no new React warnings or errors.

### Verification

- **R14.** MARK-10's unit tests and MARK-11's rendering tests pass. A test changes only for a testing-library API change, never to accept different plugin behavior. *(No test needed a change.)*
- **R15.** A manual check in CODAP 3.1.2 covers R11 and R12 against the branch build and R13 against a development build, and is recorded in the PR. *(Partly done before the push; see Not Yet Implemented.)*
- **R16.** Each R9 case has a Cypress test on MARK-11's fake-CODAP page that fails on React 19 without the fix and passes with it, plus one test that fails if Reset's `else` branch is deleted: after Reset on a drawing started in the session, adding a state and resizing the plugin fits the view.
- **R17.** Dependency and lockfile changes are in commits separate from source changes. The React 19 install commit does not build, and the `createRoot` commit right after it is the first that does.

*(Head: Jest 56 tests in 9 suites with no `act` warnings; Cypress 32 tests in 8 files, three runs in a row in Chrome and once in Electron; build, both `tsc` commands and the three lint commands silent; clean `npm ci`. Revert check: with the fit commit reverted the four R9 tests fail and Reset-then-resize passes; with only Reset's `else` deleted, only Reset-then-resize fails. Production JavaScript grows from 264,734 to 355,486 bytes.)*

## Technical Notes

### Where the code is

| Part | Files |
|---|---|
| `createRoot` mount | `src/index.tsx` |
| `useRef` initial values | `components/app.tsx`, `drawing.tsx`, `graph.tsx`, `hooks/use-codap.ts` (nine calls) |
| Fit fix | `components/app.tsx`: `fitAfterGraphChangeRef` and its effect on `graph`, set in `onCODAPDataChanged`, `onSetGraph`'s `done` and `handleReset` |
| Fit tests | `cypress/e2e/fit-view.test.ts`; `rootTransform` shared from `cypress/support/graph.ts` |

### The fit-to-view regression

`app.tsx` used to set `fitViewAt` right beside the graph change. `graph.tsx` builds `d3Graph` in one effect, draws it in a second and fits in a third, measuring the drawn bounding box. React 17 rendered the graph change on its own first, so the fit measured the new drawing. React 18 and later batch the two into one render, so the fit measured the old drawing or an empty one. The fix sets a flag where the graph changes, and an effect on `graph` requests the fit in the next render, after the new graph is drawn. It relies on `graph` being a new object on every change.

Reset with nothing to restore (a drawing started in the session, or dataset mode before a drop) keeps its direct `setFitViewAt`. The request fails on the empty drawing and stays pending until the next resize, so a resize after the user draws a new chain fits the view. Dataset-mode Reset needs no fix: `Dataset` renders its instructions instead of `Graph` while the graph is empty, so Reset unmounts `Graph`, and the rebuilt one fits itself.

### The fit tests

Dataset assertions compare with a transform read earlier, never an expected value, because the force layout races the fit. The two dataset-change tests click Fit View before reading that transform; with the automatic fit as the baseline they sometimes passed without the fix. The unversioned-drawing and Reset tests use `ela/geDiXLf2GyHsWCF2QFnU.json`. In the Reset-then-resize test, Add State stays selected after Reset, so the test clicks the graph again without pressing it.

To check the tests can fail, run `git revert --no-commit` of the fit commit and then `git revert --abort` (the revert stays in progress, so `git checkout -- src` does not undo it). Revert with git rather than by hand, since code that fails lint brings up the dev server's error overlay and fails every test. Wait about 30 s after each edit for the dev server's rebuild.

### Other notes

- **StrictMode hazard, for whoever adopts it later:** the effect in `use-codap.ts` that calls `initializePlugin` guards it with the `initialized` state value. Under StrictMode's development-only remount, the second run still sees `false` and would create a second `IframePhoneRpcEndpoint`. A ref guard would fix it.
- **Fit tests run in a browser:** `fitOrCenter` uses `getBBox`, which jsdom 26 does not implement.
- **JSX transform:** `tsconfig.json` keeps `"jsx": "react"`; React 19 runs it without a warning.
- **Install order:** React goes first, printing expected `ERESOLVE overriding peer dependency` warnings for `@testing-library/react` 12, and the testing library second, which clears them. The other order fails with `ERESOLVE unable to resolve dependency tree`.
- **`tslib`** was already 2.8.1 in the lockfile; only its `package.json` range moved.
- **Node:** nanoid 6 declares `node ^22 || ^24 || >=26`; nanoid 5 is the fallback if the Node pin changes.
- **Lint:** the effect calls `setFitViewAt` inside an effect, which MARK-9's configs allow, since they enable only `exhaustive-deps` and `rules-of-hooks` from react-hooks 7, not the React Compiler rules.
- **Not regressions seen in CODAP:**
  - On an empty dataset view the first drop's fit varies between two zoom levels from run to run, on both builds.
  - The plugin renames its tile and resizes it to 600x420 on load, as every version does.
  - A document's load fit can run before CODAP shrinks the tile, leaving a fit for the larger frame until Fit View is clicked. It was seen with `lr1YsZHAZ1KYXxk67jD2`: on the base the zoom varied from 0.66 to 0.83, here it was 0.85 every run, and Fit View gives 0.51 on both.

## Out of Scope

- Build tooling, test runners, Node, TypeScript, GitHub Actions and `@testing-library/jest-dom` (MARK-8), and ESLint (MARK-9).
- Adopting `<StrictMode>`, the new JSX transform, or React 19 features.
- Fixing existing bugs found while checking behavior, including MARK-21's fit and Reset bugs.
- Designing for the later split into components shared with an Activity Player interactive.
- Bumping the plugin version or the release process (MARK-6).
- Publishing an iframe-phone release with a `types` condition and moving to it: a separate story.

## Not Yet Implemented

- **CI on GitHub:** the `build_test` and `cypress` jobs, and `s3-deploy` after them, can only run on the first push.
- **R15 against the branch build:** the branch build exists only after the push. Before the push, the check ran in CODAP 3.1.2 with this branch's dev server beside MARK-11's branch build. These matched on both:
  - drawing mode: Create From Text, Fit View after zooming, Play, Step, Reset
  - dataset mode with Mammals: drop, zoom and Reset, a second drop, Play
  - the five ELA documents, apart from the tile-resize race above

  The plugin's frame logged nothing. Not yet checked by hand: the state editor, adding, editing and deleting states and transitions, the probability selector, case edits in CODAP, an unversioned drawing in CODAP, both speeds, output highlighting, and reopening a saved dataset document.

## Decisions

### React 19, not 18
**Options**: A) React 19; B) React 18.3, with 19 later.
**Decision**: A. The cost is nearly the same: 18 needs `createRoot` and has the same batching regression, and 19 adds only the `useRef` arguments. Every library here supports 19, and stopping at 18 means a second update soon.

### StrictMode stays off
**Options**: A) keep the app unwrapped; B) wrap it and fix what it shows.
**Decision**: A. It changes development behavior only and would pull a `use-codap.ts` fix into a 3-point story. The hazard is recorded under Technical Notes.

### Every runtime library moves, majors included
**Options**: A) all to their newest; B) React only.
**Decision**: A. Each is used in one to three places, the checks passed with all of them, and leaving them reopens the "falls further behind" problem.

### iframe-phone pinned exactly at 1.3.1
**Decision**: 1.4.0 fails TS7016 under `bundler` resolution, and `^1.3.1` lets `npm update` install it. It moves once a release has a `types` condition.

### The fit is requested from an effect, not with `flushSync`
**Options**: A) a flag plus an effect on `graph`; B) `flushSync` around each graph update.
**Decision**: A. Both restored the React 17 transforms. A keeps the fit in a normal render; B forces synchronous renders from callbacks React now batches, which React treats as a last resort.

### The fit fix lands before the React bump
**Options**: A) fix on React 17, then bump; B) bump, then fix.
**Decision**: A. The fix gives the same transforms on React 17, so it can be checked on its own, and no commit has the regression. The tests never fail in the branch's history, so the revert check covers that.

### Reset keeps its direct fit request when there is nothing to restore
**Decision**: dropping it would lose the refit on resize after the user draws a new chain, a visible change. It has its own Cypress test, because deleting the `else` leaves the R9 tests green.

### Dataset-mode Reset has no fit test
**Options**: A) drop it; B) keep it outside the revert check; C) keep it and have the revert check fail.
**Decision**: A (Doug). Reset unmounts `Graph` in dataset mode, so the test passes without the fix, even with Reset's fit request deleted. The behavior stays in R11's manual check and MARK-11's modes test.

### `rootTransform` moves into the support helpers
**Decision**: MARK-11's `fit.test.ts` is a script, so a second top-level `rootTransform` fails `tsc -p cypress` with TS2451. Both fit files import it from `cypress/support/graph.ts`. The tests go in their own `fit-view.test.ts`, following MARK-11's one-file-per-area decision.

### `createRoot` gets a cast, not a guard
**Options**: A) `document.getElementById("app") as HTMLElement`; B) `if (container) ...`.
**Decision**: A. A guard would render nothing, silently, if `#app` were missing; the cast fails loudly, as `render` did.

### Dependency commits stay separate, with one that does not build
**Decision**: React 19 removes `render`, so the install commit fails the type check until `createRoot` lands in the next commit. The two are adjacent, and the PR names the first commit that builds.

### The R13 console check runs on a development build
**Decision**: the branch deploy is a production build, whose React logs no warnings, so R13 is checked on `npm start` loaded into CODAP.

### The manual check compares against the base branch, not master
**Decision**: MARK-20 changed what users see, so "as before" means the branch MARK-12 is stacked on. The check uses CODAP 3.1.2, the version MARK-5 found the classes use.
