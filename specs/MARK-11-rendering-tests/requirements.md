# Rendering Tests for the Markov Plugin's Graph

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-11
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Add Cypress tests that load the plugin in a real browser, inside a fake CODAP page that plays CODAP's side of the plugin API, and check how the graph is drawn, highlighted and fitted and how the plugin's main flows behave. Run them in CI on every push. Nothing a student or teacher sees changes.

## Project Owner Overview

The feature stories that follow rework how the graph is drawn and move the plugin's code into parts shared with a new Activity Player interactive. MARK-10's unit tests check the plugin's logic, but nothing yet checks the picture a student actually sees: the states and arrows, their widths and arrowheads, the colors when a state is selected or a sequence plays, and the zoom that fits the chain into view. This story adds those checks, run in a real browser against the five saved ELA documents, and makes GitHub run them on every push so a change that breaks the drawing is caught before review.

To run without CODAP, the tests use a small stand-in page that answers the plugin's requests the way CODAP 3.1.2 does. MARK-12 (the React update) adds its own five tests on the same page. The plugin itself and what gets deployed do not change.

## Background

MARK-11 is the sixth "before the features" story: master, MARK-6 (deploy pipeline), MARK-20 (plugin bug fixes), MARK-8 (build and test tooling), MARK-9 (ESLint 9), MARK-10 (unit tests), then MARK-11, then MARK-12 (React 19). This branch is cut from MARK-10's, so it has MARK-8, MARK-9 and MARK-10 implemented, and the line citations here are to that code.

The Jira description and its source (`dev-stories.md`, section E2) predate MARK-20, MARK-8 and MARK-12's spec. Checked against the repo:

- **The template test** `cypress/e2e/workspace.test.ts` still expects `.app` to read "Hello World" (line 8) and fails. Confirmed; it is replaced.
- **"Edge widths."** MARK-20 replaced the whole-graph width scale with per-state widths from 2 to 4.5 px (`components/graph-utils.ts:24-33`) and made arrowheads scale with their lines (`markerUnits="strokeWidth"`, `graph.tsx:401-416`). There is one scale, so MARK-7's "under both scales" (risk area 1) no longer applies. MARK-20's Out of Scope hands MARK-11 the DOM-level arrowhead tests (`plugin-bugs.md` 3C, "Extra tests").
- **"The text and table modes."** The plugin has no text mode: Create From Text is a drawing tool (`components/drawing/add-text.tsx`), and "table" is dataset mode, which builds the chain from a CODAP attribute. Both are covered.
- **"Use the saved documents as fixtures."** MARK-5's five ELA documents (`ela-documents/<id>.json` in the stream's oob folder) are whole CODAP 3 documents; the plugin's saved state is `content.tileMap.WEBV3.content.state` in each, all `{viewMode: "drawing", nodes, edges, version: 2}`. Only that state is a fixture here.
- **`doc/cypress-coverage.md`** still names `cypress/plugins/index.js`, `cypress/support/index.js` and `cypress.json`, and the `istanbul-instrumenter-loader` and `@cypress/webpack-preprocessor`, none of which exist. Confirmed.
- **CI.** `ci.yml` has a live build job and a commented-out three-container Cypress matrix with a Cypress Cloud record key and a Codecov upload. MARK-10 renamed the build job to `build_test` (build plus Jest) and made `s3-deploy` need it, keeping the commented-out `cypress` job and a `# - cypress` line under `s3-deploy`'s `needs` for MARK-11 (decided by Doug, 2026-10-28).
- **`cypress.config.ts`** still has `fixturesFolder: false`, a Cypress Cloud `projectId` and the Cypress 10 migration comment, and hardcodes `baseUrl: http://localhost:8080`, which MARK-8 left for MARK-11 to revisit.
- **The README's Testing section** cites `cypress/integration/examples/smoke-test.js`, which doesn't exist, and lists Cypress Cloud options (`--record`, `--key`, `--group`) the repo doesn't use.

### Ownership

- **MARK-10 vs MARK-11:** logic that runs without a real browser is MARK-10's (Jest). Anything that needs layout (`getBBox`, label measuring in a real DOM), the drawn SVG, or iframe messaging is MARK-11's. MARK-10 tests generation; MARK-11 tests the Play, Step, Pause and Cancel flows (`mark-7-findings.md`, "What would make MARK-14 harder", item 1). Nothing MARK-10's spec tests is planned here.
- **CI:** MARK-11 adds a `cypress` job and adds it to `s3-deploy`'s `needs`, on top of MARK-10's `build_test` (decided by Doug, 2026-10-28).
- **MARK-12** adds five fit-to-view tests on this story's page (its R16): an unversioned drawing, Reset on a loaded drawing, a dataset case change, a second drop, and Reset then a frame resize. It needs the page to start the plugin with any saved state or none, hold a dataset a test can change, send `dragDrop[attribute]` and case notifications, and resize the plugin's frame.

### What the risk areas need (MARK-7)

`mark-7-findings.md` lists six rendering risk areas, in order: (1) arrow and loop widths, including after a state-editor Save; (2) labels, their truncation and font sizing, HTML-like and numeric labels; (3) highlighting: a selected state, animation steps, and a selected output's path; (4) fit and recenter, including a graph whose center is off the origin (bug 10); (5) mode flows on the fake-CODAP page: drop, case change, a renamed attribute (bug 2), Reset in dataset mode (bug 8), save and reload; (6) the plugin shows "Loading ..." until CODAP answers `interactiveFrame`.

## Requirements

### General

- **R1. No package changes.** No npm package is added, removed or moved, and `package-lock.json` does not change. (The CI job uses the `cypress-io/github-action` GitHub Action, which is not a package.)
- **R2. Lint and types.** Every new or changed file passes `npm run lint`, `lint:build` and `lint:style` with no output and no `eslint-disable` comments, and `npx tsc --noEmit -p .` passes. The Cypress files follow the Cypress rules MARK-9's flat config applies to `cypress/**`, and type-check with `npx tsc --noEmit -p cypress` (a `cypress/tsconfig.json` with Cypress's types, covering `cypress/` only), since nothing else checks them: `tsconfig.json` includes only `src`, and Cypress's own bundler does not type-check. The two config files the lint commands don't cover: `webpack.config.js` stays clean under `npx eslint webpack.config.js`, and `cypress.config.ts` keeps its existing style (single quotes, no semicolons, `require`), which no lint command has ever checked.
- **R3. The deployed build is unchanged.** Nothing this story adds reaches a production build: `npm run build` produces a `dist/` byte-identical to the base branch's, and a `DEPLOY_PATH` build produces the same `index-top.html`, so the S3 deploy and the `index-top.html` a release copies to the top-level `index.html` are unchanged. The fake-CODAP page exists only in the development server.
- **R4. No plugin code changes.** Nothing under `src/` changes. The tests select on the DOM the plugin already draws: class names (`g.node`, `line.edge`, `line.edge-background`, `path.loop`, `g.root`), marker ids, toolbar button titles, and button text.

### The fake-CODAP page

- **R5.1** The development server (`npm start`) serves a page, `fake-codap.html`, that hosts the plugin (`index.html`, same origin) in an iframe, 600 by 420 px unless a test asks for another size (CODAP 3.1.2 resizes the plugin's tile to 600 by 420 on load, `mark-5-results.md`). It talks to the plugin with iframe-phone's parent endpoint on the `data-interactive` channel, the same library and protocol CODAP uses.
- **R5.2** It answers the plugin's requests the way CODAP 3.1.2 does, with reply shapes taken from MARK-5's captures:
  - `init`'s batch `[update interactiveFrame, get interactiveFrame]` with two replies, the second carrying the saved state as `values.savedState` (`utils/codap-interface.ts:211-232`, which reads `resp[1]`). Nothing renders until it does (risk area 6).
  - `notify interactiveFrame {dirty: true}`.
  - `get dataContext[<dataset>].collection[<collection>].caseFormulaSearch[true]`, from the page's dataset.
  - The output-table requests Play sends since MARK-20: `get dataContextList`, `create dataContext`, `get componentList`, `create component`, `create dataContext[Sequence Data].item`, and `get dataContext[Sequence Data].itemSearch[*]` (`utils/output-dataset.ts`), keeping the items it is sent so `itemSearch[*]` and a test can read them.
  - Every request the plugin sends is recorded for tests to read. A request the page doesn't know gets `{success: false}`.
- **R5.3** It can start the plugin with any saved state: a version-2 drawing (the five ELA documents), an unversioned drawing, a dataset-mode `{attribute, viewMode: "dataset"}`; and with no saved state, which shows the mode menu, from which a test chooses Drawing or Dataset (dataset mode with no attribute). It can also withhold the `interactiveFrame` reply, so a test sees "Loading ...".
- **R5.4** It holds one small dataset (a name, a collection, and attributes with values) that a test can set and change. `caseFormulaSearch[true]` reads the current values, so a test can change them, then notify. A test can start the plugin in dataset mode with one of the dataset's attributes without spelling out the saved `{datasetName, collectionName, attributeName}` itself.
- **R5.5** It sends `dragDrop[attribute]` notifications for a drop (`dragstart`, `drop` with the dataset, collection and attribute names, `dragend`) and `dataContextChangeNotice[<dataset>]` notifications with `createCases`, `updateCases` or `deleteCases`.
- **R5.6** It asks the plugin for its state (`get interactiveState`) and can restart the plugin with the reply, for MARK-7's save-and-reload check.
- **R5.7** It resizes the plugin's iframe on request.
- **R5.8** It passes URL parameters through to the plugin, so a test can shorten the animation with the plugin's existing `fastSpeed` and `normalSpeed` parameters (`components/app.tsx:27-31`).
- **R5.9** Its API is a set of typed Cypress custom commands, each with a doc comment, and the spec's Technical Notes list them for MARK-12's tests. A command that waits on the page (a notification, the state request) yields only once the plugin has replied, so a test needs no fixed wait after it.
- **R5.10** It records every uncaught error and unhandled promise rejection in the plugin's frame, and any test during which one happens fails. Cypress doesn't see errors thrown in a nested iframe, so without this a test of a crash (bug 2) can't fail.

### Cypress configuration

- **R6.1** `cypress.config.ts` turns off `modifyObstructiveCode`, with a comment saying why: Cypress's default rewrites iframe-phone's `window.parent === window` check, and the plugin never connects to its parent (measured: no `hello` reaches the page until it is off).
- **R6.2** Fixtures are on (the default `cypress/fixtures` folder), and the Cypress Cloud `projectId` and the Cypress 10 migration comment are removed.
- **R6.3** `baseUrl` stays `http://localhost:8080`, the dev server's default and the CI job's. A developer whose port 8080 is taken runs the dev server on another port and overrides `baseUrl` with `CYPRESS_baseUrl`; the README says how.
- **R6.4** The five ELA documents' plugin states are fixtures, one file per document named by its id, holding only the state (`content.tileMap.WEBV3.content.state`), unchanged. They are the module's authored documents (the shared files the activity loads, `mark-5-results.md`), not student work.
- **R6.5** Code coverage is off unless asked for, as `doc/cypress-coverage.md` intends. Cypress 16 moved public variables from `env` to `expose`, and `@cypress/code-coverage` 4 reads `Cypress.expose("coverage")`, so today's `env: {coverage: false}` turns nothing off: every run registers the coverage hooks, writes `coverage-cypress/`, and in Chrome the report step fails the run (`cy.task('coverageReport')`: `RangeError: Invalid string length`). The default moves to `expose: {coverage: false}`, and `test:coverage:cypress:open` passes `--expose coverage=true` instead of `--env coverage=true`.

### Rendering tests

Each test runs on the fake-CODAP page. Expected values are computed from the fixture or the plugin's settings (`graph-utils.ts:12-19`), never copied from a run.

- **R7. Loading and drawing (risk area 6).** The plugin shows "Loading ..." while `interactiveFrame` is unanswered, and draws once it is answered. Each of the five ELA documents draws one `g.node` per state and one `line.edge` per non-loop transition, and `4gqlICXB3YqN3AfivyZZ` (empty) shows the drawing tools with no states. The template test is deleted.
- **R8. Arrow widths and heads (risk area 1, MARK-20's 3A, 3B and 3C).**
  - In an ELA document with states of several outgoing transitions (`9nsC6KpuDstv2N9eGndM`), every `line.edge`'s `stroke-width` is its state's share, `2 + 2.5 * value / stateTotal`.
  - A loop drawn in the plugin (Add Transition, double-click a state) has a `path.loop` whose width follows the same rule, counting the loop among its state's outgoing transitions.
  - All eight arrowhead markers use `markerUnits="strokeWidth"`; every `line.edge` and `path.loop` has a `marker-end`; no `line.edge-background` or `path.loop-background` has one, after a state is selected and after an animation step as well as on first draw (MARK-20's R3C.4).
- **R9. Labels (risk area 2).**
  - A long label is truncated with "..." only once its font size has stepped down to `minFontSize` (10 px): the size starts at 0.8 of the state's radius and drops 1 px at a time, so a truncated label is drawn at a size above 9 and at most 10 px (`calculateNodeFontSize`, `graph-utils.ts:111-148`). `9nsC6KpuDstv2N9eGndM` has such labels ("appreciation").
  - A label that looks like HTML (`<img src=x onerror=...>`, from a dataset value) is drawn as that literal text and creates no element, and runs no script (MARK-20's bug 9).
  - A numeric dataset value draws as its digits, and the Starting State list is sorted (MARK-20's bug 4).
- **R10. Highlighting (risk area 3).**
  - Clicking a state fills it with the selected color; its incoming transitions draw in blue with the `incomingArrow` head, its outgoing ones in orange with `outgoingArrow`, and unconnected states, transitions and labels fade to 0.35 opacity. Clicking it again clears all of that. (Two clicks on a state within 250 ms count as a double-click and open its editor, `graph.tsx:486-502`, so the second click comes later than that.)
  - During a Step-by-Step run, the current state is filled with the animation color and, after the next Step, the transition taken draws in the animation color with the `animatedArrow` head; when the run finishes, the highlight clears.
  - Clicking a finished output sequence highlights its states and transitions and fades the others; clicking it again clears that.
- **R11. Fit and recenter (risk area 4).** After a drawing loads, the root group has a fitted transform and the drawn graph lies inside the SVG. Zooming in with the plugin's + button and then Fit View returns to the fitted transform. Recenter View keeps the current scale. (Bug 10, the off-center fit, is left to MARK-21: Open Questions.)
- **R12. Mode flows (risk area 5).**
  - Dataset mode: dropping an attribute builds the graph from its values; changing the values and sending `createCases` rebuilds it; renaming the attribute in the dataset, then sending `updateCases`, leaves the plugin running, with no state that has an empty label (MARK-20's bug 2); Reset rebuilds the graph from the attribute's values (MARK-20's bug 8).
  - Drawing mode: typing text into Create From Text builds one state per distinct word.
  - Save and reload: the state the plugin returns for `get interactiveState`, restarted, draws the same states and transitions at the same positions.
  - Back To Main Menu returns to the mode menu.
- **R13. Generation flows (`mark-7-findings.md`, MARK-14 item 1).**
  - Play generates a sequence: the output list shows it, and the page receives one `create dataContext[Sequence Data].item` request whose states match it.
  - Step advances one state per press and finishes with the same output and item request as Play.
  - Pause stops the animation (the output stops growing), and Resume finishes it.
  - Cancel stops the run with no item request for it.

### CI

- **R14.1** `.github/workflows/ci.yml` gets a `cypress` job: one container, Node from `.nvmrc`, `npm ci` with the Cypress binary, the dev server started and waited for on port 8080, `cypress run` in Chrome, no Cypress Cloud record key and no Codecov upload. The commented-out three-container job is deleted.
- **R14.2** `s3-deploy` needs both `build_test` and `cypress`, so a failing rendering test stops the deploy.
- **R14.3** The job keeps Cypress's screenshots of a failed test as a workflow artifact, so a CI failure can be read without rerunning it locally.

### Documentation

- **R15.1** `doc/cypress-coverage.md` describes today's files: `cypress.config.ts` (the `@cypress/code-coverage/task` registration and the `coverage` default under `expose`, R6.5), `cypress/support/e2e.js`, the `CODE_COVERAGE` loader in `webpack.config.js` and `npm run test:coverage:cypress:open`. The section on Cypress unit tests, which relied on the removed `@cypress/webpack-preprocessor`, is removed.
- **R15.2** The README's Testing section says how to run the Cypress tests (`npm start`, then `npm run test:cypress` or `test:cypress:open`; `test:full` also needs the dev server running), how to use another port, that CI runs them on every push and a failure stops the deploy, and where the fake-CODAP page and its commands are. The Cypress Cloud options and the nonexistent spec path go.

### Done when

- **R16.** On Node 24 after `npm ci`, on every commit and on the head: `npm run build` compiles with no warnings; the three lint commands print nothing; both `tsc` commands pass; `npm test` passes MARK-10's and MARK-20's tests. From the commit that replaces the template test on, `npm run test:cypress` passes against `npm start`; before it, the template test fails as it does on the base. On the head, the Cypress suite passes three runs in a row, and the production `dist/` matches the base branch's byte for byte.
- **R17.** Each of MARK-7's six rendering risk areas has at least one test (R7 to R12), and the Play, Step, Pause and Cancel flows have one each (R13).
- **R18.** CI's `cypress` job runs green on the first push and `s3-deploy` runs after it. *(Checked at the first push.)*

## Technical Notes

### Measured on this checkout (throwaway code, 2026-10-28, Node 24.14, Cypress 16.2)

- **A dev-only webpack entry leaves production unchanged.** Adding the page as a second entry and a second `HtmlWebpackPlugin` only when `devMode`, keeping the plugin's chunk named `main` and its file `assets/index.[contenthash].js`, and excluding the page's chunk from `index.html`, gave a production `dist/` byte-identical to the base's (sha256 of all seven files). The CSS file is named after the chunk (`assets/main.[contenthash].css`), so renaming the entry would change the deployed file names.
- **`modifyObstructiveCode`.** With Cypress's default, the plugin in the page's iframe never sends iframe-phone's `hello`, and `init` times out after 2 s ("CODAP request timed out"). iframe-phone's `IFrameEndpoint.initialize` returns early on `window.parent === window`, which the dev bundle contains verbatim and Cypress's proxy rewrites. With the option off, the handshake and every request below work. The same page drives the plugin from Playwright with no such setting.
- **A spike of the page under Cypress** passed: the pnRU document drew 4 states and 2 transitions at 4.5 px with no `marker-end` on the click targets, and `get interactiveState` returned its 4 nodes with `version: 2`; dataset mode built 5 states from a drop and 2 after a value change and `createCases`; Play put one sequence in the output list and its items reached the page; resizing the iframe changed the graph's `viewBox`.
- **The five ELA documents on the page** each drew every state and transition. `9nsC6KpuDstv2N9eGndM` truncates six labels ("everyth...", "appreci...") and draws widths from 2.06 to 4.5 px; `geDiXLf2GyHsWCF2QFnU` truncates "septem...". The graph area is 370 by 400 px in the 600 by 420 frame.
- **Bug 10 is real.** A two-state drawing centered on the origin fits exactly centered (offset under 0.001 px). The same drawing moved by (300, 150) fits 200 px right of and 100 px below center: the fit translates by `scale * -center / 2` (`graph.tsx:803-804`) where centering needs `scale * -center`, so the error is half the scaled offset (1.345 x 300 / 2 = 202). In the ELA documents the fitted graph sits up to 24 px off center (`lr1YsZHAZ1KYXxk67jD2`: 24 left, 7 up; pnRU 16 up).
- Cypress 16 warns that Electron, its default browser, is deprecated; Chrome is on GitHub's `ubuntu-latest` runners.

### Measured before planning (stage 4 throwaway checks, Chrome 152 via Cypress 16.2)

A near-final page with typed commands, and one throwaway test per claim in R7 to R13, ran three times in a row with no failures: "Loading ..." while `interactiveFrame` is held, then the mode menu once released; every one of `9nsC6KpuDstv2N9eGndM`'s 289 widths within 1e-9 of `2 + 2.5 * value / stateTotal`; all eight markers in `strokeWidth` units; no click target with a `marker-end` on first draw, after selecting a state, or after an animation step; truncated labels at sizes above 9 and at most 10; an `<img onerror>` dataset value drawn as text, with no element made and no script run; incoming and outgoing colors and heads on selection, cleared by a second click 300 ms later; a loop drawn by double-clicking in Add Transition, with a head; the Step highlight; Pause holding the output for a second, then Resume and Cancel with no item sent; dataset drop, Reset rebuilding 5 states, and a renamed attribute returning to the drop screen; and `get interactiveState` returning the loaded nodes unchanged.

- **Production builds.** With the page's entry added, `npm run build` and a `DEPLOY_PATH=branch/x/` production build each give files byte-identical to the base's, `index-top.html` included.
- **`cy.clock`** froze the top window's `Date.now()` at 0 while the plugin's iframe kept the real time.
- **Coverage.** With `env: {coverage: false}` the run took 17 to 27 s and failed in its `after all` hook (R6.5); with `expose: {coverage: false}` the same tests took 7 s, and no `coverage-cypress/` or `.nyc_output/` was written.
- **Two Cypress habits the tests need.** `cy.invoke` does not wait for a returned promise (`get interactiveState` yielded the pending promise, which serialized as `{}`), so commands that call the page wrap it in `cy.then`. `cy.blur` fails on an input inside the plugin's iframe, because the top document's focus is the iframe itself; a test commits Max Length with `{enter}`.
- **Types.** `@typescript-eslint/no-namespace` rejects the `declare global { namespace Cypress { ... } }` Cypress documents for typing custom commands, except in a `.d.ts` file (`allowDefinitionFiles`), so the command types go in one.

### Code the tests rely on

| What | Where |
|---|---|
| `init` batch, `resp[1].values.savedState`, the 2 s reply timeout | `utils/codap-interface.ts:207-271`; iframe-phone's `IframePhoneRpcEndpoint.call` |
| Notification routing: `get` to the first matching subscriber, `notify` to every one by `operation` | `utils/codap-interface.ts:114-186` |
| Subscriptions: `dragDrop[attribute]`, and `createCases`, `updateCases`, `deleteCases` on any resource | `hooks/use-codap.ts:139-161` |
| Saved state and restore | `hooks/use-codap.ts:49-52`, `:79-96`, with the logic in `utils/plugin-state.ts` |
| Drop, case change | `hooks/use-codap.ts:98-132`; values from `utils/attribute-values.ts:8-24` |
| Output-table requests | `utils/output-dataset.ts` |
| Widths, loop paths, label measuring, settings | `components/graph-utils.ts` |
| Markers, edge and loop drawing, highlight rules, fit | `components/graph.tsx:196-300` (selection and output highlight), `:401-426` (markers), `:575-662` (edges and loops), `:727-781` (animation highlight), `:783-828` (fit and recenter) |
| Toolbar titles ("Add Transition", "Fit View", "Recenter View", "Reset", "Back to Main") | `components/toolbar.tsx:23-33` |
| Play, Step, Pause, Resume, Cancel, Reset, the output list | `components/app.tsx:343-396`, `:540-565`, `:460-528` |
| Animation speed parameters | `components/app.tsx:27-31` |
| Colors and opacities | `components/graph.tsx:16-24` |

### The page's commands (R5.9)

Declared with their doc comments in `cypress/support/index.d.ts` (the implementation spec has the code). The page's own object, `window.fakeCodap`, is reachable with `cy.fakeCodap()` for what the commands don't wrap: `requests` (every request the plugin sent) and `items` (the output items it was sent).

| Command | What it does |
|---|---|
| `cy.startPlugin(options?)` | Opens `fake-codap.html` and starts the plugin. Options: `savedState` (any shape, or none for the mode menu); `attribute` (start in dataset mode with this attribute of the page's dataset, building `{attribute, viewMode: "dataset"}`); `dataset` (replace the page's dataset); `holdInit` (withhold the `interactiveFrame` reply); `width`, `height` (the frame, 600 by 420 by default); `query` (URL parameters for the plugin, such as `normalSpeed=200`). |
| `cy.plugin()` | Yields the plugin's body, for `cy.plugin().find(...)`. |
| `cy.releaseInit()` | Sends the held `interactiveFrame` reply. |
| `cy.setAttributeValues(name, values)` | Replaces an attribute's values in the page's dataset. |
| `cy.renameAttribute(from, to)` | Renames an attribute, keeping its values. |
| `cy.dropAttribute(name)` | Sends `dragstart`, `drop` and `dragend` for an attribute, waiting for each reply. |
| `cy.notifyCases(operation)` | Sends `createCases`, `updateCases` or `deleteCases` for the page's dataset, waiting for the reply. |
| `cy.getPluginState()` | Sends `get interactiveState` and yields the state the plugin returns. |
| `cy.restartPlugin(savedState)` | Starts the plugin again with the same options and this state. |
| `cy.resizePlugin(width, height)` | Resizes the plugin's frame. |
| `cy.clickState(label)`, `cy.doubleClickState(label)` | Click a state, or click it twice inside the plugin's double-click window, with click events alone (implementation spec, the page's step, on why). |

The page's dataset is `Words`, collection `Cases`, with `Word` (`the cat sat on the mat`: 5 distinct values) and `Letter` (`a b a c`: 3).

### What MARK-12 inherits

The page and its commands (R5), the fixtures (R6.4) and `modifyObstructiveCode: false` (R6.1). MARK-12's five tests read `svg g.root`'s `transform` and compare it with one read earlier, so they don't depend on bug 10's outcome. A sketch of each, written against MARK-12's table with these commands, passed twice on React 17 (stage 7). MARK-12 moves `rootTransform` from `fit.test.ts` into `cypress/support/graph.ts` so both test files can import it, and its cases-change and second-drop tests click Fit View before reading the transform they compare with:

| MARK-12 test | Setup with this page |
|---|---|
| unversioned drawing | `cy.startPlugin({savedState})` with a drawing that has no `version` |
| Reset | `cy.startPlugin({savedState})` with an ELA fixture, `.plusButton` twice, Reset, Ok |
| cases change | `cy.startPlugin({attribute: "Word"})`, then `cy.setAttributeValues("Word", [...3 distinct words])` and `cy.notifyCases("createCases")` |
| second drop | `cy.startPlugin()`, Dataset, `cy.dropAttribute("Word")`, then `cy.dropAttribute("Letter")` |
| Reset, then resize | `cy.startPlugin()`, Drawing, Add State, `cy.plugin().find(".graph").click(x, y)`, Reset, Ok, click again, `cy.resizePlugin(700, 420)` |

Clicking the graph's background with Cypress's `click` works (no error in the plugin's frame); only states need `cy.clickState`. Add State stays selected after Reset, and pressing its button again turns it off, so the second state is added without pressing it.

## Out of Scope

- **Changing plugin code** (R4), including the two fixes in MARK-21, "Fit to view and Reset misplace graphs in the Markov CODAP plugin" (bug 10, and Reset on an unversioned drawing restoring untranslated positions), or any quirk a test finds.
- **Anything MARK-10 tests in Jest**: the text parser, graphs built from values, generation's choices, the state editor's percentages, the saved state's shape.
- **MARK-12's five fit-to-view tests**, which it adds on this page.
- **Code coverage in CI and Codecov.** Coverage stays available locally.
- **Cypress Cloud** (recording, parallel containers).
- **Component tests** (Cypress's `component` mode).
- **Checking against the real CODAP.** The page mirrors CODAP 3.1.2's captured replies; the CODAP checks stay manual (MARK-5).

## Open Questions

### RESOLVED: Judgment call: where the fake-CODAP page lives
**Context**: the page has to share the plugin's origin (Cypress reaches into the plugin's iframe), and its replies have to come from the page's own window, which iframe-phone checks (`message.source === window.parent`).
**Options considered**:
- A) A dev-only webpack entry, `fake-codap.html`, built and served by the dev server, using iframe-phone's `ParentEndpoint`.
- B) A static page stubbed with `cy.intercept`, with CODAP's side hand-written in the spec's window.
- C) Load the plugin in the real CODAP.

**Decision**: A. It uses the same library as CODAP, is TypeScript that lints with the rest, can be opened by hand while debugging, and R3's byte-identical check proves it stays out of the deploy. B posts from the spec's window, which the plugin's `window.parent` check would reject, and C depends on a network service and CODAP's release cadence.

### RESOLVED: Judgment call: fixtures hold the plugin state, not the whole CODAP documents
**Context**: each ELA document is 4 to 26 KB of CODAP document, mostly text tiles with lesson content; the page needs only the plugin's state.
**Options considered**:
- A) Commit only `content.tileMap.WEBV3.content.state`, unchanged.
- B) Commit the whole documents and extract the state in the test.

**Decision**: A. The state is what CODAP hands the plugin, the files stay small enough to read in review, and the lesson text has no use here. The file names keep the document ids, so each traces back to MARK-5.

### RESOLVED: Judgment call: Chrome in CI
**Context**: Cypress 16 warns that Electron, its default browser, is deprecated.
**Options considered**:
- A) Run CI in Chrome, which GitHub's Ubuntu runners have.
- B) Keep Electron.

**Decision**: A. The local `test:cypress` script is left as it is, so a developer without Chrome can still run it.

### RESOLVED: Bug 10: the fit is off center whenever the graph's center isn't the origin
**Context**: MARK-7 left bug 10 unconfirmed until a MARK-11 test showed it, and `plugin-bugs.md` waits on that test. It is now measured (Technical Notes): the error is half the scaled offset, 200 px for a graph moved by 300, and up to 24 px in the ELA documents. MARK-11 changes no plugin code (R4).
**Options considered**:
- A) Record it, test the fit only on an origin-centered graph, and propose a small bug story (the fix is `-scale * center` in `graph.tsx:803-804`; MARK-12's fit tests compare with transforms read earlier, so they survive it).
- B) Also add the off-center test, skipped (`it.skip`), for the fix story to enable.
- C) Fix it in this story.

**Decision**: A (Doug). R11 tests the fit on an origin-centered drawing. The fix, with an off-center test in `fit.test.ts`, is MARK-21, "Fit to view and Reset misplace graphs in the Markov CODAP plugin"; it changes where students' graphs sit, so Rebecca confirms it before it ships.

### RESOLVED: Low confidence: the page and the tests fit 3 points
**Context**: the story is the page with its commands, the config, CI and docs, and tests for six risk areas plus four generation flows. d3's force layout and the animation timers are where browser tests turn flaky.
**Options considered**:
- A) Keep it as one story.
- B) Split into the page with its config, CI and docs (and R7), then the rendering tests (R8 to R13).

**Decision**: A. Every file in the plan was built and run before the plan was final: about 700 lines of page, commands, tests, config, CI and docs over 11 commits of 18 to 337 lines, plus 3,473 lines of fixture JSON copied unchanged. The suite passed three runs in a row in about 21 s, after the one flake found (a random starting state) was fixed, and each step was replayed on its own with every check green. The risk that justified a split, flaky timing, is measured and handled, so splitting would add a second review cycle without reducing it.

### RESOLVED: Low confidence: the generation and highlight tests run without flakes
**Context**: R10 and R13 depend on the animation's `setInterval` (`app.tsx:281-298`); R12's dataset tests on the force layout, which the plugin runs to completion synchronously (`graph.tsx:558-560`). R16 asks for three clean runs in a row.
**Options considered**:
- A) Shorten the animation with `fastSpeed` and `normalSpeed`, use Step for anything that asserts mid-run, and wait only with Cypress's retrying assertions.
- B) Stub the clock with `cy.clock`.

**Decision**: A. `cy.clock` replaces the timers of Cypress's top-level app window only, not those of the plugin's iframe nested inside the page, and the animation also reads `Date.now()` (`app.tsx:283-290`), so B would stub nothing the plugin uses. Step makes every mid-run state a stable point to assert on; Play and Pause tests use a long `normalSpeed` so a paused output can't have moved on, and Play-to-finish tests a short one.

## Self-Review

Roles: QA engineer, test writer, MARK-12's test writer (the page's first consumer), DevOps engineer, the PR's reviewer (a developer newer to the repo). Each finding was checked against the code before it was written.

### QA Engineer

#### RESOLVED: R9 promised a font floor the code doesn't keep
`calculateNodeFontSize` starts at `0.8 * radius`, a fractional size, and steps down 1 px while the size is above 10, so it stops between 9 and 10 before truncating (`graph-utils.ts:125-140`); `geDiXLf2GyHsWCF2QFnU` draws a label at 9.54 px. R9 now asserts the range the code produces.

---

### Test Writer

#### RESOLVED: nothing type-checks the Cypress code
`tsconfig.json` includes only `src`, so typed custom commands (R5.9) would be typed in name only. A throwaway `cypress/tsconfig.json` with `types: ["cypress"]` type-checks the specs and the page; including `cypress.config.ts` fails on `require` and on `@types/node` 18 (installed through Jest) clashing with TypeScript 6's libs, so it stays out. R2 now requires the check.

---

#### RESOLVED: a quick second click opens the state editor
The graph detects double-clicks itself, within 250 ms of the last click on the same state (`graph.tsx:486-502`). R10 now says the clearing click comes later than that.

---

### MARK-12's Test Writer

#### RESOLVED: a dataset start has to name the page's dataset
MARK-12's cases-change test starts in dataset mode with an attribute; the saved state holds `{datasetName, collectionName, attributeName}`, which must match what `caseFormulaSearch` answers for. R5.4 now has the page build that state.

---

### PR Reviewer

#### RESOLVED: the fixtures' provenance
A reviewer seeing ELA documents in the repo will ask whether they hold student work. They are the module's authored shared files; R6.4 says so.

---

#### RESOLVED: `test:full` runs Cypress with no server
`test:full` runs `jest` then `cypress run`, which needs the dev server already running. R15.2 says so.

### Stage 7: Test Writer (from the implementation review)

#### RESOLVED: the state-editor Save width check could not fail
R8 asked that a Save with no changes leave every width unchanged, citing MARK-20's 3B. Built and run against the dev server, the test passed with 3B's `/ 100` taken out of `applyStatePercentages`: per-state widths depend only on the ratios within a state, so the 100-fold values 3B fixed no longer change any width (MARK-20's R3B.2 says as much). Risk area 1's "after a node-modal Save" was written against the whole-graph scale, where they did. The check is dropped from R8. 3B stays covered where it can fail: MARK-10's `NodeModal` Save test (its R9.1) and MARK-20's `applyStatePercentages` tests, which also catch a percentage applied to the wrong edge.

---

### Stage 7: Commit Reviewer

#### RESOLVED: R16 asked for a passing Cypress run before the template test is gone
The plan's first two steps (configuration, fixtures) leave `workspace.test.ts` in place, and it fails as on every branch so far; removing it any earlier leaves `cypress run` with no spec files, which also fails. R16 now requires the Cypress run from the commit that replaces the template on, and both `tsc` commands at every commit.

---

### Stage 7: PR Reviewer

#### RESOLVED: R2 didn't say what happens to the two config files outside the lint globs
The lint commands cover `src/` and `cypress/` only. `webpack.config.js` (changed by the page's entry) lints clean on its own; `cypress.config.ts` has never been linted and fails today on quotes, semicolons and `require`, before any change here. R2 now says which is which, so the reviewer doesn't take its style as new.

---

### Stage 7: MARK-12's Test Writer

#### RESOLVED: R5.9 promised a list of the commands the spec never gave
R5.9 said the Technical Notes list the page's commands for MARK-12; they didn't. Technical Notes now have the command table, the page's dataset, and the setup of each of MARK-12's tests in these commands, from a sketch of each that passed twice.

---

### Second review: PR Reviewer

#### RESOLVED: R15.1 described coverage's default as an `env` setting
R6.5 moves it to `expose`, and the planned doc says so; R15.1 now matches. The header's duplicated Implementation Spec line and R6.5's place between R6.2 and R6.3 are also fixed.

