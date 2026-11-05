# Saved Work in the AP Interactive, and the Teacher's History Scrubber

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-17
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

A student's work in the AP interactive, in both modes and with its layout, reopens as they left it, and a teacher can scrub through its saved moments in the class dashboard, each shown read-only. Nothing is saved until the student does something.

## Project Owner Overview

MARK-15 and MARK-16 built the workspace, but only the input text survives a reload. This story saves the rest: the drawing, each mode's outputs and generator settings, every state's place on the graph, the zoom, and the layout. It replaces the report placeholder with a read-only view of the student's real work, which is what the class dashboard's scrubber opens for each saved moment when "Save Answer History" is on. Students appear in the dashboard once they do something in the interactive, not as soon as they open the page.

Saves happen at meaningful moments rather than on every keystroke, since the Activity Player writes the whole state each time. Saved outputs have a limit, with Rebecca's message when a student reaches it. Saved work stays readable on a page whose settings differ from the page it was saved on, which covers an author changing a page after students start, and is what the linked-work stories in the backlog will need. The CODAP plugin, and the ELA module that uses it, do not change.

## Background

The story comes from question 4 and follow-up B of Rebecca's "Markov Tech Specs (AP)" doc and her answers of 2026-11-02 to layout questions 28, 29 and 35 and follow-up E. Older documents describe linked work as part of this story; the Jira story is right, and it is out of scope here (LARA-230, AP-149, MARK-26).

What exists:

- `src/interactive/runtime.tsx` saves `{ version: 1 }` on open when there is no state, saves `{ version: 1, input: { text } }` at each commit through `onSaveInput`, and in report mode shows a placeholder listing the authored settings. `app.tsx` doesn't pass `interactiveState` in report mode.
- `Workspace` holds both modes' `useMarkovTool` hooks, the mode, the probabilities toggle and "Order matters". `DataWorkspace` holds the text and the case rule; `usePaneLayout` holds each mode's open panes, sizes and the generator controls' toggle; `InspectPane` holds its tab and sorts; `DataWorkspace` holds the linked split; `Graph` holds the laid-out positions and the zoom.
- Nothing about a student's work is live yet: 0.6.0 is unreleased, so the only saved states are test runs of `{ version: 1 }` and `{ version: 1, input }`, which must still read.

## Requirements

### What is saved

- **R1.** The interactive state stays one object at `version: 1`, every new field optional. It holds, as MARK-15 does, `input: { text }`, and adds:
  - shared by the modes: `mode` (the mode showing), `probabilities`, `orderMatters`, `caseSensitive`;
  - for each mode, under `useData` and `draw`: which panes are open, whether the generator's controls are open, the pane sizes (`input`, `inspect`, `top`), Inspect's tab and both tabs' sorts, the generator's settings (starting state, Max Length, delimiter and its type, speed), the outputs, the chosen state, transition or output, and the graph's zoom and pan (R7);
  - in `useData`: the linked text box and table's split, and every state's position (R5);
  - in `draw`: the drawing, its states with their ids, labels, values and positions rounded to whole numbers, and its arrows with their values.
- **R2.** Data mode's graph and Inspect tables are rebuilt from the input, not saved. The input saved is the last committed text, the text the graph shows, so positions and input always agree. It is saved only when it differs from the authored starting text, so a student who never changed the input follows the page if the author changes that text, and their graph is laid out afresh if the number of its states changes (R5).
- **R3.** Not saved, and starting as usual on reopening: Draw mode's chosen tool (it starts on Select, so a first click can't change the drawing by accident), scroll positions, which output headers are expanded, and a sequence's playback. MARK-16's R24 lists the tool as kept while the interactive is open, which stays true. A reopened output opens at its newest, in the workspace, where the student left it after generating, and so does one in a hidden mode or a collapsed pane, once it shows; a restored choice scrolls into view as usual.
- **R4.** A sequence still playing or stepping when the state is built is saved as far as it got, which is how Cancel leaves it.
- **R5.** Data-mode positions are a flat list of whole numbers, `[x0, y0, x1, y1, ...]`, in the order the graph's states first appear in the input, saved with every state and not only moved ones, since where a state sits depends on the order it was placed in. They are read back only when the rebuilt graph has as many states and the same case rule as when they were saved; otherwise the graph is laid out afresh. Above 6,000 states no positions are saved (Technical Notes), and such a graph is laid out afresh.
- **R6.** Outputs are saved compactly (Technical Notes): a table of the states they use, each a string where its id and label are the same and an `[id, label]` pair otherwise, and each sequence as a list of places in that table. A reopened output reads and highlights as it did, including one whose state has since been renamed or removed.
- **R7.** The zoom and pan are saved for the mode showing, and only once the student has taken the view by zooming or panning. With no saved view the graph is fitted, as it is today, and goes on following. A hidden mode saves no view: showing a mode refits it (MARK-16's R24).

### When it is saved

- **R8.** **Nothing is saved until the student does something.** The save on open goes. A student who opens the page and leaves it posts nothing, and doesn't appear in the dashboard.
- **R9.** **A save is the whole state**, built by one function from what is on screen, handed to the library's `setInteractiveState`, which replaces the state and posts it 2 seconds after the last call. These moments save:
  - the input's text changes at a commit;
  - a sequence finishes, is canceled, or the output is cleared;
  - a generator setting changes, as `GeneratorSettingChanged` logs it;
  - "Order matters", "Case sensitive" or "Show probabilities" changes;
  - the drawing changes: a state or arrow added, deleted, edited or moved, or Reset;
  - a Data-mode state is dragged.
- **R10.** No save happens while a sequence plays or steps; a change made then saves when it ends.
- **R11.** Where the mode has a graph, the state posted for a change holds the positions the graph drew for it, so a scrubber step shows the new states where the student saw them.
- **R12.** **Layout-only changes don't save.** Opening or collapsing a pane, moving a divider, zooming or panning, choosing a state, transition or output, Inspect's tab and sort, and switching modes ride along with the next save, or with the Activity Player's page-leave request (`getInteractiveState` with `unloading`), which the interactive answers through the library's `setOnUnload` with the whole state. Closing the browser tab sends no such request, so layout changed since the last save is lost then.
- **R13.** **Anything the student does counts.** Any logged action, or a zoom or pan, marks the student as having done something, so at page leave their state is saved even if all they did was collapse a pane or choose a state. A page that leaves students nothing to save, such as Graph and Inspect over starting text, still shows a student who explored it, which the Activity Player's completion page and the dashboard need. These changes still save only at page leave, not when made.
- **R14.** Work the page can't show is kept: with the Input pane left out, the saved `input` is written back unchanged, and with a mode not offered, that mode's saved fields are, and without Data mode so are `orderMatters` and `caseSensitive`. Fields this version doesn't know are kept too, at the top level and inside `useData` and `draw`.

### Reopening

- **R15.** **A reopened workspace shows what the student left**, with both modes restored: the mode showing, panes, sizes, split, toggles, Inspect, generator settings, outputs, drawing, positions and the chosen item. Reopening saves nothing, logs nothing and moves no focus: the generator's "other" delimiter field, which takes focus when a student chooses it, doesn't take it when it reopens. A student who reopens and does nothing answers a page leave with the state they opened with, unchanged, even if the page has changed since. The graph's states don't move on reopening, and a state added later is placed as usual (MARK-15's R29a). Reset in Draw mode clears the drawing, rather than going back to the one reopened.
- **R16.** **The reader never throws, and takes each field on its own.** A field that is missing or the wrong type reads as if it had never been saved; the rest still apply. `null`, `{}`, `{ version: 1 }`, MARK-15's `{ version: 1, input }` and a JSON string all read.
- **R17.** **Saved work opens under the page's current settings**, for work saved before an author changed them, and so that a state copied whole from another page (AP-149) opens. MARK-26 builds on this reader and adds nothing it needs here:
  - a pane the page has keeps its saved open state, a pane it lacks is ignored, and a pane the save lacks starts as authored; Draw mode's Graph pane is always open;
  - pane sizes are read within their minimums and the row's maximum, then fitted to the row as usual;
  - the saved mode is used if the page offers it, otherwise the authored starting mode;
  - `orderMatters`, `caseSensitive` and `probabilities` apply only where the page shows that switch; otherwise the page's setting wins;
  - with no Input pane the saved input is ignored, as today; a student's edited input keeps coming before the starting text;
  - a chosen state, transition or output that doesn't exist in the reopened work, or a transition with order off, is dropped;
  - a saved starting state not in the graph reads as "(any)".

### Output limit

- **R18.** Saved outputs and the drawing together may take 140 KiB, measured as the Activity Player stores them (Technical Notes). That is about 250 to 700 outputs of length 100, depending on how many different states they use, and over 1,000 of length 20, in line with what Rebecca was told. The two modes share it.
- **R19.** Once they reach it, Play and Step are disabled in both modes for a new sequence, and the generator shows "You have reached the maximum number of outputs." in a status region. A sequence already running finishes. Clear Output in either mode, once under the limit, enables them and takes the message away. The check is made when outputs or the drawing change, not during a sequence.
- **R20.** The limit is the same in every view, so standalone behaves as hosted does. A reopened state over the limit is kept whole and shows the message.
- **R21.** The state's total stays inside the document in the worst case: a Jest test builds the largest state R18 and R5 allow, beside the largest authored state, and asserts the document the Activity Player would write is under 1,048,576 bytes.

### The read-only view

- **R22.** In `report` mode the interactive shows the student's workspace from the `interactiveState` it is given, as the student left it, except that every graph is fitted (Rebecca's answer to question 35): no saved view is applied. It replaces the placeholder. With no state it shows the workspace as authored. It reads a state as `runtime` does, whether it arrives parsed or as a string.
- **R23.** It shows a note at the top: "This is a student's saved work. It can't be changed here." It saves nothing, logs nothing, and posts no `interactiveState`.
- **R24.** A teacher can: choose a state, transition or output, clear it, zoom, pan, fit, open and collapse panes, move dividers, use Inspect's tabs and sorts, switch modes where the student could, and toggle "Show probabilities", which changes only what is drawn. All of this is lost on reload.
- **R25.** A teacher can't: edit the text or table, change "Order matters" or "Case sensitive", drag a state, use Draw mode's add, delete or Reset tools, open Draw mode's state editor, change the generator's settings, Play, Step or Clear Output. Data mode's read-only state dialog still opens.
- **R26.** Each scrubber step starts the interactive again in a new frame, so the view holds nothing between steps.
- **R27.** The report item offers "View Work" as well as "Open in new tab", by dropping `hideViewInline`: the dashboard's scrubber sits under the answer, and without an inline view moving it changes nothing a teacher can see. Its placeholder says "This student has saved work in the Markov interactive." in place of "opened". The compact answer doesn't change.

### Logging and the demo page

- **R28.** A new event, `OutputLimitReached` with `{ outputs }` (how many are saved, in both modes), logs each time the limit is reached, by a sequence ending or a drawing growing past it. `LOGGED-EVENTS.md` and `logEvents` add it. Saving and reopening log nothing, and nothing else changes.
- **R29.** The demo page shows the read-only view under the runtime, started from the state the runtime last saved, so Rebecca can try it without a class. `initInteractiveMessage` leaves `interactiveState` out for a student with none, as the Activity Player does (Technical Notes).

### What doesn't change, and tests

- **R30.** The CODAP plugin does not change. Everything added to shared code is an option the plugin doesn't pass, and with it absent the code does what it did. The compiled plugin CSS is byte-identical, and the plugin's Jest and Cypress suites pass with no test changed.
- **R31.** The report placeholder's code goes with it: `ReportPlaceholder`, `settings-summary.ts` and its test, and their styles, as does `onSaveInput` and `readSavedInput`. `README.md`'s description of what is saved and of `report-item.html`, and MARK-13's comment on `hideViewInline`, change to match.
- **R32.** Jest covers: the reader (each field wrong on its own, each R17 rule, every old state), the state builder and that reading what it builds gives back what was on screen, the output encoding with a renamed state, the limit, and R21. Cypress, on the fake Activity Player page: nothing posted on open or on a page leave with nothing done; each R9 moment posting once; a layout change riding along; reopening both modes with positions, zoom, selection and outputs as left; a state from a page with different settings; and the read-only view's R22 to R25.
- **R33.** On learn staging, with "Save Answer History" on: a student's work reopens as left in both modes, and the class dashboard's scrubber steps through it, both inline and in a new tab.

## Technical Notes

### What was checked in the other repos

Read in `activity-player`, `portal-report` and `lara` (`lara-typescript/src/interactive-api-client`, version 1.15.0 of the library), on their master branches:

- **How a save is stored.** `getAnswerWithMetadata` (`activity-player/src/utilities/embeddable-utils.ts`) builds `reportState = { mode: "report", authoredState, interactiveState: JSON.stringify(state), interactive, version }` and stores `JSON.stringify(reportState)` **twice in one document**, as `report_state` and as `answer`. So the state is JSON inside JSON (every `"` costs an extra byte) and appears twice, beside two copies of the authored state. This is why the budget is about 450 KB of a 1 MB document.
- **History.** With "Save Answer History" on, `createOrUpdateAnswer` (`firebase-db.ts`) also writes `interactive_state_history_states/<id>`, a separate document holding the same fields, and a small entry in `interactive_state_histories`, in one batch. The copy is a second document, so it doesn't count against the 1 MB, but each save writes about four copies of the state. A batch over the limit fails as a whole.
- **Unchanged states.** The Activity Player's `interactiveState` listener compares JSON with the current state and writes nothing when equal, so a page leave after a save adds no history entry, provided the builder is deterministic. A student who did nothing gives the library no final state, so it posts back the state it was started with, which compares equal.
- **Page leave.** `requestInteractiveStates({ unloading: true })` runs on page change. The library's listener awaits `onUnload` when set, uses a truthy result as the final state, and posts `managedState.interactiveState`.
- **No state.** For a student with no answer the Activity Player's `initInteractive` carries `interactiveState` undefined, and the library posts undefined back at page leave, which the Activity Player ignores. `null` would be saved as a change, and the repo's `initInteractiveMessage` sends `null`, so it leaves it out from now on (R29).
- **Clear & start over** sets the state to `null` and reloads the iframe, so the interactive starts as authored with no work to restore.
- **The scrubber.** `InteractiveStateHistoryRangeInput` (`portal-report/js/components/portal-dashboard/`) draws one marker per history entry and shows nothing with one or none. In the standalone page (`js/containers/report/iframe-standalone-app.js`) and in `iframe-answer.tsx`, moving it fetches `interactive_state_history_states/<id>` through `interactiveStateHistoryCache`, parses that document's `answer`, and starts `InteractiveIframe` under a new React key, which is a new iframe. The last marker clears the choice and shows the live answer.
- **The inline frame.** For an interactive with no `questionType`, which the Activity Player answers as `iframe_interactive`, `css/report/iframe-answer.less` caps "View Work" at 395px wide and clips it at 355px tall with `overflow: hidden`, and `InteractiveIframe` sets `scrolling="no"`. The new-tab page has neither limit.
- **What a report-mode interactive is given.** `initInteractive` with the stored `reportState` as its content: `mode: "report"`, `authoredState` as a JSON string (the authored state of the moment saved), `interactiveState` parsed (`interactive-iframe.js`), plus `view: "standalone"` and `objectStorageConfig` on the standalone page. The interactive already reads both string and parsed forms. `displayInIframe` is `!has_report_url`, so "View Work" is available.

### The budget

Measure a value as `JSON.stringify(JSON.stringify(value))` in UTF-8 bytes (`savedBytes`), which is what one copy costs. The document is about `2 * (savedBytes(state) + savedBytes(authoredState) + 150)` plus some 600 bytes of other fields, under 1,048,576.

| Part | Most, as stored | Measured from |
|---|---|---|
| Input (50,000 characters) | 200,004 | all quotes; 50,000 CJK characters are 150,004 and 50,000 characters of English about 52,000 |
| Positions (6,000 states) | 84,000 | 7 bytes a number at most; 2,500 states measured 24,663 |
| Outputs and the drawing | 143,360 | R18 |
| Everything else | 4,000 | both modes' layout and settings |
| **State** | **431,364** | |
| Authored state | 82,000 | 20,000 quotes of starting text, plus settings |

That is about 1,028,000 bytes for the document in the worst case. A typical full save (50,000 characters of English, 2,500 states, 20 KB of outputs) is about 200 KB of document. A drawing isn't stopped at the limit, only outputs are, but reaching 140 KiB takes about 560 states and 1,100 arrows placed by hand.

The limit is checked when a sequence ends, so one sequence can run past it; the table leaves about 10 KB for that, a sequence of some 2,500 steps. Two contrived inputs go past this worst case and aren't guarded: 50,000 control characters, at 7 bytes each as stored, and one unbroken word of over about 33,000 CJK characters chosen as both the state and the starting state, each of which repeats it.

Why these encodings (throwaway measurements of 100 samples):

| | Labels as arrays | Places in a table |
|---|---|---|
| An output of length 100 | 847 bytes | 457 bytes |
| An output of length 20 | 172 bytes | 93 bytes |

| Positions, 2,500 states | As `{ word: { x, y } }` | As `{ word: [x, y] }` | Flat list |
|---|---|---|---|
| Bytes | 79,661 | 49,618 | 24,663 |

A flat list has no quotes, and its numbers read back by the graph's own state order. The 6,000-state ceiling exists because states are bounded only by the input: 25,000 distinct one-character words fit in 50,000 characters, and would take 300 KB. MARK-15's R29b timed 20,000-character inputs and MARK-16's R33a 700 states; a graph near 6,000 states is already past what a student can use.

### Restoring the graph (run as throwaway code)

A throwaway build on the fake Activity Player page, in headless Chrome, confirmed:

- `Graph`'s existing `onAutoArrangeEnd` gives the laid-out states on every draw, and they stay current through drags, so reading positions needs no change to `Graph`.
- States given back with `x` and `y` are all placed (`layoutFor` says `"none"`), so no simulation runs, and whole-number positions reopened exactly.
- A view applied through `zoom.transform` after the zoom behavior is attached sets d3's own state, so the next wheel zoom carried on from it rather than jumping. Setting only the `g.root` attribute would not.
- Giving the hook its starting graph at first render, rather than through `dataChanged` in an effect, keeps a saved selection: `useClearGoneSelection` runs in a layout effect and would otherwise see an empty graph.
- `setOnUnload` returning a state posted that state, and returning nothing posted undefined.

### Other notes

- The library deep-freezes the state it is handed and the init message (`managed-state.ts`), so what is read has to be copied before the workspace edits it, and what is saved has to be a copy of live objects.
- `Node.value` isn't read from a sequence after generation, so restored outputs' nodes can carry 0.
- The `Selection` of an output is compared by object identity, so a restored one must point into the restored groups.
- `loadDrawing` records an `initialGraph` that Reset goes back to, which R15 rules out for a reopened drawing.
- MARK-23 needs nothing: an upload is a commit. MARK-18 stores its snapshots in object storage, so they aren't in this budget; its name counter is a new optional field the builder will carry.

## Corrections to the Jira story

- "A second full copy" is right, but it is a second document, so it isn't why the budget is 450 KB: the state is twice in the answer document itself.
- "toggles" sits in Jira's layout list and "each setting change" in its save list; R9 and R12 settle which is which.
- The forward-check notes planned `getSnapshot`/`loadSnapshot` on `MarkovToolHandle`. The tool's API already exposes everything to read, and restoring is simpler as the hook's starting values (a new optional argument), so the handle doesn't change.
- "A student appears in the dashboard once they have work" is now any change at all (R13), since the Activity Player's completion page counts a student with no answer as unanswered.
- Rebecca was told a 250 KB output budget; the measured figure is 140 KiB in a tighter encoding, which holds the same outputs.

## Out of Scope

- Linked work: carrying a student's work between pages (LARA-230, AP-149, MARK-26). R17 and R14 keep the way clear; nothing here reads `linkedState`.
- Anything in the CODAP plugin, including saving its typed text, which gets a story of its own if ELA teachers need it.
- The dashboard's summary of a student's work (MARK-19).
- Saving at tab close, undo, or thinning the history.
- Changes to the Activity Player, the class dashboard or LARA.

## Open Questions

### RESOLVED: Should the CODAP plugin start saving its typed text?
**Context**: Jira leaves this open. Throwaway code on the fake CODAP page confirmed the graph reopens but the Create From Text box is empty, and typing then replaces the graph. One ELA document, `CreateAMarkovChain`, has students type there.
**Options considered**:
- A) Leave it out of MARK-17, and write a separate story if the ELA module's teachers need it.
- B) Add it here.
- C) Drop it.

**Decision**: A (Doug). Students lose nothing they have today, and this story must not change the plugin.

### RESOLVED: What isn't brought back when a student returns?
**Options considered**:
- A) Bring back everything except scroll positions, the output's open settings lines and the drawing tool, and open the output at its newest.
- B) Also bring back the drawing tool.
- C) As A, with the output opening at its oldest.

**Decision**: A (Doug). A returning student sees their latest output, and the first click can't change the drawing by accident.

### RESOLVED: What counts as doing something, so a student shows in the dashboard?
**Context**: The Activity Player's completion page and `isActivityFinished` count an interactive with no answer as unanswered, so on an explore-only page a work-only rule could never read as finished.
**Options considered**:
- A) Only work counts: text, outputs, settings, the drawing.
- B) Any change counts, including moving a pane.
- C) Choosing something counts too, but moving panes doesn't.

**Decision**: B (Doug). Nobody who used the interactive is missed. Rebecca hears about it with the demo link.

### RESOLVED: When an author changes a page after students start, what wins?
**Options considered**:
- A) Rebecca's linked-work rules, and an input the student never edited follows the page.
- B) The same rules, with saved input always staying.
- C) The page always wins for layout.

**Decision**: A (Doug). The student keeps everything they did, and isn't left on starting text they never touched. It is also the reader MARK-26 needs.

### RESOLVED: The teacher's view: its note, and "Show probabilities"
**Options considered**:
- A) The note reads "This is a student's saved work. It can't be changed here.", and a teacher can use the toggle.
- B) The same note, with the toggle fixed as the student left it.

**Decision**: A (Doug). The toggle changes only what is drawn, and it goes back to the student's setting at each scrubber step, since each step is a new frame.

### RESOLVED: Judgment call: are mode switches and the probabilities toggle saves or ride-alongs?
**Options considered**:
- A) Everything in Jira's layout list rides along, including toggles.
- B) A setting that changes what the graph shows saves; where the student is looking rides along.

**Decision**: B. "Show probabilities" saves, so a teacher's scrubber shows it; switching modes rides along, since it changes no work. Both cost little either way.

### RESOLVED: Judgment call: a fixed output budget, or whatever room the state has left?
**Options considered**:
- A) Stop outputs when the whole state reaches about 450 KB.
- B) A fixed budget for outputs and the drawing.

**Decision**: B. With A, a student at the limit who pastes a long text pushes the state past the document's limit, and the Activity Player's write then fails with nothing to tell them. A fixed budget makes that impossible.

### RESOLVED: Judgment call: is a drag of a Data-mode state a save?
**Options considered**:
- A) It rides along, as layout.
- B) It saves.

**Decision**: B. It is a deliberate change to the student's graph, and it is rare enough not to matter to the write count.

## Self-Review

Reviewed as senior engineer, QA engineer, student, teacher, education researcher and accessibility expert, each finding checked against the code and fixed above:

- Student: `Generator`'s "other" delimiter field has `autoFocus`, so a reopened one would take focus on load (R15).
- Senior engineer: the live text can run ahead of the graph within a commit's pause, so positions would be dropped on reopening if it were saved (R2). An author can leave the Graph pane out, so a save can't wait for a draw (R11). `handleDragStop` stores unrounded positions, which cost a drawing about 12 bytes each (R1). Table entries doubled for Data mode, where ids are labels (R6).
- Teacher: the inline frame's size, resolved below.
- Student: an output in a hidden mode or a collapsed pane has no height at mount, so it opened at its oldest (R3).
- Senior engineer: `orderMatters` and `caseSensitive` were overwritten on a page without Data mode, and unknown fields inside `useData` and `draw` were dropped (R14). A reopened student who did nothing posted a rebuilt state, a new history entry on a changed page (R15). R2 said any change of states, where R5 checks their number.
- QA engineer: the limit's event fires for a drawing too (R19, R28), and the 1,000 states and 2,000 arrows were 256 KB as stored; 561 and 1,122 reach the limit, and short outputs fit 700 (R18).

#### RESOLVED: The size of the "View Work" frame
The code reads as a small inline frame (Technical Notes), which would show mostly the Input pane in Data mode. Decision (Doug): not an issue, and pane order stays as the student left it. A teacher has a full page for the student's work, with the scrubber at full size. R33 checks it on staging.

