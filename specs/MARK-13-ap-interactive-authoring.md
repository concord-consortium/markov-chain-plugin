# The Markov AP Interactive, with Authoring

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-13

**Status**: **Closed**

## Overview

Add a second app to this repo, the Markov Interactive, that runs in the Activity Player instead of CODAP. In this story it has an authoring form for every setting in Rebecca's AP spec, a placeholder student view that lists the settings, a placeholder teacher-dashboard answer, and a demo page that shows the form and the student view side by side, so activities can be authored while the student view is designed. The CODAP plugin and its deployed files do not change.

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

- **R12.** In runtime mode, the interactive shows "Markov interactive: coming soon" and a list of the authored settings, in the authoring form's order, each with the same label the form uses (a pane's starting state as "<pane>: Open at the start") and its value, read as R10 describes, and leaving out what the form leaves out. The starting text is listed as its first 100 characters (99 when the 100th is half of an emoji), followed by "..." when it is longer, and its length in characters, so a large bag of words doesn't fill the page; an empty one is listed as "(empty)". It saves an interactive state of `{ version: 1 }` when it opens with none (no interactive state, or `{}`), so the student has an answer in the report; it does not overwrite an interactive state that already exists. It reports its content height.
- **R13.** In `report` mode, which portal-report uses for one student's answer on a page of its own (the class dashboard's "Open in new tab", R15), it shows R12's placeholder and settings list with a note that it is a student's work shown read-only, and saves nothing. In a mode it doesn't know, it shows a short message saying the mode isn't supported yet, rather than nothing.

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
  - A full answer is a `links` item and an `html` item. The `links` item is what makes the dashboard offer "Open in new tab", the student's answer on portal-report's page of its own, where the answer history is (with "View Work" hidden, since inline it would only repeat the placeholder). The `html` item, with the host's `tall` and `wide` blocks, says the student opened the Markov interactive and that a summary of their work comes in a later version.
  - A compact answer has no items, so the dashboard grid shows its own answered icon.
  - It answers each request for the student it names, and reports its height.

### Demo

- **R16.** `npm run build` also produces `demo.html`, deployed beside the interactive, so developers and the project team can try the interactive without LARA or an activity:
  - The authoring form on the left, in a frame as wide as LARA's authoring column (435 px, Technical Notes), sized to the form's height. The page's header stays in view, and the form's column scrolls on its own, as does the runtime's, so the form can be scrolled while the runtime stays put; the column's scrollbar takes none of the frame's 435 px.
  - The runtime on the right. Each authoring change restarts it with the new authored state once the author pauses (half a second), and the interactive state it saves is kept across restarts, as the Activity Player keeps a student's.
  - The report item's full answer below the runtime.
  - It starts from the defaults with a short sample starting text. Nothing is kept across a reload.
  - **The standalone link,** as two buttons at the right of the page's header: **Copy standalone link** (to the clipboard), which says "Copied" for 2 seconds after a click, and **Open standalone link** (in a new tab). The link is the URL of `interactive.html` beside the page, carrying the form's current settings (R14), updated with each change, and it holds only the settings that differ from the defaults. Each button's description, which a screen reader reads with it and hovering shows, is "Use this link only outside the Activity Player, such as on a collection page. In LARA, add the interactive's plain URL and choose its settings in the Authoring tab: settings in this link are ignored inside an activity." Above 2,000 characters (a long starting text), a note beside the buttons says the link is long and some sites and email programs cut long links short.
  - The page's title and heading are "Demo and Standalone Authoring". The file stays `demo.html`.
- **R17.** A width choice at the top right of the runtime area sets the runtime frame to a full-width item's width in each Activity Player layout (Technical Notes, "The Activity Player's widths"): **Standard (1100px)**, the default, 1,044 px; **iPad Friendly (960px)**, 904 px; **Responsive**, the whole runtime area. The interactive in the frame gets all of that width: the frame's edge is marked without taking any of it, and the frame is as tall as its content, so it never shows a scrollbar. A frame wider than the area scrolls sideways rather than shrinking. The choice is one radio group a keyboard can use. `?width=1100`, `?width=960` or `?width=responsive` in the page's URL opens it at that width (any other value opens Standard), and choosing a width puts it in the URL, so a link can be sent with the width set.
- **R18.** The runtime is designed for a full-width item in an Activity Player page: 1,044 px in the Standard layout, 904 px in iPad Friendly, and wider in a responsive section. The interactive can't make an author place it full width; a narrower placement (Half Width, about 517 px, or a 365 px column of a two-column section) still works but is not what the design is for. This is the student view's design assumption for MARK-15 onward; MARK-13's placeholder only has to be fluid.

### Logging

- **R19.** No logging is added, and no `LOGGED-EVENTS.md`: the authoring form isn't logged, and the placeholder runtime has no student interactions. The first story that logs an event starts the file.

### Tests

- **R20.** Jest tests cover reading the authored state (R10), with expected values written out in the test rather than taken from the code's defaults, so a changed default fails a test: each default, a partial state, each invalid value, `{}`, `null` and a JSON string, each R5 correction, unchanged on a complete state, and no change on a second read. They also cover the usable modes' mapping to the two modes' availability (R5), the settings list the runtime shows (R12), including what it leaves out, the report item's answers (R15), for both answer types, the demo's widths and how it reads `?width=` (R17), and the interactive and the report item opened outside a host (R14), in jsdom, whose window is its own top window as a page opened directly is: what each shows, that neither makes the library's client, and that the interactive takes its settings from its URL. They also cover reading and building the URL settings: every setting by its path, each kind of value, invalid, unknown and missing values reading as defaults, only differing settings in a link, and a link reading back as the state it was built from.
- **R21.** Cypress tests load the interactive's entries on a fake Activity Player page served by the development server only, beside MARK-11's fake-CODAP page and using its configuration, error check and CI job:
  - **Authoring:** a new interactive shows the defaults; each control saves its setting, and only that setting changes; the starting text stops at its limit; a saved state opens showing its values; the sections come in R11's order; the help under the usable modes and the input view follows the option chosen; the starting mode is offered only with both modes and moves to a mode students have; settings R11 hides are hidden and come back as they were; the Graph pane is checked, disabled and explained while Draw is on, turning Draw on saves it as available, and its starting state's label names Data only with both modes; the probabilities' starting state stays with the toggle off; the Send to CODAP note is always tied to its checkbox; the download setting saves; and the reported height follows the form.
  - **Runtime:** the placeholder lists every setting with its saved value; settings in the interactive's URL that differ from the authored state are ignored; it saves `{ version: 1 }` when there is no interactive state, and nothing when there is one; in `report` mode it shows the placeholder with its read-only note and saves nothing.
  - **Report item:** a full-answer request gets the `links` item and the placeholder `html` item, and a compact one gets no items.
  - **Demo** (on `demo.html` itself): the Standard width by default, a width from the link, a chosen width put in the link, the authoring form at 435 px scrolling on its own while the page and the runtime stay put, an authoring change reaching the runtime, the report item's answer, the page's title, the standalone link with only the changed settings and its warning, the Copy button saying "Copied" for 2 seconds, the long-link note, and a round trip: settings chosen in the form, the link opened in a window of its own, and its placeholder listing the same settings as the hosted runtime. The round trip runs in Chrome, as the CI job does (Technical Notes).
- **R22.** On Node 24 after `npm ci`, on every commit and on the head: `npm run build` compiles with no warnings; `npm run lint`, `lint:build` and `lint:style` print nothing; `npx tsc --noEmit -p .` and `npx tsc --noEmit -p cypress` pass; `npm test` and `npm run test:cypress` (against `npm start`) pass, including MARK-10's, MARK-11's and MARK-12's tests unchanged, and the Cypress tests also pass with `--browser chrome`, the CI job's browser, which the round trip needs.

### CI and documentation

- **R23.** The existing CI jobs build, test and deploy the interactive: `build_test` runs the new Jest tests, `cypress` runs the new Cypress tests, and `s3-deploy` deploys `interactive.html`, `report-item.html` and `demo.html` with the plugin. No job is added or changed. *(After the first push; see Not Yet Implemented.)*
- **R24.** The README has a section on the Markov Interactive: its deployed URLs for a branch and a version, the Demo and Standalone Authoring page (`demo.html`) with its `?width=` parameter and its standalone link, settings in a standalone URL and that the Activity Player ignores them, how to open it in development, and how to add it to a LARA page before it is a library interactive (an Interactive IFrame item with "Enable save state" on and the report item's full URL as its report item URL, since the class dashboard reads a relative one against its own address), which a library interactive's own settings replace once it is released, and that the class dashboard needs "Activity Player Class Dashboard" chosen as an external report in the activity's portal settings either way.
- **R25.** Dependency and lockfile changes are in a commit of their own, separate from code changes.

### Done when

- **R26.** On the branch deploy: an author adds "Markov Interactive" to an activity page, sets every option, saves, and on reopening sees every setting as saved; a student run in the Activity Player shows the placeholder with those settings; and the class dashboard shows that student as having answered, with the placeholder full answer when the answer is opened. Opened directly from the branch deploy, `interactive.html` shows the placeholder with the default settings, a link copied from the demo page opens it with that link's settings, and `report-item.html` shows its message. *(Partial: everything but the direct opens was checked on learn staging against the local dev server; the branch-deploy checks follow the push. See Not Yet Implemented.)*

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
- **Cypress can't open a page on its own:** it runs every page inside its runner's frame, so `inIframe()` is true in every Cypress test. MARK-11's `modifyObstructiveCode: false` keeps it true. With Cypress's default, which rewrites `window.top` in the scripts it serves, the interactive ran standalone inside the fake Activity Player page and 6 of the 8 runtime tests failed (measured). So the Cypress tests cover the hosted side, and Jest in jsdom the standalone side.

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

### On LARA, the Activity Player and the class dashboard (checked on learn staging, 2026-10-30)

Activity 1521 on LARA staging, "MARK-13 Markov Interactive authoring test (localhost)", an Interactive IFrame item pointed at the local dev server (Chrome lets an `https` page frame `localhost`):

- **Authoring:** the form loads in LARA's Authoring tab, each change saves, and the settings come back after a reload. The authoring frame was 415 px wide in a narrow window.
- **Runtime:** the Activity Player gives a full-width Standard item 1,044 px, and the frame is exactly the reported height; the space under the placeholder is the Activity Player's wrapper (16 px) and the placeholder's own padding.
- **Saving:** a plain Interactive IFrame needs "Enable save state" in Advanced Options; without it the Activity Player never hands back the state, and the runtime saves `{ version: 1 }` on every visit. With it, one save on the first visit and none after, for an author preview with a `runKey` and for a logged-in student.
- **The dashboard:** the activity needs "Activity Player Class Dashboard" as an external report in the portal; the student shows as answered and the full answer shows the placeholder. The item's Report Item URL must be a full URL: portal-report resolved `report-item.html` against its own address. With the `links` item, "Open in new tab" opens portal-report's answer page, which starts the interactive in `report` mode.
- LARA's narrow Preview pane (261 px) squeezes the placeholder's two-column list badly; the Activity Player isn't affected, and R18 only asks the placeholder to be fluid.

The README's Markov Interactive section records the item and portal settings, and that a library interactive will carry the item settings once released.

## Out of Scope

- **The student view** (MARK-15 onward): its layout, the input text and table, the tokenizer, the graph, Inspect, the generator, the two switches and every behavior the settings will control. Its design is mocked up and settled with Rebecca after this story is built.
- **The shared components** (MARK-14). Nothing here moves or imports the plugin's code.
- **Saved student work** beyond the `{ version: 1 }` placeholder, and the history scrubber (MARK-17).
- **The dashboard summary** in the report item (MARK-19), and `report` mode's real read-only view of a student's saved work (MARK-17); in MARK-13 it shows the placeholder (R13).
- **Any change to the CODAP plugin**: its code, its deployed files, its saved documents and its logging.
- **Logging, and `LOGGED-EVENTS.md`** (R19): both start with the first story that logs an event, with the test that every logged event is in the file.
- **Keeping anything when opened outside a host** (R14): no host keeps a state, and browser storage isn't used.
- **The Download data files button itself** (MARK-18): MARK-13 only saves whether it is available (R6).
- **Shorter standalone links**, such as a saved settings id or a link shortener: a long starting text makes a long link (R16 notes it).
- **The plugin's version number and the release process.**
- **Authoring for drawing mode's tools**: Rebecca's answer is all tools on, so there is nothing to set.

## Not Yet Implemented

- **R23, CI on the first push:** `build_test`, `cypress` and `s3-deploy` on GitHub, and `interactive.html`, `report-item.html` and `demo.html` returning 200 from `https://models-resources.concord.org/markov-chain-plugin/branch/ap-interactive-authoring/`. The branch isn't pushed yet.
- **R26, on the branch deploy:** opening `interactive.html` and `report-item.html` directly from the branch URL, and a link copied from the branch's demo page. The rest of R26 (authoring, saving and reopening, the Activity Player runtime, a student run and the class dashboard with its full answer) was checked on learn staging against the local dev server, not the branch deploy.

## Decisions

### Where the interactive's pages are deployed
**Context**: question-interactives deploys each interactive in its own folder with a `report-item/` subfolder; this repo deploys the plugin's `index.html` at the root of `dist/`.
**Options considered**:
- A) `interactive.html` and `report-item.html` at the root of `dist/`, beside `index.html`.
- B) An `interactive/` folder with `index.html` and `report-item/index.html`.

**Decision**: A. The pages load `./assets/...` with the plugin's `publicPath: '.'`, the report item is a sibling of the interactive, and nothing about the plugin's deploy moves. B needs a `publicPath` per folder for no visible gain.

---

### Panes and buttons as keyed records
**Context**: the student view isn't designed yet, so the panes and buttons may change (R6).
**Options considered**:
- A) `panes` and `buttons` as records keyed by id, read with a default per key (R10).
- B) A flat field per setting.

**Decision**: A. A new pane or button is one key with a default and needs no version change, and the form and the runtime list draw from one list of ids and labels.

---

### What the runtime saves as interactive state
**Context**: the dashboard shows a student only once interactive state exists and isn't empty.
**Options considered**:
- A) `{ version: 1 }` when the interactive opens with none.
- B) Nothing, so the student shows as not answered until MARK-17.
- C) Something richer, such as an "opened at" time.

**Decision**: A. The story's done condition needs the student to appear; C is saved work, which is MARK-17's. `version` lets MARK-17 tell its state from this placeholder. Checked on learn staging: one save on a student's first visit, none after.

---

### The demo ships in production builds
**Context**: question-interactives builds a `demo.html` into every deploy; the Cypress tests already have a dev-only host page.
**Options considered**:
- A) `demo.html` in every build, with the fake Activity Player page kept for the tests and the init message built in one shared module.
- B) A dev-only demo.
- C) One page for both, with test hooks in it.

**Decision**: A (Doug). The project team opens it from any branch or version URL. The fake page records messages and starts one mode at a time, which tests need and a demo shouldn't carry.

---

### The list of panes and buttons
**Context**: R6's four panes and buttons come from the doc's layout and features, not a list of authoring settings, and the student view is designed after this story.
**Options considered**:
- A) Ship R6's list; Rebecca checks it on the branch build before code review.
- B) Ask Rebecca for the list before implementation.
- C) Leave panes and buttons to MARK-15.

**Decision**: A. The doc asks for exactly these two choices per pane and button, R10 reads each key with its default so one can be added or dropped before release without a version change, and C would leave the story's first authoring bullet undone.

---

### Whether the Graph pane can be made unavailable
**Context**: the doc lets authors choose which panes are available, with no exception, but Draw can't work without the graph.
**Options considered**:
- A) The Graph is always available.
- B) Every pane can be unavailable.

**Decision**: B, except while Draw is available (Doug). A Data activity can lean on the Graph's absence; R5 keeps it available with Draw, and R10 reads a state that breaks that as available.

---

### The authoring form's wording, layout and defaults
**Context**: Doug reviewed the form as a clickable mockup in LARA's edit sidebar; Rebecca then set its wording and layout in her doc's "Authoring" section in two passes.
**Decision**: settings that don't apply are left off the page rather than disabled (R11). One "Usable mode(s)" choice (Draw, Data, Both) replaces two mode checkboxes; Data settings is a section of its own with an Ordering group and "Starting data"; one "What students can see" section holds the panes and buttons, with a Send data buttons group. The mode is "Data" wherever authors or students see it (the saved key, URL parameters and code keep `useData`). "Both" choices come last and the table before the text. The probabilities' starting state stands apart from the toggle, capitalization says whether "The" and "the" are the same word, and Send to CODAP is off by default with a note. Rebecca confirmed the defaults (2026-10-29): both modes, starting in Data, Send to CODAP off.

---

### The standalone link is two buttons in the demo's header
**Context**: the link was first a read-only field with Copy and Open under the authoring form.
**Decision**: Doug moved it out of the edit column: "Copy standalone link" and "Open standalone link" at the right of the page's header. The warning is each button's description and hover text, the long-link note sits beside them, and Copy says "Copied" for 2 seconds after each click (R16).

---

### The demo's columns scroll on their own
**Decision**: Doug asked for the edit sidebar to scroll independently. The page is the window's height with the header in view, each column scrolls on its own, and the authoring column's scrollbar takes none of the frame's 435 px (R16).

---

### Report mode shows the placeholder read-only, in MARK-13
**Context**: the class dashboard's "Open in new tab" opens portal-report's page for one student's answer, which starts the interactive in `report` mode. The spec had left report mode out of scope, so that page showed only "doesn't support report mode yet".
**Decision**: Doug chose to do it in MARK-13. Report mode shows R12's placeholder with a note that it is a student's work shown read-only, and saves nothing (R13). The real read-only view of saved work stays MARK-17's.

---

### The library's state hooks, or its plain functions
**Context**: question-interactives and sensor-interactive use `useAuthoredState` and `useInteractiveState`.
**Options considered**:
- A) Read both states from the init message, keep the form's state in React, and send with `setAuthoredState` and `setInteractiveState`.
- B) The hooks.

**Decision**: A. Both hooks return `null` on their first render, which made the runtime save over an existing state and would flash the defaults in the form. The init message carries both states already.

---

### A fake Activity Player page beside MARK-11's, or one page for both
**Options considered**:
- A) A second dev-only page, `fake-ap.html`, sharing MARK-11's configuration, error check and CI job.
- B) Teach the fake-CODAP page to host the interactive too.

**Decision**: A. The two speak different protocols, so one page would be two in one file. The setup that matters is reused: the dev-only entry, `modifyObstructiveCode: false`, the `afterEach` error check, `cypress/tsconfig.json` and the `cypress` job.

---

### How the round trip opens the standalone link
**Context**: Cypress runs every page in its runner's frame, where the interactive is hosted and ignores its URL.
**Options considered**:
- A) Open the link with `window.open`, a top-level window, in Chrome only.
- B) Read the link's query with `authoredStateFromSearch` in the test.
- C) Leave the round trip to Jest.

**Decision**: A. It loads the real page as a collection page's link would. Chrome is the CI job's browser; Electron returns `null` from `window.open` and lists the test as pending.

---

### The report item's CSS
**Options considered**:
- A) Share `interactive.scss`.
- B) A separate stylesheet with only the body rules.

**Decision**: A. The extra rules are a few hundred bytes; MARK-19 can split it when the report item gets its own layout.

---

### URL settings come from the authored state's defaults
**Decision**: the standalone link's parameters are the leaves of `defaultAuthoredState`, with each default giving its type, and the values go through `readAuthoredState`, so a bad, unknown or missing value reads as its default and a setting added later needs no URL code. Not tecrock-simulation's way, which guesses types from how values look.

---

### Standalone detection is the library's `inIframe()`, not a timeout
**Decision**: the check answers on the first render, so a page opened directly never shows "Loading..." and a slow host can't be taken for none. The standalone view never calls the library, whose top-level client would warn, hold messages and mark the state unsaved.

---

### The frame height is measured from the root element
**Decision**: the library's `useAutoSetHeight` includes the frame's own height, so it never shrinks the frame. `useFrameHeight` observes the root element; the body margin is 0 and the root is `display: flow-root`, so the reported height includes everything (on the Activity Player the report matched the root's height exactly).

---

### The report item's full answer has a `links` item
**Context**: on learn staging the dashboard showed the placeholder but no link to the student's answer page, where the history scrubber is.
**Decision**: with a Report Item URL set, portal-report offers "Open in new tab" only when the full answer has a `links` item (`iframe-answer.tsx` in portal-report), as question-interactives' report items send. The full answer is `[{ type: "links", hideViewInline: true }, { type: "html", ... }]`; "View Work" stays hidden, since inline it would only repeat the placeholder (R15).

---

### The form and the runtime list share their visibility rules
**Decision**: `showsStartingMode`, `shownPaneIds` and `showsStartsOpen` in `authored-state.ts` decide what the form leaves off the page and the runtime list leaves out (R12), so the two can't disagree; found in the whole-branch review.

---

### A shortened starting text never splits a character
**Decision**: the runtime list's 100-character preview drops a trailing lone high surrogate, so an emoji at the cut is left out rather than shown half (R12); the one correctness defect the step reviews found.

---

### Demo colors and focus
**Decision**: the demo uses Concord's dark teal `#016082` (7:1) from one `$teal` variable, the authoring form keeps the browser's focus ring under its glow (the `#66afe9` border alone is 2.4:1), the disabled checkbox's cursor uses `label:has(input:disabled)`, and the demo frame's edge is an outline so the interactive gets the full 1,044 px.
