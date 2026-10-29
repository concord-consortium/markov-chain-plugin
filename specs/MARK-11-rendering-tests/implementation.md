# Implementation Plan: Rendering Tests for the Markov Plugin's Graph

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-11
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The branch is rebased onto MARK-10's implemented branch before the first commit, so `ci.yml` has MARK-10's `build_test` job and the README MARK-10's Testing sentence; the CI and docs steps below are written against those. Nothing else MARK-10 changes is touched here.

Every file below was built and run in this worktree before this plan was written (Node 24.14, Cypress 16.2, Chrome 152), then removed: the 27 tests passed three full runs in a row in Chrome and one in Electron (about 21 s a run), `tsc -p cypress` and the three lint commands printed nothing for `cypress/`, and the mutations listed under each step each failed a test. The page needs the dev server: every step that runs Cypress does so against `npm start`.

Before the first commit, on the rebased branch: `npm ci`, `npm run build` (no warnings), `npm run lint`, `lint:build`, `lint:style`, `npx tsc --noEmit -p .`, `npm test`, and `sha256sum` of every file in `dist/`, kept for R3. `npm run test:cypress` fails there with the template test's "Hello World", as on every branch so far.

Eleven commits, none touching `src/` (R4) or a package (R1). Steps 1 and 2 leave the template test failing as it does on the base; from step 3 on, `npm run test:cypress` passes at every commit.

---

### Configure Cypress for a plugin in an iframe

**Summary**: R6.1, R6.2, R6.5 and the type check in R2. Cypress stops rewriting iframe-phone's parent check, coverage is really off by default, fixtures are on, and the Cypress Cloud leftovers go. A `cypress/tsconfig.json` lets `tsc` check the Cypress code. No test changes yet.

**Files affected**:
- `cypress.config.ts`: `modifyObstructiveCode: false` with its reason; `expose` in place of `env`; drop `fixturesFolder: false`, `projectId` and the migration comment.
- `package.json`: `test:coverage:cypress:open` passes `--expose coverage=true`.
- `cypress/tsconfig.json`: new.

**Estimated diff size**: 18 lines (+12, -6).

`cypress.config.ts`, in full:

```ts
import { defineConfig } from 'cypress'

export default defineConfig({
  video: false,
  // Cypress rewrites "framebusting" checks such as window.parent === window, which iframe-phone uses
  // to find CODAP, so the plugin would never connect to the fake CODAP page
  modifyObstructiveCode: false,
  defaultCommandTimeout: 8000,
  expose: {
    coverage: false,
  },
  e2e: {
    setupNodeEvents(on, config) {
      return require("@cypress/code-coverage/task")(on, config);
    },
    baseUrl: 'http://localhost:8080',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
})
```

`package.json`:

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -54,7 +54,7 @@
     "test:coverage:watch": "jest --coverage --watchAll",
     "test:cypress": "cypress run",
     "test:cypress:open": "cypress open",
-    "test:coverage:cypress:open": "cypress open --env coverage=true",
+    "test:coverage:cypress:open": "cypress open --expose coverage=true",
     "test:full": "npm-run-all test test:cypress"
   },
   "repository": {
```

`cypress/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["cypress"]
  },
  "include": ["./**/*"]
}
```

It extends the root config for `strict` and the module settings, swaps the types for Cypress's, and covers only `cypress/`. `cypress.config.ts` stays outside it: it uses `require`, and adding Node's types brings in `@types/node` 18 (installed through Jest), which fails against TypeScript 6's libs. Checked: `npx tsc --noEmit -p cypress` passes on the template test alone, and on every later step.

**Commit**: `test: configure Cypress for the plugin in an iframe [MARK-11]`

---

### Add the ELA documents' plugin states as fixtures

**Summary**: R6.4, plus two small drawings the later tests share. Data only.

**Files affected**:
- `cypress/fixtures/ela/<id>.json`: new, five files, each the document's `content.tileMap.WEBV3.content.state`, unchanged, written with two-space indentation. Generated from the oob copies with:

```bash
python3 -I -c "
import json, glob, os
for f in sorted(glob.glob(os.path.expanduser('~/oob/global/streams/markov-chain-fy27/ela-documents/[!s]*.json'))):
    state = json.load(open(f))['content']['tileMap']['WEBV3']['content']['state']
    open('cypress/fixtures/ela/' + os.path.basename(f), 'w').write(json.dumps(state, indent=2, ensure_ascii=False) + '\n')
"
```

  The glob skips `seq.json`, the module's sequence export.
- `cypress/fixtures/chain.json`: new. Four states: `a` to `b` to `c`, and `d` to `a`, so a run from `a` is always `a b c`, and `d` is never on it.
- `cypress/fixtures/cycle.json`: new. `a` and `b` pointing at each other, so a run never stops early.

**Estimated diff size**: 3,473 lines of JSON (+3,473), of which 2,356 are `9nsC6KpuDstv2N9eGndM`'s 129 states and 289 transitions.

`cypress/fixtures/chain.json`:

```json
{
  "viewMode": "drawing",
  "nodes": [
    { "id": "a", "label": "a", "value": 2, "x": -150, "y": 0 },
    { "id": "b", "label": "b", "value": 1, "x": 0, "y": 0 },
    { "id": "c", "label": "c", "value": 1, "x": 150, "y": 0 },
    { "id": "d", "label": "d", "value": 1, "x": -150, "y": 120 }
  ],
  "edges": [
    { "from": "a", "to": "b", "value": 1 },
    { "from": "b", "to": "c", "value": 1 },
    { "from": "d", "to": "a", "value": 1 }
  ],
  "version": 2
}
```

`cypress/fixtures/cycle.json`:

```json
{
  "viewMode": "drawing",
  "nodes": [
    { "id": "a", "label": "a", "value": 1, "x": -100, "y": 0 },
    { "id": "b", "label": "b", "value": 1, "x": 100, "y": 0 }
  ],
  "edges": [
    { "from": "a", "to": "b", "value": 1 },
    { "from": "b", "to": "a", "value": 1 }
  ],
  "version": 2
}
```

**Commit**: `test: add the ELA documents' plugin states as Cypress fixtures [MARK-11]`

---

### Add the fake CODAP page and replace the template test

**Summary**: R5 and R7. The page, its commands, the check that fails a test on an error in the plugin's frame (R5.10), and the loading tests, which replace `workspace.test.ts`. The `clickState` commands land here with the rest of the API, though the first tests to use them come in the next step.

**Files affected**:
- `webpack.config.js`: the page's entry and HTML, development only.
- `cypress/fake-codap/index.html`, `cypress/fake-codap/fake-codap.ts`: new.
- `cypress/support/index.d.ts`, `cypress/support/commands.ts`: new.
- `cypress/support/e2e.js`: import the commands; the error check.
- `cypress/e2e/workspace.test.ts`: deleted.
- `cypress/e2e/loading.test.ts`: new.

**Estimated diff size**: 347 lines (+328, -19).

`webpack.config.js`:

```diff
diff --git a/webpack.config.js b/webpack.config.js
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -31,11 +31,17 @@ module.exports = (env, argv) => {
       allowedHosts: 'all',
     },
     devtool: devMode ? 'eval-cheap-module-source-map' : 'source-map',
-    entry: './src/index.tsx',
+    // the Cypress tests' fake CODAP page is served by the dev server only, never deployed
+    entry: devMode
+      ? { main: './src/index.tsx', 'fake-codap': './cypress/fake-codap/fake-codap.ts' }
+      : './src/index.tsx',
     mode: 'development',
     output: {
       path: path.resolve(__dirname, 'dist'),
-      filename: 'assets/index.[contenthash].js',
+      // the plugin's chunk is main, which names its CSS file, and its script is index.[contenthash].js
+      filename: ({ chunk }) => (chunk.name === 'main'
+        ? 'assets/index.[contenthash].js'
+        : 'assets/[name].[contenthash].js'),
     },
     performance: { hints: false },
     module: {
@@ -144,7 +150,14 @@ module.exports = (env, argv) => {
         template: 'src/index.html',
         favicon: 'src/public/favicon.ico',
         publicPath: '.',
+        excludeChunks: ['fake-codap'],
       }),
+      ...(devMode ? [new HtmlWebpackPlugin({
+        filename: 'fake-codap.html',
+        template: 'cypress/fake-codap/index.html',
+        chunks: ['fake-codap'],
+        publicPath: '.',
+      })] : []),
       ...(DEPLOY_PATH ? [new HtmlWebpackPlugin({
         filename: 'index-top.html',
         template: 'src/index.html',
```

The plugin's chunk stays `main`, because the CSS file is named after it (`assets/main.[contenthash].css`), and its script keeps `assets/index.[contenthash].js`, so a production build is byte-identical to the base's apart from the JS source map's `file` field, which step 1's `package.json` edit changes (R3; checked for `npm run build` and for a `DEPLOY_PATH=branch/x/` build, `index-top.html` included). `excludeChunks` keeps the page's script out of the plugin's `index.html` in development. The page's HTML template has no favicon, so it doesn't copy one.

`cypress/fake-codap/index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Fake CODAP</title>
    <style>
      body { margin: 0; }
      iframe { border: 0; display: block; }
    </style>
  </head>
  <body></body>
</html>
```

`cypress/fake-codap/fake-codap.ts`:

```ts
// A stand-in for CODAP that the Cypress tests load the plugin into. It answers the plugin's requests with
// replies shaped like CODAP 3.1.2's and sends the notifications CODAP sends, through the same iframe-phone
// protocol CODAP uses. The development server serves it as fake-codap.html; production builds leave it out.
import { IframePhoneRpcEndpoint, ParentEndpoint } from "iframe-phone";

export type CodapRequest = { action: string, resource: string, values?: any };

export type FakeDataset = { name: string, collection: string, attributes: Record<string, unknown[]> };

export type StartOptions = {
  savedState?: unknown;
  dataset?: FakeDataset;
  holdInit?: boolean;
  width?: number;
  height?: number;
  query?: string;
};

export type CasesOperation = "createCases" | "updateCases" | "deleteCases";

const outputDatasetName = "Sequence Data";

const defaultDataset = (): FakeDataset => ({
  name: "Words",
  collection: "Cases",
  attributes: {
    Word: ["the", "cat", "sat", "on", "the", "mat"],
    Letter: ["a", "b", "a", "c"]
  }
});

let options: StartOptions = {};
let dataset = defaultDataset();
let iframe: HTMLIFrameElement | undefined;
let rpc: IframePhoneRpcEndpoint | undefined;
let heldInit: (() => void) | undefined;
const requests: CodapRequest[] = [];
const errors: string[] = [];
const items: Record<string, unknown>[] = [];

const caseFormulaSearchReply = () => {
  const caseCount = Math.max(0, ...Object.values(dataset.attributes).map(values => values.length));
  const cases = [];
  for (let i = 0; i < caseCount; i++) {
    const values: Record<string, unknown> = {};
    Object.entries(dataset.attributes).forEach(([name, attributeValues]) => { values[name] = attributeValues[i]; });
    cases.push({ id: i + 1, values });
  }
  return { success: true, values: cases };
};

const reply = (request: CodapRequest) => {
  const { action, resource, values } = request;

  if (resource === "interactiveFrame") {
    return action === "get" ? { success: true, values: { savedState: options.savedState } } : { success: true };
  }
  const casesResource = `dataContext[${dataset.name}].collection[${dataset.collection}].caseFormulaSearch[true]`;
  if (action === "get" && resource === casesResource) {
    return caseFormulaSearchReply();
  }
  if (action === "get" && resource === "dataContextList") {
    const list = [{ name: dataset.name, title: dataset.name, id: 1, guid: 1 }];
    if (items.length > 0) {
      list.push({ name: outputDatasetName, title: "Output Sequences", id: 2, guid: 2 });
    }
    return { success: true, values: list };
  }
  if (action === "create" && resource === "dataContext") {
    return { success: true, values: { id: 2, name: values?.name, title: values?.title } };
  }
  if (action === "get" && resource === "componentList") {
    return { success: true, values: [] };
  }
  if (action === "create" && resource === "component") {
    return { success: true, values: { id: 3, title: values?.title, type: values?.type } };
  }
  if (action === "create" && resource === `dataContext[${outputDatasetName}].item`) {
    items.push(...values);
    return { success: true, values: { caseIDs: [], itemIDs: [] } };
  }
  if (action === "get" && resource === `dataContext[${outputDatasetName}].itemSearch[*]`) {
    return items.length > 0
      ? { success: true, values: items.map((item, i) => ({ id: i + 1, values: item })) }
      : { success: false, values: { error: "DataContext not found" } };
  }
  return { success: false, values: { error: `fake CODAP does not handle ${action} ${resource}` } };
};

const handleRequest = (request: CodapRequest | CodapRequest[], callback: (response: unknown) => void) => {
  requests.push(...(Array.isArray(request) ? request : [request]));
  const respond = () => callback(Array.isArray(request) ? request.map(reply) : reply(request));
  // the plugin's init asks for interactiveFrame, and the plugin shows "Loading ..." until it gets the reply
  const isInit = Array.isArray(request) && request.some(r => r.action === "get" && r.resource === "interactiveFrame");
  if (isInit && options.holdInit) {
    heldInit = respond;
  } else {
    respond();
  }
};

const call = (request: CodapRequest) =>
  new Promise<any>(resolve => rpc?.call(request as any, response => resolve(response)));

const start = (startOptions: StartOptions = {}) => {
  rpc?.disconnect();
  iframe?.remove();
  options = startOptions;
  dataset = startOptions.dataset ?? dataset;
  heldInit = undefined;
  requests.length = 0;

  iframe = document.createElement("iframe");
  iframe.id = "plugin";
  iframe.width = String(startOptions.width ?? 600);
  iframe.height = String(startOptions.height ?? 420);
  iframe.src = `index.html${startOptions.query ? `?${startOptions.query}` : ""}`;
  // Cypress fails a test only on errors in its own window, so errors in the plugin's frame are kept for the tests
  iframe.addEventListener("load", () => {
    const pluginWindow = iframe?.contentWindow;
    pluginWindow?.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
    pluginWindow?.addEventListener("unhandledrejection", event => errors.push(String(event.reason)));
  });
  document.body.appendChild(iframe);

  const origin = window.location.origin;
  rpc = new IframePhoneRpcEndpoint(handleRequest as any, "data-interactive", iframe, origin,
    new ParentEndpoint(iframe, origin));
};

const fakeCodap = {
  requests,
  errors,
  items,
  start,
  restart: (savedState: unknown) => start({ ...options, savedState, holdInit: false }),
  releaseInit: () => heldInit?.(),
  dataset: () => dataset,
  setAttributeValues: (name: string, values: unknown[]) => { dataset.attributes[name] = values; },
  renameAttribute: (from: string, to: string) => {
    dataset.attributes[to] = dataset.attributes[from];
    delete dataset.attributes[from];
  },
  dropAttribute: async (name: string) => {
    const drop = { context: { name: dataset.name }, collection: { name: dataset.collection }, attribute: { name } };
    for (const operation of ["dragstart", "drop", "dragend"]) {
      await call({ action: "notify", resource: "dragDrop[attribute]", values: { operation, ...drop } });
    }
  },
  notifyCases: (operation: CasesOperation) =>
    call({ action: "notify", resource: `dataContextChangeNotice[${dataset.name}]`, values: { operation } }),
  getInteractiveState: () => call({ action: "get", resource: "interactiveState" }),
  resize: (width: number, height: number) => {
    iframe?.setAttribute("width", String(width));
    iframe?.setAttribute("height", String(height));
  }
};

export type FakeCodap = typeof fakeCodap;

(window as any).fakeCodap = fakeCodap;
```

How it maps to R5:

- **Protocol (R5.1):** `ParentEndpoint` answers the plugin's `hello` and `IframePhoneRpcEndpoint` handles the `data-interactive` channel, as CODAP does. Replies to the page's own `call`s come back through the same endpoint.
- **Replies (R5.2):** each shape follows `mark-5-results.md` and MARK-20's Technical Notes ("Reply shapes"): `interactiveFrame`'s `savedState` in the second reply of `init`'s batch, `dataContextList` entries with `name`, `title`, `id` and `guid` and no `type`, `componentList` empty (the plugin always sends `create component` anyway, RM3.2), `itemSearch[*]` failing with "DataContext not found" until an item exists. Anything else fails, with the request named in the error, so a test that hits it sees why.
- **Start options (R5.3, R5.8):** `savedState` of any shape or none, `holdInit`, the frame's size, and `query` for `fastSpeed` and `normalSpeed`. `restart` keeps the options and the items already sent, as reopening a document keeps its output table, and keeps the errors already recorded, so an error before a restart still fails the test (each `cy.startPlugin` loads a fresh page, which starts with none).
- **Dataset (R5.4):** `Words` with a `Cases` collection and two attributes, `Word` (`the cat sat on the mat`, 5 distinct values) and `Letter`. `caseFormulaSearch[true]` builds the cases from the current values, so `setAttributeValues` or `renameAttribute` followed by a notification is how a test changes the data. Cases are rows across all attributes, as in CODAP: an attribute shorter than the longest has `undefined` in the remaining cases, which the plugin reads as a chain break.
- **Notifications (R5.5):** a drop is the `dragstart`, `drop`, `dragend` sequence MARK-5 saw from CODAP 3.1.2 (it also saw `dragenter` and `drag`, which the plugin ignores, `use-codap.ts:105-125`). Case changes go to `dataContextChangeNotice[Words]`; the plugin subscribes to them on any resource by `operation` (`use-codap.ts:143-146`).
- **Errors:** errors and unhandled rejections in the plugin's window are kept in `errors`. Cypress fails a test on an uncaught error only in its own windows, and the plugin's frame is nested inside the page, so without this a test could pass while the plugin threw. It listens from the frame's `load` event, so an error thrown while the plugin's script first runs is not caught; such an error leaves the plugin unrendered, which every test notices.

`cypress/support/index.d.ts`:

```ts
import type { CasesOperation, FakeCodap, StartOptions } from "../fake-codap/fake-codap";

export type StartPluginOptions = StartOptions & {
  // start in dataset mode with this attribute of the page's dataset dropped
  attribute?: string;
};

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Opens the fake CODAP page and starts the plugin in it with these options: saved state, dataset,
       * attribute, held init, frame size and URL query.
       */
      startPlugin(options?: StartPluginOptions): Chainable<void>;
      /** Yields the plugin's document body, to find elements in the plugin. */
      plugin(): Chainable<JQuery<HTMLElement>>;
      /** Yields the fake CODAP page's API, including the requests and output items it has received. */
      fakeCodap(): Chainable<FakeCodap>;
      /** Sends the interactiveFrame reply that startPlugin({holdInit: true}) held back. */
      releaseInit(): Chainable<void>;
      /** Replaces an attribute's values in the page's dataset; send a cases notification to tell the plugin. */
      setAttributeValues(name: string, values: unknown[]): Chainable<void>;
      /** Renames an attribute in the page's dataset, keeping its values. */
      renameAttribute(from: string, to: string): Chainable<void>;
      /** Drags an attribute of the page's dataset onto the plugin, and waits for the plugin's replies. */
      dropAttribute(name: string): Chainable<void>;
      /** Sends a dataContextChangeNotice for the page's dataset, and waits for the plugin's reply. */
      notifyCases(operation: CasesOperation): Chainable<void>;
      /** Asks the plugin for its state, as CODAP does when it saves a document, and yields the state. */
      getPluginState(): Chainable<any>;
      /** Starts the plugin again, with the same options and this saved state, as CODAP does when a document opens. */
      restartPlugin(savedState: unknown): Chainable<void>;
      /** Clicks the state with this label. */
      clickState(label: string): Chainable<void>;
      /** Clicks the state with this label twice, which the plugin reads as a double-click. */
      doubleClickState(label: string): Chainable<void>;
      /** Resizes the plugin's iframe. */
      resizePlugin(width: number, height: number): Chainable<void>;
    }
  }
}
```

`@typescript-eslint/no-namespace` allows the `namespace Cypress` declaration only in a `.d.ts` file. The types live here, and `commands.ts` imports `StartPluginOptions` from it.

`cypress/support/commands.ts`:

```ts
import type { FakeCodap } from "../fake-codap/fake-codap";
import type { StartPluginOptions } from "./index";

Cypress.Commands.add("fakeCodap", () => cy.window().its("fakeCodap") as Cypress.Chainable<FakeCodap>);

Cypress.Commands.add("startPlugin", ({ attribute, ...options }: StartPluginOptions = {}) => {
  cy.visit("/fake-codap.html");
  cy.fakeCodap().then(fake => {
    const dataset = options.dataset ?? fake.dataset();
    const savedState = attribute
      ? {
        attribute: { datasetName: dataset.name, collectionName: dataset.collection, attributeName: attribute },
        viewMode: "dataset"
      }
      : options.savedState;
    fake.start({ ...options, savedState });
  });
});

Cypress.Commands.add("plugin", () =>
  cy.get("iframe#plugin").its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body)));

// commands that wait on the plugin return the page's promise from then(), which Cypress waits for
Cypress.Commands.add("releaseInit", () => { cy.fakeCodap().then(fake => fake.releaseInit()); });
Cypress.Commands.add("setAttributeValues", (name: string, values: unknown[]) => {
  cy.fakeCodap().then(fake => fake.setAttributeValues(name, values));
});
Cypress.Commands.add("renameAttribute", (from: string, to: string) => {
  cy.fakeCodap().then(fake => fake.renameAttribute(from, to));
});
Cypress.Commands.add("dropAttribute", (name: string) => { cy.fakeCodap().then(fake => fake.dropAttribute(name)); });
Cypress.Commands.add("notifyCases", operation => { cy.fakeCodap().then(fake => fake.notifyCases(operation)); });
Cypress.Commands.add("getPluginState", () =>
  cy.fakeCodap().then(fake => fake.getInteractiveState()).then(response => response.values));
Cypress.Commands.add("restartPlugin", (savedState: unknown) => {
  cy.fakeCodap().then(fake => fake.restart(savedState));
});
Cypress.Commands.add("resizePlugin", (width: number, height: number) => {
  cy.fakeCodap().then(fake => fake.resize(width, height));
});

// the graph reads two clicks on a state within 250 ms as a double-click (graph.tsx)
const doubleClickTime = 250;

const triggerStateClick = (label: string) => {
  // a click event alone: Cypress's mousedown and mouseup also start d3's drag handling, which throws in this frame
  cy.plugin().find("g.node").filter((i, node) => node.textContent === label).find("ellipse").trigger("click");
};

Cypress.Commands.add("clickState", (label: string) => {
  cy.wait(doubleClickTime + 10);
  triggerStateClick(label);
});
Cypress.Commands.add("doubleClickState", (label: string) => {
  cy.wait(doubleClickTime + 10);
  triggerStateClick(label);
  triggerStateClick(label);
});
```

- `cy.plugin()` yields the frame's body, so a test writes `cy.plugin().find(...)`; Cypress retries the `find` until the plugin draws. It finds the frame by its id because the dev server's error overlay, when it shows, is another iframe on the page.
- Commands that call the page go through `then`, which waits for a returned promise; `invoke` does not, and yields the pending promise (measured, R5.9).
- `clickState` sends only a `click` event to the state's ellipse. Cypress's `click` also sends `mousedown` and `mouseup`, which start d3-drag's gesture handling on the state; in this nested frame that threw `TypeError: gestures.mouse is not a function` from d3-drag's `mouseupped` and `mousemoved` (measured with `.click()` and `.dblclick()` on states; the events' `view` was the plugin's window, so the cause is not that). The plugin's click handler is all a selection or a double-click needs (`graph.tsx:486-503`). Dragging is not tested.
- `clickState` waits out the plugin's 250 ms double-click window before clicking, so two separate clicks are never read as a double-click; `doubleClickState` clicks twice inside it.

`cypress/support/e2e.js`:

```diff
diff --git a/cypress/support/e2e.js b/cypress/support/e2e.js
--- a/cypress/support/e2e.js
+++ b/cypress/support/e2e.js
@@ -13,11 +13,15 @@
 // https://on.cypress.io/configuration
 // ***********************************************************
 
-// Import commands.js using ES2015 syntax:
-// import "./commands";
-
-// Alternatively you can use CommonJS syntax:
-// require('./commands')
-
 // add code coverage support
 import "@cypress/code-coverage/support";
+import "./commands";
+
+// errors thrown in the plugin's frame don't reach Cypress, so each test checks the ones the fake CODAP page kept
+afterEach(() => {
+  cy.window().then(win => {
+    if (win.fakeCodap) {
+      expect(win.fakeCodap.errors, "errors in the plugin").to.deep.equal([]);
+    }
+  });
+});
```

The check uses `deep.equal([])` because `expect(...).to.be.empty` is an expression statement that `@typescript-eslint/no-unused-expressions` rejects. Checked: a test that makes the plugin's window throw, or reject a promise, fails in this hook with the error's message.

`cypress/e2e/loading.test.ts`:

```ts
const elaDocuments = [
  "4gqlICXB3YqN3AfivyZZ",
  "9nsC6KpuDstv2N9eGndM",
  "geDiXLf2GyHsWCF2QFnU",
  "lr1YsZHAZ1KYXxk67jD2",
  "pnRUlM27cXXrJrofZAXx"
];

describe("Loading", () => {
  it("shows Loading until CODAP answers interactiveFrame", () => {
    cy.startPlugin({ holdInit: true });
    cy.plugin().contains("Loading ...");
    cy.fakeCodap().its("requests").should("have.length.at.least", 2);
    cy.plugin().contains("Loading ...");
    cy.releaseInit();
    cy.plugin().contains("Select Mode");
  });

  elaDocuments.forEach(id => {
    it(`draws every state and transition of ELA document ${id}`, () => {
      cy.fixture(`ela/${id}.json`).then(state => {
        const transitions = state.edges.filter((e: any) => e.from !== e.to);
        cy.startPlugin({ savedState: state });
        cy.plugin().find("button[title='Add State']").should("exist");
        cy.plugin().find("g.node").should("have.length", state.nodes.length);
        cy.plugin().find("line.edge").should("have.length", transitions.length);
      });
    });
  });
});
```

The first test waits for the page to have received the `init` batch before checking "Loading ..." a second time, so it sees the plugin waiting on the reply rather than not yet started. Each ELA test counts the non-loop transitions (none of the five has a loop).

**Commit**: `test: add a fake CODAP page and test loading the plugin [MARK-11]`

---

### Test arrow widths and arrowheads

**Summary**: R8 (risk area 1).

**Files affected**:
- `cypress/support/graph.ts`: new, the expected width.
- `cypress/e2e/arrows.test.ts`: new.

**Estimated diff size**: 73 lines (+73).

`cypress/support/graph.ts`:

```ts
type Edge = { from: string, to: string, value: number };

// the plugin's widths (graph-utils.ts): 2 px plus 2.5 px times the edge's share of its state's outgoing values
export const stateWidths = (edges: Edge[]) => {
  const totals = new Map<string, number>();
  edges.forEach(edge => totals.set(edge.from, (totals.get(edge.from) ?? 0) + edge.value));
  return (edge: Edge) => 2 + 2.5 * edge.value / totals.get(edge.from)!;
};
```

The test restates the rule rather than importing `stateEdgeWeights` from `graph-utils.ts`, so a change to the plugin's rule fails the test instead of moving with it.

`cypress/e2e/arrows.test.ts`:

```ts
import { stateWidths } from "../support/graph";

const markerIds = [
  "arrow", "loopArrow", "animatedArrow", "incomingArrow", "outgoingArrow",
  "selectedLoopArrow", "unselectedArrow", "unselectedLoopArrow"
];

const expectHeadsOnlyOnVisibleLines = () => {
  cy.plugin().find("line.edge:not([marker-end])").should("not.exist");
  cy.plugin().find("path.loop:not([marker-end])").should("not.exist");
  cy.plugin().find("line.edge-background[marker-end]").should("not.exist");
  cy.plugin().find("path.loop-background[marker-end]").should("not.exist");
};

describe("Arrows", () => {
  it("draws each transition's width as its share of its state's outgoing transitions", () => {
    cy.fixture("ela/9nsC6KpuDstv2N9eGndM.json").then(state => {
      const width = stateWidths(state.edges);
      cy.startPlugin({ savedState: state });
      cy.plugin().find("line.edge").should("have.length", state.edges.length).each(line => {
        // d3 keeps each line's edge as its bound data
        const { source, target } = (line[0] as any).__data__;
        const edge = state.edges.find((e: any) => e.from === source.id && e.to === target.id);
        expect(Number(line.attr("stroke-width"))).to.be.closeTo(width(edge), 1e-9);
      });
    });
  });

  it("counts a loop as one of its state's outgoing transitions", () => {
    cy.fixture("chain.json").then(state => {
      cy.startPlugin({ savedState: state });
      cy.plugin().find("button[title='Add Transition']").click();
      cy.doubleClickState("a");
      cy.plugin().find("path.loop").should("have.length", 1).and("have.attr", "stroke-width", "3.25");
      cy.plugin().find("line.edge").filter((i, line) => (line as any).__data__.source.id === "a")
        .should("have.attr", "stroke-width", "3.25");
    });
  });

  it("scales every arrowhead with its line and puts none on the click targets", () => {
    cy.fixture("chain.json").then(state => {
      cy.startPlugin({ savedState: state });
      cy.plugin().find("marker").should("have.length", markerIds.length).each(marker => {
        expect(markerIds).to.include(marker.attr("id"));
        expect(marker.attr("markerUnits")).to.equal("strokeWidth");
      });
      cy.plugin().find("button[title='Add Transition']").click();
      cy.doubleClickState("b");
      cy.plugin().find("path.loop").should("have.length", 1);
      expectHeadsOnlyOnVisibleLines();

      cy.plugin().find("button[title='Select']").click();
      cy.clickState("b");
      cy.plugin().find("line.edge[marker-end='url(#incomingArrow)']").should("exist");
      expectHeadsOnlyOnVisibleLines();

      cy.clickState("b");
      cy.plugin().find("select").first().select("a");
      cy.plugin().contains("button", "Step").click();
      cy.plugin().contains("button", "Step").click();
      cy.plugin().find("[marker-end='url(#animatedArrow)']").should("exist");
      expectHeadsOnlyOnVisibleLines();
    });
  });
});
```

- Each line is paired with its edge through d3's bound data (`__data__`, d3's documented storage for a selection's data), so a width on the wrong line fails, not just a wrong multiset of widths.
- The loop test adds a loop to `a`, which already has one transition, so both draw at 3.25 (half of `a`'s outgoing total each); without the loop counted, `a`'s line would be 4.5.
- The arrowhead test checks the heads on first draw, with a loop, with a state selected (the selection restyles every `line.edge`), and mid-animation (the animation effect restyles them again), the three places MARK-20's R3C.4 changed. It selects `a` as the starting state, so the second Step always has a transition to draw: with "(any)", a run that starts at `c` ends at once (seen once in nine runs before the fix).

Mutations, each run against the dev server and reverted: `maxStroke` 7 fails the width tests; `markerUnits` `userSpaceOnUse` fails the arrowhead test; the selected-state highlight selecting every `line` again (MARK-20's R3C.4) fails it.

**Commit**: `test: test arrow widths and arrowheads in the browser [MARK-11]`

---

### Test state labels

**Summary**: R9 (risk area 2).

**Files affected**:
- `cypress/e2e/labels.test.ts`: new.

**Estimated diff size**: 32 lines (+32).

```ts
describe("Labels", () => {
  it("truncates a long label only once its font is down to the minimum", () => {
    cy.fixture("ela/9nsC6KpuDstv2N9eGndM.json").then(state => {
      cy.startPlugin({ savedState: state });
      cy.plugin().find("g.node text").should("have.length", state.nodes.length).then(texts => {
        const truncated = texts.toArray().filter(text => text.textContent!.endsWith("..."));
        expect(truncated.map(text => text.textContent)).to.include("appreci...");
        truncated.forEach(text => {
          expect(Number(text.getAttribute("font-size"))).to.be.within(9.0001, 10);
        });
      });
    });
  });

  it("draws an HTML-like value as text, and numbers as their digits", () => {
    const html = "<img src=x onerror=\"window.parent.labelScriptRan = true\">";
    cy.startPlugin({
      attribute: "Word",
      dataset: { name: "Words", collection: "Cases", attributes: { Word: [html, 10, "b", 2, html] } }
    });
    cy.plugin().find("g.node text").should("have.length", 4);
    cy.plugin().find("img").should("not.exist");
    cy.plugin().find("g.node text").first().invoke("text").should(text => {
      expect(text.endsWith("...")).to.equal(true);
      expect(html.startsWith(text.slice(0, -3))).to.equal(true);
    });
    cy.window().its("labelScriptRan").should("be.undefined");
    cy.plugin().find("select").first().find("option").then(options => {
      expect(options.toArray().map(o => o.textContent)).to.deep.equal(["(any)", html, "2", "10", "b"]);
    });
  });
});
```

- The truncation test reads the sizes the plugin drew; `9nsC6KpuDstv2N9eGndM` truncates six labels, "appreciation" among them.
- The HTML value is long enough to be truncated too, so the test checks the drawn text is a prefix of it plus "...". Its `onerror` would set a flag on the page's window if it ever ran.
- The Starting State list holds the labels as `compareStateLabels` sorts them: `<` before digits, `2` before `10`, then letters.

Mutations: `innerHTML` in place of `textContent` in `calculateNodeFontSize` (MARK-20's bug 9) fails the HTML test (the `<img>` is created and its handler runs); the comparator comparing `a` with itself (bug 4) fails the list order.

**Commit**: `test: test how state labels are drawn [MARK-11]`

---

### Test highlighting

**Summary**: R10 (risk area 3).

**Files affected**:
- `cypress/e2e/highlighting.test.ts`: new.

**Estimated diff size**: 80 lines (+80).

```ts
// colors from graph.tsx
const selectedNodeColor = "#14f49e3f";
const incomingArrowColor = "#0081ff";
const outgoingArrowColor = "#ff9900";
const animatedNodeColor = "#FF00877f";
const animatedArrowColor = "#FF0087";
const faded = "[style*='opacity: 0.35']";

const edge = (from: string, to: string) =>
  cy.plugin().find("line.edge").filter((i, line) => {
    const { source, target } = (line as any).__data__;
    return source.id === from && target.id === to;
  });
const ellipse = (label: string) =>
  cy.plugin().find("g.node").filter((i, node) => node.textContent === label).find("ellipse");

describe("Highlighting", () => {
  beforeEach(() => {
    cy.fixture("chain.json").then(state => cy.startPlugin({ savedState: state }));
    cy.plugin().find("g.node").should("have.length", 4);
  });

  it("colors a selected state's transitions and fades the rest", () => {
    cy.clickState("b");
    ellipse("b").should("have.attr", "fill", selectedNodeColor);
    edge("a", "b").should("have.attr", "stroke", incomingArrowColor)
      .and("have.attr", "marker-end", "url(#incomingArrow)");
    edge("b", "c").should("have.attr", "stroke", outgoingArrowColor)
      .and("have.attr", "marker-end", "url(#outgoingArrow)");
    ellipse("d").should("match", faded);
    edge("d", "a").should("match", faded);
    cy.plugin().find("g.node text").filter((i, text) => text.textContent === "d").should("match", faded);

    cy.clickState("b");
    ellipse("b").should("have.attr", "fill", "#fff");
    cy.plugin().find(`line.edge[stroke='${incomingArrowColor}'], line.edge[stroke='${outgoingArrowColor}']`)
      .should("not.exist");
    cy.plugin().find(`g.node ellipse${faded}, line.edge${faded}`).should("not.exist");
  });

  it("follows each step of a sequence", () => {
    cy.plugin().find("select").first().select("a");
    cy.plugin().contains("button", "Step").click();
    ellipse("a").should("have.attr", "fill", animatedNodeColor);
    edge("a", "b").should("have.attr", "stroke", animatedArrowColor).and("have.attr", "stroke-dasharray", "4");

    cy.plugin().contains("button", "Step").click();
    edge("a", "b").should("have.attr", "stroke", animatedArrowColor)
      .and("have.attr", "stroke-dasharray", "")
      .and("have.attr", "marker-end", "url(#animatedArrow)");
    ellipse("b").should("have.attr", "fill", animatedNodeColor);
    ellipse("a").should("have.attr", "fill", "#fff");

    cy.plugin().contains("button", "Step").click();
    cy.plugin().contains("button", "Step").click();
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a b c");
    cy.plugin().find(`g.node ellipse[fill='${animatedNodeColor}']`).should("not.exist");
    cy.plugin().find(`line.edge[stroke='${animatedArrowColor}']`).should("not.exist");
  });

  it("highlights a selected output's path", () => {
    cy.plugin().find("select").first().select("a");
    for (let i = 0; i < 5; i++) {
      cy.plugin().contains("button", "Step").click();
    }
    cy.plugin().find(".sequence").should("have.text", "a b c").click();
    cy.plugin().find(".sequence.highlighted").should("exist");
    ["a", "b", "c"].forEach(label => ellipse(label).should("have.attr", "fill", animatedNodeColor));
    edge("a", "b").should("have.attr", "stroke", animatedArrowColor);
    edge("b", "c").should("have.attr", "stroke", animatedArrowColor);
    ellipse("d").should("match", faded);
    edge("d", "a").should("match", faded);

    cy.plugin().find(".sequence").click();
    cy.plugin().find(".sequence.highlighted").should("not.exist");
    cy.plugin().find(`g.node ellipse[fill='${animatedNodeColor}']`).should("not.exist");
    cy.plugin().find(`g.node ellipse${faded}`).should("not.exist");
  });
});
```

- The colors are restated from `graph.tsx:16-24`; the faded check matches the inline `opacity: 0.35` d3 sets.
- With `a` as the starting state, `chain.json`'s run is `a b c` on every draw, five Step presses from start to finish (`app.tsx:357-368`): `a` with its exits dashed, then `a`-to-`b` solid with `b` filled, then `b` with its exits dashed, then `b`-to-`c` with `c` filled, then the output.
- `d` and its transition are off every path, so they show what fades.

Mutation: the incoming transitions drawn in the outgoing color fails the selection test.

**Commit**: `test: test selection, animation and output highlighting [MARK-11]`

---

### Test fit and recenter

**Summary**: R11 (risk area 4), on a nearly origin-centered drawing (bug 10 is MARK-21's: requirements, Open Questions). `geDiXLf2GyHsWCF2QFnU`'s bounding box is centered at (14, 14), so bug 10 moves its fit about 3 px; no test asserts the centering, so the tests hold with MARK-21's fix.

**Files affected**:
- `cypress/e2e/fit.test.ts`: new.

**Estimated diff size**: 38 lines (+38).

```ts
const rootTransform = () => cy.plugin().find(".graph > svg g.root").invoke("attr", "transform");

describe("Fit and recenter", () => {
  beforeEach(() => {
    cy.fixture("ela/geDiXLf2GyHsWCF2QFnU.json").then(state => cy.startPlugin({ savedState: state }));
    rootTransform().should("match", /scale/);
  });

  it("fits a loaded drawing inside the view", () => {
    cy.plugin().find(".graph > svg").then(svg => {
      const view = svg[0].getBoundingClientRect();
      const graph = svg[0].querySelector("g.root")!.getBoundingClientRect();
      expect(graph.left).to.be.at.least(view.left);
      expect(graph.right).to.be.at.most(view.right);
      expect(graph.top).to.be.at.least(view.top);
      expect(graph.bottom).to.be.at.most(view.bottom);
    });
  });

  it("returns to the fitted view after zooming in", () => {
    rootTransform().then(fitted => {
      cy.plugin().find(".plusButton").click();
      cy.plugin().find(".plusButton").click();
      rootTransform().should("not.equal", fitted);
      cy.plugin().find("button[title='Fit View']").click();
      rootTransform().should("equal", fitted);
    });
  });

  it("keeps the zoom when recentering", () => {
    cy.plugin().find(".plusButton").click();
    rootTransform().then(zoomed => {
      const scale = /scale\(([^)]+)\)/.exec(zoomed!)![1];
      cy.plugin().find("button[title='Recenter View']").click();
      rootTransform().should("contain", `scale(${scale})`);
    });
  });
});
```

`.graph > svg` is the graph's SVG; the toolbar's icons are SVGs too. A drawing has no force layout, so its fit is the same every time and the Fit View result can be compared with the load's exactly. Mutations: deleting the `svg.call(zoomRef.current.transform, transform)` in `fitOrCenter` fails the suite at its first check, that the loaded drawing has a fitted transform; a fit scale of `* 2` in place of `* 0.8` fails the inside-the-view test.

**Commit**: `test: test fit and recenter [MARK-11]`

---

### Test the dataset and drawing flows

**Summary**: R12 (risk area 5).

**Files affected**:
- `cypress/e2e/modes.test.ts`: new.

**Estimated diff size**: 65 lines (+65).

```ts
const labels = () => cy.plugin().find("g.node text").then(texts => texts.toArray().map(text => text.textContent));

describe("Dataset mode", () => {
  beforeEach(() => {
    cy.startPlugin();
    cy.plugin().contains("button", "Dataset").click();
    cy.plugin().contains("first drag an attribute");
    cy.dropAttribute("Word");
    cy.plugin().find("g.node").should("have.length", 5);
  });

  it("builds the graph from a dropped attribute and rebuilds it when cases change", () => {
    labels().should("have.members", ["the", "cat", "sat", "on", "mat"]);
    cy.setAttributeValues("Word", ["dog", "ran", "dog"]);
    cy.notifyCases("createCases");
    cy.plugin().find("g.node").should("have.length", 2);
    labels().should("have.members", ["dog", "ran"]);
  });

  it("rebuilds the graph on Reset", () => {
    cy.plugin().find("button[title='Reset']").click();
    cy.plugin().contains("button", "Ok").click();
    cy.plugin().find("g.node").should("have.length", 5);
  });

  it("keeps running when the dropped attribute is renamed", () => {
    cy.renameAttribute("Word", "Words");
    cy.notifyCases("updateCases");
    cy.plugin().contains("first drag an attribute");
    cy.plugin().find("g.node").should("not.exist");
  });
});

describe("Drawing mode", () => {
  beforeEach(() => {
    cy.startPlugin();
    cy.plugin().contains("button", "Drawing").click();
    cy.plugin().find("button[title='Create From Text']").click();
    cy.plugin().find("textarea").type("the cat sat on the mat");
    cy.plugin().find("g.node").should("have.length", 5);
  });

  it("builds a state for each distinct word typed", () => {
    labels().should("have.members", ["the", "cat", "sat", "on", "mat"]);
  });

  it("draws the same graph after saving and reopening", () => {
    cy.getPluginState().then(state => {
      expect(state.nodes).to.have.length(5);
      cy.restartPlugin(state);
      cy.plugin().find("g.node").should("have.length", 5).each(node => {
        const saved = state.nodes.find((n: any) => n.label === node.text());
        expect(Number(node.find("ellipse").attr("cx"))).to.be.closeTo(saved.x, 1e-6);
        expect(Number(node.find("ellipse").attr("cy"))).to.be.closeTo(saved.y, 1e-6);
      });
      cy.plugin().find("line.edge").should("have.length", state.edges.length);
    });
  });

  it("goes back to the mode menu", () => {
    cy.plugin().find("button[title='Back to Main']").click();
    cy.plugin().contains("button", "Ok").click();
    cy.plugin().contains("Select Mode");
  });
});
```

- Renaming the attribute leaves every case without a `Word` value, the case MARK-7's bug 2 describes; the plugin reads them all as chain breaks, empties the graph and shows its drop screen. The error check fails the test if anything throws.
- Save and reload builds the drawing from text, whose positions come from the force layout, so the reopened positions are real data rather than a fixture's.

Mutations: Reset's dataset branch returning nothing (bug 8) fails the Reset test; `App` translating version-2 drawings too (`version < 3` in place of `version < 2`, `app.tsx:128`) fails save and reopen, each state 185 px off its saved `x` (MARK-10's R10.2 leaves this check to this test); `toStateLabel` passing `undefined` through (bug 2) fails the dataset tests, first at the case change, whose three values leave the dataset's last three cases with no `Word`.

**Commit**: `test: test the dataset and drawing flows [MARK-11]`

---

### Test Play, Step, Pause and Cancel

**Summary**: R13.

**Files affected**:
- `cypress/e2e/generation.test.ts`: new.

**Estimated diff size**: 54 lines (+54).

```ts
const itemsSent = () => cy.fakeCodap().its("items");

describe("Generating sequences", () => {
  it("plays a sequence into the output and to CODAP", () => {
    cy.fixture("chain.json").then(state =>
      cy.startPlugin({ savedState: state, query: "fastSpeed=20&normalSpeed=20" }));
    cy.plugin().find("select").first().select("a");
    cy.plugin().contains("button", "Play").click();
    cy.plugin().find(".sequence").should("have.text", "a b c");
    itemsSent().should("deep.equal", ["a", "b", "c"].map(State => ({ "Sequence number": 0, State })));
  });

  it("steps a sequence one state at a time", () => {
    cy.fixture("chain.json").then(state => cy.startPlugin({ savedState: state }));
    cy.plugin().find("select").first().select("a");
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a");
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a b");
    cy.plugin().contains("button", "Step").click();
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a b c");
    itemsSent().should("have.length", 0);
    cy.plugin().contains("button", "Step").click();
    itemsSent().should("have.length", 3);
  });

  it("pauses and resumes", () => {
    cy.fixture("cycle.json").then(state =>
      cy.startPlugin({ savedState: state, query: "fastSpeed=50&normalSpeed=200" }));
    cy.plugin().find("input[type=number]").clear();
    cy.plugin().find("input[type=number]").type("12{enter}");
    cy.plugin().contains("button", "Play").click();
    cy.plugin().contains("button", "Pause").click();
    cy.plugin().find(".sequence").invoke("text").then(paused => {
      cy.wait(1000); // five animation steps at this speed
      cy.plugin().find(".sequence").should("have.text", paused);
    });
    cy.plugin().contains("button", "Resume").click();
    cy.plugin().contains("button", "Play", { timeout: 15000 });
    cy.plugin().find(".sequence").invoke("text").should("match", /^([ab] ){11}[ab]$/);
    itemsSent().should("have.length", 12);
  });

  it("cancels a sequence without sending it to CODAP", () => {
    cy.fixture("cycle.json").then(state =>
      cy.startPlugin({ savedState: state, query: "fastSpeed=20&normalSpeed=100" }));
    cy.plugin().contains("button", "Play").click();
    cy.plugin().contains("button", "Cancel").click();
    cy.plugin().contains("button", "Play").should("be.enabled");
    cy.wait(2000); // twice a whole run at this speed
    itemsSent().should("have.length", 0);
  });
});
```

- Play and Step use `chain.json` from `a`, so the items are known exactly; Step's item request arrives only on the fifth press.
- Pause uses `cycle.json` (no state ends a run) with a 200 ms step and a 50 ms timer (`fastSpeed` sets the interval's period, `app.tsx:286-297`), so Resume finishes 12 states in about 5 s. The second after Pause is five steps at that speed.
- Cancel uses a 100 ms step, so the default five states take about a second, and waits twice that: a run that kept going after Cancel would have sent its items.
- Max Length is committed with `{enter}`: `blur` fails on an input inside the frame.

Mutations: `finishAnimating` sending the output even when canceled fails the Cancel test, and so does `finishAnimating` stopping the interval only when not canceled (the run goes on and sends 5 items).

**Commit**: `test: test playing, stepping, pausing and canceling [MARK-11]`

---

### Run the Cypress tests in CI

**Summary**: R14. A single-container job, in Chrome, with no Cypress Cloud or Codecov, that `s3-deploy` needs.

**Files affected**:
- `.github/workflows/ci.yml`: the `cypress` job replaces the commented-out matrix; `s3-deploy` needs it.

**Estimated diff size**: 50 lines (+20, -30, against MARK-10's file).

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -21,50 +21,30 @@
         run: npm run build
       - name: Run Tests
         run: npm test
-  #cypress:
-  #  runs-on: ubuntu-latest
-  #  strategy:
-  #    # when one test fails, DO NOT cancel the other
-  #    # containers, because this will kill Cypress processes
-  #    # leaving the Dashboard hanging ...
-  #    # https://github.com/cypress-io/github-action/issues/48
-  #    fail-fast: false
-  #    matrix:
-  #      # run 3 copies of the current job in parallel
-  #      containers: [1, 2, 3]
-  #  steps:
-  #    - name: Checkout
-  #      uses: actions/checkout@v2
-  #    - uses: cypress-io/github-action@v4
-  #      with:
-  #        start: npm start
-  #        wait-on: 'http://localhost:8080'
-  #        # only record the results to dashboard.cypress.io if CYPRESS_RECORD_KEY is set
-  #        record: ${{ !!secrets.CYPRESS_RECORD_KEY }}
-  #        # only do parallel if we have a record key
-  #        parallel: ${{ !!secrets.CYPRESS_RECORD_KEY }}
-  #      env:
-  #        # pass the Dashboard record key as an environment variable
-  #        CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
-  #        # pass GitHub token to allow accurately detecting a build vs a re-run build
-  #        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-  #        # turn on code coverage when running npm start
-  #        # so far we've been using a webpack coverage-istanbul-loader for this
-  #        # but there has been work on using the code coverage support in the browser directly,
-  #        # which should be much faster
-  #        CODE_COVERAGE: true
-  #        # Also turn on the code coverage tasks in cypress itself, these are disabled
-  #        # by default.
-  #        CYPRESS_coverage: true
-  #    - name: Upload coverage to Codecov
-  #      uses: codecov/codecov-action@v1
-  #      with:
-  #        flags: cypress
+  cypress:
+    name: Cypress Tests
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v7
+      - uses: actions/setup-node@v7
+        with:
+          node-version-file: .nvmrc
+          cache: npm
+      - uses: cypress-io/github-action@v7
+        with:
+          start: npm start
+          wait-on: 'http://localhost:8080'
+          browser: chrome
+      - uses: actions/upload-artifact@v7
+        if: failure()
+        with:
+          name: cypress-screenshots
+          path: cypress/screenshots
   s3-deploy:
     name: S3 Deploy
     needs:
       - build_test
-      # - cypress
+      - cypress
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v7
```

- `cypress-io/github-action` runs `npm ci` itself (installing the Cypress binary, which `build_test` and `s3-deploy` skip), starts `npm start` and waits for port 8080. v7 is its current major (v7.4.8, 2026-10-26; v7.0.0 was released 2026-01-21), and the other Concord plugins use its `@v6` tag the same way.
- `actions/setup-node` first, so the job runs on `.nvmrc`'s Node like the others; the action then uses it.
- `browser: chrome`: Cypress 16 warns that Electron is deprecated, and Chrome is on `ubuntu-latest`.
- `upload-artifact@v7` keeps `cypress/screenshots` only when a step fails (R14.3).
- The YAML parses to the jobs `build_test`, `cypress` and `s3-deploy`, with `s3-deploy` needing the first two. The job itself is checked on the first push (R18).

**Commit**: `ci: run the Cypress tests in CI before the deploy [MARK-11]`

---

### Update the Cypress docs

**Summary**: R15. The coverage doc describes today's files and what coverage measures; the README says how to run the tests, on what port, and where the page is.

**Files affected**:
- `doc/cypress-coverage.md`: rewritten.
- `README.md`: the Testing section.

**Estimated diff size**: 70 lines (+45, -25).

`doc/cypress-coverage.md`, in full:

```markdown
# Cypress Code Coverage

Code coverage of the Cypress tests is off by default. More information about the libraries involved is at https://github.com/cypress-io/code-coverage.

## How it is wired

- **Instrumenting the code.** When the `CODE_COVERAGE` environment variable is set, `webpack.config.js` adds `@jsdevtools/coverage-istanbul-loader` (with `enforce: 'post'`, so it runs last) to the TypeScript and JavaScript rules. To check it: run `CODE_COVERAGE=true npm start`, open the plugin, and look for `window.__coverage__` in the browser console.
- **Collecting it.** `cypress/support/e2e.js` imports `@cypress/code-coverage/support`, which reads `window.__coverage__` after each test and sends it to Cypress's node process with `cy.task`.
- **Saving it.** `cypress.config.ts` registers `@cypress/code-coverage/task` in `setupNodeEvents`. It merges what each test sends into `.nyc_output/out.json` and, when the tests finish, has nyc write the report.
- **The report.** The `nyc` section of `package.json` writes it to `coverage-cypress/`, apart from the Jest coverage in `coverage/`, and extends `@istanbuljs/nyc-config-typescript` so nyc reads the TypeScript source maps.

## Turning it on

`cypress.config.ts` sets `expose: { coverage: false }`. `@cypress/code-coverage` 4 reads `Cypress.expose("coverage")`, so `env` and `--env` have no effect on it. To collect coverage, run `CODE_COVERAGE=true npm start`, then `npm run test:coverage:cypress:open` (which passes `--expose coverage=true`), or `npx cypress run --expose coverage=true`. With coverage on, each test logs extra `task` commands as the support module talks to the task.

## What it measures

The support module reads `window.__coverage__` from Cypress's application window. The tests load the plugin inside the fake CODAP page's iframe, so that window is the fake page's: the report covers the fake page and the specs, not the plugin's own code.
```

Checked: with `CODE_COVERAGE=true` on the dev server and `--expose coverage=true`, a run wrote `coverage-cypress/` whose files were the fake page and the specs; the plugin's code was not in it. Collecting the plugin's coverage would mean copying `__coverage__` out of the nested frame for the support module, which nothing asks for (coverage is not in CI, requirements Out of Scope).

`README.md`, the Testing section from `### Testing` to `## License`, replaced with:

````markdown
### Testing

Run `npm test` to run jest tests. Run `npm run test:full` to run jest and Cypress tests. CI runs the jest tests after the build on every push, and a failing test stops the deploy.

The Cypress tests run against the dev server. Start it with `npm start`, then run `npm run test:cypress` to run them all headless, or `npm run test:cypress:open` to open the Cypress app. `npm run test:full` needs the dev server running too. CI runs the Cypress tests in Chrome on every push, a failing test stops the deploy, and a failed run keeps its screenshots as a workflow artifact.

The tests load the plugin into `fake-codap.html`, a stand-in for CODAP that the dev server serves and production builds leave out. It answers the plugin's requests the way CODAP 3.1.2 does and sends it CODAP's notifications. Its code is in `cypress/fake-codap/`, and the custom commands that drive it (`cy.startPlugin`, `cy.dropAttribute`, `cy.getPluginState` and the rest) are listed with their descriptions in `cypress/support/index.d.ts`. `cypress/fixtures/ela/` holds the saved plugin states of the five ELA module documents.

The tests expect the dev server on port 8080. If that port is taken, run the server on another one and point Cypress at it:

```
npm start -- --port 8081
CYPRESS_baseUrl=http://localhost:8081 npm run test:cypress
```

##### Cypress Run Options

Pass these to `npx cypress run`:
1. `--browser browser-name`: the browser to run the tests in (CI uses `chrome`)
2. `--spec`: the spec files to run
3. `--headed`: show the browser while the tests run
4. `--no-exit`: keep the Cypress app open when the tests finish
5. `--reporter`: a mocha reporter

##### Cypress Run Examples

1. `npx cypress run --browser chrome` runs the tests in Chrome.
2. `npx cypress run --headed --no-exit` shows the tests running and leaves the Cypress app open afterward.
3. `npx cypress run --spec 'cypress/e2e/arrows.test.ts'` runs one spec file.
````

The first paragraph is MARK-10's sentence, unchanged. The Cypress Cloud options (`--group`, `--record`, `--key`) and the nonexistent `cypress/integration/examples/smoke-test.js` are gone.

**Commit**: `docs: describe running the Cypress tests and their coverage [MARK-11]`

---

### Done when

On the head (R16 to R18): `npm ci`; `npm run build` with no warnings; the three lint commands and both `tsc` commands print nothing; `npm test` passes; `npm run test:cypress` (with `npm start` running) passes three runs in a row; the production `dist/` hashes match the ones kept before the first commit, except `index.[contenthash].js.map` (R3); a `git diff --stat` against the rebased base shows nothing under `src/` and no `package-lock.json`. Then CI's `cypress` job on the first push.

### Checked before this plan was final (stage 7)

- **Commit by commit.** In a scratch clone of this branch, each step's files were added and committed in order, and every check ran at each commit: `npm run build` compiled with no warnings, `lint`, `lint:build` and `lint:style` printed nothing, both `tsc` commands passed, and Jest passed its 32 tests. From step 3 on, `cypress run` in Chrome passed 6, 9, 11, 14, 17, 23 and 27 tests at the seven test steps. The clone's final files matched the ones quoted here. That replay ran before MARK-10's code landed; on MARK-10's head, all eleven steps' files together build with no warnings, lint and both `tsc` commands print nothing, Jest passes 56 tests, and the 27 Cypress tests passed three runs in a row in Chrome.
- **Mutations**, listed under each step, each reverted with `git checkout` after a run against the dev server, with the server given time to rebuild either side. A mutation that leaves an unused import or extra whitespace makes the dev server's overlay cover the plugin and fails every test for that reason alone, so each mutation was written to lint clean.
- **MARK-12's five tests** were sketched with these commands and passed twice (requirements, Technical Notes).

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: one test file per risk area, or one rendering spec
**Context**: MARK-12's plan adds `fit-view.test.ts` "or MARK-11's rendering spec file if it groups tests by area".
**Options considered**:
- A) One file per area, each its own commit.
- B) One `rendering.test.ts`.

**Decision**: A. Each commit is one area a reviewer can read on its own, a CI failure names the area, and MARK-12's five tests go in their own `fit-view.test.ts` beside `fit.test.ts`.

### RESOLVED: Judgment call: commands, or the page's API used directly
**Context**: the page's API on `window.fakeCodap` is enough to drive the tests through `cy.fakeCodap().then(...)`.
**Options considered**:
- A) A typed command per action, listed in `index.d.ts`.
- B) Only `cy.startPlugin`, `cy.plugin` and `cy.fakeCodap`.

**Decision**: A. Every command that talks to the plugin has to wrap its promise in `then` (`invoke` does not wait, measured), which B would leave each test to remember. The list in `index.d.ts` is the page's documentation (R5.9).

### RESOLVED: Judgment call: click states with a lone click event
**Context**: Cypress's `click` and `dblclick` on a state made d3-drag throw inside the plugin's frame.
**Options considered**:
- A) `trigger("click")` on the ellipse, wrapped in `clickState` and `doubleClickState`.
- B) Turn the dev server's error overlay off and ignore the errors.
- C) A real-events package for native clicks.

**Decision**: A. B hides real errors, which the error check exists to catch, and C adds a package (R1). The tests drive the plugin's click handling, which is what selection and double-clicks use; dragging a state is not covered.

## Self-Review

Roles: test writer (can each test fail), MARK-12's and MARK-13's integrator (the page, `e2e.js` and webpack contracts), DevOps engineer, PR reviewer. Each finding was checked by running the plan's files against MARK-10's head in Chrome.

### Test Writer

#### RESOLVED: the Cancel test passed when Cancel left the run going
At the default 1 s step, five states take about 10 s, so the 1 s wait ended long before an uncanceled run would send items: with `stopAnimationInterval()` moved inside `finishAnimating`'s `if (!cancel)`, the test passed. With a 100 ms step and a 2 s wait it fails (5 items sent), and passes three runs in a row unmutated.

---

#### RESOLVED: a restart erased the plugin's recorded errors
`start` emptied `errors`, so an error thrown in the plugin's frame before `cy.restartPlugin` was lost and the test passed (checked with a throwaway test that throws from the plugin's window, then restarts). `start` no longer clears them; the same test now fails in the `afterEach`, and the suite passes.

---

### PR Reviewer

#### RESOLVED: three diff sizes didn't match the files
Measured with `git diff --numstat` on the plan's files: the configuration step is +12, -6, the fixtures 3,473 lines, and the page step +328, -19 (`webpack.config.js`'s two removed lines were not counted).

