# Update React and the Markov plugin's runtime libraries

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-12
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Move the plugin's runtime libraries, React above all, from 2022-era versions to current supported ones, with no change a teacher or student can see. The unit and rendering tests added just before this story are what show nothing changed.

## Project Owner Overview

The Markov plugin still runs on React 17 and on library versions from 2022. Nothing is broken today, but every month on old versions makes the eventual update a bigger and riskier jump, and the plugin's interface is later going to be shared with a new Activity Player interactive built from this repo, which should start on a current React rather than inherit an old one.

This story is maintenance only: the plugin should look and behave exactly as it does now in CODAP, including documents students have already saved. It is the last of the "before the features" stories so that the new automated tests (unit tests from MARK-10, rendering tests from MARK-11) are in place to catch anything the update breaks. Checking the update ahead of time found one thing it does break: after loading an older saved drawing, after the data behind a dataset graph changes, and after Reset, the graph no longer zooms to fit the view. The story includes a small fix for that, with tests, so students see no difference.

## Background

Jira MARK-12 is the authoritative scope; section F of the stream's `dev-stories.md` holds the same technical notes. Both were written from a quick read of the repo. Checked against the code on MARK-11's branch and a scratch copy upgraded to React 19 and loaded in CODAP v3, what held up and what changed:

- **Versions are as stated, except `tslib`.** `package.json` and the lockfile have `react` and `react-dom` 17.0.2, `d3` 7.8.2, `nanoid` 4.0.2, `iframe-phone` 1.3.1 and `clsx` 1.2.1, with `@types/react` 17.0.50, `@types/react-dom` 17.0.17, `@types/d3` 7.4.0 and `@testing-library/react` 12.1.5. `tslib` is `^2.4.0` in `package.json` but already 2.8.1 in the lockfile, which MARK-8's and MARK-9's installs moved.
- **`createRoot` is required, not optional.** `src/index.tsx` calls `render` from `react-dom`; React 19 removes it and the type check fails until it changes to `createRoot` from `react-dom/client`.
- **StrictMode double-invocation does not apply as written.** The app is not wrapped in `<StrictMode>`, and `createRoot` does not turn it on, so effects are not double-invoked after the update. Adopting StrictMode would be a behavior change in development only, and `use-codap.ts` is not ready for it (see Technical Notes), so it stays out of this story.
- **Automatic batching does apply, and it changes behavior.** React 17 renders synchronously for each `setState` outside React event handlers; React 18 and later batch them. The plugin sets state from iframe-phone callbacks (`setPluginState`, `handleDrop`, `handleCasesChanged` in `hooks/use-codap.ts`), timers (the animation `setInterval` and the `handleReset` and `translateOrigin` timeouts in `components/app.tsx`) and after `await`s (`handleStep`, `handlePlay`). Four of those paths lose their fit-to-view on React 19, which F did not anticipate; see "The fit-to-view regression" below.
- **The `@types/react` update has a code cost F did not mention.** `@types/react` 19 requires an argument to `useRef`. Nine calls pass none and fail the type check: `app.tsx:93,98,104`, `drawing.tsx:53`, `graph.tsx:178-181`, `use-codap.ts:47` (as MARK-10 leaves the code; MARK-11 changes no source).
- **`@testing-library/react` has to move with React.** Version 12 declares `react` and `react-dom <18` as peers, and version 16 requires React 18 or later. npm refuses `@testing-library/react` 16 alongside React 17, and installs React 19 alongside version 12 only with `ERESOLVE overriding peer dependency` warnings, so React goes first and the testing library follows before the commit is made. Version 16 also makes `@testing-library/dom` a peer the repo must list. `@testing-library/react-hooks` (React 17 peers) blocks the React 19 install with ERESOLVE until it is removed; MARK-8 has removed it.
- **d3 is a minor bump.** 7.8.2 to 7.9.0, same major.
- **The other libraries:** `clsx` 2 keeps the named `clsx` export the code uses; `iframe-phone` 1.4.0 adds listener cleanup on disconnect, tolerates non-JSON messages and adds an `exports` map whose missing `types` condition keeps it out of this story (R5); `nanoid` 6 keeps `nanoid()` and declares `node ^22 || ^24 || >=26`; for `tslib` only the `package.json` range moves, to `^2.8.1`, matching what is installed.

### The fit-to-view regression

`app.tsx` asks the graph to fit itself by setting `fitViewAt` right after replacing the graph: in `onCODAPDataChanged`, in `onSetGraph`'s `done`, and in the `handleReset` timeout. `graph.tsx` turns the graph into `d3Graph` in one effect, draws `d3Graph` in a second, and fits in a third (`graph.tsx:814`), measuring the drawn bounding box. Under React 17 the graph change rendered on its own before `fitViewAt` did, and the fit measured the new drawing. Under React 19 the graph change and `fitViewAt` commit in one render, before the `d3Graph` effect's update has drawn anything, so the fit measures the old drawing, or an empty one.

Measured with a scratch harness that plays CODAP's part of the plugin API and hands the plugin saved state (2026-10-26, same results on repeated runs, and the same with React 19 alone, so d3 and the other libraries are not the cause). The values are the root `transform` of the graph's SVG:

| Case | React 17 | React 19, unchanged code |
|---|---|---|
| Load a drawing saved with no `version` (positions translated by `translateOrigin`) | fitted, `translate(-186,-98) scale(2)` | never fitted, no transform |
| Dataset mode, cases change from 5 words to 3 | refits, `scale(2)` to `scale(5)` | keeps the old fit, `scale(2)` |
| Dataset mode, a second attribute dropped on an existing graph | refits, to `scale(5)` | keeps the old fit |
| Drawing mode, zoom in twice, then Reset | returns to the fitted view | stays zoomed in |

Loading a `version: 2` drawing, loading a dataset document, the first drop on an empty dataset view, the mode menu, Play, Step and the "Sequence Data" items all matched. On that first drop the fit lands on one of two transforms from run to run, as the force layout races the fit (`scale(2)` or `scale(3)` on React 17 in the harness; on MARK-11's fake-CODAP page React 19 does the same, `scale(1.45)` or `scale(2.27)` for its `Word` attribute); the graph is fitted either way, so this is not a regression. Two small fixes in `app.tsx` each restored all four cases to the React 17 values with no console output: requesting the fit from an effect that runs after the graph change commits, or wrapping the graph update in `flushSync`. The implementation spec uses the effect.

MARK-20 (bug 8) makes Reset in dataset mode rebuild the graph from the attribute's values, inside the same timeout as drawing-mode Reset. It is not a fifth case: `Dataset` shows its instructions in place of `Graph` while the graph is empty, so Reset unmounts `Graph`, and the rebuilt graph mounts a fresh one that fits itself. Measured on React 19 without the fix, it refits from zoomed in, even with Reset's fit request deleted.

### Where this story sits

The stack is master, MARK-6 (deploy and release), MARK-20 (plugin bug fixes), MARK-8 (build and test tooling), MARK-9 (ESLint), MARK-10 (unit tests), MARK-11 (rendering tests), then MARK-12. Doug's decision on the stream channel (#1191): MARK-8 owns the Node version and test tooling; MARK-9 owns every ESLint package and config. MARK-8 pins Node 24 in `.nvmrc`, moves TypeScript to 6.0.3 with `"moduleResolution": "bundler"`, Jest to 30 (jsdom 26) and Cypress to 16, maps `.scss` in Jest, removes `@testing-library/react-hooks`, and pins `@testing-library/jest-dom` to exactly 6.9.1, which has no `@testing-library/dom` peer and so sits beside RTL 16 unchanged. MARK-9 replaces the ESLint 8 configs with three flat configs (`eslint.config.js`, `eslint.config.build.js`, `eslint.config.style.js`), enabling only `exhaustive-deps` and `rules-of-hooks` from `eslint-plugin-react-hooks` 7. MARK-20 changes things users see (arrow widths and heads, sorted Starting State lists, sequence numbering, dataset-mode Reset), so "as before" in the requirements below means the branch MARK-12 is stacked on, not master. MARK-12 owns React, React DOM, their type packages, `@testing-library/react` and its `@testing-library/dom` peer, and the runtime libraries listed above. It does not touch build tooling, test runners or ESLint.

## Requirements

### Library versions

- R1. `react` and `react-dom` move to React 19, the current major, on the newest 19.x minor at implementation time.
- R2. `@types/react` and `@types/react-dom` move to the 19.x versions matching R1.
- R3. `@testing-library/react` moves to 16.x, the first major that supports React 19, and `@testing-library/dom` 10.x is added to `devDependencies` as its peer.
- R4. `d3` moves to the newest 7.x (7.9.0 today), and `@types/d3` to the newest 7.x.
- R5. `nanoid`, `clsx` and `tslib` move to their newest release (6.x, 2.x and 2.8.x today). `iframe-phone` stays on 1.3.1, pinned exactly (`"1.3.1"`, not `^1.3.1`, which `npm update` moves to 1.4.0), the one deliberate exception to Jira's "all runtime dependencies are on supported versions": 1.4.0's `exports` map has no `types` condition, so its types fail with TS7016 under the `bundler` resolution MARK-8 lands (see Technical Notes). It moves once a release with a `types` condition exists, which is a separate story.
- R6. `npm ci` on the result succeeds with no `ERESOLVE` errors and no peer-dependency warnings for the packages this story changes, on the Node version MARK-8 pins.

### Code changes the update requires

- R7. `src/index.tsx` mounts the app with `createRoot` from `react-dom/client`. The app is not wrapped in `<StrictMode>`.
- R8. Every `useRef` call passes an initial value, so the code type-checks against `@types/react` 19. Ref types and runtime values are unchanged (`undefined` where there was no argument).
- R9. The view fits the graph after the graph is replaced from outside a React event, as it did on React 17: loading a drawing saved without a `version`, dataset cases changing, dropping another attribute on an existing graph, and Reset on a loaded drawing. The four cases in the table under "The fit-to-view regression" end at their React 17 transforms. This is a regression the update introduces, so it is in scope, unlike the existing bugs under Out of Scope.
- R10. No other source changes beyond R7 to R9 and what the type check, the build or a failing test requires. Each one is named in the PR.

### No visible change

- R11. The plugin behaves as it did before the update in CODAP, in both modes:
  - Dataset mode: dropping an attribute builds the graph, editing, adding or deleting cases in that attribute updates it, and Reset rebuilds it.
  - Drawing mode: adding, editing and deleting states and transitions, the probability selector, creating a chain from text, and reset and back to main menu.
  - Generating: Play, Pause, Resume, Step and Cancel, both speeds, the output list and its highlighting, and items written to the "Sequence Data" table.
  - The graph: node sizes, edge widths, loops, highlighting, zoom, fit and recenter.
- R12. Saved documents load as before: a drawing-mode document saved with `version: 2` state, an older document with no version (whose node positions `onSetGraph` translates), and a dataset-mode document that restores its attribute.
- R13. The development build logs no new React warnings or errors in the browser console while doing R11 and R12.

### Verification

- R14. The unit tests from MARK-10 and the rendering tests from MARK-11 pass after the update. A test changed to pass is changed only because a testing-library API changed, never to accept different plugin behavior, and each such change is named in the PR.
- R15. A manual check in CODAP covers R11 and R12 against the branch build, and R13 against a development build (`npm start`) loaded into the same CODAP, in CODAP 3.1.2 (the version MARK-5 found the classes use), and is recorded in the PR. The branch deploy is a production build, whose React logs no warnings, so it cannot show R13.
- R16. Each R9 case has a rendering test that fails on React 19 without the R9 fix and passes with it. The tests run in Cypress on the fake-CODAP parent page MARK-11 provides, which starts the plugin with given saved state and sends it `dragDrop[attribute]` and case-change notifications. One more test covers Reset on a drawing started in the session: after adding a state, resizing the plugin frame fits the view (the `handleReset` `else` branch), and it fails if that branch is deleted. MARK-11's page hosts the plugin in an iframe whose size a test can change (`cy.resizePlugin`); tests MARK-11 already has count, and the rest are added here.
- R17. Dependency and lockfile changes are in commits separate from source changes, so the reviewer can read each kind on its own. Where a dependency commit cannot build until the source commit after it lands (React 19 removes `render`, which `index.tsx` imports), the two are adjacent and the PR says which commit is the first that builds.

## Technical Notes

- **Files that change:** `package.json`, `package-lock.json`, `src/index.tsx`, the four files with bare `useRef` calls (`src/components/app.tsx`, `src/components/drawing.tsx`, `src/components/graph.tsx`, `src/hooks/use-codap.ts`), and for R16 a new `cypress/e2e/fit-view.test.ts`, with `rootTransform` moving from `cypress/e2e/fit.test.ts` into `cypress/support/graph.ts`. Other test files only if R14 requires it.
- **In CODAP:** loaded into CODAP v3.1.2 as a plugin, React 17 and React 19 development builds of a scratch copy behaved the same in drawing mode (create from text, Play, Step, Cancel, "Sequence Data" table created), with no console output from the plugin frame, and with the other runtime libraries updated too.
- **Bundle size:** the production JavaScript grows, mostly from `react-dom` 19. Nothing in the deploy has a size budget, so the PR reports before and after measured on its head commit, and it is not a requirement.
- **JSX transform:** `tsconfig.json` uses `"jsx": "react"` (the classic `React.createElement` transform). React 19 still runs it, and the development build logged no warning about it, so switching to `"react-jsx"` is not required here.
- **StrictMode hazard, for whoever adopts it later:** the effect in `use-codap.ts` that calls `initializePlugin` guards `initializePlugin` with the `initialized` state value. Under StrictMode's development-only mount, unmount and mount, the second run still sees `initialized === false` and would create a second `IframePhoneRpcEndpoint`. A ref guard would fix it.
- **Where fit tests can run:** `fitOrCenter` measures with `getBBox`, which jsdom does not implement (`typeof g.getBBox` is `undefined` in jsdom 26, which Jest 30's environment uses), so R16's tests have to run in a browser, in MARK-11's Cypress setup, not in Jest.
- **Testing-library change, for MARK-10's tests:** from version 13, `render` uses `createRoot`, so state updates outside `act` warn and assertions may need `findBy`/`waitFor` where a synchronous render used to be enough. `renderHook` is built into version 13.1 and later.
- **Node:** nanoid 6 declares `node ^22 || ^24 || >=26`. MARK-8's Node 24 pin satisfies it; nanoid 5 (`^18 || >=20`) is the fallback if that pin changes.
- **TypeScript:** with React 19.3.1, `@types/react` 19.3.0 and the R7 and R8 changes, the code type-checks under TypeScript 6.0.3 with `"moduleResolution": "bundler"`, the repo's since MARK-8. Under `bundler`, `iframe-phone` 1.4.0 does not: its new `exports` map has no `types` condition, so TS reports TS7016 for `codap-interface.ts:44`. 1.3.1, which has no `exports` map, resolves, so R5 keeps it. With today's `^1.3.1`, `npm update iframe-phone` installs 1.4.0 and `tsc` fails; with `"1.3.1"` it stays (measured 2026-10-28), so R5 pins it exactly, as MARK-8 pinned `@testing-library/jest-dom`. A `types` condition in a later iframe-phone release (a Concord package) would let it move.
- **Install:** `npm ci` on Node 24.14 and npm 11.9 with React 19.3.1, `@testing-library/react` 16.3.3 and `@testing-library/dom` 10 printed no ERESOLVE, EBADENGINE or peer warnings, once `@testing-library/react-hooks` was gone. On MARK-11's branch the only installed packages that peer on React are `@testing-library/react` 12, which R3 replaces, and Cypress 16's bundled `@cypress/react` (`^18 || ^19`), which React 19 satisfies.
- **Jest:** on MARK-11's head with React 19.3.1, `@testing-library/react` 16.3.3 and the R7 and R8 changes, MARK-10's 56 tests pass unchanged with no `act` warnings, under Jest 30.5.2 and `@testing-library/jest-dom` 6.9 on Node 24.14.
- **Lint:** with the R8 `useRef` changes and the R9 effect applied as throwaway code on MARK-11's head, both `tsc` commands, `npm run lint`, `lint:build` and `lint:style` print nothing.

## Out of Scope

- Build tooling, test runners, Node version, TypeScript, GitHub Actions and `@testing-library/jest-dom` (MARK-8, which pins 6.9.1; jest-dom 7, which peers `@testing-library/dom` 10, is a later bump), and ESLint (MARK-9).
- Adopting `<StrictMode>`, the new JSX transform, or React 19 features (`ref` as a prop in place of `forwardRef` in `add-text.tsx`, actions, `use`).
- Fixing existing bugs found while checking behavior: they go to MARK-7's findings list or new stories, so that R11 compares like with like.
- Designing for the later split into components shared with an Activity Player interactive.
- Bumping the plugin version or touching the release process (MARK-6).
- Publishing an iframe-phone release with a `types` condition in its `exports` map, and moving to it: a separate story.
- Building the fake-CODAP parent page R16's tests run on: MARK-11's.

## Open Questions

<!-- Requirements-focused questions only (scope, acceptance criteria, business rules).
     Implementation questions go in implementation.md. -->

### RESOLVED: Judgment call: React 18 or React 19?
**Context**: F allows either. React 18.3 is the last 18 release and gets no further updates; 19 is current.
**Options considered**:
- A) React 19
- B) React 18.3, with 19 later

**Decision**: A. The upgrade cost is nearly the same (18 needs the same `createRoot` change and has the same batching regression; 19 adds only the `useRef` arguments), every library here supports 19 (`@testing-library/react` 16.1+), as does `@concord-consortium/lara-interactive-api` (peers `>=16.9`), which the planned Activity Player interactive will use and which should start on the current major. Stopping at 18 would mean a second update soon.

### RESOLVED: Judgment call: leave StrictMode off
**Context**: F says to check effects for StrictMode double-invocation, which only happens if the app opts in.
**Options considered**:
- A) Keep the app unwrapped, as today
- B) Wrap it in `<StrictMode>` and fix what it shows

**Decision**: A. StrictMode changes development behavior only, so it adds nothing a user sees, and it would pull a fix to `use-codap.ts` into a 3-point story. The hazard is recorded in Technical Notes for later.

### RESOLVED: Judgment call: update every runtime library, including majors
**Context**: nanoid 4 to 6 and clsx 1 to 2 are major bumps, which F listed without deciding.
**Options considered**:
- A) All to their newest release
- B) React only; leave the small libraries

**Decision**: A. Each is used in one or two places (`nanoid()` once in `drawing.tsx`, the named `clsx` export in three files), the scratch check passed with all of them, and leaving them reopens the "falls further behind" problem the story exists to fix.

### RESOLVED: Low confidence: does automatic batching change saved-document loading?
**Context**: `setPluginState` sets load state, view mode, graph and initial graph from an iframe-phone callback, and the older-version path in `onSetGraph` polls with `setTimeout`. The first scratch check did not load a saved document.
**Options considered**:
- A) Load both document versions in the scratch copy before the implementation spec
- B) Leave it to MARK-11's rendering tests and the manual check

**Decision**: A, done. It found the fit-to-view regression (Background), now R9, in loading an unversioned drawing and in two other paths. Everything else about loading matched React 17.

### RESOLVED: Low confidence: which CODAP version does the manual check use?
**Context**: R15 needed the CODAP version the classes use, which MARK-5 was to find.
**Options considered**:
- A) Whatever MARK-5 records
- B) CODAP v3 and v2

**Decision**: A. MARK-5 found the classes use CODAP 3.1.2, so R15 names it and the check runs there only.

## Self-Review

Roles: senior engineer, QA engineer, test writer (for MARK-10 and MARK-11's harnesses), the PR's reviewer (a developer newer to the repo), product manager, and operator (CODAP integrator).

### Senior Engineer

#### RESOLVED: R9 missed a fourth path
Dropping a second attribute onto a dataset graph goes through the same `onCODAPDataChanged` and, measured in the harness, keeps the old fit on React 19 (React 17 refits to `scale(5)`). Added to R9 and the table.

#### RESOLVED: the explanation of React 17's ordering went past what was measured
The Background described which render `setD3Graph` landed in under React 17, which was reasoned rather than observed. Reworded to the observed order: the graph change rendered before `fitViewAt`.

### QA Engineer

#### RESOLVED: a first drop differs between runs on React 17 itself
On an empty dataset view, React 17 fits a first drop to `scale(2)` or `scale(3)` depending on the run; React 19 always gives `scale(2)`. Recorded in the Background so the manual check does not report it as a regression.

### Test Writer

#### RESOLVED: R16 depends on a MARK-11 harness nobody has specified yet
R16's tests need a browser (jsdom has no `getBBox`) and a way to hand the plugin saved state and send it CODAP notifications. Options were: (A) MARK-11 provides a fake-CODAP parent page and MARK-12 adds its tests on it; (B) MARK-12 builds the page, split off as its own story; (C) drop R16. Decided (A) on the stream channel (#1210); the requirement is recorded for MARK-11's spec, and R16 names the dependency.

### Reviewer

#### RESOLVED: separate dependency commits cannot all build
React 19 removes `render`, so the commit that installs it fails the type check until `index.tsx` changes. R17 now says the two are adjacent and the PR names the first commit that builds.

#### RESOLVED: the Background said neither React nor its testing library could go first
Measured with npm 11.9: React 19 installs beside `@testing-library/react` 12 with `ERESOLVE overriding peer dependency` warnings; only the other order fails. The bullet now says which order works and what it prints, matching the install step.

### Product Manager

#### RESOLVED: R9 read like a bug fix the Out of Scope list excludes
R9 now says it is a regression the update introduces, which is what keeps it in scope.

### Operator (CODAP integrator)

#### RESOLVED: R13 cannot be checked on the branch build
CI deploys `npm run build` (`webpack --mode production`); a scratch production build contains React's minified-error production bundle, which logs no development warnings. R15 now checks R13 on `npm start` loaded into CODAP.

### Second pass

#### RESOLVED: stale counts
The fit fixes were said to restore "three" cases (the table has four; both fixes restore all four in a jsdom harness), and `clsx` was said to be used in four files (it is three). The React 19 rationale listed `lara-interactive-api` as a library "here"; it is not a dependency of this repo. Corrected.

### Third pass

Roles: dependency maintainer and the PR's reviewer (Maureen Zitouni). Each finding was checked on this branch's head and in a scratch clone with the planned commits applied.

#### RESOLVED: `tslib` is already 2.8.1 in the lockfile
MARK-8's and MARK-9's installs moved it; only the `package.json` range is `^2.4.0`. The versions bullet and the other-libraries bullet now say only the range moves.

#### RESOLVED: the file list left out R16's Cypress files, and the bundle sizes predated the stack
"Files that change" said test files change only for R14; it now names `fit-view.test.ts`, `fit.test.ts` and `support/graph.ts`. The byte counts came from a scratch copy of master and did not hold on this stack (355,486 bytes after the update), so they are dropped and the PR measures on its head.

#### RESOLVED: process history in the Background and Technical Notes
The list of branches the notes were checked on, an earlier React 19.2 check superseded by the 19.3.1 bullets, and "the implementation spec's call" are compressed to what was found.
