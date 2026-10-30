# Rendering Tests for the Markov Plugin's Graph

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-11

**Status**: **Closed**

## Overview

Add Cypress tests that load the plugin in a real browser, inside a fake CODAP page that plays CODAP's side of the plugin API, and check how the graph is drawn, highlighted and fitted and how the plugin's main flows behave. Run them in CI on every push. Nothing a student or teacher sees changes.

The branch sits on MARK-10's (unit tests), which sits on MARK-9's, MARK-8's, MARK-20's and MARK-6's. MARK-12 (React 19) adds five fit-to-view tests on this story's page, and MARK-13 adds a fake Activity Player page beside it. Ownership: logic that runs without a real browser is MARK-10's; layout, the drawn SVG, iframe messaging and the Play, Step, Pause and Cancel flows are MARK-11's.

The Jira description predates MARK-20, MARK-8 and MARK-12's spec. Where it disagrees with the code: MARK-20 had already replaced the whole-graph width scale with per-state widths and made arrowheads scale with their lines, so "under both scales" no longer applies; the plugin has no text mode (Create From Text is a drawing tool, and "table" is dataset mode); and the saved documents' fixtures hold only the plugin's state, not whole CODAP documents.

## Requirements

### General

- **R1. No package changes.** No npm package is added, removed or moved, and `package-lock.json` does not change. (The CI job uses the `cypress-io/github-action` GitHub Action, which is not a package.)
- **R2. Lint and types.** Every new or changed file passes `npm run lint`, `lint:build` and `lint:style` with no output and no `eslint-disable` comments, and `npx tsc --noEmit -p .` passes. The Cypress files type-check with `npx tsc --noEmit -p cypress` (`cypress/tsconfig.json`, Cypress's types, `cypress/` only). `webpack.config.js` stays clean under `npx eslint webpack.config.js`; `cypress.config.ts` keeps its existing style, which no lint command checks.
- **R3. The deployed build is unchanged.** `npm run build` produces a `dist/` byte-identical to the base branch's apart from the `file` field inside the plugin's JS source map, and a `DEPLOY_PATH` build produces the same `index-top.html`. The fake-CODAP page exists only in the development server. *(The source-map field changes because R6.5's `package.json` script edit feeds webpack's intermediate chunk hash; `hooks/use-codap.ts` imports `package.json` for the version.)*
- **R4. No plugin code changes.** Nothing under `src/` changes. The tests select on the DOM the plugin already draws: class names (`g.node`, `line.edge`, `line.edge-background`, `path.loop`, `g.root`), marker ids, toolbar button titles, and button text.

### The fake-CODAP page

- **R5.1** The development server (`npm start`) serves `fake-codap.html`, which hosts the plugin (`index.html`, same origin) in an iframe, 600 by 420 px unless a test asks for another size. It talks to the plugin with iframe-phone's parent endpoint on the `data-interactive` channel, as CODAP does.
- **R5.2** It answers the plugin's requests the way CODAP 3.1.2 does, with reply shapes from MARK-5's captures: `init`'s batch with the saved state in the second reply's `values.savedState`; `notify interactiveFrame {dirty: true}`; `caseFormulaSearch[true]` from the page's dataset; and the output-table requests Play sends (`get dataContextList`, `create dataContext`, `get componentList`, `create component`, `create dataContext[Sequence Data].item`, `get dataContext[Sequence Data].itemSearch[*]`), keeping the items it is sent. `Sequence Data` exists only once the plugin creates it: it is listed from then on, and writing or reading its items before then fails as in CODAP. Every request is recorded; an unknown one gets `{success: false}` and is kept for R5.10.
- **R5.3** It starts the plugin with any saved state (a version-2 drawing, an unversioned drawing, dataset mode) or none (the mode menu), and can withhold the `interactiveFrame` reply so a test sees "Loading ...".
- **R5.4** It holds one small dataset a test can set and change; `caseFormulaSearch[true]` reads the current values. A test can start in dataset mode with one of its attributes without spelling out the saved state.
- **R5.5** It sends `dragDrop[attribute]` notifications for a drop (`dragstart`, `drop`, `dragend`) and `dataContextChangeNotice[<dataset>]` notifications with `createCases`, `updateCases` or `deleteCases`.
- **R5.6** It asks the plugin for its state (`get interactiveState`) and can restart the plugin with the reply.
- **R5.7** It resizes the plugin's iframe on request.
- **R5.8** It passes URL parameters to the plugin, so a test can shorten the animation with `fastSpeed` and `normalSpeed`.
- **R5.9** Its API is a set of typed Cypress custom commands, each with a doc comment. A command that waits on the page yields only once the plugin has replied.
- **R5.10** It records every uncaught error and unhandled promise rejection in the plugin's frame, and every request it has no reply for, and any test during which one happens fails. Cypress doesn't see errors thrown in a nested iframe.

### Cypress configuration

- **R6.1** `cypress.config.ts` turns off `modifyObstructiveCode`, with a comment saying why: Cypress's default rewrites iframe-phone's `window.parent === window` check, and the plugin never connects to its parent.
- **R6.2** Fixtures are on, and the Cypress Cloud `projectId` and the Cypress 10 migration comment are removed.
- **R6.3** `baseUrl` stays `http://localhost:8080`; a developer whose port 8080 is taken overrides it with `CYPRESS_baseUrl`, as the README says.
- **R6.4** The five ELA documents' plugin states are fixtures, one file per document named by its id, holding only `content.tileMap.WEBV3.content.state`, unchanged. They are the module's authored documents, not student work.
- **R6.5** Code coverage is off unless asked for. Cypress 16 moved public variables from `env` to `expose`, and `@cypress/code-coverage` 4 reads `Cypress.expose("coverage")`, so the old `env: {coverage: false}` turned nothing off and in Chrome failed the run. The default is `expose: {coverage: false}`, and `test:coverage:cypress:open` passes `--expose coverage=true`.

### Rendering tests

Expected values are computed from the fixture or the plugin's settings, never copied from a run.

- **R7. Loading and drawing (risk area 6).** "Loading ..." shows while `interactiveFrame` is unanswered, and the plugin draws once it is answered. Each of the five ELA documents draws one `g.node` per state and one `line.edge` per non-loop transition, and labels each state with its fixture label, whole or truncated with "..."; `4gqlICXB3YqN3AfivyZZ` (empty) shows the drawing tools with no states. The template test is deleted.
- **R8. Arrow widths and heads (risk area 1).** Every `line.edge`'s `stroke-width` in `9nsC6KpuDstv2N9eGndM` is `2 + 2.5 * value / stateTotal`; a loop drawn in the plugin follows the same rule, counted among its state's outgoing transitions. All eight markers exist and use `markerUnits="strokeWidth"`; every `line.edge` and `path.loop` has a `marker-end` and no click target has one, on first draw, with a state selected and mid-animation.
- **R9. Labels (risk area 2).** A long label is truncated only once its font size is above 9 and at most 10 px. An HTML-like dataset value is drawn as text (MARK-20's bug 9). A numeric value draws as its digits, and the Starting State list is sorted (bug 4).
- **R10. Highlighting (risk area 3).** A selected state fills with the selected color, its incoming and outgoing transitions draw in blue and orange with their heads, and unconnected states, transitions and labels fade to 0.35 while the connected ones stay at full opacity; a second click, later than the 250 ms double-click window, clears it. A Step run fills the current state and draws the transition taken in the animation color; a finished run clears it. A selected output highlights its path and fades the rest, and a second click clears it.
- **R11. Fit and recenter (risk area 4).** A loaded drawing has a fitted transform and lies inside the SVG; zooming in, then Fit View, returns to it; Recenter View moves an off-center graph back to within 10 px of the SVG's center at the same scale. *(Tested on a nearly origin-centered drawing; bug 10, the off-center fit, is MARK-21's.)*
- **R12. Mode flows (risk area 5).** Dataset mode: a drop builds the graph, `createCases` after a value change rebuilds it, renaming the attribute then `updateCases` leaves the plugin running (bug 2), and Reset rebuilds from the data (bug 8). Drawing mode: Create From Text builds one state per distinct word. Save and reload draws the same states and transitions at the same positions. Back To Main Menu returns to the mode menu.
- **R13. Generation flows.** Play fills the output and sends one item request whose states match. Step advances one state per press and ends with the same output and items. Pause stops the output growing, and Resume finishes it. Cancel stops the run with no item request.

### CI

- **R14.1** `.github/workflows/ci.yml` has a `cypress` job: one container, Node from `.nvmrc`, the dev server started and waited for on port 8080, `cypress run` in Chrome, no Cypress Cloud and no Codecov. The commented-out three-container job is deleted.
- **R14.2** `s3-deploy` needs both `build_test` and `cypress`.
- **R14.3** `build_test` runs `npx tsc --noEmit -p cypress` after the build, since Cypress runs the tests without checking their types (Maureen E. Zitouni's review on the PR).
- **R14.3** The job keeps a failed run's screenshots as a workflow artifact.

### Documentation

- **R15.1** `doc/cypress-coverage.md` describes today's files: the coverage task in `cypress.config.ts` and its `expose` default, `cypress/support/e2e.js`, the `CODE_COVERAGE` loader rule in `webpack.config.js`, and `npm run test:coverage:cypress:open`.
- **R15.2** The README's Testing section says how to run the Cypress tests, on another port if 8080 is taken, that CI runs them and a failure stops the deploy, and where the fake-CODAP page and its commands are.

### Done when

- **R16.** On Node 24 after `npm ci`, at every commit and on the head: the build has no warnings, the three lint commands print nothing, both `tsc` commands pass, `npm test` passes, and from the commit that replaces the template test on, `npm run test:cypress` passes. On the head, the Cypress suite passes three runs in a row, and production `dist/` matches the base. *(Head: Jest 57 tests, Cypress 27 tests in 7 files, three runs in a row in Chrome, and once in Electron through `npm run test:cypress` before the last test fix-up; `dist/` matches except R3's source-map field.)*
- **R17.** Each of MARK-7's six rendering risk areas has a test (R7 to R12), and Play, Step, Pause and Cancel have one each (R13).
- **R18.** CI's `cypress` job runs green on the first push and `s3-deploy` runs after it. *(Checked at the first push.)*

## Technical Notes

### Where the code is

| Part | Files |
|---|---|
| Fake CODAP page | `cypress/fake-codap/fake-codap.ts`, `index.html`; dev-only entry and page in `webpack.config.js` |
| Commands and error check | `cypress/support/index.d.ts` (types and doc comments), `commands.ts`, `e2e.js` (`afterEach`) |
| Width rule restated for tests | `cypress/support/graph.ts` (`stateWidths`) |
| Tests | `cypress/e2e/loading`, `arrows`, `labels`, `highlighting`, `fit`, `modes`, `generation` `.test.ts` |
| Fixtures | `cypress/fixtures/ela/<id>.json`, `chain.json` (a run from `a` is always `a b c`), `cycle.json` (never stops early) |

### The page's commands

| Command | What it does |
|---|---|
| `cy.startPlugin(options?)` | Opens `fake-codap.html` and starts the plugin. Options: `savedState`, `attribute` (dataset mode with this attribute), `dataset`, `holdInit`, `width`, `height`, `query`. |
| `cy.plugin()` | Yields the plugin's body. It finds the frame by `id="plugin"`, because the dev server's error overlay is another iframe on the page. |
| `cy.fakeCodap()` | Yields `window.fakeCodap`, including `requests` and `items`. |
| `cy.releaseInit()` | Sends the held `interactiveFrame` reply. |
| `cy.setAttributeValues`, `cy.renameAttribute` | Change the page's dataset. |
| `cy.dropAttribute(name)`, `cy.notifyCases(operation)` | Send a drop or a case notification, waiting for the replies. |
| `cy.getPluginState()`, `cy.restartPlugin(savedState)` | Save and reopen, as CODAP does. |
| `cy.resizePlugin(width, height)` | Resizes the frame. |
| `cy.clickState(label)`, `cy.doubleClickState(label)` | Click a state with a lone `click` event, outside or inside the 250 ms double-click window. |

The page's dataset is `Words`, collection `Cases`, with `Word` (`the cat sat on the mat`) and `Letter` (`a b a c`). A restart keeps the options, the items sent and the errors recorded.

### What the tests need to know about the browser

- **`modifyObstructiveCode`** has to be off, or the plugin never sends iframe-phone's `hello` and `init` times out.
- **Errors in the plugin's frame** don't fail a Cypress test; the page keeps them for the `afterEach` (R5.10). It listens on the frame's first window as soon as the frame is added, because loading the same-origin plugin reuses that window, so errors while the plugin starts count too; listening from the frame's `load` event missed them.
- **`.click()` on a state** makes d3-drag throw `gestures.mouse is not a function` in the nested frame, so states get a lone `click` event. Clicking the graph's background with `.click(x, y)` works.
- **`invoke` doesn't wait for a promise**; commands that call the page use `then`. **`blur`** fails on an input inside the frame; tests commit with `{enter}`.
- **`cy.clock`** affects only the top window, so animation timing comes from the plugin's `fastSpeed` and `normalSpeed` parameters.
- **The dev server's rebuild can lag** behind an edit to `src/`. A run that starts too soon tests the old code, so a mutation check waits about 30 s. A lint warning or runtime error brings up the overlay, which covers the plugin.
- **Coverage** counts statements only for the fake page: the plugin runs in a nested frame, and the `nyc` section's `all: true` lists every other file with nothing counted.

### Bug 10, measured

A two-state drawing centered on the origin fits exactly centered. The same drawing moved by (300, 150) fits 200 px right of and 100 px below center: the fit translates by `scale * -center / 2` (`graph.tsx:803-804`) where centering needs `scale * -center`. In the ELA documents the fitted graph sits up to 24 px off center. `geDiXLf2GyHsWCF2QFnU`, which the fit tests use, is off by about 3 px, so the recenter test's 10 px tolerance holds before and after MARK-21's fix.

### What MARK-12 and MARK-13 inherit

The page, its commands, the fixtures, the Cypress config, the error check and the CI job. MARK-12's five tests compare `svg g.root`'s transform with one read earlier, so they don't depend on bug 10. MARK-12 moves `rootTransform` from `fit.test.ts` into `cypress/support/graph.ts`; `fit.test.ts`'s recenter test changed during implementation, so that diff's context may need refreshing. MARK-13 adds its fake Activity Player page as a second dev-only entry and extends the `afterEach`.

## Out of Scope

- Changing plugin code (R4), including the two fixes in MARK-21, "Fit to view and Reset misplace graphs in the Markov CODAP plugin": bug 10, and Reset on an unversioned drawing restoring untranslated positions.
- Anything MARK-10 tests in Jest: the text parser, graphs built from values, generation's choices, the state editor's percentages, the saved state's shape.
- MARK-12's five fit-to-view tests.
- Code coverage in CI and Codecov; Cypress Cloud; Cypress component tests.
- Checking against the real CODAP: the page mirrors CODAP 3.1.2's captured replies, and the CODAP checks stay manual (MARK-5).
- Dragging a state: the tests drive the plugin's click handling only.

## Decisions

### Where the fake-CODAP page lives
**Options**: A) a dev-only webpack entry using iframe-phone's `ParentEndpoint`; B) a static page stubbed with `cy.intercept`; C) the real CODAP.
**Decision**: A. It uses CODAP's library, lints with the rest, can be opened by hand, and R3's check proves it stays out of the deploy. B posts from the wrong window for the plugin's `window.parent` check, and C depends on a network service.

### Fixtures hold the plugin state, not the whole CODAP documents
**Decision**: only `content.tileMap.WEBV3.content.state`, unchanged, named by document id. It is what CODAP hands the plugin, and the lesson text has no use here.

### Chrome in CI
**Decision**: Chrome, since Cypress 16 deprecates Electron. The local `test:cypress` script keeps the default, so a developer without Chrome can still run it.

### Bug 10
**Options**: A) record it, test fit only on an origin-centered graph, and propose a bug story; B) also add a skipped off-center test; C) fix it here.
**Decision**: A (Doug). The fix and an off-center test are MARK-21; it changes where students' graphs sit, so Rebecca confirms it before it ships.

### The frame-error check is a requirement
**Decision**: the `afterEach` that fails a test on an error or rejection in the plugin's frame is R5.10 (Doug). Without it the bug 2 test can't fail.

### One story at 3 points
**Decision**: no split. Every file was built and run before the plan was final, and the timing risk that would justify a split was measured and handled.

### Timing without `cy.clock`
**Options**: A) shorten the animation with `fastSpeed` and `normalSpeed`, assert mid-run with Step, wait with retrying assertions; B) `cy.clock`.
**Decision**: A. `cy.clock` doesn't reach the plugin's frame, and the animation reads `Date.now()`. Cancel runs at a 100 ms step and waits 2 s, so a run left going would send its items in time to fail the test.

### The state-editor Save width check was dropped
**Decision**: with per-state widths, a Save that applies 100-fold values changes no width, so the check passed with MARK-20's 3B fix undone. MARK-10's `NodeModal` test and MARK-20's `applyStatePercentages` tests cover 3B.

### One test file per risk area
**Decision**: each commit is one area a reviewer can read on its own, a CI failure names the area, and MARK-12's tests go in their own `fit-view.test.ts`.

### Typed commands rather than the page's API directly
**Decision**: every command that talks to the plugin has to wrap its promise in `then`, which raw use would leave each test to remember; `index.d.ts` is the page's documentation.

### States are clicked with a lone click event
**Options**: A) `trigger("click")`; B) hide the errors by turning the overlay off; C) a real-events package.
**Decision**: A. B hides the errors the check exists to catch, and C adds a package (R1).

### `cypress.config.ts` stays out of `tsc -p cypress`
**Decision**: it uses `require`, and adding Node's types brings in `@types/node` 18, which fails against TypeScript 6's libs. The Cypress specs, support files and page are checked.

### A restart keeps the recorded errors
**Decision**: `start` doesn't clear `errors`, so an error before `cy.restartPlugin` still fails the test. Each `cy.startPlugin` loads a fresh page, which starts empty.

### The plugin's frame is found by id
**Decision**: `cy.plugin()` selects `iframe#plugin`. Found while implementing: the dev server's error overlay is also an iframe, and after a restart it came first.

### Recenter is tested off center
**Decision**: the test zooms with the wheel near a corner, which moves the graph off center, before clicking Recenter View, and R11 says Recenter recenters. Found in review: with `+` alone, a Recenter that did nothing passed.

### Tests made able to fail during review
**Decision**: each was shown failing on a mutation before it was kept.
- The marker check compares the full id set.
- Highlighting checks that labels un-fade, that the selected state and its neighbors stay unfaded, and that an output's own states do.
- The labels test checks the numeric labels. Its text check is what fails when a label is drawn as HTML, since the truncated value never holds a whole tag, so it has no separate script check.
- Recenter checks that the graph's center is within 10 px of the SVG's (Ethan McElroy's review on the PR).
- The ELA load tests check each drawn label against the fixture's labels (Ethan McElroy's review on the PR).
- A request the fake CODAP page has no reply for fails the test, as frame errors do (Ethan McElroy's review on the PR).
- The arrowhead checks first confirm the click targets are drawn.
- Save and reopen checks the saved transitions, and the reopened graph draws exactly those transitions.
- Play and Step check the exact items sent, in one request.
- The fake CODAP page rejects items for an output dataset the plugin never created (Copilot's review on the PR).
- Errors thrown while the plugin starts fail the test (Copilot's review on the PR).
