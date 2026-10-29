# The Markov AP Interactive, with Authoring

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-13
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Add a second app to this repo, the Markov Interactive, that runs in the Activity Player instead of CODAP. In this story it has an authoring form for every setting in Rebecca's AP spec, a placeholder student view that lists the settings, a placeholder teacher-dashboard answer, and a demo page that shows the form and the student view side by side, so activities can be authored while the student view is designed. The CODAP plugin and its deployed files do not change.

## Project Owner Overview

Rebecca's Markov Tech Specs (AP) doc moves the Markov chain work out of CODAP and into an Activity Player interactive with a new design, while the CODAP plugin stays exactly as it is for the ELA module. This story is the first piece of that interactive: an author can add "Markov Interactive" to an activity page in LARA, choose which modes, panes and buttons students get and which start open, pick the input view and capitalization, set how "Order matters" starts and whether students can change it, and type the starting text (for example a large bag of words). Every choice is saved with the activity.

Students who open the interactive see "Markov interactive: coming soon" with the author's settings listed, so authors and Rebecca can check that each setting was saved. The class dashboard shows the student as having opened it, with a placeholder answer, so the dashboard is wired up for the summary story later. Opened on its own, outside the Activity Player (for example from a link on a collection page), it shows the same placeholder with the settings its link gives, the default for any it doesn't, and saves nothing; inside the Activity Player, settings in its link are ignored. A demo and standalone authoring page shows the authoring form and the student view side by side at the widths the Activity Player gives them, so anyone can try it from a link without LARA or an activity, and a link can open it at a chosen page width. Under the form, it gives the standalone link for the current settings, to copy or open, with a warning that the link is for use outside the Activity Player only. The student view itself is designed with Rebecca after this story is built, and built in the stories that follow, for an interactive that spans the full width of an Activity Player page.

## Background

MARK-13 is the first of the AP interactive stories (MARK-13 to MARK-19, feature stories 1 to 7 in the stream's `feature-stories-draft.md`). It stacks on the "before the features" stories: master, MARK-6, MARK-20, MARK-8, MARK-9, MARK-10, MARK-11 and MARK-12. This branch sits on MARK-12's, so all of them are implemented, and MARK-11's and MARK-12's closed specs are in `specs/`. This spec relies on what they landed: React 19.3 with `createRoot` and ts-loader's `configFile` (MARK-12), MARK-11's dev-only `fake-codap.html` webpack entry, fake-CODAP page, Cypress configuration and `cypress` CI job, and MARK-10's `build_test` CI job. Code is cited as it is in this checkout.

### What the Jira story says, checked

- **"A new build entry with its own HTML file, deployed beside the plugin."** Correct, with one condition: the plugin's deployed files must not change, because the ELA module loads them. Adding two production entries (`interactive` and `report-item`) to `webpack.config.js`, with the plugin's two HTML files limited to the plugin's chunk, gave a production `dist/` whose plugin files are byte-identical (measured, Technical Notes). The one difference is a field inside the plugin's source map, which nothing loads.
- **"Initialized with `@concord-consortium/lara-interactive-api` (runtime and authoring modes, authored and interactive state)."** Correct. The newest release, 1.15.0, works with React 19.3.1 and the versions MARK-12 installed (Technical Notes). LARA shows an interactive's authoring form only after the interactive reports `authoredState` among its supported features (`interactive-authoring.tsx:41` in LARA), so that call is required, not optional. The Activity Player only sends `runtime` and `report` modes. Authoring mode comes from LARA alone.
- **"Every setting from the spec saved in authored state."** Correct. The settings come from Rebecca's doc ("AP aspects needed"; "Refactor the two modes", item 1), her answers (capitalization is an author setting, first choice; the starting text, from "Decided unless you object") and her Slack thread of 2026-10-27 ("Order matters" starts on or off and the author decides whether students see the switch; a "Data / Draw" switch appears when both modes are on). The tracker records all of these. The doc does not list the panes and buttons by name. The list here (R6) is taken from the doc's layout and features.
- **"The runtime shows a placeholder with the authored settings listed."** Correct. For the student to appear in the dashboard at all, the runtime must also save interactive state. An answer exists only after the interactive sends interactive state, and an empty `{}` counts as no answer (portal-report `answer-utils.ts:180-202`). So the placeholder saves a small, non-empty state (R12).
- **"A report-item build entry that answers the class dashboard with placeholder compact and full answers."** Partly correct. The interactive does not declare its report item's URL; LARA holds it with the interactive's own URL. The dashboard grid draws its own answered or not-answered icon and uses only a `score` item from a compact answer (portal-report `answer-compact.tsx:56-57, 82-85`), so a placeholder compact answer shows nothing extra. A placeholder full answer shows when a teacher opens the student's answer. Both are still answered, so the wiring is in place for MARK-19.
- **"Opened directly, outside the Activity Player, the interactive runs with the settings given in its URL, one readable parameter per setting, and the default for any not given, and saves nothing. Inside the Activity Player, URL settings are ignored."** Correct, as a requirement of its own: an interactive that waits for its host's init message shows "Loading..." forever when opened directly, and the library logs "Interactive API is meant to be used in iframe" (measured in Chrome). So the interactive tells the two cases apart before it renders, and only the standalone case reads its URL (R14, Technical Notes).
- **"Demo and standalone authoring page ... a link to the interactive running standalone with the current settings, to copy or open."** Correct (R16). The link is built from the same list of settings the URL is read with, so the two can't disagree, and a Cypress test opens it to check (R21).
- **"Logs the interactions it adds and starts `LOGGED-EVENTS.md`."** This story adds no interaction to log: the runtime is a placeholder, and authoring isn't logged. `LOGGED-EVENTS.md` starts with the first story that logs an event (R19).

### Prior art looked at

- **question-interactives** (`~/projects/question-interactives`, lara-interactive-api 1.14.0, React 17): the base app's mode switch, `setSupportedFeatures({interactiveState: true, authoredState: true})`, a `version` field on every authored state, a separate report-item entry per package using `useReportItem`, saving authored state on every change, and a container-based height hook. Its authoring forms are react-jsonschema-form with Bootstrap 3 styles. Taken: the layout conventions (Technical Notes, "Authoring form layout"), not the form framework.
- **sensor-interactive** (`~/projects/sensor-interactive`): a plain React authoring form with one exported `defaultAuthoredState` shared by authoring and runtime, and a small update helper using `setAuthoredState`'s updater form. The simplest fitting pattern, and the one followed here, with controlled inputs throughout.
- **tecrock-table**: its report-item entry uses `useReportItem`, cleaner than sensor-interactive's hand-written listener. **vortex**: a runtime `version` check and a defensive parse of authored state delivered as a JSON string. **hurricane-model** and **mass-sims**: lara-interactive-api already runs on React 19 in Concord repos.
- **Also looked at**, with nothing to take for authoring: activity-player (the host; it never sends authoring mode), dynamic-text and collaborative-learning (no authoring), alaskan-simulations and erosion-interactive (stubs), tecrock-simulation (a page that builds a URL to paste), geocode and sage-modeler-site (raw iframe-phone), wildfire, flooding and forestfire (URL parameters only). No model repo has a Cypress test with a fake Activity Player parent. question-interactives' `wrapper` package is the only one, and the fake AP page here follows its approach.

### Where the next stories build

- **MARK-14** (shared components) splits the plugin's UI and logic from its CODAP wiring. MARK-13 imports nothing from the plugin's components and changes none of them, so MARK-14's split starts from the plugin as it is.
- **MARK-15 to MARK-18** read the authored state (R4 to R9) and add settings to it without breaking saved activities (R10). The runtime placeholder is replaced by the real student view, whose design is settled with Rebecca after this story is built.
- **MARK-16** adds the "Data / Draw" switch and the "Order matters" switch, both driven by settings here, and opens Draw mode with the Graph pane open whatever its Data starting state (R6). **MARK-17** replaces the placeholder interactive state with saved work and adds the history scrubber's read-only view. **MARK-19** fills in the report item's placeholder answers.

## Requirements

### Build and deploy

- **R1.** `npm run build` produces three new pages in `dist/`, beside the plugin's `index.html`: `interactive.html` (the interactive, in every mode LARA and the Activity Player use), `report-item.html` (the report item) and `demo.html` (R16). Each loads only its own script and styles.
- **R2.** The CODAP plugin's production build does not change. Its `index.html`, `index-top.html` (in a `DEPLOY_PATH` build), favicon, scripts, styles and license files are byte-identical to those the base branch builds, and its JavaScript source map differs only in its `file` field (Technical Notes). The release workflow, which copies `index-top.html` to the top-level `index.html`, is unchanged. Checked by building `dist/` on the base branch and on the head and comparing them, for `npm run build` and for a `DEPLOY_PATH=branch/x/` build.
- **R3.** No source file the plugin builds from changes. The interactive's code lives in its own folder and does not import the plugin's components, hooks or utilities.

### Authored state

- **R4.** The authored state has a TypeScript type, `MarkovAuthoredState`, with a numeric `version` field, `1` in this story. Every authored state the authoring form saves carries `version: 1` and every setting below.
- **R5.** Modes: whether **Data** (saved as `useData`) and **Draw** are each available (both by default), and which one students start in when both are (Data by default). At least one mode is always available. The form offers them as one choice of usable modes: Draw, Data, or Both (with a toggle switch for students), saved as the two modes' availability. Students draw on the graph, so while Draw is available the Graph pane is too.
- **R6.** Panes and buttons, each with whether it is available and whether it starts open (a pane) or on (a toggle button):
  - Panes: **Input**, **Graph**, **Inspect** and **Sequence generator**. Each is available and starts open by default. The Input pane applies to Data only. The Graph pane can be made unavailable only without Draw (R5), and its starting state applies to Data only: Draw starts blank with its tools on the graph, so Draw mode always opens the Graph pane. With both modes its label says so ("Open at the start in Data mode"); with Data alone it is a plain "Open at the start".
  - Buttons: the **Show probabilities** toggle (available, starts off), **Send to CODAP** and **Download data files** (`downloadTables`). The last two are not available by default and have no on or off state. MARK-13 saves the download setting only: MARK-18 builds the button, which students see as "Download tables" and which downloads the checked tables, the same four Send to CODAP sends, as CSV files. The probabilities' starting state applies whether or not students have the toggle, as "Order matters" does (R9): without the toggle, probabilities stay shown or hidden as set. Send to CODAP works only on a page that also has a CODAP interactive with the Datalog plugin, linked to this one (MARK-18), so it is off until an author turns it on.
  - A pane that is not available has no "Open at the start" choice.
- **R7.** Input view: **table only**, **text only**, or **linked table and text** (the default). Data only.
- **R8.** Capitalization: whether "The" and "the" are **the same word** (the default, saved as `lowercase`) or **different words** (`asTyped`). Data only. Whether the text box shows a student's capitals is MARK-15's.
- **R9.** Data mode's other two settings:
  - "Order matters": whether it starts **on** (the default) or off, and whether students **see the switch** (the default) or not.
  - Starting text: the text students start with in the input, empty by default, up to 20,000 characters (Technical Notes, "Size of the authored state"). It applies in every input view; how it fills the table is MARK-15's.
- **R10.** Reading the authored state never fails and never breaks a saved activity:
  - A missing authored state, `{}` (what LARA sends for a new interactive), or a JSON string of an authored state all read as a complete `MarkovAuthoredState`.
  - A missing or invalid setting takes its default and leaves the other settings as saved. Any string is a valid starting text, even one longer than the form allows (LARA's Admin tab can edit the JSON), so reading never drops an author's text. A setting MARK-15 to MARK-19 add is read the same way from activities saved before it existed, so adding a setting needs no version change.
  - A state that breaks R5 (no mode available, a starting mode that is not available, or Draw available without the Graph pane) reads as the nearest valid state: no mode available reads as both available; an unavailable starting mode reads as the available one; the Graph pane reads as available while Draw is.
  - Reading a complete, valid authored state returns it unchanged, and reading what reading returned changes nothing.
  - The version changes only when a setting's meaning changes; that story then reads version 1 states by converting them. A default, once released, keeps its meaning, so an activity saved before a setting existed keeps behaving as it did.

### Authoring

- **R11.** In authoring mode, the interactive shows a form with every setting in R5 to R9, laid out to LARA's authoring column (Technical Notes, "Authoring form layout"):
  - In every mode, it tells the host that it supports authored and interactive state; LARA shows an interactive's authoring form only after it does (Background).
  - It opens showing the saved settings, or the defaults for a new interactive.
  - Each change is saved at once with `setAuthoredState`, with no Save button of its own (LARA's Save stores it). Typing in the starting text saves too, so nothing is lost if the author clicks LARA's Save without leaving the field.
  - It cannot produce a state R10 would correct or LARA cannot store: the starting text stops at 20,000 characters and shows how many are left once fewer than 1,000 are; no choice of usable modes leaves students without one; and while Draw is available the Graph pane's checkbox is checked and disabled, with help text saying why, and turning Draw on makes the Graph pane available.
  - The sections, as Rebecca laid them out in her doc's "Authoring" section: **Modes** (the usable modes, then the starting mode); **Data settings** (how students enter their data; capital letters; **Ordering**, the two "Order matters" settings, with help saying what each setting means for the next word; and the starting data, empty when students will generate their own); **What students can see** (the four panes, then "Probabilities shown at the start", the probabilities toggle, and a **Send data buttons** group: Send to CODAP and Download data files). A choice that includes both options comes last, and the table comes before the text: Draw / Data / Both, and Table only / Text only / Linked table and text.
  - A setting that applies only while something else is on is left off the page while that is off: the Data settings section and the Input pane without Data; the starting mode without both modes; a pane's "Open at the start" while the pane isn't available; the Graph pane's "Open at the start" without Data. A hidden setting keeps its value, and comes back as it was. The probabilities' starting state is always shown (R6).
  - Send to CODAP has a note tied to it, always shown: it requires a linked CODAP interactive with the Datalog plugin on the page to work.
  - Every control has a visible label tied to it, so a screen reader announces it, and help text, tied to its control the same way, where the setting's effect isn't obvious from its label (the modes, the input view, "Order matters", the starting data, the Graph pane while Draw is on, the probabilities, Send to CODAP). Under the usable modes and the input view, the help describes the option chosen and changes with it (the linked text and table, for example: students see their text and a table of its words, and changing one changes the other). Help text for a setting that isn't shown is left off with it, so it is never read for a control that isn't there. Every control works from the keyboard, in the order it is shown.
  - Labels come from one list shared with the runtime's settings list (R12), so the two cannot disagree.
  - It fits LARA's authoring column with no horizontal scrolling from 420px wide, and reports its content height so LARA sizes the frame to it, growing and shrinking with the form.
  - It shows nothing LARA's dialog already provides: no name, Save or Cancel, aspect ratio, click to play, question number, answer history or "Clear and start over" settings.

### Runtime

- **R12.** In runtime mode, the interactive shows "Markov interactive: coming soon" and a list of the authored settings, in the authoring form's order, each with the same label the form uses (a pane's starting state as "<pane>: Open at the start") and its value, read as R10 describes, and leaving out what the form leaves out. The starting text is listed as its first 100 characters, followed by "..." when it is longer, and its length in characters, so a large bag of words doesn't fill the page; an empty one is listed as "(empty)". It saves an interactive state of `{ version: 1 }` when it opens with none (no interactive state, or `{}`), so the student has an answer in the report; it does not overwrite an interactive state that already exists. It reports its content height.
- **R13.** In any other mode (`report`, or a mode it doesn't know), it shows a short message saying the mode isn't supported yet, rather than nothing.

### Opened outside a host

- **R14.** Opened directly, not in a frame (for example from a link on a collection page, as ConnectedBio's interactives can be):
  - `interactive.html` shows the runtime placeholder at once, listing the settings its URL gives, with a note that they come from the link and nothing is saved. It doesn't wait for a host.
  - **Settings in the URL:** one parameter per setting (R4 to R9), named by its path in the authored state, with `true` or `false`, or text: `?modes.draw=false&panes.inspect.available=false&buttons.probabilities.startsOn=true&orderMatters.showSwitch=false&startingText=the+cat+sat`. They are read as R10 reads a saved state, so a missing, unknown or invalid value takes its default. The parameters and their types come from the authored state's defaults, not from a list kept beside them (Technical Notes, "Settings in a standalone link").
  - **Inside a host the URL is ignored:** authored state is the only source of settings, whatever the interactive's URL carries.
  - It sends nothing: no message to a parent, so no interactive state, height or supported features. Reopening it starts over.
  - `report-item.html` says what it is ("This is the Markov interactive's report item. It shows a student's answer in the class dashboard.") rather than waiting for the dashboard.
  - Authoring starts only from LARA's init message, so a page opened directly never shows the form. The demo page (R16) is where to try authoring outside LARA.
  - "Not in a frame" is the test (Technical Notes, "Telling a page opened directly from one in a host"). A page in a frame whose host never sends an init message still shows "Loading...".

### Report item

- **R15.** `report-item.html` answers the class dashboard's report requests:
  - It tells the host it is ready and that it provides compact answers.
  - A full answer is one `html` item, with the host's `tall` and `wide` blocks, saying the student opened the Markov interactive and that a summary of their work comes in a later version.
  - A compact answer has no items, so the dashboard grid shows its own answered icon.
  - It answers each request for the student it names, and reports its height.

### Demo

- **R16.** `npm run build` also produces `demo.html`, deployed beside the interactive, so developers and the project team can try the interactive without LARA or an activity:
  - The authoring form on the left, in a frame as wide as LARA's authoring column (435 px, Technical Notes), sized to the form's height.
  - The runtime on the right. Each authoring change restarts it with the new authored state once the author pauses (half a second), and the interactive state it saves is kept across restarts, as the Activity Player keeps a student's.
  - The report item's full answer below the runtime.
  - It starts from the defaults with a short sample starting text. Nothing is kept across a reload.
  - **The standalone link,** under the authoring form: a read-only field with the URL of `interactive.html` beside the page, carrying the form's current settings (R14), updated with each change, with **Copy** (to the clipboard) and **Open** (in a new tab). The link holds only the settings that differ from the defaults. Right under the field: "Use this link only outside the Activity Player, such as on a collection page. In LARA, add the interactive's plain URL and choose its settings in the Authoring tab: settings in this link are ignored inside an activity." Above 2,000 characters (a long starting text), a note says the link is long and some sites and email programs cut long links short.
  - The page's title and heading are "Demo and Standalone Authoring". The file stays `demo.html`.
- **R17.** A width choice at the top right of the runtime area sets the runtime frame to a full-width item's width in each Activity Player layout (Technical Notes, "The Activity Player's widths"): **Standard (1100px)**, the default, 1,044 px; **iPad Friendly (960px)**, 904 px; **Responsive**, the whole runtime area. The interactive in the frame gets all of that width: the frame's edge is marked without taking any of it, and the frame is as tall as its content, so it never shows a scrollbar. A frame wider than the area scrolls sideways rather than shrinking. The choice is one radio group a keyboard can use. `?width=1100`, `?width=960` or `?width=responsive` in the page's URL opens it at that width (any other value opens Standard), and choosing a width puts it in the URL, so a link can be sent with the width set.
- **R18.** The runtime is designed for a full-width item in an Activity Player page: 1,044 px in the Standard layout, 904 px in iPad Friendly, and wider in a responsive section. The interactive can't make an author place it full width; a narrower placement (Half Width, about 517 px, or a 365 px column of a two-column section) still works but is not what the design is for. This is the student view's design assumption for MARK-15 onward; MARK-13's placeholder only has to be fluid.

### Logging

- **R19.** No logging is added, and no `LOGGED-EVENTS.md`: the authoring form isn't logged, and the placeholder runtime has no student interactions. The first story that logs an event starts the file.

### Tests

- **R20.** Jest tests cover reading the authored state (R10), with expected values written out in the test rather than taken from the code's defaults, so a changed default fails a test: each default, a partial state, each invalid value, `{}`, `null` and a JSON string, each R5 correction, unchanged on a complete state, and no change on a second read. They also cover the usable modes' mapping to the two modes' availability (R5), the settings list the runtime shows (R12), including what it leaves out, the report item's answers (R15), for both answer types, the demo's widths and how it reads `?width=` (R17), and the interactive and the report item opened outside a host (R14), in jsdom, whose window is its own top window as a page opened directly is: what each shows, that neither makes the library's client, and that the interactive takes its settings from its URL. They also cover reading and building the URL settings: every setting by its path, each kind of value, invalid, unknown and missing values reading as defaults, only differing settings in a link, and a link reading back as the state it was built from.
- **R21.** Cypress tests load the interactive's entries on a fake Activity Player page served by the development server only, beside MARK-11's fake-CODAP page and using its configuration, error check and CI job:
  - **Authoring:** a new interactive shows the defaults; each control saves its setting, and only that setting changes; the starting text stops at its limit; a saved state opens showing its values; the sections come in R11's order; the help under the usable modes and the input view follows the option chosen; the starting mode is offered only with both modes and moves to a mode students have; settings R11 hides are hidden and come back as they were; the Graph pane is checked, disabled and explained while Draw is on, turning Draw on saves it as available, and its starting state's label names Data only with both modes; the probabilities' starting state stays with the toggle off; the Send to CODAP note is always tied to its checkbox; the download setting saves; and the reported height follows the form.
  - **Runtime:** the placeholder lists every setting with its saved value; settings in the interactive's URL that differ from the authored state are ignored; it saves `{ version: 1 }` when there is no interactive state, and nothing when there is one.
  - **Report item:** a full-answer request gets the placeholder `html` item, and a compact one gets no items.
  - **Demo** (on `demo.html` itself): the Standard width by default, a width from the link, a chosen width put in the link, an authoring change reaching the runtime, the report item's answer, the page's title, the standalone link with only the changed settings and its warning, the long-link note, and a round trip: settings chosen in the form, the link opened in a window of its own, and its placeholder listing the same settings as the hosted runtime. The round trip runs in Chrome, as the CI job does (Technical Notes).
- **R22.** On Node 24 after `npm ci`, on every commit and on the head: `npm run build` compiles with no warnings; `npm run lint`, `lint:build` and `lint:style` print nothing; `npx tsc --noEmit -p .` and `npx tsc --noEmit -p cypress` pass; `npm test` and `npm run test:cypress` (against `npm start`) pass, including MARK-10's, MARK-11's and MARK-12's tests unchanged, and the Cypress tests also pass with `--browser chrome`, the CI job's browser, which the round trip needs.

### CI and documentation

- **R23.** The existing CI jobs build, test and deploy the interactive: `build_test` runs the new Jest tests, `cypress` runs the new Cypress tests, and `s3-deploy` deploys `interactive.html`, `report-item.html` and `demo.html` with the plugin. No job is added or changed.
- **R24.** The README has a section on the Markov Interactive: its deployed URLs for a branch and a version, the Demo and Standalone Authoring page (`demo.html`) with its `?width=` parameter and its standalone link, settings in a standalone URL and that the Activity Player ignores them, and how to open it in development.
- **R25.** Dependency and lockfile changes are in a commit of their own, separate from code changes.

### Done when

- **R26.** On the branch deploy: an author adds "Markov Interactive" to an activity page, sets every option, saves, and on reopening sees every setting as saved; a student run in the Activity Player shows the placeholder with those settings; and the class dashboard shows that student as having answered, with the placeholder full answer when the answer is opened. Opened directly from the branch deploy, `interactive.html` shows the placeholder with the default settings, a link copied from the demo page opens it with that link's settings, and `report-item.html` shows its message. *(Checked by hand on the branch deploy, recorded in the PR.)*

## Technical Notes

### The library and React 19 (measured 2026-10-29, scratch copy of this branch, Node 24.14)

- `@concord-consortium/lara-interactive-api` 1.15.0 is the newest release (published 2026-10-08). It peers on `react` and `react-dom` `>=16.9.0`, and depends on `iframe-phone ^1.3.1` and `nanoid ^3.3.7`. Its `index.js` is a UMD bundle with iframe-phone and nanoid built in, which requires only `react`. Its package has no `exports` map, only `main` and `types`, so it resolves under TypeScript's `bundler` resolution, unlike iframe-phone 1.4.0 (MARK-12's R5).
- Installed on top of MARK-12's versions (React 19.3.1, `@types/react` 19.3, `@testing-library/react` 16.3.3, d3 7.9, nanoid 6.0.2, clsx 2.1, iframe-phone pinned at 1.3.1), `npm install` printed no peer warnings. npm keeps one iframe-phone (1.3.1, deduped) and installs nanoid 3 under the library; the plugin's nanoid 6 is unchanged.
- A throwaway interactive using `useInitMessage`, `useAuthoredState`, `useInteractiveState`, `setSupportedFeatures`, `useReportItem` and `sendReportItemAnswer` type-checks with `tsc` under TypeScript 6.0.3 and builds with webpack. In Chromium, on a throwaway fake Activity Player page using iframe-phone's `ParentEndpoint`: authoring mode rendered its form and posted `supportedFeatures`, then an `authoredState` for each change; runtime mode rendered the placeholder and posted `interactiveState` after the library's 2-second debounce; the report item posted `reportItemClientReady` with `compactAnswerReportItemsAvailable: true`, then a `reportItemAnswer` for a full and a compact request. No React warnings or errors were logged.
- **Height:** the library's `useAutoSetHeight` reports the largest of the body's and the document's heights, including `documentElement.clientHeight`, the frame's own height. So it can grow the frame but never shrink it (it reported 150 px, the frame's default height, for a shorter page). R11 asks for a frame that shrinks too, so the interactive measures its own root element instead, as question-interactives' `useAutoHeight` does. A throwaway hook that observes the root element with a `ResizeObserver` and sends `setHeight` with its height reported 360, then 40 after a 300 px block was hidden, then 360 again. With the browser's default 8 px body margin, the frame was 16 px shorter than the page and clipped it (LARA's frame doesn't scroll), so the interactive's pages set the body's margin to 0.
- **Cypress on a fake Activity Player page:** a throwaway Cypress 16 test, on a dev-server page hosting the interactive through iframe-phone's `ParentEndpoint` and recording every message the interactive posts in a window variable, clicked an authoring checkbox and read the one `authoredState` it caused, read the runtime's `interactiveState`, and read the report item's compact answer. It passed twice in Chrome. The dev server's lint-warning overlay covers the page when the code has lint warnings, which R22's clean lint rules out.
- **The report item request has no `requestId`.** portal-report posts `getReportItemAnswer` without one (`report-reducer.ts:338-348`), and the library's listener only calls handlers whose `requestId` matches, so a test page that adds one gets no answer. Found the hard way in the throwaway page.

### The deployed build (measured 2026-10-29, a scratch copy of this branch on MARK-12's)

- With `interactive` and `report-item` entries added beside the plugin's `main`, each with its own `HtmlWebpackPlugin`, and the plugin's `index.html` and `index-top.html` given `chunks: ['main']`: `npm run build` and a `DEPLOY_PATH=branch/x/` build produced the plugin's `index.html`, `index-top.html`, `favicon.ico`, `assets/index.<hash>.js`, its `LICENSE.txt`, `assets/main.<hash>.css` and its map byte-identical to the base's. New files: `interactive.html`, `report-item.html`, and `assets/interactive.<hash>.js` and `assets/report-item.<hash>.js` with their maps and license files. Without `chunks: ['main']`, `HtmlWebpackPlugin`'s default puts every entry's script in the plugin's pages.
- The plugin's `assets/index.<hash>.js.map` differs in one field, `file`, which holds webpack's interim hash for the chunk rather than the real file name. That hash moved even when the new files were only present under `src/` and not built, so it follows the TypeScript program, not the plugin's code. Every other field matched, the JavaScript's `sourceMappingURL` comment points at the same file name, and browsers don't read `file`. Base builds were deterministic, so the comparison is meaningful.
- MARK-11's `output.filename` function already names any chunk other than `main` `assets/[name].[contenthash].js`, and the CSS plugin names CSS after the chunk, so the new entries need no change to `output`.
- The interactive's script was 312 KB minified, the report item's 301 KB and the demo's 229 KB (React 19 and the library each; the plugin's is 355 KB). Nothing has a size budget.
- Branch builds deploy to `https://models-resources.concord.org/markov-chain-plugin/branch/<name>/`, with the Jira prefix stripped, so MARK-13's interactive is at `branch/ap-interactive-authoring/interactive.html`. A tag deploys to `version/<tag>/interactive.html`.

### Size of the authored state

LARA keeps a managed interactive's authored state in a MySQL `text` column (`authored_state`, `db/schema.rb:433` in LARA, `adapter: mysql2`), which holds at most 65,535 bytes. Depending on the server's SQL mode, a longer value either fails to save or is cut off, and a cut-off JSON value no longer parses, which breaks the item in authoring and at runtime. Everything but the starting text is under 1 KB of JSON. Counted the way a textarea's `maxLength` counts (UTF-16 code units), no unit takes more than 3 bytes of UTF-8, since a 4-byte character such as an emoji counts as two. JSON escapes quotes and backslashes as 2 bytes and control characters as 6, and a starting text has few of either beyond line breaks (2 bytes). So 20,000 units stay under about 61 KB, inside the column's limit. 20,000 characters is about 3,500 English words, which covers the "large bag of words" Rebecca's answer asks for; if she needs more, the limit is one constant.

### LARA's authoring panel (measured on Doug's local LARA, 2026-10-29)

The item edit dialog takes 80% of the window. Its left column holds LARA's fields (about 235 px of them: Name, Half Width, then the Authoring, Advanced Options and Admin tabs) and the authoring iframe, and scrolls; the right column is a runtime preview, hidden under 800 px. Cancel and Save are a fixed 40 px bar at the bottom of the left column.

| Window | Authoring iframe width | Visible column height |
|---|---|---|
| 1920 x 1080 | 449 px | 788 px |
| 1440 x 900 | 438 px | 644 px |
| 1280 x 800 | 432 px | 564 px |
| 1024 x 768 | 420 px | 526 px |
| 780 x 700 | 575 px (preview hidden) | 472 px |

- The iframe has `scrolling="no"` and no border, padding or margin, and is exactly as tall as the last height the interactive reported. With no report, it is width divided by the aspect ratio (about 331 px at 438 px wide with the default 576 x 435), or 300 px.
- So the form: lays out fluidly from 420 px, designed for about 435 px; reports its height on every size change; uses no `100vh`, fixed or sticky elements, or inner scroll areas (the column scrolls); and needs no bottom padding of its own, since LARA pads the column's bottom by 30 px under the button bar.

### The Activity Player's widths (read from activity-player's styles, 2026-10-29; not measured in a running Activity Player)

- An activity page is 1100 px wide by default, 960 px for "iPad Friendly", or the window's width (`src/components/app.scss:108-121`). LARA's "Activity Page Fixed Width" offers only the first two, "Standard (1100px)" and "iPad Friendly (960px)" (`app/models/fixed_width_layout.rb:4-5`); the window width comes from a section with a responsive layout (`activity-page-content.tsx:114-126`).
- Inside it, the page has 20 px of padding each side (`activity-page-content.scss:7`) and a section 8 px of margin (`section.scss:7`), and a full-width item spans the section's ten grid columns (`section.scss:15-18`). So a full-width item is 1,044 px wide in Standard and 904 px in iPad Friendly. Half Width halves it, and a two-column layout's narrow column is 365 px (`section.scss:151-152`).
- question-interactives' demo (`packages/helpers/src/components/demo.tsx`) splits the window in half and runs each frame through a nested iframe; its pub-sub, job, dynamic-text and log-monitor support is beyond what one placeholder interactive needs. The Markov demo hosts its two frames directly.

### Telling a page opened directly from one in a host (read and measured 2026-10-29)

- **The check:** `inIframe()` from lara-interactive-api 1.15.0 (`in-frame.ts`): `window.self !== window.top`, worked out once when the library loads, and true if reading `window.top` throws. Comparing the two references never reads a cross-origin property. hurricane-model uses it to choose its standalone app or its LARA wrapper (`src/index.tsx:20`), and vortex and mass-sims (`packages/shared/src/utils/embedding.ts`) carry the same check. question-interactives has no standalone mode. `window.parent === window` gives the same answer for both cases here; the library's function keeps one definition, with its `try`.
- **Not a timeout:** the check answers on the first render, so a page opened directly never flashes "Loading...", and a slow host can't be taken for no host. A timeout long enough for LARA on a slow connection would leave a page opened directly on "Loading..." that long, and a shorter one would start a real student's runtime without saving. What the check doesn't cover, a frame whose parent isn't a host, isn't a case anyone has asked for: a link from a collection page opens the page on its own.
- **Standalone calls nothing in the library.** The library makes one client per page on its first call. At the top level that client never connects (iframe-phone says hello only to a parent, `iframe-endpoint.js:101`), so it sends nothing, but it warns "Interactive API is meant to be used in iframe", holds every message for good, and marks the interactive state unsaved, so leaving the page in the 2 seconds after a save asks "State has not been saved". So the hosted and standalone views are separate components, and only the hosted one uses the library. Measured in Chrome, opened directly: a page that waits for its host logged the warning and stayed on "Loading..."; the split page logs neither.
- **Cypress can't open a page on its own:** it runs every page inside its runner's frame, so `inIframe()` is true in every Cypress test. MARK-11's `modifyObstructiveCode: false` keeps it true. With Cypress's default, which rewrites `window.top` in the scripts it serves, the interactive ran standalone inside the fake Activity Player page and 5 of the 7 runtime tests failed (measured). So the Cypress tests cover the hosted side, and Jest in jsdom the standalone side.

### Settings in a standalone link (written 2026-10-29)

- **One source of truth.** The parameters are the leaves of `defaultAuthoredState`, by path, apart from `version`, and each leaf's default gives its type: a `true` or `false` setting reads `"true"` and `"false"` and nothing else, and any other setting reads as text. The partial state built from the URL goes through `readAuthoredState`, the reader for saved states (R10), which checks each value, so an invalid value, a setting the URL doesn't give, and a parameter that names no setting all come out as defaults. A setting added to the authored state is in the URL with no other change. A Jest test lists every path and type, so a setting with a type the URL can't carry (a number) fails it until the reading handles it.
- **Not tecrock-simulation's way.** Its `config.ts:209-237` (in `~/projects/tectonic-explorer`) guesses each value's type from how it looks, a number, a bracketed list or `true`, and spreads the result over its defaults unchecked, so a bad value reaches the model. Here nothing is guessed from a value, and nothing reaches the runtime unchecked.
- **The link** carries only the settings that differ from the defaults, so a default changed before release reaches standalone links, and a link stays readable. Its parameters come out in the defaults' order.
- **Length.** A starting text can be 20,000 characters (R9): 23,837 in a URL once encoded, for English prose with punctuation (measured), and more for accented letters, which take 6 each. Browsers accept that, but some sites, chat and email programs cut long links short, so the demo page notes a link above 2,000 characters, the usual rule of thumb, rather than refusing it.
- **The round trip needs a window of its own.** Cypress runs pages in its runner's frame, where the interactive is hosted (above), so the test opens the link with `window.open`, a top-level window. Cypress's Electron returns `null` for that (measured), and Chrome a window, so that one test is limited to Chrome, the CI job's browser, and Electron shows it as pending.

### Authoring form layout

Taken from question-interactives' forms (react-jsonschema-form's markup with Bootstrap 3 styles), as conventions, without the framework:

- Sections as `fieldset`s with a `legend` (18 px, a 1 px `#e5e5e5` rule below, 20 px below that), in this order: Modes, Data settings, What students can see. Ordering is a group inside Data settings, a `fieldset` whose `legend` is sized like a field's label. The starting data is the last of Data mode's settings, since it is the largest.
- Body text Helvetica Neue 14 px, `#333`. Labels bold, 5 px below. 15 px between fields.
- Text inputs, selects and the textarea are 100% wide, with 6 px by 12 px padding, a 1 px `#ccc` border and 4 px radius; selects 34 px tall. Focus: border `#66afe9` with a soft glow, over the browser's own focus ring, which stays because the border is 2.4:1 against white, under the 3:1 WCAG asks of a focus indicator. The starting text has 8 rows.
- Checkboxes have their label beside them (normal weight, 20 px left padding, 10 px above and below), not a second label above.
- Help text goes below its control in `#737373`, 5 px above and 10 px below. Labels are Rebecca's, in sentence case ("Usable mode(s)", "What students can see"). They are in `authored-state.ts`, shared with the runtime's list.
- Send data buttons is a group inside What students can see, like Ordering inside Data settings: a `fieldset` whose `legend` is sized like a field's label.
- Dependent controls (a pane's "Open at the start") are indented 24 px under the control they depend on, and dependent settings, the Data settings section included, are left off the page while what they depend on is off. Leaving them off rather than disabling them keeps settings that don't apply away from the author and from a screen reader, and shrinks the form.

### Where things are

| What | Where |
|---|---|
| The plugin's webpack config: MARK-11's dev-only `fake-codap` entry, `output.filename` function and `excludeChunks`, and MARK-12's ts-loader `configFile` | `webpack.config.js`; `specs/MARK-11-rendering-tests.md`, "Where the code is" |
| MARK-11's fake-CODAP page, which the fake Activity Player page follows: the frame found by its id, errors kept across a restart, listeners on the frame's first window | `cypress/fake-codap/fake-codap.ts`, `cypress/support/commands.ts`; `specs/MARK-11-rendering-tests.md`, "The page's commands" and "What the tests need to know about the browser" |
| MARK-12's click tests and the plugin's test helpers, which the interactive's tests leave alone | `cypress/e2e/clicks.test.ts`, `cypress/support/graph.ts` |
| The plugin's entry (`createRoot` after MARK-12) | `src/index.tsx` |
| A `ResizeObserver` hook already in the repo (plugin code, which R3 keeps out) | `src/hooks/use-resize-observer.ts` |
| The frame-error check every Cypress test runs | `cypress/support/e2e.js`; MARK-11's R5.10 |
| CI's `build_test` (MARK-10), `cypress` (MARK-11) and `s3-deploy` jobs | `.github/workflows/ci.yml` |
| The library's `inIframe()`, and hurricane-model's use of it | `~/projects/lara/lara-typescript/src/interactive-api-client/in-frame.ts`; `~/projects/hurricane-model/src/index.tsx:20` |
| LARA's authoring host, its `authoredState` parse and the `authoredState` feature check | `~/projects/lara/lara-typescript/src/page-item-authoring/common/components/interactive-authoring.tsx:27-41` |
| The library's hooks and `setAuthoredState` (sent at once) vs `setInteractiveState` (debounced 2 s) | `~/projects/lara/lara-typescript/src/interactive-api-client/hooks.ts`, `api.ts:83-154` |
| The dashboard's compact and full report item requests | `~/projects/portal-report/js/containers/portal-dashboard/answer-compact.tsx`, `js/reducers/report-reducer.ts:307-348`, `js/components/report/iframe-answer.tsx` |

## Out of Scope

- **The student view** (MARK-15 onward): its layout, the input text and table, the tokenizer, the graph, Inspect, the generator, the two switches and every behavior the settings will control. Its design is mocked up and settled with Rebecca after this story is built.
- **The shared components** (MARK-14). Nothing here moves or imports the plugin's code.
- **Saved student work** beyond the `{ version: 1 }` placeholder, and the history scrubber (MARK-17).
- **The dashboard summary** in the report item (MARK-19), and the `report` mode of the interactive itself.
- **Any change to the CODAP plugin**: its code, its deployed files, its saved documents and its logging.
- **Logging, and `LOGGED-EVENTS.md`** (R19): both start with the first story that logs an event, with the test that every logged event is in the file.
- **Keeping anything when opened outside a host** (R14): no host keeps a state, and browser storage isn't used.
- **The Download data files button itself** (MARK-18): MARK-13 only saves whether it is available (R6).
- **Shorter standalone links**, such as a saved settings id or a link shortener: a long starting text makes a long link (R16 notes it).
- **The plugin's version number and the release process.**
- **Authoring for drawing mode's tools**: Rebecca's answer is all tools on, so there is nothing to set.

## Open Questions

<!-- Requirements-focused questions only (scope, acceptance criteria, business rules).
     Implementation questions go in implementation.md. -->

### RESOLVED: Judgment call: where the interactive's pages are deployed
**Context**: question-interactives deploys each interactive in its own folder with a `report-item/` subfolder. This repo deploys the plugin's `index.html` at the root of `dist/`.
**Options considered**:
- A) `interactive.html` and `report-item.html` at the root of `dist/`, beside `index.html`.
- B) An `interactive/` folder with `index.html` and `report-item/index.html`.

**Decision**: A. The pages load `./assets/...` with the same `publicPath: '.'` the plugin's page uses, the report item's URL is a sibling of the interactive's, so LARA's "relative to the base URL" works if it ever does, and nothing about the plugin's deploy moves. B needs a different `publicPath` per folder and gains nothing a reader would notice.

### RESOLVED: Judgment call: panes and buttons as keyed records
**Context**: the student view isn't designed yet, so the list of panes and buttons may grow (R6).
**Options considered**:
- A) `panes` and `buttons` as records keyed by id, each `{ available, startsOpen }` or `{ available, startsOn }`, read with defaults per key (R10).
- B) A flat field per setting (`inspectAvailable`, `inspectStartsOpen`, ...).

**Decision**: A. A new pane or button is one key with a default, needs no version change, and the form and the runtime list both draw from the same list of ids and labels.

### RESOLVED: Judgment call: what the runtime saves as interactive state
**Context**: the dashboard shows a student only once interactive state exists and isn't empty (Background).
**Options considered**:
- A) `{ version: 1 }` when the interactive opens with none.
- B) Nothing, and the dashboard shows the student as not answered until MARK-17.
- C) Something richer, such as an "opened at" time.

**Decision**: A. The Jira story's done condition needs the student to appear; B fails it, and C is saved work MARK-17 owns. `version` lets MARK-17 tell its own state from this placeholder.

### RESOLVED: Judgment call: the demo ships in production builds
**Context**: question-interactives builds a `demo.html` for every interactive into its deploys. The Cypress tests already have a dev-only page that hosts the interactive.
**Options considered**:
- A) `demo.html` in every build, beside the interactive, with the fake Activity Player page kept for the tests and the init message they both send built in one shared module.
- B) A dev-only demo.
- C) One page for both, with test hooks in it.

**Decision**: A (Doug, 2026-10-29). The project team opens it from any branch or version URL, as with question-interactives. The fake page records messages and starts one mode at a time, which the tests need and a demo shouldn't carry.

### RESOLVED: Low confidence: the list of panes and buttons
**Context**: R6 names four panes and two buttons from the doc's layout and features, but the doc never lists them as authoring settings, and the student view's design is settled with Rebecca after this story. If a pane is merged, renamed or dropped, activities authored on the branch carry a setting that means nothing.
**Options considered**:
- A) Ship R6's list; Rebecca checks it when she tries the branch build, before code review (the tracker's rule for feature stories). Changes before release are free, since nothing is released.
- B) Ask Rebecca for the list before implementation.
- C) Leave panes and buttons out of MARK-13 and add them in MARK-15 with the layout.

**Decision**: A. The doc's "AP aspects needed" asks for exactly these two choices per pane and button ("will be available", "will start selected"), and its layout names the four panes and the probabilities toggle; Send to CODAP comes from Rebecca's answers. B holds up a story whose settings are reversible until release, and C leaves the Jira story's first authoring bullet undone. Because R10 reads each key with its default, MARK-15 can add a key (for example the generator's collapsible controls, which the doc says students can hide) or drop one before release without a version change. Rebecca sees the list in the form when she tries the branch build.

### RESOLVED: Low confidence: whether the Graph pane can be made unavailable
**Context**: R6 lets an author make any pane unavailable, including the Graph, which is the point of the interactive. The doc says the top three panels are collapsible and the author chooses which panes are available, without exceptions.
**Options considered**:
- A) The Graph is always available; the author only chooses whether it starts open.
- B) Every pane, the Graph included, can be unavailable, as the doc says.

**Decision**: B, except while Draw is available (Doug, 2026-10-29). The doc puts no exception on "which panes ... will be available", and a Data activity can lean on the Graph's absence (a black box first, or counts only in Inspect): the sequence generator generates from the chain's data, so without the Graph only its animation is lost. Draw can't work without it, since students draw on the graph, so R5 keeps it available while Draw is, and R10 reads a state that breaks that as the Graph available.

### RESOLVED: Decided with Doug: the authoring form's wording, layout and defaults (2026-10-29)
**Context**: Doug reviewed the form as a clickable mockup in LARA's edit sidebar before it was built.
**Decision**: settings hide rather than disable (R11). Rebecca then set the wording and layout in her doc's "Authoring" section: one choice of usable modes (Draw, Data, Both) in place of two mode checkboxes, Data settings as a section of their own, an Ordering group, "Starting data", and one "What students can see" section for the panes and buttons (R11). Her comment asking what "Text with a linked table" meant is answered by the label "Linked table and text" and its help text. In a second pass she renamed the mode "Use data" to "Data" wherever authors or students see it (the saved key, URL parameters and code keep `useData`), put each "both" choice last and the table before the text, led the Ordering help with "Order matters" on, and added the Send data buttons group, with the Download data files setting and a plain note on Send to CODAP in place of a warning. Also:
- The probabilities' starting state stands apart from the toggle, as "Order matters" does, so an author can keep probabilities on without a toggle (R6).
- Capitalization says whether "The" and "the" are the same word rather than "lowercase", which would promise the student's text is rewritten (R8).
- Send to CODAP is off by default, with a note, since it needs CODAP on the page (R6).

Rebecca confirmed the defaults on Slack (2026-10-29): both modes, starting in Data, and Send to CODAP off. A changed default later is one value in `defaultAuthoredState` and the tests that write the defaults out.

## Self-Review

Roles: senior engineer, author (education material developer), WCAG accessibility expert, test writer, the PR's reviewer (a developer newer to the repo), and the developer of the stories that build on the authored state. Each finding was checked against the code in this checkout, LARA, the Activity Player or portal-report before it was written.

### Senior Engineer

#### RESOLVED: the starting text could make an activity unsavable
LARA stores authored state in a MySQL `text` column, 65,535 bytes at most (`db/schema.rb:433`). A pasted book would fail to save or be cut off into JSON that no longer parses. R9 now limits the starting text to 20,000 characters, R11 stops typing at the limit and shows the count near it, and R10 keeps any longer text it is given rather than dropping it. The arithmetic is in Technical Notes.

#### RESOLVED: "with none" didn't say what an empty interactive state is
portal-report counts `{}` as no answer (`answer-utils.ts:180-202`), so a runtime that only saved on `null` would leave a student stuck at `{}` with no answer. R12 now saves on either.

---

### Author

#### RESOLVED: the Input pane stayed editable with Data off
R6 makes the Input pane apply to Data only, but R11 only covered the settings grouped under Data, and the Input pane sits under Panes. R11 now leaves the Input pane's row off the page without Data too.

#### RESOLVED: the starting text's effect in table only view was unstated
An author choosing "table only" would not know whether the starting text applies. R9 now says it applies in every input view, and how it fills the table is MARK-15's.

---

### WCAG Accessibility Expert

#### RESOLVED: R11 asked for visible labels but not for labels a screen reader announces
A label beside a checkbox that isn't tied to it reads as nothing. R11 now ties each label and each help text to its control and requires the form to work from the keyboard in display order. The help text color, `#737373` on white, is 4.7:1, above WCAG AA's 4.5:1.

---

### Test Writer

#### RESOLVED: a defaults test could pass by construction
A Jest test comparing a read of `{}` with the code's own `defaultAuthoredState` passes whatever the defaults are. R20 now writes the expected values out in the test.

---

### PR Reviewer

#### RESOLVED: the form's labels and the runtime's list could drift apart
R12 says the runtime uses "the same label the authoring form uses", which two hand-written lists would only keep true by care. R11 now takes the labels from one list both use.

### Stage 8: Cross-reference with the implementation spec

#### RESOLVED: no requirement said the interactive reports its supported features
The plan's `setSupportedFeatures({ authoredState: true, interactiveState: true })`, and the Cypress test for it, traced to the Background only. LARA shows the authoring form only after it (`interactive-authoring.tsx:41`), so R11 now requires it.

#### RESOLVED: no requirement said how the runtime lists the starting text
The plan lists the first 100 characters and the length, which R12 didn't ask for. R12 now does, since a 20,000-character text would otherwise fill the placeholder.

