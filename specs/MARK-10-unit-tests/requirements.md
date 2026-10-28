# Unit Tests for the Markov Plugin's Logic

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-10
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Add Jest unit tests for the plugin's logic that MARK-20's tests don't yet cover (text parsing details, graphs built from CODAP values, sequence generation, the state editor's percentages, and the saved state), and run Jest in CI on every push. Nothing a student or teacher sees changes.

## Project Owner Overview

The plugin is about to change a lot: seven feature stories rework the graph and build an Activity Player interactive on the same code. Each of them needs a quick way to show it did not break how the plugin turns text and data into a chain, how it generates sequences, how the state editor's percentages behave, and how a saved document comes back. This story adds those checks as automated tests and makes GitHub run them on every push, so a broken change shows up before review rather than in a classroom.

It is maintenance only. The ELA module's documents load, draw and generate exactly as before. MARK-11 adds the matching browser tests of how the graph is drawn.

## Background

MARK-10 is the fifth "before the features" story in the stack: master, MARK-6 (deploy pipeline), MARK-20 (plugin bug fixes), MARK-8 (build and test tooling), MARK-9 (ESLint 9), then MARK-10, then MARK-11 (rendering tests, Cypress) and MARK-12 (React 19 and runtime libraries). This branch is cut from MARK-9's and has all of that implemented.

The Jira description and its source (`dev-stories.md`, section E1) were written before MARK-20 and MARK-8 landed, and several of their details are now out of date:

- **"There are no test files under `src`."** MARK-20 added six test files with 32 tests, next to five new pure modules: `utils/text-to-graph.ts` (the Create From Text parser), `utils/attribute-values.ts` (reading an attribute's values from CODAP and building the graph from them), `utils/output-dataset.ts` (the output dataset and sequence numbering), `components/graph-utils.ts` (widths, geometry, label measuring) and `components/app-utils.ts` (the Starting State sort, what Reset restores, the Max Length clamp), plus `components/drawing/state-editor.ts` (the state editor's Save). MARK-8 moved Jest to 30 with ts-jest 29 and maps `.scss` to `identity-obj-proxy`.
- **"Pull the pure logic out of `graph.tsx` and `app.tsx`."** Text parsing and the arrow widths are already out (MARK-20). Generation was never in either file: it is in `hooks/use-generator.ts`. The probability normalization is in `components/drawing/node-modal.tsx` (`setExactPercentages`, `:19-24`, and the initial percentages, `:41-44`) and `components/drawing/probability-selector.tsx` (the rounded display, `:82-86`, and the slider's paired update, `:123-140`), not in `probability-selector.tsx` alone.
- **"Test the CODAP helper functions in `utils/codap-helper.ts` with the CODAP interface mocked."** The two helpers the plugin used to read and write CODAP data moved out and are tested (MARK-20): `getAttributeValues` replaced `getValuesForAttribute`, and `guaranteeOutputDatasetAndCaseTable` is in `output-dataset.ts`. Of `codap-helper.ts`'s 19 exported functions, the plugin calls only two: `initializePlugin`, a one-line pass-through to `codapInterface.init`, and `registerObservers`, one of the dead state paths MARK-14 deletes (plugin-bugs.md row 5). The rest are never called.
- **`ci.yml` only builds; add a Jest job, and leave out the Codecov upload.** Still true. MARK-8 moved the two live jobs to `actions/checkout@v7` and `actions/setup-node@v7` with `node-version-file: .nvmrc`, and left the commented-out Jest and Cypress jobs for MARK-10 and MARK-11.

MARK-7's review (`mark-7-findings.md`) names six unit-test risk areas, in order. Two of its citations are wrong: area 1 says `:` is not kept as punctuation, but the parser keeps it (`keepPunctuationRegex`, `text-to-graph.ts:3`); and its bug 3 cites `use-generator.ts:356-365` for generation, which is `chooseRandomEdge` at `use-generator.ts:24-33`. Its file references are to master; where code has moved since, this spec cites this checkout.

| Area (MARK-7) | Covered by MARK-20 | Left for MARK-10 |
|---|---|---|
| 1. Text parser | `constructor` and other prototype names; the order of number-like words | Splitting, kept and removed punctuation (`:` included), lowercasing, empty input, self-loops |
| 2. Graph from CODAP values | `undefined`, `null`, `""`, numbers, repeated values | Self-loops, falsy values (`0`, `false`), whitespace-only values |
| 3. Generation | none | All of it |
| 4. State editor round trip | Save's arithmetic (`applyStatePercentages`) | The editor itself: initial percentages, their sum, the Save call; the slider's paired update |
| 5. Saved state | none | The saved shape for both modes, restoring, the version-1 origin translation |
| 6. CODAP helpers | Both named items: a rejected values request, and the dataset check against CODAP 3.1.2 replies | None (see the third bullet above) |

Ownership, from the stream's decisions:

- **MARK-10 vs MARK-11:** logic that runs without a real browser is MARK-10's (Jest). Anything that needs layout (`getBBox`, label measuring in a real DOM), the drawn SVG, or iframe messaging is MARK-11's (Cypress). MARK-10 tests generation; MARK-11 tests the play, step, pause and cancel flows (`mark-7-findings.md`, "What would make MARK-14 harder", item 1).
- **MARK-10 vs MARK-14:** MARK-10 extracts only what a test needs. The `graph.tsx` split (view model, drawing, highlighting) and the `app.tsx` state machine are MARK-14's.
- **CI:** decided by Doug (2026-10-28), from the convention in Concord's other repos (17 of 22 local repos with Jest and Cypress, all six CODAP plugins among them): the build job becomes `build_test`, which builds and runs Jest, and `s3-deploy` needs it. MARK-11 later adds a `cypress` job and adds it to `s3-deploy`'s `needs`.

## Requirements

### General

- **R1. No tooling change.** Tests run under the existing Jest config with `npm test`. No package is added, removed or moved, and `package.json`'s Jest config, `package-lock.json`, `tsconfig.json`, `src/global.d.ts` and the ESLint configs do not change.
- **R2. Lint-clean tests.** Every new or changed file passes `npm run lint`, `lint:build` and `lint:style` with no output and no `eslint-disable` comments, and `npx tsc --noEmit -p .` passes. Test files follow the Jest and Testing Library rules the config applies to `src/**/*.test.*` (MARK-9).
- **R3. Tests survive MARK-12 unchanged.** MARK-12 moves to React 19 and React Testing Library 16, whose `render` uses `createRoot`. Component tests query through `screen`, wait with `findBy*` or `waitFor` for anything that appears after a render's effects run, never read the container or DOM nodes directly, and don't use `renderHook`. They should pass on React 19 and Testing Library 16 with no change; MARK-12's R14 allows only Testing Library API adjustments.
- **R4. Production code changes only to make logic testable, with no behavior change.** Logic moves into a module only when a test cannot reach it where it is. The plugin draws, generates, edits and saves exactly as before: no change to the rendered DOM, class names or marker ids (MARK-11's tests select on them), to the saved state, or to any visible behavior.
- **R5. Tests cover code the plugin runs.** Nothing MARK-14 deletes is tested: the dead state paths (plugin-bugs.md row 5, including `registerObservers`), the unused `selectionList` helpers (M4), `getCaseValues`, and the other `codap-helper.ts` exports the plugin never calls.

### 1. The text parser

- **R6.** Tests of `textToWords` and `wordsToGraph` (`utils/text-to-graph.ts`) pin today's behavior:
  - text splits on any run of whitespace, newlines and tabs included;
  - `. , ? ! : ;` each become their own state;
  - `" ( ) { } [ ] _ + = | \ / < >` separate words and never become states;
  - apostrophes and hyphens stay inside words (`don't`, `well-known`), and a decimal number splits at its point (`3.5` gives `3`, `.`, `5`);
  - words are lowercased, accented letters included (`École` gives `école`);
  - empty and whitespace-only text give no states and no transitions;
  - a word repeated back to back gives a self-loop, counted once per repeat.

### 2. The graph built from CODAP values

- **R7.** Tests of `toStateLabel` and `graphFromValues` (`utils/attribute-values.ts`) pin today's behavior:
  - a value repeated back to back gives a self-loop, and repeated transitions add to one edge's value;
  - `0` and `false` become the states `"0"` and `"false"`, not chain breaks;
  - a whitespace-only value (`" "`) is a state, not a chain break.

### 3. Generation

- **R8.1** The sequence generator moves out of the `useGenerator` hook (`hooks/use-generator.ts`) into a module with no React import, because a test can't call a hook outside a component (`react-hooks/rules-of-hooks`). `App` calls it directly and the hook is deleted, since nothing else would use it. The function's arguments and results are unchanged.
- **R8.2** Tests, with `Math.random` stubbed:
  - from a starting state, the next state is chosen in proportion to the outgoing values: with values 1 and 3, a draw below 0.25 picks the first and one above picks the second;
  - with no starting state, the first state is chosen in proportion to the states' values;
  - generation stops at a state with no outgoing transitions, before the length limit;
  - the sequence never exceeds the length limit: a limit of 1 gives one state, and 0 gives an empty sequence;
  - an empty graph gives an empty sequence;
  - a transition with value 0 is never chosen for any draw above 0, and a self-loop can be followed.

### 4. The state editor

- **R9.1** Component tests render `NodeModal` (`components/drawing/node-modal.tsx`) in drawing mode, which loads under today's Jest config:
  - a state with three equal outgoing values shows `33%`, `33%` and `34%`, which sum to 100 (this fails if the displayed shares are each rounded, without the last one taking up the difference, `probability-selector.tsx:82-86`);
  - Save with nothing changed calls `onChange` with each of the state's outgoing values within floating-point tolerance of its original, every other state's edges unchanged, and the label trimmed (this fails if Save's `/ 100` from MARK-20 is reverted);
  - a state with one outgoing transition shows no percentages at all (the selector renders nothing in drawing mode below two transitions, `probability-selector.tsx:143-145`), and Save keeps its value.
- **R9.2** The slider's paired update (`handleProbabilitySelectorThumbChange`, `probability-selector.tsx:123-140`) moves into `components/drawing/state-editor.ts` as a pure function, because a test can't reach the slider's SVG thumbs through Testing Library's queries without reading DOM nodes (R3). The three helpers it uses, `percentage`, `probability` and `reduceToSum` (`probability-selector.tsx:44-46`), move with it, because `state-editor.ts` importing them back from the selector would make an import cycle; `ProbabilitySelector` and `NodeModal` import them from `state-editor.ts`, so each keeps one definition. Tests: moving a thumb changes only that share and the next, keeps the percentages' total at 100, and a move past the next thumb, which would make a share negative, is ignored.
- **R9.3** `setExactPercentages`'s step that makes the last share `100 - rest` (`node-modal.tsx:19-24`) is not claimed as tested: it only absorbs floating-point drift, and removing it leaves every test above passing (checked by mutation). No test can observe it short of comparing values to the last bit.

### 5. The saved state

- **R10.1** The code that builds the saved state (`getPluginState`, `hooks/use-codap.ts:48-65`), reads it back (`setPluginState`, `:92-112`), and translates a version-1 drawing's origin (`translateOrigin` in `App`'s `onSetGraph`, `components/app.tsx:118-133`) moves its logic into a module with no React or CODAP interface import. The hook and `App` keep their state updates, the CODAP registration, and the wait for the drawing's dimensions. The translation keeps moving the restored nodes in place, at the same moment as today, because `setPluginState` copies those same node objects for Reset's initial graph (`use-codap.ts:101-103`) right after handing them to `App`; returning new objects instead could change which positions Reset restores.
- **R10.2** Tests:
  - drawing mode saves `{viewMode: "drawing", nodes, edges, version: 2}`; restoring the saved state of the ELA document `pnRUlM27cXXrJrofZAXx` and saving it again gives JSON identical to the original, key order included;
  - dataset mode saves `{attribute, viewMode: "dataset"}`, with no nodes, edges or version, and restoring it gives back the attribute;
  - a drawing saved with no version is restored as version 1, and a version-2 drawing as version 2; the origin translation moves nodes by minus half the plugin's width and height, a missing `x` or `y` counting as 0. Which versions `App` translates (`version < 2` in `onSetGraph`) stays in `App` and no Jest test reaches it: MARK-11's save-and-reopen test in drawing mode fails if a version-2 drawing is moved;
  - a state with no `viewMode`, or a drawing with no nodes or edges, restores no graph.

### 6. The CODAP helpers

- **R11.** No new tests: MARK-20's `attribute-values.test.ts` and `output-dataset.test.ts` cover both items MARK-7 names, and the `codap-helper.ts` exports the plugin calls are either a one-line pass-through or dead (R5).

### CI

- **R12.1** In `.github/workflows/ci.yml`, the `only_build` job becomes `build_test`, named "Build and Run Jest Tests" as in Concord's other plugins. It checks out, sets up Node from `.nvmrc` with npm caching, runs `npm ci` with `CYPRESS_INSTALL_BINARY: 0`, `npm run build`, then `npm test`.
- **R12.2** `s3-deploy` needs `build_test`, so a failing test stops the deploy. The commented-out `# - cypress` line under its `needs` stays for MARK-11.
- **R12.3** The commented-out old `build_test` job, with its Codecov upload and the "disable tests during early development" comment, is deleted. The commented-out `cypress` job stays for MARK-11 to replace. Nothing uploads coverage.
- **R12.4** The README's Testing section says that CI runs `npm test` on every push and that a failing test stops the deploy.

### Done when

- **R13.** On Node 24 after `npm ci`, at every commit and on the head: `npm test` passes MARK-20's 32 tests and every new one; `npm run lint`, `lint:build` and `lint:style` exit 0 with no output; `npx tsc --noEmit -p .` passes; `npm run build` compiles with no warnings.
- **R14.** Each of MARK-7's six unit-test risk areas has at least one test (the table in Background, with MARK-20's tests counting for area 6).
- **R15.** The plugin, served by `npm start` and loaded in the released CODAP (`https://codap.concord.org/app/`), behaves as before where this story touched its code: Create From Text, then Play and Step generate sequences into the output table (generation, R8); the state editor opens with the same percentages, a slider moves its pair of shares, and Save leaves the arrows as they were (R9.2); a drawing saved in a document reopens with its drawing, and a dataset-mode document (an attribute dropped from the Mammals sample) reopens with its graph (R10).
- **R16.** CI's `build_test` job runs Jest green on the first push, and `s3-deploy` runs after it. *(Checked at the first push.)*

## Technical Notes

### Where each area's code is (this checkout)

| Area | Code | Notes |
|---|---|---|
| 1 | `utils/text-to-graph.ts:3-13` (`textToWords`), `:16-33` (`wordsToGraph`); called from `components/drawing.tsx:291-303` (`handleTextChange`) | `keepPunctuationRegex` is `/[.,?!:;]/g`; `removePunctuationRegex` is `/["(){}[\]_+=\|\\/><]/g`. |
| 2 | `utils/attribute-values.ts:5` (`toStateLabel`), `:26-62` (`graphFromValues`); called from `hooks/use-graph.ts:8-10` and `components/app-utils.ts:8-14` | `toStateLabel` leaves strings as they are, so `" "` survives as a label. |
| 3 | `hooks/use-generator.ts:8-55` (`chooseRandomNode` `:13-22`, `chooseRandomEdge` `:24-33`, the loop `:35-47`); called from `components/app.tsx:147` and `:219` | `useGenerator` uses no React hook; `generate` is a new function each render and is in `generateNewSequence`'s dependency list (`app.tsx:222`). |
| 4 | `components/drawing/node-modal.tsx:19-24` (`setExactPercentages`), `:41-44` (initial percentages), `:50-56` (`handleSubmit`); `components/drawing/probability-selector.tsx:44-46` (`percentage`, `probability`, `reduceToSum`), `:82-86` (`roundPercentages`), `:123-140` (`handleProbabilitySelectorThumbChange`) | The slider renders only in drawing mode with two or more outgoing transitions (`:143-145`). |
| 5 | `hooks/use-codap.ts:48-65` (`getPluginState`), `:92-112` (`setPluginState`); `components/app.tsx:111-140` (`onSetGraph`, `translateOrigin` at `:118-133`) | `plugin-bugs.md` cites master's lines (`use-codap.ts:49-66`, `:98`); MARK-7 cites `app.tsx:115-136`. |
| 6 | `utils/attribute-values.ts:8-24`, `utils/output-dataset.ts:5-86`; `utils/codap-helper.ts:22-37` (`initializePlugin`, `registerObservers`) | Only `hooks/use-codap.ts` imports `codap-helper.ts`. |

### Measured behavior the tests pin (throwaway tests, 2026-10-28)

- `textToWords("Hello,  World!\nHi:\tthere; ok? yes.")` gives `hello , world ! hi : there ; ok ? yes .`. `textToWords("don't well-known 3.5 it's")` gives `don't well-known 3 . 5 it's`. `"..."` gives three `.` states.
- `graphFromValues(["a", "a", "b", "a", "b"])` gives `a` (3), `b` (2) and the edges `a→a` (1), `a→b` (2), `b→a` (1). `toStateLabel` maps `0`, `false`, `true`, `1.5`, `" "` to `"0"`, `"false"`, `"true"`, `"1.5"`, `" "`.
- Generation, with `Math.random` stubbed: from `a` with outgoing values 1 (to `b`) and 3 (to `c`), a draw of 0.2 picks `b` and 0.3 picks `c`. A limit of 0 and an empty graph both give `[]`.
- Two quirks are left as they are and not tested, since a test would pin a defect: a draw of exactly 0 (which `Math.random` can return, about once in 2^53 draws) picks the first transition even when its value is 0, because the comparison is `>=` (`use-generator.ts:31`); and a starting node not in the graph is emitted once and ends the sequence. `App` looks the starting state up by id in the current graph (`app.tsx:201`), so it never passes a missing node.
- `NodeModal` renders under today's Jest with no config change. With three outgoing values of 1 it shows `33%`, `33%`, `34%`, and Save gives `0.9999999999999999`, `0.9999999999999999`, `1.0000000000000002`. A drag on the first slider thumb, from `fireEvent.mouseDown` and a `mouseMove` on `window` 30 px right, gave `49%`, `17%`, `34%`. A state whose outgoing values sum to 0 shows `NaN%` and saves `NaN`, but no editor or drawing path produces such a state (drawn transitions start at 1, data transitions count at least 1, and Save keeps a state's total), so it is not tested.
- The ELA document pnRU's saved plugin state is `{"viewMode":"drawing","nodes":[...4 nodes...],"edges":[...2 edges...],"version":2}`, with no `attribute` key (an `undefined` attribute drops out of the JSON). The other four ELA documents have the same shape.

### Throwaway build of the whole plan (2026-10-28)

Every extraction and test in R6 to R10, built for real in this worktree, then reverted:

- `npm test` ran 9 suites and 56 tests (MARK-20's 32 and 24 new), also with `CI=true`. `npm run lint`, `lint:build` and `lint:style` printed nothing, `tsc` passed, and `npm run build` compiled with no warnings.
- Served by the dev server in CODAP 3.1.2 (`https://codap.concord.org/app/`): Create From Text, two Plays and a Step run filled the output list; the state editor on "the" showed `50%`, `25%`, `25%`, a slider drag gave `63%`, `12%`, `25%`, and Save changed only the two arrows whose shares moved; ELA document pnRU, opened from a copy whose plugin URL pointed at the dev server, restored its four states and two transitions. Chrome blocks an https page from framing `http://localhost` until the local-network-access prompt is answered, which a manual check has to allow.
- The slider's negative case is a thumb dragged past the next one: in `[20, 30, 50]`, the first thumb at 60% would leave the second share at -10. The second thumb at 90% is a valid `[20, 70, 10]`.
- The generator's file move reads as a delete and an add in git, since every line loses one level of indentation; `diff -w` against the old file shows only the hook wrapper removed.

### Which components load under Jest

Measured with a throwaway import test per component (2026-10-28, Node 24.14, Jest 30):

| Component | As configured | With either ES-module fix |
|---|---|---|
| `NodeModal`, `ProbabilitySelector`, `Toolbar`, `AddText`, `ConfirmModal`, `SpeedToggle` | loads | loads |
| `App`, `Drawing`, `Graph`, `Dataset` | fails: d3 (`Graph`, and `Dataset` through it) and nanoid (`Drawing`) are ES-module only | loads |

MARK-8's spec names `App`, `Drawing` and `Graph`; `Dataset` fails too, because it imports `Graph`. The two fixes MARK-8 recorded are a `transformIgnorePatterns` that lets ts-jest compile `nanoid`, `d3`, `d3-*`, `internmap`, `delaunator` and `robust-predicates`, or `NODE_OPTIONS=--experimental-vm-modules`. Both loaded all ten components, the first in about 11 s and the second in about 8 s for the ten-file run.

### Lint rules that shape the tests

- `react-hooks/rules-of-hooks` reports `useGenerator()` called in a test ("cannot be called at the top level"), which is why R8.1 moves generation out of the hook.
- `testing-library/no-node-access` and `testing-library/no-container` (errors, from the Testing Library `flat/react` config) rule out reaching the slider's `<circle>` thumbs, which have no role, label or text, which is why R9.2 extracts the slider's arithmetic.

### What MARK-12 and MARK-11 inherit

MARK-12's implementation spec (on its branch, re-measured on MARK-9's) says MARK-10 and MARK-11 only add tests, so its line numbers should still hold. MARK-10 also changes `components/app.tsx` and `hooks/use-codap.ts`: after it, the bare `useRef` calls MARK-12 fixes are at `app.tsx:93, 98, 104` (one line lower) and `use-codap.ts:47` (one lower), and `translateOrigin` in `onSetGraph`, beside the `done` MARK-12's fit fix edits, calls `moveOriginToCenter` instead of its own loop. The code MARK-12 changes is otherwise untouched, and the `NodeModal` tests already pass on React 19 (Open Questions). MARK-11 inherits no Jest change: the ES-module fix stays unchosen, and its Cypress tests run on webpack's build.

### CI today

`ci.yml` runs on every push. `only_build` ("Build") and `s3-deploy` ("S3 Deploy", `needs: only_build`) are live; a commented-out `build_test` (Codecov v1 upload) and a three-container `cypress` matrix sit between them. `master` has no branch protection and the repo has no rulesets, so renaming the job breaks no required check.

## Out of Scope

- **The ES-module fix for `App`, `Drawing`, `Graph` and `Dataset`.** No MARK-10 test loads them (Open Questions).
- **The play, step, pause and cancel flows, highlighting, fit and recenter, and anything that needs layout, the drawn SVG or iframe messaging** (MARK-11), including `codap-interface.ts`'s message routing and `init`.
- **The `graph.tsx` split and the `app.tsx` state machine** (MARK-14), including the graph's view model (node radii) and edge geometry (`calculateEdges`), which MARK-11's drawn arrows cover and MARK-14's `graph-geometry` module would move.
- **Dead code** (R5): its removal is MARK-14's.
- **Fixing the quirks the tests find**: the zero-draw choice, the whitespace-only state, and the `NaN%` of a zero-sum state are recorded above, not changed, and get no follow-up story (Doug, 2026-10-28).
- **Coverage reporting and Codecov.**
- **The Cypress job** (MARK-11).

## Open Questions

### RESOLVED: Judgment call: which ES-module fix MARK-10 adopts
**Context**: MARK-8 left the choice between `transformIgnorePatterns` and `--experimental-vm-modules` to MARK-10, "depending on how MARK-10 structures its tests".
**Options considered**:
- A) Neither: no MARK-10 test needs `App`, `Drawing`, `Graph` or `Dataset`, so the Jest config stays as it is, and the measured facts are recorded for whoever first needs them.
- B) `transformIgnorePatterns`, so every component loads.
- C) `--experimental-vm-modules` in the `test` script.

**Decision**: A, confirmed by Doug at stage 8 (2026-10-28). The only component MARK-10 renders, `NodeModal`, loads today. Rendering `App` or `Graph` under jsdom would be a test of the flows and drawing MARK-11 owns in a real browser, and adding a fix nothing uses is a config change with nothing to verify it.

### RESOLVED: Judgment call: delete `useGenerator`, or export `generate` beside it
**Context**: a test can't call the hook (R8.1). The generator could be exported from `hooks/use-generator.ts` with the hook kept as a wrapper, or moved to its own module with the hook deleted.
**Options considered**:
- A) Move it to a module, have `App` import it, and delete the hook.
- B) Export it from the hook's file and keep the hook returning it.

**Decision**: A. With B, the hook would be a wrapper nothing needs, which the team's reviewers flag as orphaned code. The function becomes stable across renders, so `generateNewSequence` is recreated less often; nothing visible depends on that.

### RESOLVED: Judgment call: test the state editor by rendering it, not by extracting its logic
**Context**: area 4's initial percentages and Save call sit in `NodeModal`'s state and effects.
**Options considered**:
- A) Render `NodeModal` with Testing Library, and extract only the slider's arithmetic, which a test can't reach without DOM access.
- B) Extract every percentage computation into `state-editor.ts` and test those.

**Decision**: A. Rendering tests the real call site that MARK-20 left to a manual check, needs no production change for the percentages, and `NodeModal` loads as configured.

### RESOLVED: Low confidence: the component tests need no change on React 19 and Testing Library 16
**Context**: R3 was reasoned from MARK-12's notes, not run.
**Options considered**:
- A) Run the planned component tests against MARK-12's versions in a scratch copy before the implementation spec.
- B) Rely on the rules in R3.

**Decision**: A, run 2026-10-28. R9.1's three `NodeModal` tests, written to R3's rules, pass unchanged on this checkout (React 17.0.2, Testing Library 12.1.5) and in a scratch copy with React 19.3.1, `@types/react` 19, `@testing-library/react` 16.3.3 and `@testing-library/dom` 10.4.2, with no `act` warnings. They also pass all three lint commands, after one change the check found: a `render*` helper may only return the render result (`testing-library/render-result-naming-convention`), so the `onChange` mock is made by each test and passed in.

### RESOLVED: Low confidence: R10.1's extraction stays small enough for MARK-14 not to fight it
**Context**: MARK-14 moves `viewMode` and the saved state into a shared core. A module holding the saved shape is what MARK-14 needs to keep byte-compatible, but if it is shaped around today's hook it may be rewritten.
**Options considered**:
- A) Extract only pure functions of plain arguments (the values to save; the drawing to restore; the translation), with no hook or CODAP types.
- B) Test `useCODAP` through a rendered test component with `codap-interface` mocked, and extract nothing.

**Decision**: A. B tests how `useCODAP` registers with the `codap-interface` singleton, which is exactly what MARK-14 replaces (`mark-7-findings.md`, MARK-14 item 3), and needs a hook harness under Testing Library 12, which has no `renderHook`. A's tests pin the saved shape, the one thing MARK-14 must keep byte-compatible (item 2), and carry over to whatever core MARK-14 builds.

### RESOLVED: Low confidence: the scope fits 3 points
**Context**: seven commits (CI, and the five test areas with area 4 in two), three of them with small extractions.
**Options considered**:
- A) Keep all of it.
- B) Defer area 5's version-1 translation, the smallest-value piece (no ELA document is version 1).

**Decision**: A. Two of the areas are test-only additions to MARK-20's files, the state editor's tests already exist in final form (above), and each extraction moves an existing block of 10 to 40 lines. The version-1 translation is one small function and is the case MARK-7 names. Nothing here needs a package, a config change or a new harness.

### RESOLVED: Stage 8: the slider commit moves three helpers no requirement named
**Context**: the cross-reference found the slider step moving `percentage`, `probability` and `reduceToSum` into `state-editor.ts`, which R9.2 did not say.
**Options considered**:
- A) Add the move to R9.2.
- B) Leave the helpers in the selector and repeat `* 100` in `state-editor.ts`.

**Decision**: A (Doug, 2026-10-28). R9.2 now names the move and the import cycle it avoids.

---

### RESOLVED: Stage 8: a follow-up for the quirks the tests found
**Context**: the tests pin a whitespace-only CODAP value becoming a blank state (reachable in dataset mode), a draw of exactly 0 choosing a 0-value transition, and a zero-sum state's `NaN%` (unreachable).
**Options considered**:
- A) Record them in this spec only.
- B) Note a small follow-up story for the whitespace-only state.

**Decision**: A (Doug, 2026-10-28).

## Self-Review

Roles: senior engineer, QA engineer and test writer, the PR's reviewer (a developer newer to the repo), DevOps engineer, product owner. Each finding below was checked against the code before it was written; findings that did not survive are not recorded.

### QA Engineer

#### RESOLVED: R9.1 implied the percentage test covers `setExactPercentages`
A mutation run in a scratch copy showed which change each `NodeModal` test catches: rounding every displayed share fails the 33/33/34 test, and reverting MARK-20's `/ 100` fails both Save tests, but deleting `setExactPercentages`' last-share fix-up leaves all three passing, since it only absorbs floating-point drift. R9.1 now names the mutation each test catches, and R9.3 says the fix-up is not tested and why.

---

#### RESOLVED: R15's manual check missed two call sites this story changes
R9.2 changes the slider's handler in `probability-selector.tsx`, and R10.1 changes how `setPluginState` restores dataset mode, but R15 checked only the editor's percentages and a drawing-mode reopen. R15 now moves a slider and reopens a dataset-mode document as well.

---

### Senior Engineer

#### RESOLVED: R10.1 didn't say the version-1 translation must stay in place
`translateOrigin` mutates the restored node objects (`app.tsx:127-130`), and `setPluginState` copies those same objects into Reset's initial graph right after calling `setGraph` (`use-codap.ts:101-103`). An extraction that returned new nodes would leave the timing of that copy, and so what Reset restores for a version-1 drawing, different from today. R10.1 now requires the translation to keep moving the nodes in place.

---

### PR Reviewer

#### RESOLVED: nothing tells a developer that CI now runs the tests
The README's Testing section (`README.md:78-80`) says how to run Jest locally but not that CI runs it, or that a failure blocks the deploy. R12.4 adds that line.

---

#### RESOLVED: an unmeasured timing figure
The component-loading note compared the two fixes with "about 6 s" for the components that load as configured, a figure no run measured. It is removed; the two measured times stay.

---

#### RESOLVED: citations that didn't match the code or the plan
Rechecked against this checkout: the `>=` is at `use-generator.ts:31`, `handleTextChange` ends at `drawing.tsx:303`, R6's accented example is the test's `École`, and the scope note counts seven commits. Each is corrected in place.

---

### Test Writer (third pass)

#### RESOLVED: R10.2 claimed a test that a version-2 drawing is not moved
`App` decides which versions to translate (`version < 2`), outside `plugin-state.ts`; changing it to `< 3` or `< 1` leaves all 56 tests passing. R10.2 now claims only the version read back and the translation's arithmetic, and names MARK-11's save-and-reopen test as the guard for version 2.
