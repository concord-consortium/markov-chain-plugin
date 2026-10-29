# Unit Tests for the Markov Plugin's Logic

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-10

**Status**: **Closed**

## Overview

Add Jest unit tests for the plugin's logic that MARK-20's tests don't yet cover (text parsing details, graphs built from CODAP values, sequence generation, the state editor's percentages, and the saved state), and run Jest in CI on every push. Nothing a student or teacher sees changes.

The branch sits on MARK-9's (ESLint 9), which sits on MARK-8's, MARK-20's and MARK-6's. MARK-11 (Cypress rendering tests) and MARK-12 (React 19) build on it. Ownership: logic that runs without a real browser is MARK-10's; anything that needs layout, the drawn SVG, iframe messaging, or the play, step, pause and cancel flows is MARK-11's; the `graph.tsx` split and the `app.tsx` state machine are MARK-14's.

The Jira description predates MARK-20 and MARK-8. Where it disagrees with the code: MARK-20 had already added six test files (32 tests) and pulled the text parser and arrow widths out; generation was in `hooks/use-generator.ts`, not `graph.tsx` or `app.tsx`; and of `codap-helper.ts`'s 19 exports the plugin calls only `initializePlugin` (a one-line pass-through) and `registerObservers` (dead code MARK-14 deletes), so no CODAP helper tests were added.

## Requirements

### General

- **R1. No tooling change.** No package, Jest config, lockfile, `tsconfig.json`, `src/global.d.ts` or ESLint config changes.
- **R2. Lint-clean tests.** Every new or changed file passes `npm run lint`, `lint:build` and `lint:style` with no output and no `eslint-disable`, and `npx tsc --noEmit -p .` passes.
- **R3. Tests survive MARK-12 unchanged.** Component tests query through `screen`, wait with `findBy*` or `waitFor` for anything that appears after effects run, never touch the container or DOM nodes, and don't use `renderHook`. *(Verified: all 56 tests pass on React 19.3.1 and Testing Library 16.3.3 with no change and no `act` warnings.)*
- **R4. Production code changes only to make logic testable, with no behavior change.** Logic moves only when a test can't reach it where it is. No change to the rendered DOM, class names, marker ids, the saved state, or anything visible.
- **R5. Tests cover code the plugin runs.** Nothing MARK-14 deletes is tested.

### 1. The text parser

- **R6.** Tests of `textToWords` and `wordsToGraph` (`utils/text-to-graph.ts`) pin: splitting on any whitespace run (newlines and tabs included); `. , ? ! : ;` each becoming a state; `" ( ) { } [ ] _ + = | \ / < >` separating words without becoming states; apostrophes and hyphens kept inside words, and `3.5` splitting at its point; lowercasing, accented letters included; empty and blank text giving no states; and a back-to-back repeat giving a self-loop counted once per repeat.

### 2. The graph built from CODAP values

- **R7.** Tests of `toStateLabel` and `graphFromValues` (`utils/attribute-values.ts`) pin: self-loops and repeated transitions adding to one edge; `0` and `false` becoming the states `"0"` and `"false"`; and a whitespace-only value being a state, not a chain break.

### 3. Generation

- **R8.1** The generator moves from the `useGenerator` hook into `utils/generate-sequence.ts` (`generateSequence`), with no React import, because a test can't call a hook. `App` calls it directly and the hook is deleted. Arguments and results are unchanged.
- **R8.2** Tests, with `Math.random` stubbed: next states and the first state chosen in proportion to their values; stopping at a dead end; never exceeding the length limit (1 gives one state, 0 none); an empty graph giving nothing; a 0-value transition never chosen for a draw above 0; a self-loop followed.

### 4. The state editor

- **R9.1** `NodeModal` render tests: three equal transitions show `33%`, `33%`, `34%`; Save with nothing changed keeps each value within floating-point tolerance, leaves other states' edges untouched and trims the label; one transition shows no percentages and Save keeps its value.
- **R9.2** The slider's paired update moves into `components/drawing/state-editor.ts` (`movePairedPercentage`), with `percentage`, `probability` and `reduceToSum`, which `ProbabilitySelector` and `NodeModal` now import from there. Tests: a move changes only that share and the next, keeps the total, and a move past the next thumb is ignored.
- **R9.3** `setExactPercentages`' last-share fix-up is not tested: it only absorbs floating-point drift, and removing it fails nothing.

### 5. The saved state

- **R10.1** `utils/plugin-state.ts` holds `pluginStateValues`, `readPluginState` and `moveOriginToCenter`, with no React or CODAP interface import. `useCODAP` keeps its state updates and CODAP registration; `App` keeps the wait for the drawing's dimensions. The translation still moves the restored nodes in place, at the same moment as before.
- **R10.2** Tests: restoring and re-saving ELA document pnRU's state gives identical JSON, key order included; dataset mode saves `{attribute, viewMode}` only and restores the attribute; no version reads as 1 and version 2 as 2; the translation moves nodes by minus half the width and height, a missing `x` or `y` counting as 0; no `viewMode`, or a drawing missing `nodes` or `edges`, restores no graph. *(Which versions `App` translates, `version < 2`, is not reachable from Jest; MARK-11's save-and-reopen test guards it.)*

### 6. The CODAP helpers

- **R11.** No new tests: MARK-20's tests cover both items MARK-7 names.

### CI

- **R12.1** `only_build` becomes `build_test` ("Build and Run Jest Tests"): checkout, Node from `.nvmrc` with npm caching, `npm ci` with `CYPRESS_INSTALL_BINARY: 0`, `npm run build`, `npm test`.
- **R12.2** `s3-deploy` needs `build_test`. The `# - cypress` line stays for MARK-11.
- **R12.3** The commented-out old `build_test` job and its Codecov upload are deleted; the commented-out `cypress` job stays for MARK-11.
- **R12.4** The README's Testing section says CI runs the tests and a failure stops the deploy.

### Done when

- **R13.** At every commit and on the head (Node 24, after `npm ci`): tests pass, the three lint commands print nothing, `tsc` passes, the build has no warnings. *(Head: 9 suites, 56 tests: MARK-20's 32 plus 24 new.)*
- **R14.** Each of MARK-7's six risk areas has a test: 1 `text-to-graph.test.ts`, 2 `attribute-values.test.ts`, 3 `generate-sequence.test.ts`, 4 `node-modal.test.tsx` and `state-editor.test.ts`, 5 `plugin-state.test.ts`, 6 MARK-20's `attribute-values.test.ts` and `output-dataset.test.ts`.
- **R15.** In the released CODAP 3.1.2, served by the dev server: Create From Text, Play and Step fill the output table; the state editor shows the same percentages, a slider trades within its pair, and Save leaves the values; pnRU reopens with its drawing; a Mammals document with Diet dropped reopens with its graph. *(Passed. Also checked: an unversioned drawing opens and resets to the same positions as on MARK-9's head; re-saving pnRU and the Mammals document gives byte-identical plugin state; Play and Step work in dataset mode.)*
- **R16.** CI's `build_test` runs Jest green on the first push, and `s3-deploy` runs after it. *(Checked at the first push.)*

## Technical Notes

### Where the tested code is

| Area | Code | Tests |
|---|---|---|
| 1 | `utils/text-to-graph.ts` (`textToWords`, `wordsToGraph`) | `utils/text-to-graph.test.ts` |
| 2 | `utils/attribute-values.ts` (`toStateLabel`, `graphFromValues`) | `utils/attribute-values.test.ts` |
| 3 | `utils/generate-sequence.ts` (`generateSequence`), called from `components/app.tsx` | `utils/generate-sequence.test.ts` |
| 4 | `components/drawing/node-modal.tsx`; `components/drawing/state-editor.ts` (`movePairedPercentage` and the helpers); `probability-selector.tsx` (`roundPercentages`) | `node-modal.test.tsx`, `state-editor.test.ts` |
| 5 | `utils/plugin-state.ts`, called from `hooks/use-codap.ts` (`getPluginState`, `setPluginState`) and `App`'s `translateOrigin` | `utils/plugin-state.test.ts` |

`plugin-state.ts` imports `ViewMode` and `CODAPAttribute` with `import type`, so `import/no-cycle` reports nothing although `use-codap.ts` imports it.

### Behavior the tests leave alone

- A draw of exactly 0 picks the first transition even when its value is 0 (`>=` in `generateSequence`); a test would pin a defect.
- A starting node not in the graph is emitted once and ends the sequence; `App` never passes one.
- A whitespace-only CODAP value becomes a blank state in dataset mode (pinned by R7 as today's behavior; a marvin todo tracks whether to fix it).
- A state whose outgoing values sum to 0 shows `NaN%`; no editor or drawing path produces one.
- Reset on an unversioned drawing restores the untranslated top-left positions, because `setPluginState` copies the graph for Reset before `translateOrigin` moves it. Found by the manual checks, identical on MARK-9's head, and kept by R10.1; the fix is in MARK-21.

### Which components load under Jest

| Component | As configured | With either ES-module fix |
|---|---|---|
| `NodeModal`, `ProbabilitySelector`, `Toolbar`, `AddText`, `ConfirmModal`, `SpeedToggle` | loads | loads |
| `App`, `Drawing`, `Graph`, `Dataset` | fails: d3 and nanoid are ES-module only (`Dataset` through `Graph`) | loads |

The two fixes MARK-8 recorded: a `transformIgnorePatterns` that lets ts-jest compile `nanoid`, `d3`, `d3-*`, `internmap`, `delaunator` and `robust-predicates` (about 11 s for ten components), or `NODE_OPTIONS=--experimental-vm-modules` (about 8 s). MARK-10 adopts neither.

### Lint rules that shaped the tests

- `react-hooks/rules-of-hooks` rejects calling `useGenerator()` in a test, which is why generation moved out of the hook.
- `testing-library/no-node-access` and `no-container` rule out reaching the slider's `<circle>` thumbs, which is why the slider arithmetic moved.
- `testing-library/render-result-naming-convention` requires a `render*` helper to return the render result, so each `NodeModal` test makes its own `onChange` mock.

### What MARK-11 and MARK-12 inherit

After MARK-10, the bare `useRef` calls MARK-12 fixes are at `app.tsx:93, 98, 104` and `use-codap.ts:47`, and `translateOrigin` calls `moveOriginToCenter`. MARK-11 inherits no Jest change, and its save-and-reopen test is what guards `App`'s `version < 2`.

## Out of Scope

- The ES-module fix for `App`, `Drawing`, `Graph` and `Dataset`: no MARK-10 test loads them.
- Play, step, pause and cancel, highlighting, fit and recenter, layout, the drawn SVG and iframe messaging (MARK-11).
- The `graph.tsx` split and the `app.tsx` state machine (MARK-14).
- Dead code, including `registerObservers` and the unused `codap-helper.ts` exports (MARK-14 removes it).
- Fixing the quirks above (Doug, 2026-10-28), apart from the Reset bug, which went to MARK-21.
- Coverage reporting and Codecov, and the Cypress job (MARK-11).

## Not Yet Implemented

- R16, CI's `build_test` job on GitHub: it can only run on the first push.

## Decisions

### Which ES-module fix MARK-10 adopts
**Options**: A) neither; B) `transformIgnorePatterns`; C) `--experimental-vm-modules`.
**Decision**: A (Doug, 2026-10-28). The only component rendered, `NodeModal`, loads as configured; rendering `App` or `Graph` under jsdom would test what MARK-11 owns in a real browser, and a fix nothing uses has nothing to verify it.

### Delete `useGenerator`, or export the generator beside it
**Options**: A) move it to a module and delete the hook; B) export it and keep the hook as a wrapper.
**Decision**: A. B leaves a wrapper nothing needs. The function is now stable across renders, which changes nothing visible.

### Test the state editor by rendering it, or by extracting its logic
**Options**: A) render `NodeModal` and extract only the slider arithmetic; B) extract every percentage computation.
**Decision**: A. It tests the real call site with no production change for the percentages.

### Extract pure functions for the saved state, or test `useCODAP` through a harness
**Options**: A) pure functions of plain arguments; B) a rendered harness with `codap-interface` mocked.
**Decision**: A. B tests the `codap-interface` registration MARK-14 replaces and needs `renderHook`, which Testing Library 12 lacks. A pins the saved shape MARK-14 must keep byte-compatible.

### Keep the whole scope in 3 points, or defer the version-1 translation
**Decision**: keep it. Two areas are test-only, each extraction moves an existing 10 to 40 line block, and the version-1 translation is the case MARK-7 names.

### The slider commit moves three helpers no requirement named
**Options**: A) add the move to R9.2; B) leave the helpers and repeat `* 100` in `state-editor.ts`.
**Decision**: A (Doug, 2026-10-28). B gives the percentage conversion two definitions; importing the helpers back from the selector would make an import cycle.

### A follow-up story for the quirks the tests found
**Options**: A) record them in the spec only; B) a small follow-up for the whitespace-only state.
**Decision**: A (Doug, 2026-10-28). A marvin todo keeps the whitespace-only state open for Rebecca to confirm. The later Reset finding went to MARK-21.

### The CI commit first, or last
**Decision**: first, so every later commit's tests run in CI and Mau reads the CI change on its own.

### Move the generator in one commit, or a pure rename first
**Decision**: one commit. Git shows a delete and an add because every line loses one indentation level; `diff -w` of the old `hooks/use-generator.ts` against `utils/generate-sequence.ts` shows only the hook wrapper removed.

### R10.1 keeps the translation in place
`setPluginState` copies the restored node objects for Reset right after handing them to `App`, so a translation that returned new nodes could change what Reset restores. `moveOriginToCenter` mutates in place, at the same moment as before; a test checks the node objects are the same.

### What the tests can and can't catch
`split(" ")` in place of `split(/\s/)` is caught only by the bare newline and tab case in the parser's first test. Neither `attribute`'s position before `viewMode` nor `App`'s `version < 2` is pinned by Jest; MARK-11's save-and-reopen test guards the latter. `readPluginState` is checked with each of `nodes` and `edges` missing.
