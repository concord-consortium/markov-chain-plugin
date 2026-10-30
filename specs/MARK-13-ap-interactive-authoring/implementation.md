# Implementation Plan: The Markov AP Interactive, with Authoring

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-13
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Before starting

The branch sits on MARK-12's, so it has master, MARK-6, MARK-20, MARK-8, MARK-9, MARK-10, MARK-11 and MARK-12, all implemented, with MARK-11's and MARK-12's closed specs in `specs/`. The plan relies on what they landed: React 19.3, `createRoot` and iframe-phone pinned at 1.3.1 (MARK-12); ts-loader's `configFile` set to the root `tsconfig.json` (MARK-12), so every entry compiles with the root config, `cypress/fake-ap/fake-ap.ts` included, whichever file webpack compiles first; MARK-11's dev-only `fake-codap` webpack entry, its `output.filename` function, `cypress/tsconfig.json`, `modifyObstructiveCode: false`, the frame-error check in `cypress/support/e2e.js` and the `cypress` CI job; MARK-10's `build_test` CI job; Node 24 and TypeScript 6 with `bundler` resolution (MARK-8); the three ESLint flat configs (MARK-9). The webpack and `e2e.js` diffs below are written against the files on MARK-12's branch. MARK-12's `cypress/e2e/clicks.test.ts` and the helpers in `cypress/support/graph.ts` are the plugin's and stay as they are: the interactive's tests use neither.

Run on Node 24 (`nvm use`) after `npm ci`, and record the baseline:

```bash
npm run build && npm run lint && npm run lint:build && npm run lint:style
npx tsc --noEmit -p . && npx tsc --noEmit -p cypress
npm test
npm start   # in another terminal, then:
npm run test:cypress
```

Then keep the base's production builds for R2's check, outside the repo:

```bash
npm run build:webpack && rm -rf /tmp/mark13-base && cp -r dist /tmp/mark13-base
DEPLOY_PATH=branch/x/ npx webpack --mode production && rm -rf /tmp/mark13-base-top && cp -r dist /tmp/mark13-base-top
```

## Implementation Plan

### Add the LARA interactive API library

**Summary**: R25. The one dependency the interactive needs, in a commit of its own so the reviewer reads the lockfile change apart from code. Nothing imports it yet, so the build and tests are unchanged.

**Files affected**:
- `package.json`: `@concord-consortium/lara-interactive-api` in `dependencies`.
- `package-lock.json`.

**Estimated diff size**: 50 lines (+50), measured: `package.json` +1, `package-lock.json` +49.

```bash
npm install @concord-consortium/lara-interactive-api@^1.15.0
```

(Use the newest 1.x at implementation time; 1.15.0 was newest on 2026-10-29.) npm adds two packages: the library and the `nanoid` 3 it depends on, nested under it. The plugin's `nanoid` 6 and the pinned `iframe-phone` 1.3.1 don't move (the library's `^1.3.1` is satisfied by it, and its bundle carries its own copy anyway). Then `rm -rf node_modules && npm ci`, and check the output has no `ERESOLVE`, `EBADENGINE` or peer-dependency warnings. The deprecation warnings `npm ci` already prints (eslint 9.39.5, `glob`, `whatwg-encoding`) are the base's.

**Commit**: `build: add the LARA interactive API library [MARK-13]`

---

### Add the authored state and its reader

**Summary**: R4 to R10, and R20's authored-state tests. The type, the defaults, the labels the form and the runtime share, and `readAuthoredState`, which turns whatever LARA or the Activity Player hands over into a complete state. Pure TypeScript with no import of the library, so Jest loads it without the library's UMD bundle.

**Files affected**:
- `src/interactive/authored-state.ts`: new.
- `src/interactive/authored-state.test.ts`: new.

**Estimated diff size**: 373 lines (+373).

`src/interactive/authored-state.ts`:

```ts
// The settings an author chooses for the Markov Interactive, saved by LARA as the interactive's authored state.
// Settings are read one by one with a default for each (readAuthoredState), so a setting added later reads its
// default from activities saved before it existed, and needs no version change. The version changes only when a
// saved setting's meaning changes, and the reader then converts the older versions.

export const authoredStateVersion = 1;

export const modeIds = ["useData", "draw"] as const;
export type ModeId = typeof modeIds[number];

// The authoring form's one choice of modes, saved as the two modes' availability. No choice leaves students with no
// mode.
export const usableModesChoices = ["draw", "useData", "both"] as const;
export type UsableModes = typeof usableModesChoices[number];

export const usableModesOf = (modes: Record<ModeId, boolean>): UsableModes =>
  modes.useData && modes.draw ? "both" : modes.draw ? "draw" : "useData";

export const modesFor = (usable: UsableModes): Record<ModeId, boolean> =>
  ({ useData: usable !== "draw", draw: usable !== "useData" });

export const paneIds = ["input", "graph", "inspect", "generator"] as const;
export type PaneId = typeof paneIds[number];

export const buttonIds = ["probabilities", "sendToCodap", "downloadTables"] as const;
export type ButtonId = typeof buttonIds[number];

// in the order the form offers them, with the linked choice last
export const inputViews = ["table", "text", "textAndTable"] as const;
export type InputView = typeof inputViews[number];

export const capitalizations = ["lowercase", "asTyped"] as const;
export type Capitalization = typeof capitalizations[number];

export const maxStartingTextLength = 20000;

export interface PaneSettings {
  available: boolean;
  startsOpen: boolean;
}

export interface ButtonSettings {
  available: boolean;
  // only for a toggle button
  startsOn?: boolean;
}

export interface MarkovAuthoredState {
  version: typeof authoredStateVersion;
  modes: Record<ModeId, boolean>;
  startingMode: ModeId;
  panes: Record<PaneId, PaneSettings>;
  buttons: Record<ButtonId, ButtonSettings>;
  inputView: InputView;
  capitalization: Capitalization;
  orderMatters: { startsOn: boolean, showSwitch: boolean };
  startingText: string;
}

export const defaultAuthoredState: MarkovAuthoredState = {
  version: authoredStateVersion,
  modes: { useData: true, draw: true },
  startingMode: "useData",
  panes: {
    input: { available: true, startsOpen: true },
    graph: { available: true, startsOpen: true },
    inspect: { available: true, startsOpen: true },
    generator: { available: true, startsOpen: true },
  },
  buttons: {
    probabilities: { available: true, startsOn: false },
    sendToCodap: { available: false },
    downloadTables: { available: false },
  },
  inputView: "textAndTable",
  capitalization: "lowercase",
  orderMatters: { startsOn: true, showSwitch: true },
  startingText: "",
};

// the labels the authoring form shows, and the runtime's list of settings repeats
export const modeLabels: Record<ModeId, string> = { useData: "Data", draw: "Draw" };
export const usableModesLabels: Record<UsableModes, string> = {
  draw: modeLabels.draw, useData: modeLabels.useData, both: "Both (with a toggle switch for students)"
};
// the help the form shows under a choice, for the option chosen
export const usableModesHelp: Record<UsableModes, string> = {
  draw: "Students draw their own chain.",
  useData: "Students build a chain from text or a table.",
  both: "Students build a chain from text or a table, or draw their own, and switch between the two.",
};
export const paneLabels: Record<PaneId, string> = {
  input: "Input pane", graph: "Graph pane", inspect: "Inspect pane", generator: "Sequence generator pane"
};
export const buttonLabels: Record<ButtonId, string> = {
  probabilities: "Show probabilities toggle", sendToCodap: "Send to CODAP button",
  downloadTables: "Download data files button",
};
export const inputViewLabels: Record<InputView, string> = {
  table: "Table only", text: "Text only", textAndTable: "Linked table and text"
};
export const inputViewHelp: Record<InputView, string> = {
  table: "Students work only in the table and never see the text.",
  text: "Students work only in the text box and never see a table.",
  textAndTable: "Students see their text and a table of its words; changing one changes the other.",
};
export const capitalizationLabels: Record<Capitalization, string> = {
  lowercase: "\"The\" and \"the\" are the same word", asTyped: "\"The\" and \"the\" are different words"
};
export const settingLabels = {
  modes: "Modes",
  usableModes: "Usable mode(s)",
  startingMode: "Starting mode",
  useData: "Data settings",
  inputView: "How students enter their data",
  capitalization: "Capital letters",
  ordering: "Ordering",
  orderMattersStartsOn: "Start with \"Order matters\" on",
  orderMattersShowSwitch: "Show students the \"Order matters\" switch",
  startingText: "Starting data",
  whatStudentsSee: "What students can see",
  startsOpen: "Open at the start",
  // with both modes, since Draw mode always opens its graph and the Graph pane's starting state is Data mode's alone
  graphStartsOpenWithBothModes: "Open at the start in Data mode",
  probabilitiesStartsOn: "Probabilities shown at the start",
  sendDataButtons: "Send data buttons",
};

// a pane's "Open at the start" label; the Graph pane's names the mode it applies to when there are two
export const startsOpenLabel = (id: PaneId, modes: Record<ModeId, boolean>) =>
  id === "graph" && modes.useData && modes.draw ? settingLabels.graphStartsOpenWithBothModes : settingLabels.startsOpen;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readBoolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;

const readChoice = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T =>
  choices.includes(value as T) ? value as T : fallback;

const parse = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === "string") {
    try {
      return parse(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
};

const readModes = (raw: unknown) => {
  const saved = isRecord(raw) ? raw : {};
  const modes = {
    useData: readBoolean(saved.useData, defaultAuthoredState.modes.useData),
    draw: readBoolean(saved.draw, defaultAuthoredState.modes.draw),
  };
  // a state with no mode available can't be run, so it reads as the default, both
  return modes.useData || modes.draw ? modes : { ...defaultAuthoredState.modes };
};

const readPanes = (raw: unknown) => {
  const saved = isRecord(raw) ? raw : {};
  const panes = {} as Record<PaneId, PaneSettings>;
  paneIds.forEach(id => {
    const pane = isRecord(saved[id]) ? saved[id] : {};
    const fallback = defaultAuthoredState.panes[id];
    panes[id] = {
      available: readBoolean(pane.available, fallback.available),
      startsOpen: readBoolean(pane.startsOpen, fallback.startsOpen),
    };
  });
  return panes;
};

const readButtons = (raw: unknown) => {
  const saved = isRecord(raw) ? raw : {};
  const buttons = {} as Record<ButtonId, ButtonSettings>;
  buttonIds.forEach(id => {
    const button = isRecord(saved[id]) ? saved[id] : {};
    const fallback = defaultAuthoredState.buttons[id];
    buttons[id] = { available: readBoolean(button.available, fallback.available) };
    if (fallback.startsOn !== undefined) {
      buttons[id].startsOn = readBoolean(button.startsOn, fallback.startsOn);
    }
  });
  return buttons;
};

// Reads whatever LARA or the Activity Player hands the interactive (an object, a JSON string, {} for a new
// interactive, or nothing) as a complete authored state. It never throws, and a complete, valid state reads
// back unchanged.
export const readAuthoredState = (raw: unknown): MarkovAuthoredState => {
  const saved = parse(raw);
  const modes = readModes(saved.modes);
  const startingMode = readChoice(saved.startingMode, modeIds, defaultAuthoredState.startingMode);
  const orderMatters = isRecord(saved.orderMatters) ? saved.orderMatters : {};
  const panes = readPanes(saved.panes);
  // students draw on the graph, so Draw mode always has it
  if (modes.draw) {
    panes.graph.available = true;
  }
  return {
    version: authoredStateVersion,
    modes,
    // students can only start in a mode they have
    startingMode: modes[startingMode] ? startingMode : modes.useData ? "useData" : "draw",
    panes,
    buttons: readButtons(saved.buttons),
    inputView: readChoice(saved.inputView, inputViews, defaultAuthoredState.inputView),
    capitalization: readChoice(saved.capitalization, capitalizations, defaultAuthoredState.capitalization),
    orderMatters: {
      startsOn: readBoolean(orderMatters.startsOn, defaultAuthoredState.orderMatters.startsOn),
      showSwitch: readBoolean(orderMatters.showSwitch, defaultAuthoredState.orderMatters.showSwitch),
    },
    startingText: typeof saved.startingText === "string" ? saved.startingText : defaultAuthoredState.startingText,
  };
};
```

- **Keyed records** for modes, panes and buttons: the form loops over `modeIds`, `paneIds` and `buttonIds`, the runtime's list does too, and a later story adds a pane or button by adding an id, a default and a label.
- **Labels** live here, beside the ids they name (R11's one list), in Rebecca's wording. The settings that aren't a mode, pane or button have theirs in `settingLabels`. `startsOpenLabel` gives a pane's "Open at the start" label, which for the Graph pane with both modes is "Open at the start in Data mode", so the form and the runtime's list can't disagree. `usableModesHelp` and `inputViewHelp` hold the help the form shows under those two selects, one entry per option, so it describes the option chosen.
- **Usable modes** are the form's one choice (R5): `modesFor` turns a choice into the two saved booleans and `usableModesOf` reads it back. The saved state, its reader and the URL settings keep the two booleans, and no choice gives a state with no mode.
- **The Graph rule** (R5, R10) is applied after the panes are read, so a saved `graph.available: false` stays as saved without Draw and reads as available with it.
- **Send to CODAP and Download data files** are off by default (R6). `downloadTables` is one more button id with only `available`, so the reader, the URL settings and the standalone link take it with no code of their own; MARK-18 builds the button.
- **Option order:** `inputViews` lists the table first and the linked choice last, the form's order, and `usableModesChoices` puts Both last.
- **`startsOn`** exists only on a toggle button; `readButtons` copies it only for buttons whose default has one, so Send to CODAP never gains one.
- **Corrections** (R10's third bullet): no mode reads as both; an unavailable starting mode reads as Data if it is available, else Draw.
- **`version`** is always written as the current version. A version 2 reader would branch on `saved.version` before reading fields.

`src/interactive/authored-state.test.ts`:

```ts
import {
  defaultAuthoredState, MarkovAuthoredState, modesFor, readAuthoredState, usableModesOf
} from "./authored-state";

// written out rather than taken from defaultAuthoredState, so a changed default fails here
const expectedDefaults: MarkovAuthoredState = {
  version: 1,
  modes: { useData: true, draw: true },
  startingMode: "useData",
  panes: {
    input: { available: true, startsOpen: true },
    graph: { available: true, startsOpen: true },
    inspect: { available: true, startsOpen: true },
    generator: { available: true, startsOpen: true },
  },
  buttons: {
    probabilities: { available: true, startsOn: false },
    sendToCodap: { available: false },
    downloadTables: { available: false },
  },
  inputView: "textAndTable",
  capitalization: "lowercase",
  orderMatters: { startsOn: true, showSwitch: true },
  startingText: "",
};

const customState: MarkovAuthoredState = {
  version: 1,
  modes: { useData: true, draw: false },
  startingMode: "useData",
  panes: {
    input: { available: true, startsOpen: false },
    graph: { available: false, startsOpen: true },
    inspect: { available: false, startsOpen: false },
    generator: { available: true, startsOpen: false },
  },
  buttons: {
    probabilities: { available: true, startsOn: true },
    sendToCodap: { available: true },
    downloadTables: { available: true },
  },
  inputView: "table",
  capitalization: "asTyped",
  orderMatters: { startsOn: false, showSwitch: false },
  startingText: "the cat sat on the mat",
};

describe("usable modes", () => {
  it.each([
    ["draw", { useData: false, draw: true }],
    ["useData", { useData: true, draw: false }],
    ["both", { useData: true, draw: true }],
  ] as const)("saves %s as the two modes' availability, and reads it back", (usable, modes) => {
    expect(modesFor(usable)).toEqual(modes);
    expect(usableModesOf(modes)).toBe(usable);
  });
});

describe("readAuthoredState", () => {
  it.each([
    ["nothing", undefined],
    ["null", null],
    ["{}, what LARA sends for a new interactive", {}],
    ["an unparseable string", "{not json"],
    ["an array", []],
    ["a number", 3],
  ])("reads %s as the defaults", (_, raw) => {
    expect(readAuthoredState(raw)).toEqual(expectedDefaults);
  });

  it("has the defaults written out above", () => {
    expect(defaultAuthoredState).toEqual(expectedDefaults);
  });

  it("returns a complete, valid state unchanged", () => {
    expect(readAuthoredState(customState)).toEqual(customState);
    expect(readAuthoredState(expectedDefaults)).toEqual(expectedDefaults);
  });

  it("reads a JSON string of a state", () => {
    expect(readAuthoredState(JSON.stringify(customState))).toEqual(customState);
  });

  it("changes nothing on a second read", () => {
    const partial = { modes: { draw: false }, panes: { inspect: { available: false } }, inputView: "nope" };
    const once = readAuthoredState(partial);
    expect(readAuthoredState(once)).toEqual(once);
  });

  it("fills in the settings a state doesn't have and keeps the ones it does", () => {
    const read = readAuthoredState({
      version: 1,
      startingMode: "draw",
      panes: { inspect: { available: false } },
      buttons: { probabilities: { startsOn: true } },
      capitalization: "asTyped",
    });
    expect(read).toEqual({
      ...expectedDefaults,
      startingMode: "draw",
      panes: { ...expectedDefaults.panes, inspect: { available: false, startsOpen: true } },
      buttons: { ...expectedDefaults.buttons, probabilities: { available: true, startsOn: true } },
      capitalization: "asTyped",
    });
  });

  it.each([
    ["modes", { modes: "both" }],
    ["a mode", { modes: { useData: "yes", draw: true } }],
    ["the starting mode", { startingMode: "toString" }],
    ["panes", { panes: [] }],
    ["a pane", { panes: { graph: null } }],
    ["a pane's availability", { panes: { inspect: { available: 0 } } }],
    ["a button's starting state", { buttons: { probabilities: { startsOn: "off" } } }],
    ["the download button", { buttons: { downloadTables: { available: "yes" } } }],
    ["the input view", { inputView: "both" }],
    ["the capitalization", { capitalization: "upper" }],
    ["order matters", { orderMatters: { startsOn: "yes", showSwitch: null } }],
    ["the starting text", { startingText: 42 }],
  ])("reads invalid %s as the default", (_, raw) => {
    expect(readAuthoredState(raw)).toEqual(expectedDefaults);
  });

  it("ignores a starting state for a button with no on or off", () => {
    expect(readAuthoredState({ buttons: { sendToCodap: { available: true, startsOn: true } } }).buttons.sendToCodap)
      .toEqual({ available: true });
  });

  it("keeps a starting text longer than the form allows", () => {
    const startingText = "word ".repeat(5000);
    expect(readAuthoredState({ startingText }).startingText).toBe(startingText);
  });

  it("reads no mode available as both available", () => {
    expect(readAuthoredState({ modes: { useData: false, draw: false } }).modes).toEqual({ useData: true, draw: true });
  });

  it("reads the Graph pane as available while Draw is, and as saved without it", () => {
    const panes = { graph: { available: false, startsOpen: false } };
    expect(readAuthoredState({ panes }).panes.graph).toEqual({ available: true, startsOpen: false });
    expect(readAuthoredState({ modes: { useData: true, draw: false }, panes }).panes.graph)
      .toEqual({ available: false, startsOpen: false });
  });

  it.each([
    [{ useData: true, draw: false }, "draw", "useData"],
    [{ useData: false, draw: true }, "useData", "draw"],
  ])("reads a starting mode that isn't available as the available one", (modes, startingMode, expected) => {
    expect(readAuthoredState({ modes, startingMode }).startingMode).toBe(expected);
  });

  it("writes the current version, whatever version it reads", () => {
    expect(readAuthoredState({ version: 0 }).version).toBe(1);
  });
});
```

The expected defaults are written out (R20), and one test checks the code's `defaultAuthoredState` against them, so changing a default means changing the test on purpose. Measured in a scratch copy: 33 tests pass; with the no-mode correction removed, the starting-mode correction removed, the JSON-string parse removed, a pane's availability read unchecked, or a long starting text cut to the form's limit, at least one fails. The invalid pane availability is the Inspect pane's, since the Graph rule below would make an invalid Graph availability read as the default whatever the reader did with it.

**Commit**: `feat: add the Markov Interactive's authored state [MARK-13]`

---

### Add the interactive's page with the placeholder runtime

**Summary**: R1 and R2 for `interactive.html`, R3, R12, R13, R14 for the interactive with its URL settings, and R20's settings-list, standalone and URL-settings tests. The new webpack entry and page, the mode switch, the frame-height hook, and the runtime placeholder that lists the settings and saves `{ version: 1 }`. Authoring mode shows the "not supported yet" message until the next step but one.

**Files affected**:
- `webpack.config.js`: the `interactive` entry and its `HtmlWebpackPlugin`; the plugin's pages limited to the `main` chunk.
- `src/interactive/index.html`, `index.tsx`, `app.tsx`, `runtime.tsx`, `interactive-state.ts`, `settings-summary.ts`, `settings-summary.test.ts`, `use-frame-height.ts`, `interactive.scss`, `standalone.test.tsx`, `url-settings.ts`, `url-settings.test.ts`: new.

**Estimated diff size**: 539 lines (+533, -6), measured.

`webpack.config.js`:

```diff
@@ -31,10 +31,12 @@ module.exports = (env, argv) => {
       allowedHosts: 'all',
     },
     devtool: devMode ? 'eval-cheap-module-source-map' : 'source-map',
-    // the Cypress tests' fake CODAP page is served by the dev server only, never deployed
-    entry: devMode
-      ? { main: './src/index.tsx', 'fake-codap': './cypress/fake-codap/fake-codap.ts' }
-      : './src/index.tsx',
+    entry: {
+      main: './src/index.tsx',
+      interactive: './src/interactive/index.tsx',
+      // the Cypress tests' fake CODAP page is served by the dev server only, never deployed
+      ...(devMode ? { 'fake-codap': './cypress/fake-codap/fake-codap.ts' } : {}),
+    },
     mode: 'development',
     output: {
       path: path.resolve(__dirname, 'dist'),
@@ -152,8 +154,14 @@ module.exports = (env, argv) => {
         template: 'src/index.html',
         favicon: 'src/public/favicon.ico',
         publicPath: '.',
-        excludeChunks: ['fake-codap'],
+        chunks: ['main'],
       }),
+      new HtmlWebpackPlugin({
+        filename: 'interactive.html',
+        template: 'src/interactive/index.html',
+        publicPath: '.',
+        chunks: ['interactive'],
+      }),
       ...(devMode ? [new HtmlWebpackPlugin({
         filename: 'fake-codap.html',
         template: 'cypress/fake-codap/index.html',
@@ -165,6 +173,7 @@ module.exports = (env, argv) => {
         template: 'src/index.html',
         favicon: 'src/public/favicon.ico',
-        publicPath: DEPLOY_PATH
+        publicPath: DEPLOY_PATH,
+        chunks: ['main'],
       })] : []),
       new CleanWebpackPlugin(),
     ]
```

(Hunk line numbers are the file's on MARK-12's branch.) A string entry is a chunk named `main`, so the object form names the plugin's chunk exactly as before. `HtmlWebpackPlugin` puts every chunk on a page by default, so both plugin pages get `chunks: ['main']`, which also replaces MARK-11's `excludeChunks`. MARK-11's `output.filename` function names the new chunk `assets/interactive.[contenthash].js`, and `MiniCssExtractPlugin` names its CSS after the chunk, so `output` is unchanged. The interactive's page has no favicon: it is only ever shown inside LARA's or the Activity Player's frame.

`src/interactive/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Markov Interactive</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

`src/interactive/index.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";

createRoot(document.getElementById("app") as HTMLElement).render(<App />);
```

As MARK-12's `src/index.tsx`, with the same cast.

`src/interactive/app.tsx` (this step's version; the authoring step adds the `authoring` case):

```tsx
import React, { useEffect } from "react";
import { inIframe, setSupportedFeatures, useInitMessage } from "@concord-consortium/lara-interactive-api";
import { readAuthoredState } from "./authored-state";
import { MarkovInteractiveState } from "./interactive-state";
import { Runtime } from "./runtime";
import { authoredStateFromSearch } from "./url-settings";
import { useFrameHeight } from "./use-frame-height";

import "./interactive.scss";

// Started by LARA or the Activity Player, which send the init message and keep the states.
const HostedApp = () => {
  const initMessage = useInitMessage<MarkovInteractiveState, unknown>();
  const ref = useFrameHeight();

  useEffect(() => {
    // LARA shows the authoring form only for an interactive that says it supports authored state
    setSupportedFeatures({ authoredState: true, interactiveState: true });
  }, []);

  const renderMode = () => {
    if (!initMessage) {
      return <div className="loading">Loading...</div>;
    }
    switch (initMessage.mode) {
      case "runtime":
        return (
          <Runtime authoredState={readAuthoredState(initMessage.authoredState)}
            interactiveState={initMessage.interactiveState} />
        );
      default:
        return (
          <div className="unsupported-mode">
            The Markov interactive doesn&apos;t support { initMessage.mode } mode yet.
          </div>
        );
    }
  };

  return <div className="markov-interactive" ref={ref}>{ renderMode() }</div>;
};

// Opened directly, as a link from a collection page opens it: no host will send an init message or keep a state,
// so it takes its settings from its link and leaves the library alone, whose client would only warn and hold messages.
const StandaloneApp = () => (
  <div className="markov-interactive">
    <Runtime authoredState={authoredStateFromSearch(window.location.search)} standalone={true} />
  </div>
);

export const App = () => inIframe() ? <HostedApp /> : <StandaloneApp />;
```

- `setSupportedFeatures` must report `authoredState: true`, or LARA never shows the authoring form (`interactive-authoring.tsx:41` in LARA). No `aspectRatio`: the interactive reports its height instead.
- The authored state is typed `unknown` in `useInitMessage`, since `readAuthoredState` is what makes it a `MarkovAuthoredState`.
- `report` mode, and any mode the library adds later, gets the message (R13).
- `inIframe()` is the library's own check, true in a frame (requirements, Technical Notes, "Telling a page opened directly from one in a host"). The hosted and standalone views are separate components so that only the hosted one calls the library: at the top level its client never connects, so it would only warn, hold every message, and mark the state unsaved, which makes leaving the page in the next 2 seconds ask "State has not been saved". Only the standalone view reads `window.location.search`; the hosted view's settings come from the init message alone (R14).

`src/interactive/interactive-state.ts`:

```ts
// What the interactive saves for a student. The class dashboard counts a student as having opened the interactive
// once their state isn't empty, so it always holds the version.
export const interactiveStateVersion = 1;

export interface MarkovInteractiveState {
  version: typeof interactiveStateVersion;
}
```

`src/interactive/runtime.tsx`:

```tsx
import React, { useEffect } from "react";
import { setInteractiveState } from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { interactiveStateVersion, MarkovInteractiveState } from "./interactive-state";
import { settingsSummary } from "./settings-summary";

interface Props {
  authoredState: MarkovAuthoredState;
  // the student's saved state, as the Activity Player started the interactive with it
  interactiveState?: MarkovInteractiveState | null;
  // opened outside a host, so there is nowhere to save
  standalone?: boolean;
}

// A placeholder for the student view: it lists the authored settings, so authors can check them.
export const Runtime = ({ authoredState, interactiveState, standalone }: Props) => {
  // the class dashboard shows a student only once there is interactive state, and counts {} as none
  const hasState = !!interactiveState && Object.keys(interactiveState).length > 0;
  useEffect(() => {
    if (!standalone && !hasState) {
      setInteractiveState<MarkovInteractiveState>({ version: interactiveStateVersion });
    }
  }, [standalone, hasState]);

  return (
    <div className="runtime-placeholder">
      <h2>Markov interactive: coming soon</h2>
      { standalone && (
        <p className="standalone-note">
          Opened outside the Activity Player: the settings come from this page&apos;s link, and nothing is saved.
        </p>
      ) }
      <dl>
        { settingsSummary(authoredState).map(({ label, value }) => (
          <React.Fragment key={label}>
            <dt>{ label }</dt>
            <dd>{ value }</dd>
          </React.Fragment>
        )) }
      </dl>
    </div>
  );
};
```

The runtime decides from the init message's interactive state, not from the library's `useInteractiveState` hook: the hook returns `null` on its first render and only then the real state, so an effect on it saves `{ version: 1 }` over a student's existing state. Measured: with the hook, the "leaves an existing interactive state alone" test failed; with the init message, it passes. `setInteractiveState` waits 2 seconds before it sends, as the library does for every interactive-state save.

`src/interactive/settings-summary.ts`:

```ts
import {
  buttonLabels, capitalizationLabels, inputViewLabels, MarkovAuthoredState, modeLabels, PaneId, paneIds, paneLabels,
  settingLabels, startsOpenLabel, usableModesLabels, usableModesOf
} from "./authored-state";

export interface SettingSummary {
  label: string;
  value: string;
}

// how much of the starting text the summary repeats before giving its full length
const startingTextPreviewLength = 100;

const yesNo = (value: boolean) => value ? "Yes" : "No";
const availability = (value: boolean) => value ? "Available" : "Not available";

const startingTextValue = (text: string) => {
  if (text === "") {
    return "(empty)";
  }
  // a cut between a character's two halves would leave half of it, so that half goes too
  const cut = text.slice(0, startingTextPreviewLength).replace(/[\uD800-\uDBFF]$/, "");
  const preview = text.length > startingTextPreviewLength ? `${cut}...` : text;
  return `${preview} (${text.length} ${text.length === 1 ? "character" : "characters"})`;
};

// The authored settings as the runtime's placeholder lists them, in the authoring form's order and with its labels.
// As in the form, a setting is left out while what it depends on is off.
export const settingsSummary = (state: MarkovAuthoredState): SettingSummary[] => {
  const { useData, draw } = state.modes;
  const pane = (id: PaneId): SettingSummary[] => {
    const { available, startsOpen } = state.panes[id];
    const showStartsOpen = available && (id !== "graph" || useData);
    return [
      { label: paneLabels[id], value: availability(available) },
      ...(showStartsOpen
        ? [{ label: `${paneLabels[id]}: ${startsOpenLabel(id, state.modes)}`, value: yesNo(startsOpen) }]
        : []),
    ];
  };
  return [
    { label: settingLabels.usableModes, value: usableModesLabels[usableModesOf(state.modes)] },
    ...(useData && draw ? [{ label: settingLabels.startingMode, value: modeLabels[state.startingMode] }] : []),
    ...(useData ? [
      { label: settingLabels.inputView, value: inputViewLabels[state.inputView] },
      { label: settingLabels.capitalization, value: capitalizationLabels[state.capitalization] },
      { label: settingLabels.orderMattersStartsOn, value: yesNo(state.orderMatters.startsOn) },
      { label: settingLabels.orderMattersShowSwitch, value: yesNo(state.orderMatters.showSwitch) },
      { label: settingLabels.startingText, value: startingTextValue(state.startingText) },
    ] : []),
    ...paneIds.filter(id => id !== "input" || useData).reduce<SettingSummary[]>((all, id) => all.concat(pane(id)), []),
    { label: settingLabels.probabilitiesStartsOn, value: yesNo(state.buttons.probabilities.startsOn ?? false) },
    { label: buttonLabels.probabilities, value: availability(state.buttons.probabilities.available) },
    { label: buttonLabels.sendToCodap, value: availability(state.buttons.sendToCodap.available) },
    { label: buttonLabels.downloadTables, value: availability(state.buttons.downloadTables.available) },
  ];
};
```

`src/interactive/settings-summary.test.ts`:

```ts
import { readAuthoredState } from "./authored-state";
import { settingsSummary } from "./settings-summary";

const listed = (raw: unknown) => settingsSummary(readAuthoredState(raw)).map(({ label, value }) => [label, value]);

describe("settingsSummary", () => {
  it("lists every default setting, in the form's order and with its labels", () => {
    expect(listed({})).toEqual([
      ["Usable mode(s)", "Both (with a toggle switch for students)"],
      ["Starting mode", "Data"],
      ["How students enter their data", "Linked table and text"],
      ["Capital letters", "\"The\" and \"the\" are the same word"],
      ["Start with \"Order matters\" on", "Yes"],
      ["Show students the \"Order matters\" switch", "Yes"],
      ["Starting data", "(empty)"],
      ["Input pane", "Available"],
      ["Input pane: Open at the start", "Yes"],
      ["Graph pane", "Available"],
      ["Graph pane: Open at the start in Data mode", "Yes"],
      ["Inspect pane", "Available"],
      ["Inspect pane: Open at the start", "Yes"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "Yes"],
      ["Probabilities shown at the start", "No"],
      ["Show probabilities toggle", "Available"],
      ["Send to CODAP button", "Not available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("leaves out what applies only to Data mode, or to a pane that isn't available, as the form does", () => {
    expect(listed({
      modes: { useData: false, draw: true },
      panes: { inspect: { available: false }, generator: { startsOpen: false } },
      buttons: { probabilities: { available: false, startsOn: true }, sendToCodap: { available: true } },
      inputView: "table",
    })).toEqual([
      ["Usable mode(s)", "Draw"],
      ["Graph pane", "Available"],
      ["Inspect pane", "Not available"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "No"],
      ["Probabilities shown at the start", "Yes"],
      ["Show probabilities toggle", "Not available"],
      ["Send to CODAP button", "Available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("lists Data's changed settings, and a Graph pane made unavailable without Draw", () => {
    expect(listed({
      modes: { useData: true, draw: false },
      panes: { graph: { available: false } },
      inputView: "table",
      capitalization: "asTyped",
      orderMatters: { startsOn: false, showSwitch: false },
      startingText: "the cat",
    })).toEqual([
      ["Usable mode(s)", "Data"],
      ["How students enter their data", "Table only"],
      ["Capital letters", "\"The\" and \"the\" are different words"],
      ["Start with \"Order matters\" on", "No"],
      ["Show students the \"Order matters\" switch", "No"],
      ["Starting data", "the cat (7 characters)"],
      ["Input pane", "Available"],
      ["Input pane: Open at the start", "Yes"],
      ["Graph pane", "Not available"],
      ["Inspect pane", "Available"],
      ["Inspect pane: Open at the start", "Yes"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "Yes"],
      ["Probabilities shown at the start", "No"],
      ["Show probabilities toggle", "Available"],
      ["Send to CODAP button", "Not available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("labels the Graph pane's starting state plainly with Data alone", () => {
    expect(listed({ modes: { useData: true, draw: false } })).toContainEqual(["Graph pane: Open at the start", "Yes"]);
  });

  const startingData = (startingText: string) =>
    listed({ startingText }).find(([label]) => label === "Starting data")?.[1];

  it("shortens a long starting text and counts it", () => {
    expect(startingData("a".repeat(150))).toBe(`${"a".repeat(100)}... (150 characters)`);
    expect(startingData("a".repeat(101))).toBe(`${"a".repeat(100)}... (101 characters)`);
    expect(startingData("a".repeat(100))).toBe(`${"a".repeat(100)} (100 characters)`);
    expect(startingData("a")).toBe("a (1 character)");
  });

  it("never shortens a starting text in the middle of a character", () => {
    expect(startingData(`${"a".repeat(99)}\u{1F600}${"a".repeat(10)}`)).toBe(`${"a".repeat(99)}... (111 characters)`);
  });
});
```

`src/interactive/use-frame-height.ts`:

```ts
import { useEffect, useRef } from "react";
import { setHeight } from "@concord-consortium/lara-interactive-api";

// Reports the height of the element the returned ref is on, whenever it changes, so the host sizes its frame to
// it; LARA's and the Activity Player's frames don't scroll. The library's useAutoSetHeight also measures the
// frame itself, so a frame it has grown never shrinks again.
export const useFrameHeight = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(Math.ceil(element.getBoundingClientRect().height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
};
```

The ref goes on the hosted app's root element, which wraps every mode, so it measures from the first render ("Loading...") on. Opened directly, there is no frame to size, and the hook isn't used. Measured on a throwaway page: 360 px, then 40 px after a 300 px block was hidden, then 360 px again.

`src/interactive/interactive.scss`:

```scss
// the host sizes its frame to the reported height, so a body margin would be cut off
body {
  margin: 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.42857143;
  color: #333;
}

.markov-interactive {
  // keeps the children's margins inside the measured height
  display: flow-root;
}

.runtime-placeholder {
  padding: 10px;

  h2 {
    margin: 0 0 10px;
    font-size: 18px;
    font-weight: normal;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 12px;
    margin: 0;
  }

  dt {
    font-weight: bold;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
}

// what the interactive and its report item say when opened outside a host
.standalone-note {
  margin: 0 0 10px;
  color: #737373;

  .markov-interactive > & {
    margin: 10px;
  }
}
```

`display: flow-root` keeps the children's margins inside the root element, so the measured height includes them; the body's margin is 0 for the same reason (an 8 px body margin left the page 16 px taller than the frame, measured). The report item's standalone note sits directly in the root element, with no placeholder padding around it, so it takes its own margin.

`src/interactive/standalone.test.tsx` (this step's version; the report item step adds a test):

```tsx
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { App } from "./app";

// the value the placeholder lists beside a setting's label
const listed = (label: string) =>
  screen.getAllByRole("definition")[screen.getAllByRole("term").findIndex(term => term.textContent === label)];

// jsdom's window is its own top window, as a page opened directly is, so these run outside any host. The library
// warns when it makes its client outside a frame, and makes one client per page, so a test checks for the warning
// before anything else in the file could have made the client.
describe("opened outside a host", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("the interactive runs with the default settings, and leaves the library alone", () => {
    jest.useFakeTimers();
    render(<App />);
    expect(screen.getByText("Markov interactive: coming soon")).toBeInTheDocument();
    expect(screen.getByText(/the settings come from this page's link, and nothing is saved/)).toBeInTheDocument();
    expect(listed("Usable mode(s)")).toHaveTextContent(/^Both/);

    // past the library's 2 second wait before it sends an interactive state
    act(() => { jest.advanceTimersByTime(3000); });
    expect(warn).not.toHaveBeenCalled();
  });

  it("the interactive takes its settings from its link", () => {
    window.history.replaceState(null, "", "/interactive.html?modes.draw=false&inputView=table");
    render(<App />);
    expect(listed("Usable mode(s)")).toHaveTextContent(/^Data$/);
    expect(listed("How students enter their data")).toHaveTextContent(/^Table only$/);
  });
});
```

The test renders the real `App` with the real library: jsdom's window is its own top, so `inIframe()` is false, as it is for a page opened directly. A client made at the top level sends nothing, since iframe-phone never says hello without a parent (`iframe-endpoint.js:101`), so the library's warning is how the test sees that nothing made one. The warning comes once per page, so the check is in the same test as the file's first render. Each of these fails a test (measured): `App` always rendering the hosted view (it finds "Loading..."), the runtime saving when standalone, the standalone view calling `setSupportedFeatures`, and the standalone view ignoring its URL. The link test sets the page's URL with `history.replaceState`, which jsdom allows within its origin, and puts it back.

`src/interactive/url-settings.ts`:

```ts
import { defaultAuthoredState, isRecord, MarkovAuthoredState, readAuthoredState } from "./authored-state";

// The settings in a standalone interactive's link: one parameter per setting, named by its path in the authored
// state, such as ?panes.inspect.available=false&startingText=the+cat. The settings and their types come from
// defaultAuthoredState, and readAuthoredState checks the values as it checks a saved state, so a bad, unknown or
// missing value reads as its default.

// a link longer than this may be cut short by the sites and programs it is pasted into
export const longLinkLength = 2000;

type Leaf = [string[], unknown];

const leaves = (value: unknown, path: string[] = []): Leaf[] =>
  isRecord(value)
    ? Object.entries(value).reduce<Leaf[]>((all, [key, child]) => all.concat(leaves(child, [...path, key])), [])
    : [[path, value]];

// every setting's path and default; the version is the format's, not a setting
export const urlSettings = leaves(defaultAuthoredState).filter(([path]) => path.join(".") !== "version");

const valueAt = (state: unknown, path: string[]) =>
  path.reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, state);

const setAt = (state: Record<string, unknown>, path: string[], value: unknown) => {
  const parent = path.slice(0, -1).reduce<Record<string, unknown>>((record, key) => {
    record[key] = isRecord(record[key]) ? record[key] : {};
    return record[key] as Record<string, unknown>;
  }, state);
  parent[path[path.length - 1]] = value;
};

// a true or false setting is "true" or "false" in a link; any other text is left for the reader to reject
const fromText = (text: string, fallback: unknown) =>
  typeof fallback === "boolean" && (text === "true" || text === "false") ? text === "true" : text;

export const authoredStateFromSearch = (search: string): MarkovAuthoredState => {
  const params = new URLSearchParams(search);
  const state: Record<string, unknown> = {};
  urlSettings.forEach(([path, fallback]) => {
    const text = params.get(path.join("."));
    if (text !== null) {
      setAt(state, path, fromText(text, fallback));
    }
  });
  return readAuthoredState(state);
};

// the settings that differ from the defaults, as a link's query string, or "" when none do
export const searchFromAuthoredState = (state: MarkovAuthoredState) => {
  const params = new URLSearchParams();
  urlSettings.forEach(([path, fallback]) => {
    const value = valueAt(state, path);
    if (value !== fallback) {
      params.set(path.join("."), String(value));
    }
  });
  const search = params.toString();
  return search ? `?${search}` : "";
};
```

- **The settings are the defaults' leaves.** `urlSettings` walks `defaultAuthoredState`, so the parameter names are the authored state's own paths and need no list of their own. `version` is left out: it is the format's, not a setting.
- **Types come from the defaults, not the values:** a `true` or `false` setting takes `"true"` or `"false"`, and anything else is passed on as text for `readAuthoredState` to reject, so `?modes.draw=no` reads as the default, as `{ modes: { draw: "no" } }` does in a saved state. A text setting takes the text as it is.
- **`readAuthoredState` finishes the job,** so every rule R10 has for a saved state, including the mode and starting-mode corrections, holds for a link. A parameter that names no setting is never read.
- **Building a link** compares each setting with its default and writes the ones that differ, in the defaults' order, with `URLSearchParams`, which encodes spaces as `+` and everything else that needs it.
- `isRecord` is `authored-state.ts`'s, exported for this.

`src/interactive/url-settings.test.ts`:

```ts
import { defaultAuthoredState, MarkovAuthoredState, readAuthoredState } from "./authored-state";
import { authoredStateFromSearch, searchFromAuthoredState, urlSettings } from "./url-settings";

const customState: MarkovAuthoredState = {
  ...defaultAuthoredState,
  modes: { useData: true, draw: false },
  panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } },
  buttons: {
    probabilities: { available: true, startsOn: true },
    sendToCodap: { available: true },
    downloadTables: { available: true },
  },
  inputView: "table",
  capitalization: "asTyped",
  orderMatters: { startsOn: false, showSwitch: false },
  startingText: "the cat & the hat = 2?\nYes: 100% \"sure\"",
};

describe("settings in a link", () => {
  it("covers every setting by its path, each one true or false, or text", () => {
    expect(urlSettings.map(([path, fallback]) => [path.join("."), typeof fallback])).toEqual([
      ["modes.useData", "boolean"],
      ["modes.draw", "boolean"],
      ["startingMode", "string"],
      ["panes.input.available", "boolean"],
      ["panes.input.startsOpen", "boolean"],
      ["panes.graph.available", "boolean"],
      ["panes.graph.startsOpen", "boolean"],
      ["panes.inspect.available", "boolean"],
      ["panes.inspect.startsOpen", "boolean"],
      ["panes.generator.available", "boolean"],
      ["panes.generator.startsOpen", "boolean"],
      ["buttons.probabilities.available", "boolean"],
      ["buttons.probabilities.startsOn", "boolean"],
      ["buttons.sendToCodap.available", "boolean"],
      ["buttons.downloadTables.available", "boolean"],
      ["inputView", "string"],
      ["capitalization", "string"],
      ["orderMatters.startsOn", "boolean"],
      ["orderMatters.showSwitch", "boolean"],
      ["startingText", "string"],
    ]);
  });

  it("reads each setting it is given, and the default for the rest", () => {
    const search = "?modes.draw=false&panes.inspect.available=false&buttons.probabilities.startsOn=true" +
      "&orderMatters.showSwitch=false&inputView=table&startingText=the+cat+sat";
    expect(authoredStateFromSearch(search)).toEqual({
      ...defaultAuthoredState,
      modes: { useData: true, draw: false },
      panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } },
      buttons: { ...defaultAuthoredState.buttons, probabilities: { available: true, startsOn: true } },
      inputView: "table",
      orderMatters: { startsOn: true, showSwitch: false },
      startingText: "the cat sat",
    });
  });

  it.each([
    ["true or false as other text", "?modes.draw=no&panes.inspect.available=FALSE&buttons.probabilities.startsOn=yes"],
    ["a choice that isn't one", "?inputView=sideways&startingMode=fly"],
    ["an unknown setting", "?panes.zoom.available=false&buttons.sendToCodap.startsOn=true&width=960"],
    ["no mode", "?modes.useData=false&modes.draw=false"],
    ["nothing", ""],
  ])("reads %s as the defaults", (_, search) => {
    expect(authoredStateFromSearch(search)).toEqual(readAuthoredState({}));
  });

  it("puts only the settings that differ from the defaults in a link", () => {
    expect(searchFromAuthoredState(defaultAuthoredState)).toBe("");
    expect(searchFromAuthoredState({ ...defaultAuthoredState, inputView: "text" })).toBe("?inputView=text");
  });

  it("reads back the settings it puts in a link", () => {
    expect(authoredStateFromSearch(searchFromAuthoredState(customState))).toEqual(customState);
  });
});
```

The path list is written out, so a setting added later has to be added here, with its type. Each of these fails a test (measured): a link holding every setting, the reader skipping `readAuthoredState`, any text but `"false"` reading as true (the `startsOn=yes` case, whose default is false), `version` read as a setting, and every value read as text.


**Check R2 at this commit**: build both kinds of production `dist/` and compare with the base's:

```bash
npm run build:webpack && diff -rq /tmp/mark13-base dist
DEPLOY_PATH=branch/x/ npx webpack --mode production && diff -rq /tmp/mark13-base-top dist
```

Each `diff` lists only the new files (`interactive.html` and the `assets/interactive.*` files) and one changed file, the plugin's `assets/index.<hash>.js.map`. Confirm the map differs only in its `file` field:

```bash
npm run build:webpack
node -e '
const fs = require("fs");
const [a, b] = process.argv.slice(1).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
console.log(Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])));
' /tmp/mark13-base/assets/index.*.js.map dist/assets/index.*.js.map
```

It prints `[ 'file' ]` (measured; the requirements' Technical Notes say why). `require` can't read the map: Node loads a `.map` file as JavaScript.

**Commit**: `feat: add the Markov Interactive's page with a placeholder runtime [MARK-13]`

---

### Add the fake Activity Player page and the runtime's Cypress tests

**Summary**: R21's runtime tests, including that a host's authored state wins over settings in the interactive's URL (R14), on a dev-only page that starts the interactive in a mode with given states and keeps every message it sends. It sits beside MARK-11's fake-CODAP page, built and served the same way, and uses MARK-11's Cypress configuration, its frame-error check and its CI job.

**Files affected**:
- `webpack.config.js`: the `fake-ap` entry and page, development only.
- `src/interactive/host-messages.ts`: new, the init message a host sends, shared with the demo page.
- `cypress/fake-ap/index.html`, `cypress/fake-ap/fake-ap.ts`: new.
- `cypress/support/fake-ap.d.ts`, `cypress/support/fake-ap-commands.ts`: new.
- `cypress/support/e2e.js`: import the commands; check the interactive's frame for errors too.
- `cypress.config.ts`: the `modifyObstructiveCode` comment names the interactive's reason too.
- `cypress/e2e/interactive-runtime.test.ts`: new.

**Estimated diff size**: 275 lines (+271, -4), measured.

`webpack.config.js`:

```diff
       interactive: './src/interactive/index.tsx',
-      // the Cypress tests' fake CODAP page is served by the dev server only, never deployed
-      ...(devMode ? { 'fake-codap': './cypress/fake-codap/fake-codap.ts' } : {}),
+      // the Cypress tests' fake CODAP and Activity Player pages are served by the dev server only, never deployed
+      ...(devMode ? {
+        'fake-codap': './cypress/fake-codap/fake-codap.ts',
+        'fake-ap': './cypress/fake-ap/fake-ap.ts',
+      } : {}),
     },
```

```diff
       ...(devMode ? [new HtmlWebpackPlugin({
         filename: 'fake-codap.html',
         template: 'cypress/fake-codap/index.html',
         chunks: ['fake-codap'],
         publicPath: '.',
-      })] : []),
+      }), new HtmlWebpackPlugin({
+        filename: 'fake-ap.html',
+        template: 'cypress/fake-ap/index.html',
+        chunks: ['fake-ap'],
+        publicPath: '.',
+      })] : []),
```

`cypress/fake-ap/index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Fake Activity Player</title>
    <style>
      body { margin: 0; }
      iframe { border: 0; display: block; }
    </style>
  </head>
  <body></body>
</html>
```

`src/interactive/host-messages.ts`:

```ts
// The initInteractive message a host sends to start the interactive in authoring or runtime mode, as LARA and the
// Activity Player send it. The demo page and the Cypress tests' fake Activity Player page both start it this way.
export type HostedMode = "authoring" | "runtime";

export const initInteractiveMessage = (mode: HostedMode, authoredState: unknown, interactiveState: unknown) => ({
  version: 1,
  mode,
  authoredState: authoredState ?? null,
  interactiveState: interactiveState ?? null,
  hostFeatures: {},
});
```

`cypress/fake-ap/fake-ap.ts`:

```ts
// A stand-in for LARA and the Activity Player that the Cypress tests load the Markov Interactive into. It starts
// the interactive in a mode with an authored and interactive state, as LARA's authoring dialog, the Activity
// Player and the class dashboard do, and keeps every message the interactive sends. The development server
// serves it as fake-ap.html; production builds leave it out.
import { ParentEndpoint } from "iframe-phone";
import { initInteractiveMessage } from "../../src/interactive/host-messages";

export type InteractiveMode = "authoring" | "runtime" | "reportItem";

export type StartOptions = {
  mode: InteractiveMode;
  authoredState?: unknown;
  interactiveState?: unknown;
  // LARA's authoring column is about 435px wide
  width?: number;
  // a query string on the interactive's URL, as an author could paste a standalone link into LARA
  search?: string;
};

export type InteractiveMessage = { type: string, content: unknown };

export type ItemsType = "fullAnswer" | "compactAnswer";

// the messages the interactive and the report item send that the tests read
const messageTypes = [
  "supportedFeatures", "authoredState", "interactiveState", "height", "reportItemClientReady", "reportItemAnswer"
];

let options: StartOptions = { mode: "runtime" };
let iframe: HTMLIFrameElement | undefined;
let phone: ParentEndpoint | undefined;
let awaitingAnswer: ((answer: any) => void) | undefined;
const messages: InteractiveMessage[] = [];
const errors: string[] = [];

const initMessage = () => options.mode === "reportItem"
  ? { version: 1, mode: "reportItem", hostFeatures: {}, interactiveItemId: "interactive_1", view: "singleAnswer",
    users: { student1: { hasAnswer: true } } }
  : initInteractiveMessage(options.mode, options.authoredState, options.interactiveState);

const start = (startOptions: StartOptions) => {
  phone?.disconnect();
  iframe?.remove();
  options = startOptions;
  messages.length = 0;

  iframe = document.createElement("iframe");
  iframe.id = "interactive";
  iframe.width = String(startOptions.width ?? 435);
  const page = startOptions.mode === "reportItem" ? "report-item.html" : "interactive.html";
  iframe.src = page + (startOptions.search ?? "");
  document.body.appendChild(iframe);
  // Cypress fails a test only on errors in its own window, so errors in the interactive's frame are kept for the
  // tests. The frame's first window is reused when it loads the same-origin page, so these see its startup too.
  const interactiveWindow = iframe.contentWindow;
  interactiveWindow?.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
  interactiveWindow?.addEventListener("unhandledrejection", event => errors.push(String(event.reason)));

  const endpoint = new ParentEndpoint(iframe, window.location.origin,
    () => endpoint.post("initInteractive", initMessage()));
  phone = endpoint;
  messageTypes.forEach(type => endpoint.addListener(type, (content: unknown) => {
    messages.push({ type, content });
    // the host sizes the frame to the interactive's height, as LARA and the Activity Player do
    if (type === "height") {
      iframe?.setAttribute("height", String(content));
    }
    if (type === "reportItemAnswer") {
      awaitingAnswer?.(content);
      awaitingAnswer = undefined;
    }
  }));
};

// asks the report item for a student's answer, as the class dashboard does, and resolves with the answer
const requestReportItemAnswer = (itemsType: ItemsType) => new Promise<any>(resolve => {
  awaitingAnswer = resolve;
  // the dashboard sends no requestId, and the library's listener answers only a request without one
  phone?.post("getReportItemAnswer", {
    version: "2.1.0", platformUserId: "student1", itemsType,
    interactiveState: options.interactiveState ?? null, authoredState: options.authoredState ?? null
  });
});

const fakeAp = {
  messages,
  errors,
  start,
  requestReportItemAnswer,
};

export type FakeAp = typeof fakeAp;

(window as any).fakeAp = fakeAp;
```

- **Protocol:** `ParentEndpoint` answers the interactive's `hello` and posts `initInteractive` once connected, as LARA and the Activity Player do. The init messages follow the library's types: `mode`, `authoredState` and `interactiveState` for authoring and runtime; for a report item, `mode: "reportItem"`, `view` and `users`, as portal-report's report-item frame sends them.
- **Messages:** every message of the listed types is kept in `messages`, in order. `height` also resizes the frame, so a test can compare the frame with the page it holds.
- **Report item requests:** `getReportItemAnswer` goes without a `requestId`, as portal-report sends it; the library only answers listeners whose `requestId` matches, so a request with one is never answered (measured). The promise resolves with the next `reportItemAnswer`.
- **Width:** 435 px by default, LARA's authoring column (requirements, Technical Notes); runtime tests pass 600.
- **Search:** a query string for the interactive's URL, as an author might paste a standalone link into LARA, so a test can check the hosted interactive ignores it.
- **Errors:** kept as MARK-11's page keeps the plugin's, for the same `afterEach`, with the same two choices (MARK-11's closed spec, "What the tests need to know about the browser"): the listeners go on the frame's first window as soon as the frame is added, since a listener added on `load` misses errors while the interactive starts, and starting the interactive again keeps the errors already recorded, so an error before a restart still fails the test. Measured: an `error` event dispatched while the interactive's script runs fails the runtime tests with the listeners added with the frame, and all 7 pass with them added on `load`. No test starts the interactive twice, so keeping errors across a restart is there to match MARK-11's page, not checked by a test.
- **The frame's id:** `interactive`, and the commands find the frame by it, as MARK-11's `cy.plugin()` finds `iframe#plugin`: the dev server's error overlay is another iframe on the page.

`cypress/support/fake-ap.d.ts`:

```ts
import type { FakeAp, ItemsType, StartOptions } from "../fake-ap/fake-ap";

declare global {
  namespace Cypress {
    interface Chainable {
      /** Opens the fake Activity Player page and starts the Markov Interactive in it, in the mode given. */
      startInteractive(options: StartOptions): Chainable<void>;
      /** Yields the interactive's document body, to find elements in the interactive. */
      interactive(): Chainable<JQuery<HTMLElement>>;
      /** Yields the fake Activity Player page's API, including the messages the interactive has sent. */
      fakeAp(): Chainable<FakeAp>;
      /** Yields the content of every message of this type the interactive has sent, oldest first, retrying. */
      interactiveMessages(type: string, options?: Partial<Timeoutable>): Chainable<unknown[]>;
      /** Waits until the host's frame is as tall as the interactive's content, as its height messages ask. */
      frameFitsInteractive(): Chainable<void>;
      /** Asks the report item for the student's answer, as the class dashboard does, and yields the answer. */
      requestReportItemAnswer(itemsType: ItemsType): Chainable<any>;
    }
  }
}
```

A file of its own, so MARK-11's `index.d.ts` is untouched; the two `Chainable` declarations merge. `@typescript-eslint/no-namespace` allows the `namespace Cypress` declaration only in a `.d.ts` file, as MARK-11 found.

`cypress/support/fake-ap-commands.ts`:

```ts
import type { FakeAp, InteractiveMessage, ItemsType, StartOptions } from "../fake-ap/fake-ap";

Cypress.Commands.add("fakeAp", () => cy.window().its("fakeAp") as Cypress.Chainable<FakeAp>);

Cypress.Commands.add("startInteractive", (options: StartOptions) => {
  cy.visit("/fake-ap.html");
  cy.fakeAp().then(fake => fake.start(options));
});

Cypress.Commands.add("interactive", () =>
  cy.get("iframe#interactive").its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body)));

// its() and invoke() are queries, so a should() after this retries until the messages it expects arrive
Cypress.Commands.add("interactiveMessages", (type: string, options?: Partial<Cypress.Timeoutable>) =>
  cy.fakeAp().its("messages", options)
    .invoke("filter", (message: InteractiveMessage) => message.type === type)
    .invoke("map", (message: InteractiveMessage) => message.content));

// the root element's own height, which, unlike the page's scrollHeight, doesn't grow with the frame; both are read
// again on each retry, since the form can still be settling when the check starts
Cypress.Commands.add("frameFitsInteractive", () => {
  cy.get<HTMLIFrameElement>("iframe#interactive").should(frame => {
    const root = frame[0].contentDocument?.querySelector(".markov-interactive");
    expect(root, "the interactive's root element").not.to.equal(null);
    expect(frame.height()).to.equal(Math.ceil(root?.getBoundingClientRect().height ?? 0));
  });
});

// then() waits for the page's promise, which resolves with the report item's answer
Cypress.Commands.add("requestReportItemAnswer", (itemsType: ItemsType) =>
  cy.fakeAp().then(fake => fake.requestReportItemAnswer(itemsType)));
```

`interactiveMessages` is built from `its` and `invoke`, which are queries, so a `should` after it re-reads the messages until they match; a `then` would read them once. Measured: the runtime's interactive state arrives 2 seconds after the page loads, and the "saves a version" tests wait for it with no fixed wait. `frameFitsInteractive` compares the frame with the root element's own height rather than the page's `scrollHeight`, which is never less than the frame's height and so would match a frame that had grown too tall. It reads both on every retry: read once, the root's height went stale while the form settled, and the check failed 2 runs in 7 (measured).

`cypress/support/e2e.js`:

```diff
 import "@cypress/code-coverage/support";
 import "./commands";
+import "./fake-ap-commands";
 
-// errors thrown in the plugin's frame don't reach Cypress, so each test checks the ones the fake CODAP page kept
+// errors thrown in a frame don't reach Cypress, so each test checks the ones the fake CODAP or Activity Player
+// page kept
 afterEach(() => {
   cy.window().then(win => {
     if (win.fakeCodap) {
       expect(win.fakeCodap.errors, "errors in the plugin").to.deep.equal([]);
     }
+    if (win.fakeAp) {
+      expect(win.fakeAp.errors, "errors in the interactive").to.deep.equal([]);
+    }
   });
 });
```

`cypress.config.ts`:

```diff
   // Cypress rewrites "framebusting" checks such as window.parent === window, which iframe-phone uses
-  // to find CODAP, so the plugin would never connect to the fake CODAP page
+  // to find CODAP, so the plugin would never connect to the fake CODAP page, and window.self !== window.top,
+  // which the Markov Interactive uses to tell a host from a page opened directly, so it would run standalone
+  // in the fake Activity Player page
   modifyObstructiveCode: false,
```

The setting is MARK-11's, for the plugin; the interactive's tests depend on it as much (measured: with Cypress's default, 5 of the 7 runtime tests fail), so its comment says so for whoever next considers changing it.

`cypress/e2e/interactive-runtime.test.ts`:

```ts
import { defaultAuthoredState, MarkovAuthoredState } from "../../src/interactive/authored-state";

const listedSettings = () => cy.interactive().find(".runtime-placeholder dl").then(list =>
  [...list.find("dt")].map((term, i) => [term.textContent, list.find("dd")[i].textContent]));

describe("the interactive's placeholder runtime", () => {
  it("lists every authored setting with its value", () => {
    const authoredState: MarkovAuthoredState = {
      ...defaultAuthoredState,
      modes: { useData: true, draw: false },
      panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } },
      buttons: {
        probabilities: { available: true, startsOn: true }, sendToCodap: { available: true },
        downloadTables: { available: false }
      },
      inputView: "text",
      capitalization: "asTyped",
      orderMatters: { startsOn: false, showSwitch: false },
      startingText: "the cat sat",
    };
    cy.startInteractive({ mode: "runtime", authoredState, width: 600 });
    cy.interactive().should("contain.text", "Markov interactive: coming soon");
    listedSettings().should("deep.equal", [
      ["Usable mode(s)", "Data"],
      ["How students enter their data", "Text only"],
      ["Capital letters", "\"The\" and \"the\" are different words"],
      ["Start with \"Order matters\" on", "No"],
      ["Show students the \"Order matters\" switch", "No"],
      ["Starting data", "the cat sat (11 characters)"],
      ["Input pane", "Available"],
      ["Input pane: Open at the start", "Yes"],
      ["Graph pane", "Available"],
      ["Graph pane: Open at the start", "Yes"],
      ["Inspect pane", "Not available"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "Yes"],
      ["Probabilities shown at the start", "Yes"],
      ["Show probabilities toggle", "Available"],
      ["Send to CODAP button", "Available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("ignores settings in its link, taking only the authored state", () => {
    cy.startInteractive({
      mode: "runtime", width: 600,
      authoredState: { modes: { useData: true, draw: false }, panes: { inspect: { available: false } } },
      search: "?modes.draw=true&panes.inspect.available=true&inputView=table",
    });
    listedSettings().should("deep.include", ["Usable mode(s)", "Data"])
      .and("deep.include", ["Inspect pane", "Not available"])
      .and("deep.include", ["How students enter their data", "Linked table and text"]);
  });

  it("lists the defaults for an interactive never authored", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {} });
    listedSettings().its(0).should("deep.equal", ["Usable mode(s)", "Both (with a toggle switch for students)"]);
  });

  [["no interactive state", undefined], ["{}", {}]].forEach(([name, interactiveState]) => {
    it(`saves a version when it opens with ${name}`, () => {
      cy.startInteractive({ mode: "runtime", authoredState: {}, interactiveState });
      // the library sends interactive state after a 2 second pause
      cy.interactiveMessages("interactiveState", { timeout: 5000 }).should(states => {
        expect(states).to.deep.equal([{ version: 1 }]);
      });
    });
  });

  it("leaves an existing interactive state alone", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, interactiveState: { version: 1 } });
    cy.interactive().should("contain.text", "coming soon");
    cy.wait(2500);
    cy.interactiveMessages("interactiveState").should("have.length", 0);
  });

  it("sizes its frame to the placeholder", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, width: 600 });
    cy.interactive().find(".runtime-placeholder dl");
    cy.frameFitsInteractive();
    // taller than a frame's default 150px, so a frame that never resized would fail
    cy.get("iframe#interactive").invoke("height").should("be.greaterThan", 150);
  });
});
```

The URL test gives three settings that differ from the authored state, two of them set in it and one left at its default; with the hosted runtime reading its URL, it fails (measured). The "leaves an existing interactive state alone" test waits 2.5 seconds, past the library's 2-second send delay, since it checks that something does not happen. It is the runtime tests' only fixed wait.

**Commit**: `test: add a fake Activity Player page and the runtime's Cypress tests [MARK-13]`

---

### Add the authoring form

**Summary**: R11, and R21's authoring tests. The form for every setting, laid out to LARA's column with question-interactives' conventions, saving each change with `setAuthoredState`, and leaving off the page any setting that doesn't apply.

**Files affected**:
- `src/interactive/authoring.tsx`, `src/interactive/authoring.scss`: new.
- `src/interactive/app.tsx`: the `authoring` case.
- `cypress/e2e/interactive-authoring.test.ts`: new.

**Estimated diff size**: 532 lines (+532), measured.

`src/interactive/authoring.tsx`:

```tsx
import React, { useState } from "react";
import { setAuthoredState } from "@concord-consortium/lara-interactive-api";
import {
  buttonLabels, Capitalization, capitalizationLabels, capitalizations, InputView, inputViewHelp, inputViewLabels,
  inputViews, MarkovAuthoredState, maxStartingTextLength, ModeId, modeIds, modeLabels, modesFor, PaneId, paneIds,
  paneLabels, settingLabels, startsOpenLabel, UsableModes, usableModesChoices, usableModesHelp, usableModesLabels,
  usableModesOf
} from "./authored-state";

import "./authoring.scss";

// the starting text shows how many characters are left once fewer than this are
const showRemainingBelow = 1000;

// the starting mode's choices, in the order the usable modes list them
const startingModeChoices: readonly ModeId[] = ["draw", "useData"];

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  // the accessible name, when the visible label alone doesn't say which setting it is
  ariaLabel?: string;
  helpId?: string;
  onChange: (checked: boolean) => void;
}

const Checkbox = ({ id, label, checked, disabled, ariaLabel, helpId, onChange }: CheckboxProps) => (
  <div className="checkbox">
    <label htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} aria-label={ariaLabel}
        aria-describedby={helpId} onChange={e => onChange(e.target.checked)} />
      { label }
    </label>
  </div>
);

interface SelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  choices: readonly T[];
  labels: Record<T, string>;
  helpId?: string;
  onChange: (value: T) => void;
}

const Select = <T extends string>({ id, label, value, choices, labels, helpId, onChange }: SelectProps<T>) => (
  <div className="form-group">
    <label htmlFor={id}>{ label }</label>
    <select id={id} value={value} aria-describedby={helpId} onChange={e => onChange(e.target.value as T)}>
      { choices.map(choice => <option key={choice} value={choice}>{ labels[choice] }</option>) }
    </select>
  </div>
);

interface Props {
  // the authored state LARA started the form with, already read with readAuthoredState
  initialState: MarkovAuthoredState;
}

// Settings whose dependency is off are left off the page but keep their values, so they return as they were.
export const Authoring = ({ initialState }: Props) => {
  const [state, setState] = useState(initialState);

  // every change is sent to LARA at once; LARA stores it when the author clicks Save
  const update = (change: (current: MarkovAuthoredState) => MarkovAuthoredState) => {
    const next = change(state);
    setState(next);
    setAuthoredState(next);
  };

  const setUsableModes = (usable: UsableModes) => update(current => {
    const modes = modesFor(usable);
    const startingMode = modes[current.startingMode] ? current.startingMode : modeIds.find(m => modes[m]) ?? "useData";
    // students draw on the graph, so Draw makes the Graph pane available
    const panes = modes.draw ? { ...current.panes, graph: { ...current.panes.graph, available: true } } : current.panes;
    return { ...current, modes, startingMode, panes };
  });
  const setPane = (id: PaneId, change: Partial<MarkovAuthoredState["panes"][PaneId]>) =>
    update(current => ({ ...current, panes: { ...current.panes, [id]: { ...current.panes[id], ...change } } }));
  const setProbabilities = (change: Partial<MarkovAuthoredState["buttons"]["probabilities"]>) =>
    update(current => ({
      ...current, buttons: { ...current.buttons, probabilities: { ...current.buttons.probabilities, ...change } }
    }));
  const setButton = (id: "sendToCodap" | "downloadTables", available: boolean) =>
    update(current => ({ ...current, buttons: { ...current.buttons, [id]: { available } } }));
  const setOrderMatters = (change: Partial<MarkovAuthoredState["orderMatters"]>) =>
    update(current => ({ ...current, orderMatters: { ...current.orderMatters, ...change } }));

  const { useData, draw } = state.modes;
  const remaining = Math.max(maxStartingTextLength - state.startingText.length, 0);

  const useDataSettings = (
    <fieldset>
      <legend>{ settingLabels.useData }</legend>
      <Select<InputView> id="inputView" label={settingLabels.inputView} value={state.inputView}
        choices={inputViews} labels={inputViewLabels} helpId="input-view-help"
        onChange={inputView => update(current => ({ ...current, inputView }))} />
      <p id="input-view-help" className="help after-select">{ inputViewHelp[state.inputView] }</p>
      <Select<Capitalization> id="capitalization" label={settingLabels.capitalization} value={state.capitalization}
        choices={capitalizations} labels={capitalizationLabels}
        onChange={capitalization => update(current => ({ ...current, capitalization }))} />
      <fieldset className="form-group">
        <legend className="field-legend">{ settingLabels.ordering }</legend>
        <Checkbox id="orderMattersStartsOn" label={settingLabels.orderMattersStartsOn}
          checked={state.orderMatters.startsOn} helpId="order-matters-help"
          onChange={startsOn => setOrderMatters({ startsOn })} />
        <Checkbox id="orderMattersShowSwitch" label={settingLabels.orderMattersShowSwitch}
          checked={state.orderMatters.showSwitch} helpId="order-matters-help"
          onChange={showSwitch => setOrderMatters({ showSwitch })} />
        <p id="order-matters-help" className="help">
          With &quot;Order matters&quot; on, the next word depends on the word before it (a Markov chain). With it off,
          the next word is picked at random, with words that appear more often more likely to be picked (a weighted bag
          of words).
        </p>
      </fieldset>
      <div className="form-group">
        <label htmlFor="startingText">{ settingLabels.startingText }</label>
        <textarea id="startingText" rows={8} maxLength={maxStartingTextLength} value={state.startingText}
          aria-describedby="starting-text-help"
          onChange={e => {
            const startingText = e.target.value;
            update(current => ({ ...current, startingText }));
          }} />
        <p id="starting-text-help" className="help">
          Leave it empty if students will generate their own data.
          { remaining < showRemainingBelow && ` ${remaining} ${remaining === 1 ? "character" : "characters"} left.` }
        </p>
      </div>
    </fieldset>
  );

  const pane = (id: PaneId) => {
    const { available, startsOpen } = state.panes[id];
    // Draw mode always opens its graph, so the Graph pane's starting state only matters with Data mode
    const showStartsOpen = available && (id !== "graph" || useData);
    const label = startsOpenLabel(id, state.modes);
    return (
      <div key={id}>
        <Checkbox id={`pane-${id}`} label={paneLabels[id]} checked={available}
          disabled={id === "graph" && draw} helpId={id === "graph" && draw ? "graph-help" : undefined}
          onChange={checked => setPane(id, { available: checked })} />
        { id === "graph" && draw &&
          <p id="graph-help" className="help">
            Draw mode needs the Graph pane. Choose Data alone to make it optional.
          </p> }
        { showStartsOpen &&
          <div className="dependent">
            <Checkbox id={`pane-${id}-startsOpen`} label={label} checked={startsOpen}
              ariaLabel={`${paneLabels[id]} ${label.toLowerCase()}`}
              onChange={checked => setPane(id, { startsOpen: checked })} />
          </div> }
      </div>
    );
  };

  return (
    <form className="authoring" onSubmit={e => e.preventDefault()}>
      <fieldset>
        <legend>{ settingLabels.modes }</legend>
        <Select<UsableModes> id="usableModes" label={settingLabels.usableModes} value={usableModesOf(state.modes)}
          choices={usableModesChoices} labels={usableModesLabels} helpId="modes-help" onChange={setUsableModes} />
        <p id="modes-help" className="help after-select">{ usableModesHelp[usableModesOf(state.modes)] }</p>
        { useData && draw &&
          <Select id="startingMode" label={settingLabels.startingMode} value={state.startingMode}
            choices={startingModeChoices} labels={modeLabels}
            onChange={startingMode => update(current => ({ ...current, startingMode }))} /> }
      </fieldset>

      { useData && useDataSettings }

      <fieldset>
        <legend>{ settingLabels.whatStudentsSee }</legend>
        { paneIds.filter(id => id !== "input" || useData).map(pane) }
        <Checkbox id="button-probabilities-startsOn" label={settingLabels.probabilitiesStartsOn}
          checked={state.buttons.probabilities.startsOn ?? false} helpId="probabilities-help"
          onChange={startsOn => setProbabilities({ startsOn })} />
        <Checkbox id="button-probabilities" label={buttonLabels.probabilities}
          checked={state.buttons.probabilities.available} helpId="probabilities-help"
          onChange={available => setProbabilities({ available })} />
        <p id="probabilities-help" className="help">
          Without the toggle, probabilities stay shown or hidden as set here.
        </p>
        <fieldset className="form-group">
          <legend className="field-legend">{ settingLabels.sendDataButtons }</legend>
          <Checkbox id="button-sendToCodap" label={buttonLabels.sendToCodap}
            checked={state.buttons.sendToCodap.available} helpId="send-to-codap-help"
            onChange={available => setButton("sendToCodap", available)} />
          <p id="send-to-codap-help" className="help">
            Requires a linked CODAP interactive with the Datalog plugin on the page to work.
          </p>
          <Checkbox id="button-downloadTables" label={buttonLabels.downloadTables}
            checked={state.buttons.downloadTables.available}
            onChange={available => setButton("downloadTables", available)} />
        </fieldset>
      </fieldset>
    </form>
  );
};
```

- **State:** the form keeps the state it was started with in React state and sends each new state with the library's `setAuthoredState`, which posts at once (no debounce). The library's `useAuthoredState` hook is not used: it returns `null` on its first render, which would show the defaults for a moment and, for an author quick enough, save a change on top of them.
- **Sections (R11):** Modes, Data settings and What students can see, in Rebecca's order. The usable modes and the starting mode list Draw before Data, as she wrote them; `modeIds` keeps Data first everywhere else, the runtime's list included. Ordering is a `fieldset` inside Data settings, whose `legend` (`field-legend`) is sized like a field's label.
- **Constraints (R11):** the usable modes can't leave students without a mode; while Draw is on, the Graph pane's checkbox is disabled, with `#graph-help` saying why; choosing a set with Draw makes the Graph pane available, and choosing one without the starting mode moves it to the mode left, so the form never sends a state R10 would correct.
- **Hiding (R11):** the Data settings section, the Input pane's row, the starting mode, a pane's "Open at the start" are rendered only while what they depend on is on. Their values stay in the state, so they come back as they were. A help text that is left off is never named in an `aria-describedby`, since a screen reader reads a description even when it is hidden.
- **Probabilities:** the starting state and the toggle are two checkboxes side by side, in that order, with one help text, as R6 has them; the starting state is never hidden.
- **Send data buttons** is a `fieldset` inside What students can see, like Ordering. Send to CODAP's note (`#send-to-codap-help`) is always shown and always tied to its checkbox; `setButton` sets the two buttons that are only available or not.
- **Help under a select** (`after-select`) pulls up into the gap the select's field group leaves, so it sits 5 px under the select like the others.
- **The starting text:** the textarea's `maxLength` stops typing and pasting at 20,000 characters; the help text adds "N characters left" under 1,000.
- **Accessibility (R11):** each checkbox is inside its `label`, each select and the textarea has a `label` with `htmlFor`, and help texts are tied with `aria-describedby`. The repeated "Open at the start" checkboxes get an `aria-label` naming their pane ("Inspect pane open at the start"), which contains the visible text, as WCAG's "label in name" asks; every other label names its setting on its own. The order in the DOM is the order shown.

`src/interactive/authoring.scss`:

```scss
// laid out to LARA's authoring column, about 435px wide, with question-interactives' form conventions
.authoring {
  padding: 0 2px;

  fieldset {
    min-width: 0;
    margin: 0 0 10px;
    padding: 0;
    border: 0;
  }

  legend {
    display: block;
    width: 100%;
    margin-bottom: 20px;
    padding: 0;
    font-size: 18px;
    border-bottom: 1px solid #e5e5e5;
  }

  .form-group {
    margin-bottom: 15px;

    > label {
      display: inline-block;
      margin-bottom: 5px;
      font-weight: bold;
    }
  }

  select,
  textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding: 6px 12px;
    font: inherit;
    color: #555;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;

    &:focus {
      border-color: #66afe9;
      box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075), 0 0 8px rgba(102, 175, 233, .6);
    }
  }

  select {
    height: 34px;
  }

  textarea {
    resize: vertical;
  }

  .checkbox {
    margin: 10px 0;

    label {
      display: block;
      position: relative;
      padding-left: 20px;
      cursor: pointer;
    }

    input {
      position: absolute;
      margin: 3px 0 0 -20px;
    }

    label:has(input:disabled),
    input:disabled {
      cursor: not-allowed;
    }
  }

  .dependent {
    margin-left: 24px;
  }

  .help {
    margin: 5px 0 10px;
    color: #737373;
  }

  // help for a select sits under it, inside the gap its field group leaves
  .after-select {
    margin-top: -10px;
  }

  // a heading over a group of checkboxes, sized like a field's label rather than a section's
  .field-legend {
    margin-bottom: 0;
    font-size: inherit;
    font-weight: bold;
    border: 0;
  }
}
```

The values are question-interactives' Bootstrap 3 ones (requirements, Technical Notes, "Authoring form layout"). The 2 px side padding keeps the focus ring and glow inside the frame. The browser's focus ring stays under the glow: the `#66afe9` border alone is 2.4:1 against white, under the 3:1 WCAG asks of a focus indicator. A disabled checkbox's label gets the not-allowed cursor through `:has`, since the label's text is a text node beside the input, not an element a sibling selector can reach.

`src/interactive/app.tsx`:

```diff
 import { readAuthoredState } from "./authored-state";
+import { Authoring } from "./authoring";
 import { MarkovInteractiveState } from "./interactive-state";
```

```diff
     switch (initMessage.mode) {
+      case "authoring":
+        return <Authoring initialState={readAuthoredState(initMessage.authoredState)} />;
       case "runtime":
```

`cypress/e2e/interactive-authoring.test.ts`:

```ts
import { defaultAuthoredState, MarkovAuthoredState, maxStartingTextLength } from "../../src/interactive/authored-state";

// invoke() and its() are queries, so an assertion on this retries until the latest save arrives
const lastSaved = () => cy.interactiveMessages("authoredState").invoke("slice", -1).its(0);

const savedOnce = (expected: MarkovAuthoredState) =>
  cy.interactiveMessages("authoredState").should(states => expect(states).to.deep.equal([expected]));

const withChange = (change: Partial<MarkovAuthoredState>): MarkovAuthoredState =>
  ({ ...defaultAuthoredState, ...change });

describe("the interactive's authoring form", () => {
  it("tells LARA it supports authored and interactive state", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactiveMessages("supportedFeatures").should(features => expect(features).to.deep.equal([
      { apiVersion: 1, features: { authoredState: true, interactiveState: true } }
    ]));
  });

  it("shows the defaults for a new interactive, and saves nothing until a change", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#usableModes").should("have.value", "both");
    cy.interactive().find("#startingMode").should("have.value", "useData");
    cy.interactive().find("#inputView").should("have.value", "textAndTable");
    cy.interactive().find("#capitalization").should("have.value", "lowercase");
    cy.interactive().find("#orderMattersStartsOn").should("be.checked");
    cy.interactive().find("#orderMattersShowSwitch").should("be.checked");
    cy.interactive().find("#startingText").should("have.value", "");
    ["input", "graph", "inspect", "generator"].forEach(pane => {
      cy.interactive().find(`#pane-${pane}`).should("be.checked");
      cy.interactive().find(`#pane-${pane}-startsOpen`).should("be.checked");
    });
    cy.interactive().find("#pane-graph-startsOpen").closest("label")
      .should("have.text", "Open at the start in Data mode");
    cy.interactive().find("#button-probabilities").should("be.checked");
    cy.interactive().find("#button-probabilities-startsOn").should("not.be.checked");
    cy.interactive().find("#button-sendToCodap").should("not.be.checked");
    cy.interactive().find("#button-downloadTables").should("not.be.checked");
    cy.interactiveMessages("authoredState").should("have.length", 0);
  });

  it("lays out its sections in order, with Ordering and Send data buttons as groups inside them", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("legend").then(legends => [...legends].map(legend => legend.textContent))
      .should("deep.equal", ["Modes", "Data settings", "Ordering", "What students can see", "Send data buttons"]);
    cy.interactive().find("#inputView").should("have.attr", "aria-describedby", "input-view-help");
    cy.interactive().find("#input-view-help").should("contain.text", "a table of its words");
  });

  it("describes the option chosen under the usable modes and the input view", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#modes-help").should("contain.text", "switch between the two");
    cy.interactive().find("#usableModes").select("Draw");
    cy.interactive().find("#modes-help").should("have.text", "Students draw their own chain.");
    cy.interactive().find("#usableModes").select("Data");
    cy.interactive().find("#inputView").select("Table only");
    cy.interactive().find("#input-view-help")
      .should("have.text", "Students work only in the table and never see the text.");
  });

  const changes: Array<[string, () => void, MarkovAuthoredState]> = [
    ["the usable modes", () => cy.interactive().find("#usableModes").select("Data"),
      withChange({ modes: { useData: true, draw: false } })],
    ["the starting mode", () => cy.interactive().find("#startingMode").select("Draw"),
      withChange({ startingMode: "draw" })],
    ["the input view", () => cy.interactive().find("#inputView").select("Table only"),
      withChange({ inputView: "table" })],
    ["the capitalization",
      () => cy.interactive().find("#capitalization").select("\"The\" and \"the\" are different words"),
      withChange({ capitalization: "asTyped" })],
    ["\"Order matters\" starts on", () => cy.interactive().find("#orderMattersStartsOn").uncheck(),
      withChange({ orderMatters: { startsOn: false, showSwitch: true } })],
    ["the \"Order matters\" switch", () => cy.interactive().find("#orderMattersShowSwitch").uncheck(),
      withChange({ orderMatters: { startsOn: true, showSwitch: false } })],
    ["a pane", () => cy.interactive().find("#pane-inspect").uncheck(),
      withChange({ panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } } })],
    ["a pane's starting state", () => cy.interactive().find("#pane-generator-startsOpen").uncheck(),
      withChange({ panes: { ...defaultAuthoredState.panes, generator: { available: true, startsOpen: false } } })],
    ["the Send to CODAP button", () => cy.interactive().find("#button-sendToCodap").check(),
      withChange({ buttons: { ...defaultAuthoredState.buttons, sendToCodap: { available: true } } })],
    ["the Download data files button", () => cy.interactive().find("#button-downloadTables").check(),
      withChange({ buttons: { ...defaultAuthoredState.buttons, downloadTables: { available: true } } })],
    ["the probabilities toggle", () => cy.interactive().find("#button-probabilities").uncheck(),
      withChange({
        buttons: { ...defaultAuthoredState.buttons, probabilities: { available: false, startsOn: false } }
      })],
    ["the probabilities' starting state", () => cy.interactive().find("#button-probabilities-startsOn").check(),
      withChange({ buttons: { ...defaultAuthoredState.buttons, probabilities: { available: true, startsOn: true } } })],
  ];
  changes.forEach(([name, act, expected]) => {
    it(`saves ${name}, and only that`, () => {
      cy.startInteractive({ mode: "authoring", authoredState: {} });
      act();
      savedOnce(expected);
    });
  });

  it("saves the starting text as it is typed", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#startingText").type("the cat");
    cy.interactiveMessages("authoredState").should("have.length", "the cat".length);
    lastSaved().should("deep.equal", withChange({ startingText: "the cat" }));
  });

  it("stops the starting text at its limit and says how much is left near it", () => {
    const nearlyFull = "a".repeat(maxStartingTextLength - 2);
    cy.startInteractive({ mode: "authoring", authoredState: withChange({ startingText: nearlyFull }) });
    cy.interactive().find("#starting-text-help").should("contain.text", "2 characters left");
    cy.interactive().find("#startingText").type("b");
    cy.interactive().find("#starting-text-help").should("contain.text", "1 character left.");
    cy.interactive().find("#startingText").type("cd");
    cy.interactive().find("#startingText").invoke("val").should("have.length", maxStartingTextLength);
    lastSaved().its("startingText").should("equal", `${nearlyFull}bc`);
    cy.interactive().find("#starting-text-help").should("contain.text", "0 characters left");
  });

  it("opens showing a saved state", () => {
    const saved = withChange({
      modes: { useData: true, draw: true }, startingMode: "draw", inputView: "text", capitalization: "asTyped",
      orderMatters: { startsOn: false, showSwitch: false }, startingText: "a big bag of words",
      panes: {
        input: { available: true, startsOpen: false }, graph: { available: true, startsOpen: false },
        inspect: { available: false, startsOpen: true }, generator: { available: true, startsOpen: false },
      },
      buttons: {
        probabilities: { available: false, startsOn: true }, sendToCodap: { available: true },
        downloadTables: { available: true },
      },
    });
    cy.startInteractive({ mode: "authoring", authoredState: saved });
    cy.interactive().find("#startingMode").should("have.value", "draw");
    cy.interactive().find("#inputView").should("have.value", "text");
    cy.interactive().find("#capitalization").should("have.value", "asTyped");
    cy.interactive().find("#orderMattersStartsOn").should("not.be.checked");
    cy.interactive().find("#orderMattersShowSwitch").should("not.be.checked");
    cy.interactive().find("#startingText").should("have.value", "a big bag of words");
    ["input", "graph", "generator"].forEach(pane => {
      cy.interactive().find(`#pane-${pane}-startsOpen`).should("not.be.checked");
    });
    cy.interactive().find("#pane-inspect").should("not.be.checked");
    cy.interactive().find("#button-probabilities").should("not.be.checked");
    cy.interactive().find("#button-probabilities-startsOn").should("be.checked");
    cy.interactive().find("#button-sendToCodap").should("be.checked");
    cy.interactive().find("#button-downloadTables").should("be.checked");
  });

  it("offers the starting mode only with both modes, and keeps it to a mode students have", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#usableModes").select("Data");
    cy.interactive().find("#startingMode").should("not.exist");
    cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
    cy.interactive().find("#startingMode").should("have.value", "useData");
    cy.interactive().find("#usableModes").select("Draw");
    cy.interactive().find("#startingMode").should("not.exist");
    lastSaved().should("deep.equal", withChange({ modes: { useData: false, draw: true }, startingMode: "draw" }));
  });

  it("hides the Data settings and the Input pane without Data mode, and shows them as they were", () => {
    cy.startInteractive({
      mode: "authoring", authoredState: withChange({ modes: { useData: false, draw: true }, inputView: "table" })
    });
    // the form is on the page, so what isn't there was left off rather than not drawn yet
    cy.interactive().find("#pane-inspect-startsOpen").should("exist");
    cy.interactive().find("#usableModes").should("have.value", "draw");
    ["#inputView", "#capitalization", "#orderMattersStartsOn", "#orderMattersShowSwitch", "#startingText",
      "#pane-input", "#pane-input-startsOpen", "#pane-graph-startsOpen"].forEach(selector => {
      cy.interactive().find(selector).should("not.exist");
    });
    cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
    cy.interactive().find("#inputView").should("have.value", "table");
    cy.interactive().find("#pane-input").should("be.checked");
    cy.interactive().find("#pane-graph-startsOpen").should("be.checked");
  });

  it("hides a pane's starting state while it isn't available, but not the probabilities'", () => {
    cy.startInteractive({ mode: "authoring", authoredState: withChange({ modes: { useData: true, draw: false } }) });
    cy.interactive().find("#pane-graph-startsOpen").closest("label").should("have.text", "Open at the start");
    cy.interactive().find("#pane-inspect").uncheck();
    cy.interactive().find("#pane-inspect-startsOpen").should("not.exist");
    cy.interactive().find("#pane-graph").uncheck();
    cy.interactive().find("#pane-graph-startsOpen").should("not.exist");
    cy.interactive().find("#button-probabilities").uncheck();
    cy.interactive().find("#button-probabilities-startsOn").should("not.be.disabled").check();
    lastSaved().its("buttons.probabilities").should("deep.equal", { available: false, startsOn: true });
  });

  it("keeps the Graph pane while Draw is available, and says why", () => {
    cy.startInteractive({ mode: "authoring", authoredState: withChange({ modes: { useData: true, draw: false } }) });
    cy.interactive().find("#pane-graph").should("not.be.disabled").uncheck();
    cy.interactive().find("#graph-help").should("not.exist");
    cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
    cy.interactive().find("#pane-graph").should("be.checked").and("be.disabled")
      .and("have.attr", "aria-describedby", "graph-help");
    cy.interactive().find("#graph-help").should("contain.text", "Draw mode needs the Graph pane");
    lastSaved().its("panes.graph.available").should("equal", true);
  });

  it("notes that Send to CODAP needs CODAP on the page, whether or not it is checked", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#button-sendToCodap").should("not.be.checked")
      .and("have.attr", "aria-describedby", "send-to-codap-help");
    cy.interactive().find("#send-to-codap-help").should("contain.text", "Requires a linked CODAP interactive");
    cy.interactive().find("#button-sendToCodap").check();
    cy.interactive().find("#button-sendToCodap").should("be.checked")
      .and("have.attr", "aria-describedby", "send-to-codap-help");
    cy.interactive().find("#send-to-codap-help").should("contain.text", "Requires a linked CODAP interactive");
  });

  it("sizes its frame to the form, growing and shrinking with it", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#startingMode");
    cy.frameFitsInteractive();
    cy.get("iframe#interactive").invoke("height").then(withBothModes => {
      cy.interactive().find("#usableModes").select("Data");
      cy.interactive().find("#startingMode").should("not.exist");
      cy.frameFitsInteractive();
      cy.get("iframe#interactive").invoke("height").should("be.lessThan", withBothModes);
      cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
      cy.frameFitsInteractive();
      cy.get("iframe#interactive").invoke("height").should("equal", withBothModes);
    });
  });

  it("fits LARA's narrowest authoring column without scrolling sideways", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {}, width: 420 });
    cy.interactive().find("#startingText");
    cy.interactive().then(body => expect(body[0].scrollWidth).to.be.at.most(420));
  });
});
```

- "Saves X, and only that" starts from `{}` and expects exactly one `authoredState` message equal to the defaults with one change, so a control that saved the wrong field, two fields, or twice fails it.
- The height test waits for the frame to fit the content (`cy.frameFitsInteractive()`), then chooses Data alone, which removes the starting mode and the Graph help, and expects a shorter frame that still fits, then a frame as tall as before. Measured: with the library's `useAutoSetHeight` in place of `useFrameHeight` it fails, since that hook never shrinks the frame; it passed six runs in a row as written.
- **`lastSaved`** is built from queries (`invoke`, `its`), so an assertion on it retries until the latest save arrives; read once with `then`, it caught the save before last (measured: two tests failed in one run).
- **Hidden settings:** `cy.interactive()` only waits for a non-empty body, which "Loading..." is, so the hiding test first finds a setting that should be there, and only then checks that the others aren't. Without that, it passed with Data mode's settings always shown (measured); with it, that fails.
- Each of these fails a test (measured): the Graph pane's checkbox never disabled, choosing Draw leaving the Graph unavailable, Data mode's settings always shown, the starting mode always shown, the usable modes' help fixed on one option, the Download data files checkbox saving Send to CODAP's setting, the Send to CODAP note left off while the box is checked, and a saved pane, probabilities or Download data files setting shown as its default.
- The width test starts the form at 420 px, the narrowest LARA column measured, and checks the page doesn't scroll sideways.

**Commit**: `feat: add the Markov Interactive's authoring form [MARK-13]`

---

### Add the report item

**Summary**: R1 and R2 for `report-item.html`, R14 for the report item, R15, and R20's and R21's report-item tests.

**Files affected**:
- `webpack.config.js`: the `report-item` entry and its page.
- `src/interactive/report-item.tsx`, `src/interactive/report-item-answer.ts`, `src/interactive/report-item-answer.test.ts`: new.
- `src/interactive/standalone.test.tsx`: the report item's test.
- `cypress/fake-ap/fake-ap.ts`, `cypress/support/fake-ap-commands.ts`, `cypress/support/fake-ap.d.ts`: a request can name its student.
- `cypress/e2e/interactive-report-item.test.ts`: new.

**Estimated diff size**: 117 lines (+111, -6), measured.

`webpack.config.js`:

```diff
       interactive: './src/interactive/index.tsx',
+      'report-item': './src/interactive/report-item.tsx',
```

```diff
       new HtmlWebpackPlugin({
         filename: 'interactive.html',
         template: 'src/interactive/index.html',
         publicPath: '.',
         chunks: ['interactive'],
       }),
+      new HtmlWebpackPlugin({
+        filename: 'report-item.html',
+        template: 'src/interactive/index.html',
+        publicPath: '.',
+        chunks: ['report-item'],
+      }),
```

`src/interactive/report-item-answer.ts`:

```ts
import type { IReportItemAnswerItem } from "@concord-consortium/lara-interactive-api";

// The grid draws its own answered icon and reads only a score from a compact answer, so a compact answer has no items.
export const placeholderReportHtml =
  "<div class=\"tall\"><p>This student opened the Markov interactive.</p>" +
  "<p>A summary of their work comes in a later version.</p></div>" +
  "<div class=\"wide\"><p>This student opened the Markov interactive. " +
  "A summary of their work comes in a later version.</p></div>";

export const reportItemAnswerItems = (itemsType: "fullAnswer" | "compactAnswer"): IReportItemAnswerItem[] =>
  itemsType === "compactAnswer" ? [] : [{ type: "html", html: placeholderReportHtml }];
```

`import type`, so Jest never loads the library.

`src/interactive/report-item.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import {
  inIframe, IReportItemInitInteractive, sendReportItemAnswer, useInitMessage, useReportItem
} from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { MarkovInteractiveState } from "./interactive-state";
import { reportItemAnswerItems } from "./report-item-answer";
import { useFrameHeight } from "./use-frame-height";

import "./interactive.scss";

// The class dashboard's report item: one frame answers for every student in the class.
const ReportItem = () => {
  const initMessage = useInitMessage<IReportItemInitInteractive<MarkovInteractiveState, MarkovAuthoredState>>();
  const ref = useFrameHeight();

  useReportItem<MarkovInteractiveState, MarkovAuthoredState>({
    metadata: { compactAnswerReportItemsAvailable: true },
    handler: ({ platformUserId, version, itemsType }) => {
      sendReportItemAnswer({ version, platformUserId, itemsType, items: reportItemAnswerItems(itemsType) });
    }
  });

  return (
    <div className="markov-interactive" ref={ref}>
      { !initMessage && <div className="loading">Loading...</div> }
    </div>
  );
};

// Opened directly, outside the class dashboard, it has no student to answer for.
const StandaloneReportItem = () => (
  <div className="markov-interactive">
    <p className="standalone-note">
      This is the Markov interactive&apos;s report item. It shows a student&apos;s answer in the class dashboard.
    </p>
  </div>
);

const root = createRoot(document.getElementById("app") as HTMLElement);
root.render(inIframe() ? <ReportItem /> : <StandaloneReportItem />);
```

Opened directly, the report item says what it is and, like the interactive, leaves the library alone (R14). `useReportItem` adds the answer listener and posts `reportItemClientReady` with the metadata, in one call. The handler doesn't check the request's version: there is one (`2.1.0`), and a placeholder has nothing to adapt. MARK-19, which reads the states, adds the check question-interactives makes.

`src/interactive/report-item-answer.test.ts`:

```ts
import { reportItemAnswerItems } from "./report-item-answer";

describe("reportItemAnswerItems", () => {
  it("answers a full answer with the placeholder html, in the report's tall and wide blocks", () => {
    expect(reportItemAnswerItems("fullAnswer")).toEqual([{
      type: "html",
      html: "<div class=\"tall\"><p>This student opened the Markov interactive.</p>" +
        "<p>A summary of their work comes in a later version.</p></div>" +
        "<div class=\"wide\"><p>This student opened the Markov interactive. " +
        "A summary of their work comes in a later version.</p></div>"
    }]);
  });

  it("answers a compact answer with no items", () => {
    expect(reportItemAnswerItems("compactAnswer")).toEqual([]);
  });
});
```

`src/interactive/standalone.test.tsx`, the report item's test, after the interactive's two:

```diff
     expect(listed("How students enter their data")).toHaveTextContent(/^Table only$/);
   });
+
+  it("the report item says what it is, and leaves the library alone", async () => {
+    document.body.innerHTML = "<div id=\"app\"></div>";
+    await act(async () => { await import("./report-item"); });
+    expect(screen.getByText(/It shows a student's answer in the class dashboard/)).toBeInTheDocument();
+    expect(warn).not.toHaveBeenCalled();
+  });
 });
```

It fails when the report item always waits for the dashboard, and when its standalone view reports a height (measured).

A request names its student, `student1` unless a test gives another, so a test can check the answer is for the student asked about:

`cypress/fake-ap/fake-ap.ts`:

```diff
-const requestReportItemAnswer = (itemsType: ItemsType) => new Promise<any>(resolve => {
+const requestReportItemAnswer = (itemsType: ItemsType, platformUserId = "student1") => new Promise<any>(resolve => {
   awaitingAnswer = resolve;
   // the dashboard sends no requestId, and the library's listener answers only a request without one
   phone?.post("getReportItemAnswer", {
-    version: "2.1.0", platformUserId: "student1", itemsType,
+    version: "2.1.0", platformUserId, itemsType,
```

`cypress/support/fake-ap-commands.ts`:

```diff
-Cypress.Commands.add("requestReportItemAnswer", (itemsType: ItemsType) =>
-  cy.fakeAp().then(fake => fake.requestReportItemAnswer(itemsType)));
+Cypress.Commands.add("requestReportItemAnswer", (itemsType: ItemsType, platformUserId?: string) =>
+  cy.fakeAp().then(fake => fake.requestReportItemAnswer(itemsType, platformUserId)));
```

`cypress/support/fake-ap.d.ts`:

```diff
-      /** Asks the report item for the student's answer, as the class dashboard does, and yields the answer. */
-      requestReportItemAnswer(itemsType: ItemsType): Chainable<any>;
+      /** Asks the report item for a student's answer (student1's by default), as the class dashboard does. */
+      requestReportItemAnswer(itemsType: ItemsType, platformUserId?: string): Chainable<any>;
```

`cypress/e2e/interactive-report-item.test.ts`:

```ts
describe("the interactive's report item", () => {
  beforeEach(() => {
    cy.startInteractive({ mode: "reportItem", interactiveState: { version: 1 } });
    cy.interactiveMessages("reportItemClientReady").should("deep.equal", [{ compactAnswerReportItemsAvailable: true }]);
    cy.interactiveMessages("height").should("have.length.greaterThan", 0);
  });

  it("answers a full answer with the placeholder", () => {
    cy.requestReportItemAnswer("fullAnswer").then(answer => {
      expect(answer).to.include({ version: "2.1.0", platformUserId: "student1", itemsType: "fullAnswer" });
      expect(answer.items).to.have.length(1);
      expect(answer.items[0].type).to.equal("html");
      expect(answer.items[0].html).to.contain("This student opened the Markov interactive.");
    });
  });

  it("answers a compact answer with no items, for the student the request names", () => {
    cy.requestReportItemAnswer("compactAnswer", "student2")
      .should("deep.include", { platformUserId: "student2", itemsType: "compactAnswer", items: [] });
  });
});
```

The full answer asks for `student1` and the compact answer for `student2`, so a handler that answered for a fixed student fails one; and `beforeEach` waits for a height, which fails with the root's `ref` removed (both measured).

**Check R2 again** with the same commands as the runtime step: the new files now include `report-item.html` and `assets/report-item.*`, and the plugin's files are unchanged but for the map's `file`.

**Commit**: `feat: add the Markov Interactive's report item [MARK-13]`

---

### Add the demo page

**Summary**: R16 to R18, and the demo's Jest and Cypress tests in R20 and R21. `demo.html`, titled "Demo and Standalone Authoring", hosts the authoring form and the runtime side by side, at LARA's and the Activity Player's widths, with the width choice and its `?width=` parameter, and gives the standalone link for the form's settings.

**Files affected**:
- `webpack.config.js`: the `demo` entry and its page.
- `src/interactive/demo.tsx`, `src/interactive/demo.scss`, `src/interactive/demo-widths.ts`, `src/interactive/demo-widths.test.ts`: new.
- `cypress/e2e/interactive-demo.test.ts`: new.

**Estimated diff size**: 469 lines (+469), measured.

`webpack.config.js`:

```diff
       'report-item': './src/interactive/report-item.tsx',
+      demo: './src/interactive/demo.tsx',
```

```diff
       new HtmlWebpackPlugin({
         filename: 'report-item.html',
         template: 'src/interactive/index.html',
         publicPath: '.',
         chunks: ['report-item'],
       }),
+      new HtmlWebpackPlugin({
+        filename: 'demo.html',
+        template: 'src/interactive/index.html',
+        publicPath: '.',
+        chunks: ['demo'],
+      }),
```

`src/interactive/demo-widths.ts`:

```ts
// The widths a full-width item gets in the Activity Player, for the demo page's width choice. An activity page is
// 1100px wide (LARA's "Standard"), 960px ("iPad Friendly"), or as wide as the window when a section has a responsive
// layout, and the item sits inside the page's 20px side padding and the section's 8px side margin.
export const activityPlayerInset = 2 * 20 + 2 * 8;

export const demoWidths = [
  { id: "1100", label: "Standard (1100px)", frameWidth: 1100 - activityPlayerInset },
  { id: "960", label: "iPad Friendly (960px)", frameWidth: 960 - activityPlayerInset },
  // fills the runtime area, as a responsive section fills the window
  { id: "responsive", label: "Responsive", frameWidth: undefined },
] as const;

export type DemoWidthId = typeof demoWidths[number]["id"];

export const defaultDemoWidth: DemoWidthId = "1100";

// the demo's ?width= value, or the default for a missing or unknown one
export const readDemoWidth = (search: string): DemoWidthId => {
  const width = new URLSearchParams(search).get("width");
  return demoWidths.find(w => w.id === width)?.id ?? defaultDemoWidth;
};
```

The widths are derived from the Activity Player's own numbers, so a reader can check them against its styles (the requirements' Technical Notes cite each one).

`src/interactive/demo-widths.test.ts`:

```ts
import { demoWidths, readDemoWidth } from "./demo-widths";

describe("demo widths", () => {
  it("gives a full-width item's width in each fixed Activity Player layout", () => {
    expect(demoWidths.map(w => [w.id, w.frameWidth]))
      .toEqual([["1100", 1044], ["960", 904], ["responsive", undefined]]);
  });

  it.each([
    ["?width=960", "960"],
    ["?width=responsive", "responsive"],
    ["?width=1100", "1100"],
    ["", "1100"],
    ["?width=800", "1100"],
    ["?other=1&width=960", "960"],
  ])("reads %j as %s", (search, expected) => {
    expect(readDemoWidth(search)).toBe(expected);
  });
});
```

`src/interactive/demo.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ParentEndpoint } from "iframe-phone";
import { readAuthoredState } from "./authored-state";
import { demoWidths, DemoWidthId, readDemoWidth } from "./demo-widths";
import { HostedMode, initInteractiveMessage } from "./host-messages";
import { placeholderReportHtml } from "./report-item-answer";
import { longLinkLength, searchFromAuthoredState } from "./url-settings";

import "./interactive.scss";
import "./demo.scss";

// the runtime restarts with the authoring form's latest state once the author pauses this long
const restartDelay = 500;

const initialAuthoredState = readAuthoredState({ startingText: "the cat sat on the mat. the cat ran." });

// the report's own style for a wide answer, which hides the tall version
const reportItemDocument = (html: string) =>
  `<!DOCTYPE html><html><head><style>body { font-family: lato, arial, helvetica, sans-serif; margin: 0; }
  .tall { display: none; }</style></head><body>${html}</body></html>`;

interface HostedFrameProps {
  title: string;
  mode: HostedMode;
  authoredState: unknown;
  getInteractiveState?: () => unknown;
  onMessage: (type: "authoredState" | "interactiveState", content: unknown) => void;
  width: number | string;
}

// interactive.html in a frame, started in a mode as LARA or the Activity Player starts it, and sized to the height
// it reports; a new authoredState restarts it
const HostedFrame = ({ title, mode, authoredState, getInteractiveState, onMessage, width }: HostedFrameProps) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) {
      return;
    }
    iframe.src = "interactive.html";
    const endpoint = new ParentEndpoint(iframe, window.location.origin, () => {
      endpoint.post("initInteractive", initInteractiveMessage(mode, authoredState, getInteractiveState?.()));
    });
    endpoint.addListener("height", (content: unknown) => setHeight(Number(content)));
    endpoint.addListener("authoredState", (content: unknown) => onMessage("authoredState", content));
    endpoint.addListener("interactiveState", (content: unknown) => onMessage("interactiveState", content));
    return () => endpoint.disconnect();
  }, [mode, authoredState, getInteractiveState, onMessage]);

  return <iframe ref={ref} title={title} className={`hosted-frame ${mode}`} style={{ width, height }} />;
};

const pageTitle = "Demo and Standalone Authoring";

// The interactive opened on its own with the authoring form's settings, for a collection page or any page outside
// the Activity Player. The link is beside this page, so it names the same branch or version.
const StandaloneLink = ({ authoredState }: { authoredState: unknown }) => {
  const link = new URL(`interactive.html${searchFromAuthoredState(readAuthoredState(authoredState))}`,
    window.location.href).href;
  const [copiedLink, setCopiedLink] = useState<string>();

  const copy = () => navigator.clipboard.writeText(link).then(() => setCopiedLink(link));

  return (
    <section className="demo-standalone" aria-labelledby="demo-standalone-heading">
      <h2 id="demo-standalone-heading">Standalone link</h2>
      <div className="demo-standalone-row">
        <input type="text" readOnly={true} value={link} aria-labelledby="demo-standalone-heading"
          aria-describedby="demo-standalone-warning" onFocus={event => event.target.select()} />
        <button type="button" onClick={copy}>{ copiedLink === link ? "Copied" : "Copy" }</button>
        <a href={link} target="_blank" rel="noopener noreferrer">Open</a>
      </div>
      <p id="demo-standalone-warning" className="demo-standalone-warning">
        Use this link only outside the Activity Player, such as on a collection page. In LARA, add the
        interactive&apos;s plain URL and choose its settings in the Authoring tab: settings in this link are ignored
        inside an activity.
      </p>
      { link.length > longLinkLength && (
        <p className="demo-standalone-long">
          This link is longer than { longLinkLength.toLocaleString("en-US") } characters, mostly its starting text, and
          some sites and email programs cut long links short.
        </p>
      ) }
    </section>
  );
};

const Demo = () => {
  const [authoredState, setAuthoredState] = useState<unknown>(initialAuthoredState);
  const [runtimeAuthoredState, setRuntimeAuthoredState] = useState<unknown>(initialAuthoredState);
  const [widthId, setWidthId] = useState<DemoWidthId>(() => readDemoWidth(window.location.search));
  // kept across the runtime's restarts, as the Activity Player keeps a student's state
  const interactiveStateRef = useRef<unknown>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setRuntimeAuthoredState(authoredState), restartDelay);
    return () => window.clearTimeout(timeout);
  }, [authoredState]);

  const getInteractiveState = useCallback(() => interactiveStateRef.current, []);
  const handleMessage = useCallback((type: "authoredState" | "interactiveState", content: unknown) => {
    if (type === "authoredState") {
      setAuthoredState(content);
    } else {
      interactiveStateRef.current = content;
    }
  }, []);

  const selectWidth = (id: DemoWidthId) => {
    setWidthId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("width", id);
    window.history.replaceState(null, "", url);
  };

  const frameWidth = demoWidths.find(w => w.id === widthId)?.frameWidth;

  return (
    <div className="demo">
      <h1>{ pageTitle }</h1>
      <div className="demo-columns">
        <section className="demo-authoring" aria-labelledby="demo-authoring-heading">
          <h2 id="demo-authoring-heading">Authoring</h2>
          <HostedFrame title="Authoring" mode="authoring" authoredState={initialAuthoredState}
            onMessage={handleMessage} width="100%" />
          <StandaloneLink authoredState={authoredState} />
        </section>
        <section className="demo-runtime" aria-labelledby="demo-runtime-heading">
          <div className="demo-runtime-header">
            <h2 id="demo-runtime-heading">Interactive</h2>
            <fieldset className="demo-widths">
              <legend>Activity Player page width</legend>
              { demoWidths.map(({ id, label }) => (
                <label key={id} className={id === widthId ? "selected" : undefined}>
                  <input type="radio" name="width" value={id} checked={id === widthId}
                    onChange={() => selectWidth(id)} />
                  { label }
                </label>
              )) }
            </fieldset>
          </div>
          <div className="demo-runtime-frame">
            <HostedFrame title="Interactive" mode="runtime" authoredState={runtimeAuthoredState}
              getInteractiveState={getInteractiveState} onMessage={handleMessage} width={frameWidth ?? "100%"} />
          </div>
          <h2>Report item, full answer</h2>
          <iframe title="Report item" className="demo-report-item" srcDoc={reportItemDocument(placeholderReportHtml)} />
        </section>
      </div>
    </div>
  );
};

document.title = pageTitle;
createRoot(document.getElementById("app") as HTMLElement).render(<Demo />);
```

- **Hosting:** each frame gets its own iframe-phone `ParentEndpoint`, as LARA and the Activity Player give one to each interactive, and starts with the same `initInteractiveMessage` the fake Activity Player page sends. `HostedFrame`'s effect reloads its frame whenever its `authoredState` changes, which is how the runtime restarts; the authoring frame is given the starting state once, so typing in it never restarts it.
- **State:** the latest authored state from the form waits half a second before it reaches the runtime, so typing restarts it once per pause, not once per key. The interactive state is held in a ref and read when the runtime starts, so the runtime's own save doesn't restart it.
- **Width:** the frame takes the chosen width (or `100%` for Responsive), and the area around it scrolls sideways when it is narrower. The frame's dashed edge is an outline, which takes no room, so the interactive gets the whole width and the whole reported height; a border inside a `border-box` frame would take 2 px of each, and the lost height makes the interactive scroll, with a scrollbar that leaves it 1,027 px of Standard's 1,044 (measured). Choosing a width calls `history.replaceState`, so the address bar holds a link to that width without adding a history entry.
- **The report item's answer** is the same `placeholderReportHtml` `report-item.html` sends, shown in a `srcDoc` frame with the report's wide-layout style. It is a constant, so no author or student text reaches the frame's HTML.
- **Title:** the template's title is the interactive's, so the page sets its own, from the same constant as its heading.
- **The standalone link** is built from the form's latest authored state, before the runtime's half-second wait, with `searchFromAuthoredState`, the inverse of what the standalone interactive reads, and resolved against the page's own URL, so it names the same branch or version. **Copy** writes it with the Clipboard API, which `localhost` and the deployed `https` pages allow, and says "Copied" until the link changes; **Open** is a link with `target="_blank"`. The field's description is the warning, so a screen reader reads it with the field. The long-link note takes its number from `longLinkLength`.

`src/interactive/demo.scss`:

```scss
// the authoring column is LARA's authoring column's width, so authors see the room they get there
$authoring-width: 435px;
// Concord's dark teal, 7:1 against white as text or as a background under white text
$teal: #016082;

.demo {
  h1 {
    margin: 0;
    padding: 10px;
    font-size: 20px;
    color: white;
    background-color: $teal;
  }

  h2 {
    margin: 10px 0 5px;
    font-size: 14px;
    font-weight: bold;
  }

  iframe {
    display: block;
    border: 0;
  }
}

.demo-columns {
  display: flex;
  gap: 20px;
  padding: 0 10px 10px;
}

.demo-authoring {
  flex: 0 0 $authoring-width;
}

.demo-runtime {
  flex: 1 1 auto;
  min-width: 0;
}

.demo-runtime-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.demo-widths {
  display: flex;
  margin: 10px 0 5px;
  padding: 0;
  border: 0;

  legend {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  label {
    padding: 4px 10px;
    border: 1px solid $teal;
    color: $teal;
    cursor: pointer;

    & + label {
      border-left: 0;
    }

    &:first-of-type {
      border-radius: 4px 0 0 4px;
    }

    &:last-of-type {
      border-radius: 0 4px 4px 0;
    }

    &.selected {
      color: white;
      background-color: $teal;
    }

    &:focus-within {
      outline: 2px solid #0957d0;
      outline-offset: 2px;
    }
  }

  input {
    position: absolute;
    opacity: 0;
  }
}

// a frame wider than the area scrolls, so the frame keeps the width the page width gives it; the outline marks the
// frame's edge without taking any of the width or height the interactive is given, and the padding keeps it in view
.demo-runtime-frame {
  overflow-x: auto;
  padding: 1px;

  .hosted-frame {
    outline: 1px dashed #ccc;
  }
}

.demo-standalone-row {
  display: flex;
  gap: 5px;

  input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  button,
  a {
    padding: 4px 10px;
    border: 1px solid $teal;
    border-radius: 4px;
    font: inherit;
    color: $teal;
    background-color: white;
    text-decoration: none;
    cursor: pointer;
  }
}

.demo-standalone-warning,
.demo-standalone-long {
  margin: 5px 0 0;
}

.demo-standalone-warning {
  color: #737373;
}

.demo-standalone-long {
  color: #8a4b00;
}

.demo-report-item {
  width: 100%;
  height: 60px;
}
```

The long-link note is `#8a4b00` on white, 6.8:1, the warning `#737373`, 4.7:1, and the teal of the heading, the width choice and the link's buttons `#016082`, the Activity Player's `$cc-teal-dark2`, 7.0:1 either way round; its `$cc-teal`, `#0592af`, is 3.7:1, under the 4.5:1 WCAG asks of 14 px text. The width choice is native radio buttons styled as one row of buttons, so it is one keyboard stop with arrow keys between the widths, and a screen reader announces the hidden legend.

`cypress/e2e/interactive-demo.test.ts`:

```ts
const frameBody = (title: string) =>
  cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body));

// its() re-queries, so this keeps reading the frame after the runtime restarts and reloads it
const frameText = (title: string) => cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body.innerText");

// the width the running interactive lays out in, which a scrollbar in its frame would narrow
const runtimeFrameWidth = () => {
  frameBody("Interactive").find(".runtime-placeholder");
  return cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument.documentElement.clientWidth");
};

const standaloneLink = () => cy.get(".demo-standalone input");

// iframe-phone posts an object, or its JSON where a browser can only post text
const messageOf = (data: unknown) => {
  try {
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return undefined;
  }
};

// each setting the runtime's placeholder lists in a document, as [label, value] pairs
const listedIn = (doc: Document) => [...doc.querySelectorAll(".runtime-placeholder dt")]
  .map(term => [term.textContent, term.nextElementSibling?.textContent]);

describe("the interactive's demo page", () => {
  it("shows the runtime at a full-width item's width in the Standard layout", () => {
    cy.visit("/demo.html");
    cy.get("input[value=\"1100\"]").should("be.checked");
    runtimeFrameWidth().should("equal", 1044);
  });

  it("opens at the width its link names, and puts a chosen width in the link", () => {
    cy.visit("/demo.html?width=960");
    cy.get("input[value=\"960\"]").should("be.checked");
    runtimeFrameWidth().should("equal", 904);
    cy.contains("label", "Responsive").click();
    cy.location("search").should("equal", "?width=responsive");
    cy.get(".demo-runtime-frame").invoke("width").then(areaWidth => {
      runtimeFrameWidth().should("equal", areaWidth);
    });
  });

  it("restarts the runtime with each authoring change, keeping its interactive state", () => {
    const savedStates: unknown[] = [];
    cy.visit("/demo.html", {
      onBeforeLoad: win => win.addEventListener("message", event => {
        const message = messageOf(event.data);
        if (message?.type === "interactiveState") {
          savedStates.push(message.content);
        }
      })
    });
    frameText("Interactive").should("contain", "are the same word");
    // the first runtime saves a state, after the library's 2 second pause
    cy.wrap(savedStates, { timeout: 5000 }).should("have.length", 1);
    frameBody("Authoring").find("#capitalization").select("asTyped");
    frameText("Interactive").should("contain", "are different words").and("not.contain", "are the same word");
    // started with that state, the restarted runtime has nothing to save
    cy.wait(2500);
    cy.wrap(savedStates).should("deep.equal", [{ version: 1 }]);
  });

  it("links to the interactive standalone with the settings that differ from the defaults", () => {
    cy.visit("/demo.html?width=960");
    cy.title().should("equal", "Demo and Standalone Authoring");
    cy.get("h1").should("have.text", "Demo and Standalone Authoring");
    cy.location("origin").then(origin => {
      const startingText = "startingText=the+cat+sat+on+the+mat.+the+cat+ran.";
      standaloneLink().should("have.value", `${origin}/interactive.html?${startingText}`);
      frameBody("Authoring").find("#capitalization").select("asTyped");
      standaloneLink().should("have.value", `${origin}/interactive.html?capitalization=asTyped&${startingText}`);
    });
    cy.get(".demo-standalone").should("contain.text", "Use this link only outside the Activity Player")
      .find("a").should("have.attr", "target", "_blank");
    cy.get(".demo-standalone-long").should("not.exist");
  });

  it("says when the link is long", () => {
    cy.visit("/demo.html");
    // val() sets the text without the form noticing, and the typed letter makes the form save all of it
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(1000)).type("b");
    standaloneLink().invoke("val").its("length").should("be.greaterThan", 2000);
    cy.get(".demo-standalone-long").should("contain.text", "longer than 2,000 characters");
  });

  // Electron's window.open gives Cypress no window; the CI job runs Chrome
  it("opens its link standalone with the settings the runtime lists", { browser: "chrome" }, () => {
    cy.visit("/demo.html");
    frameBody("Authoring").find("#usableModes").select("Data");
    frameBody("Authoring").find("#pane-inspect").uncheck();
    frameBody("Authoring").find("#capitalization").select("asTyped");
    frameText("Interactive").should("contain", "are different words");
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument").then(runtime => {
      const hosted = listedIn(runtime);
      // a window of its own, not in a frame, as a link from a collection page opens it
      standaloneLink().invoke("val").then(link => {
        cy.window().then(win => win.open(String(link))).as("standalone");
      });
      cy.get<Window>("@standalone").its("document.body.innerText").should("contain", "coming soon")
        .and("contain", "the settings come from this page's link");
      cy.get<Window>("@standalone").then(standalone => {
        expect(listedIn(standalone.document)).to.deep.equal(hosted);
        standalone.close();
      });
    });
  });

  it("shows the report item's full answer", () => {
    cy.visit("/demo.html");
    frameText("Report item").should("contain", "This student opened the Markov interactive.");
  });
});
```

The runtime frame reloads on every restart, so the restart test reads its text through `its`, which re-queries the frame each retry; a body taken with `then` goes stale on the first reload (measured: it failed every run). Measured: the first four tests pass five runs in a row with the rest of the suite; with the restart removed, the restart test fails, and with `?width=` ignored, the link test fails, and with a border inside the frame's width, both width tests fail: `runtimeFrameWidth` reads the width the interactive lays out in, once it is running, not the frame's outer width. All seven pass three runs in a row in Chrome, with the rest of the interactive's tests.

- **The interactive state** is checked in the restart test: the page records the runtime's `interactiveState` messages, the first runtime saves `{ version: 1 }`, and the restarted one, started with it, saves nothing in the 2.5 seconds after (the library waits 2 before it sends). With the runtime started without the kept state, it fails (measured).
- **The long link** is made by setting the text with `val()`, which records it as the form's current value, and typing one letter, so the form's `onChange` sends the whole text: about 2,000 typed keys would take seconds.
- **The round trip** compares the hosted runtime's list with the list in a window opened on the link, not with values written in the test, so it checks the link builder against the reader whatever the settings are. With the builder writing `_` between a path's names, it fails (measured). It is Chrome-only: Cypress's Electron returns `null` from `window.open` (measured), and a page in Cypress's own frame is hosted. Electron lists it as pending.

**Check R2 again**: the new files now include `demo.html` and `assets/demo.*`, and the plugin's files are unchanged but for the map's `file` (measured).

**Commit**: `feat: add the Markov Interactive's demo and standalone authoring page [MARK-13]`

---

### Document the interactive

**Summary**: R24.

**Files affected**:
- `README.md`: a Markov Interactive section, and a line in Testing.

**Estimated diff size**: 27 lines (+27), measured.

`README.md`, a new section after "Deployment" and its subsections, before "License":

```markdown
## Markov Interactive

The repo also builds the Markov Interactive, an Activity Player interactive with its own authoring, deployed
beside the plugin:

- `interactive.html`: the interactive, in LARA's authoring and the Activity Player's runtime.
- `report-item.html`: its report item, which answers the class dashboard.
- `demo.html`: the Demo and Standalone Authoring page, with the authoring form beside the interactive.

A branch build is at `https://models-resources.concord.org/markov-chain-plugin/branch/<name>/interactive.html`, and a
tag's at `version/<tag>/interactive.html`. The release workflow doesn't copy the interactive anywhere: activities use
a version's URL.

To try it without LARA or an activity, open `demo.html` beside it, for example
`https://models-resources.concord.org/markov-chain-plugin/branch/<name>/demo.html`. It shows the authoring form at
LARA's width and the interactive at the width a full-width item gets in an Activity Player page. `?width=1100` (the
default), `?width=960` or `?width=responsive` opens it at the Standard, iPad Friendly or responsive page width, and
choosing a width updates the link. In development it is `http://localhost:8080/demo.html`.

Opened on its own, outside LARA or the Activity Player, `interactive.html` takes its settings from its URL, one
parameter per setting named by its path in the authored state, such as `?modes.draw=false&inputView=table`, with the
default for any it doesn't give, and saves nothing. The demo page builds that link for the settings in its form, to
copy or open. Inside an activity, settings in the URL are ignored: in LARA, add the interactive's plain URL and choose
its settings in the Authoring tab. Opened on its own, `report-item.html` says what it is.
```

And in "Testing", after the paragraph about `fake-codap.html`, as one unwrapped line like the paragraphs around it:

```markdown
The interactive's tests use a second dev-server page, `fake-ap.html`, which plays LARA's and the Activity Player's part; its commands are in `cypress/support/fake-ap.d.ts`.
```

**Commit**: `docs: document the Markov Interactive [MARK-13]`

---

## After the last commit

On the head, run the baseline set from "Before starting" (R22): the build with no warnings, the three lint commands with no output, both `tsc` commands, `npm test` (116 tests: MARK-10's 56 and this story's 60), and `npm run test:cypress` against `npm start`, three runs in a row (78 tests: MARK-11's 27, MARK-12's 9 and this story's 42, one of them pending in Electron), and again with `--browser chrome`, which runs all 78. Then R2's comparison once more for both builds.

## After the first push

- CI: `build_test`, `cypress` and `s3-deploy` green, and `https://models-resources.concord.org/markov-chain-plugin/branch/ap-interactive-authoring/interactive.html`, `report-item.html` and `demo.html` return 200 (R23). The plugin's branch `index.html` loads in CODAP as before.
- R26, by hand: add it to an activity page, set every option, save, reopen and check each one; run the activity as a student in the Activity Player and check the placeholder's list; open the class dashboard and check the student shows as answered, then open the answer and see the placeholder. Open `interactive.html` and `report-item.html` directly from the branch URL and check the defaults and the message, then open a link copied from the branch's demo page and check its settings (R14, R16). Record each in the PR.

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: the library's state hooks, or its plain functions
**Context**: question-interactives and sensor-interactive use `useAuthoredState` and `useInteractiveState`.
**Options considered**:
- A) Read both states from the init message, keep the form's state in React, and send with `setAuthoredState` and `setInteractiveState`.
- B) The hooks.

**Decision**: A. Both hooks return `null` on their first render and the real state only on the next (`hooks.ts:18-32` in LARA), which made the runtime save over an existing state (measured, the runtime test) and would flash the defaults in the form. The init message carries both states already, and nothing else changes them while the interactive is open.

### RESOLVED: Judgment call: a fake Activity Player page beside MARK-11's, or one page for both
**Context**: the prompt for this story asks to reuse MARK-11's setup where it fits.
**Options considered**:
- A) A second dev-only page, `fake-ap.html`, with its own commands, sharing MARK-11's configuration, error check and CI job.
- B) Teach MARK-11's fake-CODAP page to host the interactive too.

**Decision**: A. The two pages speak different protocols (CODAP's request and reply calls, and the interactive API's messages), so one page would be two pages in one file. The setup that matters is reused: the dev-only entry pattern, the Cypress config with `modifyObstructiveCode: false`, the `afterEach` error check (one more `if`), `cypress/tsconfig.json` and the `cypress` job, which runs every spec.

### RESOLVED: Judgment call: how the round trip opens the standalone link
**Context**: R21 asks for the demo's link to be opened and checked, and Cypress runs every page in its runner's frame, where the interactive is hosted and ignores its URL.
**Options considered**:
- A) Open the link with `window.open`, a top-level window, and run that test in Chrome only.
- B) Read the link's query with `authoredStateFromSearch` inside the Cypress test, without opening it.
- C) Leave the round trip to Jest.

**Decision**: A. It opens the real page as a collection page's link would, so it checks the standalone wiring too. Chrome is the CI job's browser; Electron returns `null` from `window.open` and lists the test as pending rather than passing it. B and C check the two functions against each other but never load the page.

### RESOLVED: Judgment call: the report item's CSS
**Context**: `report-item.tsx` imports `interactive.scss` for the body's margin and font, which also carries the runtime placeholder's few rules.
**Options considered**:
- A) Share `interactive.scss`.
- B) A separate stylesheet with only the body rules.

**Decision**: A. The report item renders nothing but "Loading..." (or, opened directly, one line) before MARK-19, and the extra rules are a few hundred bytes. MARK-19 can split it when the report item gets its own layout.

## Self-Review

Roles: the commit reviewer (does each step apply and pass on its own), the test writer (can each test fail), the operator (do the checks the plan asks for work as written), and the PR's reviewer (a developer newer to the repo). Each finding came from replaying the plan: every step was applied from this file's own code blocks and diffs, in order, to a scratch clone of this branch on MARK-12's branch. Then the type checks, the three lint commands, Jest and the production build ran at each step, and Cypress from the fake Activity Player step on.

### Commit Reviewer

#### RESOLVED: the `index-top.html` hunk didn't apply
The diff added `chunks: ['main']` after `publicPath: DEPLOY_PATH,`, but the base's line has no trailing comma, so the hunk matched nothing. The diff now changes that line too. Every other hunk applied as written, and each step passed its checks on its own: Jest at 56, 89, 106, 106, 106, 109 and 116 tests through the seven code steps, a warning-free build, and no lint or type errors.

---

### Operator

#### RESOLVED: R2's source-map check could not run
The check loaded each map with `require`, which treats a `.map` file as JavaScript and throws on its first line. It now reads the files with `fs.readFileSync` and `JSON.parse`, and prints `[ 'file' ]` at the runtime step, as the requirements expect. The `diff -r` commands became `diff -rq`, since a full diff of two source maps prints megabytes.

---

### Test Writer

#### RESOLVED: the frame-height test was flaky, and its comparison could not fail
It read the frame's height as soon as the form appeared, before the form's first height message, and got 20 px in 2 of 3 full runs. It also compared the frame with the page's `scrollHeight`, which is never less than the frame's own height, so a frame grown too tall still matched. A `frameFitsInteractive` command now waits until the frame is as tall as the root element's own box, and both height tests use it. With the library's `useAutoSetHeight` swapped in, the authoring height test fails; as written, the whole suite passed five runs in a row.

---

A second pass added the senior engineer, a WCAG accessibility expert and a QA engineer to the roles above. Each finding below was checked in the scratch copy built from this file's blocks: a probe or contrast calculation for the defect, and a mutation for each test change, which fails the changed test and passed it before.

### Senior Engineer

#### RESOLVED: the demo's runtime got 1,027 px of Standard's 1,044, behind a scrollbar
The frame's dashed border sat inside a `border-box` frame, so the frame's content was 2 px shorter than the height the interactive reported, the interactive scrolled, and its scrollbar took 15 px more. The width tests read the frame's outer width, so they passed. The edge is now an outline, which takes no room (R17), and `runtimeFrameWidth` reads the width the running interactive lays out in; with the border back, both width tests fail.

---

### WCAG Accessibility Expert

#### RESOLVED: the demo's teal text was 3.7:1
`#0592af` on white, and white on it, is 3.7:1, under AA's 4.5:1 for the 14 px width choice and the Copy and Open buttons. The page now uses the Activity Player's `$cc-teal-dark2`, `#016082` (7.0:1), from one `$teal` variable in place of six copies.

#### RESOLVED: the authoring form's focus indicator was 2.4:1
`outline: 0` left the `#66afe9` border and glow as the only sign of focus on the selects and the textarea, 2.4:1 against white, under the 3:1 of SC 1.4.11. The rule no longer removes the browser's focus ring.

---

### QA Engineer

#### RESOLVED: the Send to CODAP note test never checked the box
Named "whether or not it is checked", it checked only the unchecked state, and passed with the note left off while checked. It now checks the box and looks again.

#### RESOLVED: a saved state's checkboxes weren't checked on opening
"Opens showing a saved state" covered the selects, the Ordering boxes and the Graph's starting state only. With a pane's availability always checked, or the Download data files or probabilities' starting state always unchecked, every test passed. The saved state now sets every pane and button against its default, and the test checks each box.

#### RESOLVED: the invalid pane availability case couldn't fail
It used the Graph pane, which the Graph rule makes available with Draw on whatever was read, so `authored-state.test.ts` passed with pane availability read unchecked (only the URL test caught it). The case uses the Inspect pane.

---

### PR Reviewer

#### RESOLVED: the disabled checkbox's cursor rule matched nothing
`input:disabled + *` needs an element after the input, and the label's text is a text node, so the disabled Graph pane's label kept the pointer cursor (measured). It is now `label:has(input:disabled)`.

#### RESOLVED: `modifyObstructiveCode`'s comment named only the plugin's reason
The interactive's tests need it as much: with Cypress's default, 5 of the 7 runtime tests fail (the Technical Notes said 4 of 6, counted before the URL test). The runtime step extends MARK-11's comment.

---

### Operator

#### RESOLVED: step sizes re-measured
The README step is 27 lines, not 28. The fixes above make the runtime-tests step 275, the authoring step 531 and the demo step 444; Jest stays at 116 and Cypress at 78.
