# Send to CODAP and Download tables

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-18

**Status**: **Closed**

## Overview

Students can send the AP interactive's tables to a linked CODAP interactive on the same page, through the Datalog plugin, and download the same tables as CSV files. Each send is a named snapshot with its own tables in CODAP, such as "Data1_States", so two texts can be compared side by side.

Until now a student's words, states, transitions and outputs stay inside the interactive. This story adds the two buttons Rebecca's design puts at the right of the top row, Send to CODAP and Download tables, each turned on by the author. Both open one small popup: a name that starts as "Data1" or "Drawing1", and a checkbox for each table that applies. Send saves the tables in the Activity Player's object storage, each send becoming its own set of tables in CODAP, and a message that stays until the student closes it says how to bring them into CODAP. Download saves one CSV file per table, inside the Activity Player or on a standalone page.

The Datalog plugin's side is DP-12, to be released as 0.0.4, and this story needs that version before it can be finished. The two stories agree on a general format for a snapshot, `multi-value-snapshot`, documented in the Datalog plugin's `docs/multi-value-snapshot.md`, that any interactive could use; Markov is its first user. The CODAP plugin the ELA module loads doesn't change.

The buttons' author settings already exist: MARK-13 saves `buttons.sendToCodap` and `buttons.downloadTables`, both off by default, and `workspaceConfig` already carries them as `sendToCodap` and `downloadTables`. Nothing renders them yet. MARK-15 and MARK-16 built `.controls-row`, the tables in Inspect, and the modes; MARK-17 saves a student's work and left room for one new saved field, the name counter. MARK-23 (CSV upload) lands after this story and reads the first column of a CSV.

Rebecca's decisions, latest first: "Where we landed", Send to CODAP (updated); follow-ups D (the message stays until closed) and "What we decided" 24 to 27; layout questions 10 and 24 to 27. Where she didn't speak, her question's default stands.

## Requirements

### The buttons

- **R1.** **Send to CODAP** shows when the author turned it on and the interactive runs in the Activity Player with object storage (`objectStorageConfig` in the init message). It doesn't show standalone, since there is nowhere to send to, or in a report.
- **R2.** **Download tables** shows when the author turned it on, inside the Activity Player and standalone. It doesn't show in a report.
- **R3.** Both sit together in their own group at the right end of `.controls-row`, in both modes, after everything else in the row including Clear highlight. When the row doesn't fit they wrap as a group onto the next line, still at the right. The group's place doesn't depend on any other control in the row, so moving Show probabilities later needs no change here.
- **R4.** Each button is off when its mode has no states, or while a sequence runs (playing, paused or stepping). The tables are the showing mode's, so Data mode with no words is off even if a drawing exists. Its reason is the button's `title`, which the browser shows on hover, and a screen reader gets the same text: "Add some words first.", "Draw something first." or "Wait for the sequence to finish." An off button stays in the Tab order and does nothing when pressed.

### The popup

- **R5.** Either button, when on, opens one popup, titled for its button, with a name field, the table checkboxes, and Cancel and Send (or Download). It sits near the top of the workspace, just under the row, so it is in view in a tall stacked frame; the frame is as tall as the workspace, so centering it could put it below the fold. It blocks the workspace behind it, keeps focus inside it, including while its controls are off (R16) and after a failed save, and returns focus to the button that opened it when it closes by any route. Escape and Cancel close it; a click outside doesn't. While it saves or downloads, Escape does nothing. Escape never also clears the graph's selection.
- **R6.** The checkboxes, in this order, are "Input data", "States", "Transitions" and "Outputs":
  - Input data: not in Draw mode.
  - Transitions: not with "Order matters" off, since Inspect shows an explanation in its place.
  - Outputs: not when the author left out the Sequence Generator.
  - A table with no rows yet reads "(none yet)" after its name, faded, unchecked, and can't be chosen. That is Outputs before any are generated, and Transitions with one word or a drawing with no arrows.
  - Every other box starts checked. Send and Download are off with nothing checked.
  - Input data and States and Transitions don't depend on the Input or Inspect pane being present.
- **R7.** Choices made in the popup aren't kept: each opening starts as R6 says.

### Names

- **R8.** The name field starts as "Data" or "Drawing", by mode, and the mode's next number: "Data1", "Data2". Students can change it. Sending and downloading share one count, per mode. The field takes at most 50 characters; surrounding spaces are removed; Send and Download are off while it is empty.
- **R9.** The count goes up by one with each finished send or download, whatever the name was. Cancel and a failed send or download leave it.
- **R10.** The count is saved in the student's state, for each mode, as a new optional field, left out while it is 0 so that an untouched state stays unchanged (MARK-17's R15). Reading a wrong value treats it as never saved. A state without it starts at 1. Standalone, it lasts as long as the page, as the rest of the work does.

### The tables

- **R11.** Tables hold the showing mode's work at the moment of the press, committed input only. Each table's definition (its word, columns and column types) is stated once and serves both sending and downloading.
- **R12.** The columns, as `cols` and `colTypes`:

| Table word | Data mode | Draw mode | Rows |
|---|---|---|---|
| Input | Word (categorical), Position (numeric) | none | one per word in input order, as typed; a blank line is no row; Position counts from 1 |
| States | State (categorical), Count (numeric) | State (categorical) | one per state, in Inspect's alphabetical order |
| Transitions | From (categorical), To (categorical), Count (numeric), Probability (numeric) | From, To, Probability | one per transition, in Inspect's alphabetical order |
| Outputs | Output number (numeric), Output (categorical), Starting state (categorical), Max length (numeric), Delimiter (categorical), Order matters (categorical) | same | one per output, numbered from 1 oldest first |

- **R13.** Probability is a number from 0 to 1 at 4 decimal places, the transition's value over the total out of its state, and 0 where that total is 0, as a drawing's arrows can be. `Word` comes first so that a downloaded Input file uploads back as words through MARK-23. In Outputs, Output is the sequence's labels joined with its group's delimiter; Starting state is the label or "(any)"; Delimiter is the text, "(none)" for no delimiter, or "(space)" for one of only spaces, which CODAP shows as empty; Order matters is "Yes" or "No", "No" only for a group marked orderless. No column is named `__objectId`, `__id__` or `__proto__`, which DP-12 reserves.

### Sending

- **R14.** Send writes one stored object in DP-12's form:
  - `new StoredObject({ name, description: name, subType: "multi-value-snapshot" })`, `type` left as `"untyped"`;
  - one `addDataTable({ id, name, cols, rows })` per checked table, with `id` its word in lowercase, `name` its word in both modes, and no item `subType`;
  - one `addObject({ id: "tables", name: "Tables", data: { tables: [{ id, colTypes }] } })`, its order R6's order.
  - `tables` is reserved by DP-12 as the index's id, and no table uses it.

  The Datalog plugin titles each table `<snapshot's display name>_<table's name>`, such as "Data1_States" or "Drawing1_States", the same words as R19's file names. Every send is its own set of tables, so nothing is shared between sends or modes.
- **R15.** Each press is a new object. Two snapshots may share a name: the plugin keeps them apart by object, and their tables then have the same title.
- **R16.** While saving or downloading, the popup's controls are off and its button says "Saving..." or "Downloading...". A save that fails or takes over 30 seconds shows "Your tables couldn't be saved. Check your connection and try again." in the popup, which stays open with the student's choices. A download that fails shows "Your tables couldn't be downloaded. Try again." the same way.
- **R17.** A table's rows may take 1,000,000 bytes as stored, inside Firestore's 1 MiB per document. Outputs is the table that reaches that in use (Technical Notes). Where Send to CODAP shows, generating stops at MARK-17's "You have reached the maximum number of outputs." once either mode's Outputs table reaches it, as well as at MARK-17's own limit. Other pages keep MARK-17's limit alone. There is no message of its own for a table that is too big: a write Firestore refuses is a failed save, as R16 says.
- **R18.** After a save the popup shows exactly "Your tables have been saved as [Name]. Open the CODAP window on this page and choose this name in the Datalog plugin." with [Name] the snapshot's name, and a Close button that takes focus. It stays until the student closes it, with Close or Escape; it never fades. A screen reader reads it with Close.

### Downloading

- **R19.** Download saves one CSV file per checked table, named `[Name]_[Word].csv`, such as `Data1_Input.csv`, to wherever the browser saves downloads. A character a file name can't hold (`/ \ : * ? " < > |`) becomes `_` in the file name only.
- **R20.** A file is UTF-8 with a byte order mark, so spreadsheets read accented words, with a header row of the columns, values quoted as RFC 4180 says, and CRLF line ends. Cells hold R12's values unchanged.
- **R21.** Files start about 200 ms apart. The popup then closes, with no message. Download has no size limit.

### Logging

- **R22.** New events, each with `mode`: `TablesDialogOpened` `{ action }`, `TablesDialogCanceled` `{ action }`, `TablesSent` `{ name, tables }`, `TablesSendFailed` `{ name, tables }`, `TablesDownloaded` `{ name, tables }`, with `action` `send` or `download` and `tables` the table words. `TablesSent` and `TablesDownloaded` save the student's state, so the count survives. `TablesSendFailed` means the popup stopped waiting, not that nothing was written: a write still going at 30 seconds can land afterward. `LOGGED-EVENTS.md` and `logEvents` add them, and `OutputLimitReached`'s entry in `LOGGED-EVENTS.md` also names R17's limit. As with every event, nothing is logged standalone.

### What must not change

- **R23.** The CODAP plugin's built script and CSS (`main`) are byte-identical to the base build, and the report item's script doesn't grow. The object storage library loads as its own chunk, only where Send to CODAP shows.
- **R24.** A saved state from before this story opens as it did. The 1 MB answer-document budget from MARK-17 is unaffected: snapshots aren't in it.
- **R25.** Dependency and lockfile changes are a commit of their own.
- **R25a.** The demo page and the fake Activity Player page start the interactive with the library's in-memory `demo` store, so Rebecca and the tests can use Send to CODAP without Firebase. Nothing reaches CODAP there.

### Tests and the Done check

- **R26.** Jest covers: the tables from a graph, tokens and groups, each row of R6, R13's values, CSV quoting, file names, the snapshot object as DP-12 reads it, the count's reader and builder, and R17's limit at and over its edge. Jest also covers each button's standalone showing rules, since Cypress's own frame makes a page read as hosted. Cypress, on the fake Activity Player page: each button's showing rules, R3's place at the workspace's widest and narrowest rows, R4's reasons, the popup's keyboard and focus behavior, a send to its message, a failed send, a failed download, R17's limit with Send and its absence without, a download's files and their contents, the count across a reopen, and R22's events. R23 is checked by comparing the plugin's built files on the base and the head, as MARK-17 did.
- **R27.** Hand check on staging, before DP-12's 0.0.4 is tagged, on an activity with this story's branch build and a linked CODAP interactive on one page, the plugin pointed at a branch deploy of DP-12's code: a student sends tables from Data mode and from Draw mode, brings each into CODAP with that deploy, and sees each send's tables under their own titles with text columns as text. This is Jira's Done when, on the code that becomes 0.0.4. Also a real Chrome and a Chromebook download of four files, since a browser may ask once to allow several downloads. Also a send from a page left open for more than an hour, which shows that a client signed in at the start outlives the token it signed in with. Also what Cypress can't drive: a real Escape on the popup, pressed several times during an offline save, which must leave it open until R16's message, and a real Tab, which must stay in the popup and not reach the Activity Player's page.

## Technical Notes

### Object storage, as checked

Read in `activity-player`, `object-store` (`@concord-consortium/object-storage` 1.0.0-pre.9), `lara-interactive-api` 1.15.0, `report-service`'s `firestore.rules`, and Agent Sim's save in `question-interactives`, on their current checkouts.

- **Reaching it.** The Activity Player puts `objectStorageConfig` in the runtime and report init messages (`iframe-runtime.tsx`), typed as opaque by `lara-interactive-api`. An interactive builds its own client with `createObjectStorage(config)`. The Firebase token in the config is refreshed just before the init message is posted, and the client signs in when it is created, "possibly long after launch" as the Activity Player's comment says. So the client is created when the workspace starts, not at the first press, while the token is fresh.
- **Who can read.** A snapshot's `question_id` comes from the config; the Datalog plugin finds it through the CODAP interactive's `data_source_interactive` link, per student. The Firestore rules treat `object_store_data` and `object_store_metadata` as student work: students create and read their own, teachers read their class's. There is no delete in the client's interface or the rules, so a snapshot stays.
- **Size limit.** `add` writes a metadata document and one document per item, the `tables` index among them, in one batch. Each item is `JSON.stringify`-ed into `itemData`, so Firestore's 1 MiB limit is per table, not per snapshot, and the 10 MiB batch limit isn't reachable with five items. There is no client-side check. R17's 1,000,000 bytes count only a table's rows, which leaves room for its column names, the document's other fields and the last sequence. Offline, a Firestore write neither finishes nor fails, which is why Agent Sim races it against 30 seconds and R16 does too. The client connects once at workspace start and keeps a failed connection's rejection, so after that rare failure R16's "try again" fails until the page is reloaded; this is left unguarded, since the page has just loaded on a fresh token. A write that outlives the timeout can still land, so a retry could leave two snapshots; that is harmless (R15).
- **The library and React.** It declares a React 16 or 17 peer, and this repo is on React 19, so `npm install` refuses it. An `overrides` entry mapping its `react` to `$react` installs cleanly, and in a real build `StoredObject`, `addDataTable`, `addObject` and the demo store ran in Chrome. Only `createObjectStorage` and `StoredObject` are used, not its React context. The override stays until the library's peer range allows React 19, then goes.

### Sizes measured

From throwaway runs of generated outputs filled to MARK-17's 140 KiB limit, in KB as stored:

| Outputs | One row per output | One row per word |
|---|---|---|
| 720 of length 100, 8 states of 5 letters | 443 | 2,726 |
| 500 of length 100, 100 states | 356 | 1,939 |
| 280 of length 100, 2,000 states | 227 | 1,108 |
| 2,380 of length 20, 100 states | 394 | 1,817 |
| 720 of length 100, 8 states of 50 letters | 3,607 | 5,890 |

MARK-17 stores each state once, so long states pass its limit while their text fills a table, which is why R17 adds a second check. A full 50,000-character input of 12,500 different words is 98 KB of Input, 122 KB of States and 220 KB of Transitions, so of typed text only Outputs can reach R17's size.

The check runs where MARK-17's does, when a sequence ends, so the last sequence can run past it. Firestore's limit leaves 48,576 bytes past R17's count, which that sequence shares with the column names and the document's other fields: a little under 8,000 steps of 5-letter words, or 900 of 50-letter words. Max Length has no upper bound, so a longer last sequence can pass it, and so can a page where the author turns Send on after students have outputs over the size. A drawing can pass it in Transitions, since a state's label has no length limit: 12 states of 9,000 characters with every arrow are 2.38 MB, within MARK-17's limit. All three are left unguarded, as MARK-17 leaves its contrived inputs: the save fails with R16's message.

Run on the real table code, 720 outputs of length 100 are 957 KB with 12-letter words and 1,101 KB with 14-letter words, so R17 stops generating before MARK-17's limit only when the words average about 13 letters or more.

### The build

Measured with a dynamic `import()` from the interactive: the plugin's script and CSS and `report-item` kept their hashes, `interactive` grew 3.4 KB, and `demo` grew only by R25a's store. The library is a 572 KB chunk, 163 KB gzipped. The chunk came out as `dist/934.js`, unhashed and outside `assets/`, because `output.filename` is a function and `chunkFilename` isn't set. Setting `chunkFilename: 'assets/[name].[contenthash].js'` puts it beside the others and leaves the plugin's hash as it was.

### The row

Measured in Chrome by adding the two buttons and Clear highlight to the real row: the buttons' group is 225 px. The widest row, with no Input pane so both switches sit in it, is 899 px; with both read-only labels, 800 px; the usual row, 563 px. It wraps below those widths, with the group on its own line at the right, and the workspace grows 22 px. In those wider cases at widths under 899 px, Clear highlight coming and going can move the panes by that much. The usual row fits at 700 px, the narrowest side-by-side width.

### Datalog 0.0.3 and earlier

An older plugin reads a snapshot as it reads anything: the first table it finds, every column numeric. So an activity needs 0.0.4 before it turns Send to CODAP on. Everything here but R27 can be built and tested before DP-12's code is deployed.

The release order, also in DP-12's spec: R27 runs on a branch deploy of the plugin, DP-12's own before merge or `branch/main/` after it, whichever exists when this story's pushed branch build is ready, and that also gives DP-12's check its real snapshot; then `v0.0.4` is tagged; then the Release workflow promotes it. Promotion waits on the check. Doug and the implementing session set up the snapshot's staging activity together in Playwright once this story's branch build is pushed: a copy of staging activity 1458 with the Markov interactive in place of Agent Sim and the plugin pointed at the branch deploy. Activity 1458 itself stays as DP-12's Agent Sim check.

### Downloads

The Activity Player's iframe has no `sandbox` attribute, so downloads aren't blocked. In headless Chromium, four anchor downloads 200 ms apart from a cross-origin iframe with the Activity Player's `allow` list all arrived. Headless mode doesn't show the browser's "download multiple files" prompt, hence R27.

### Fits the existing code

- `ControlsRow` renders Clear highlight after its children, so R3 needs a new `actions` slot after it rather than a place in the shell's `controls`.
- The shell holds both tools, the saved state and `reportsRef`, whose `useData.text` and `capitalization` give the committed tokens, so the popup belongs to `Workspace`, not to a mode's body.
- `use-mode-body.ts`'s `useEscape` listens on the document, so the popup stops Escape's propagation, as the Reset dialog does.
- `transitionRows` and `stateRows` already sort as Inspect does, and `inspectColumns` names each mode's columns.
- `workspaceConfig` needs no change. `ap-host.ts`'s `savingEvents` gains two events.

### CSV cells

A word can reach a file starting with `=`, through brackets. R20 leaves it, since it is the student's own word in the student's own file, and a prefix would change what MARK-23 reads back.

### Spaces around a value in CODAP

CODAP 3.1.2 trims leading and trailing whitespace from a value and keeps inner spaces, so a delimiter of `" - "` arrives as `-` there, while files keep it as typed. A whitespace-only delimiter would arrive empty, which is why R13 sends "(space)".

### How it is built

- `src/interactive/tables/` holds the code with no components of its own. `table-data.ts` states each table once, as its word, columns and column types, and `tableChoices` says what the popup offers. `csv.ts` writes the files and `file-gap.ts` holds the gap between them, on its own so Cypress can import it: `tsc -p cypress` drops Node's types and can't compile the workspace's code. `table-sender.ts` writes the snapshot and dynamically imports the library.
- `src/interactive/workspace/` holds the components. `table-buttons.tsx` is the group; `tables-dialog.tsx` is the popup, a native `dialog`; `use-table-actions.tsx` keeps the popup's state, the sender and `tablesOffReason` out of `Workspace`, which renders `{ dialog }` beside the two bodies and passes `actions` to each.
- `ControlsRow` has an `actions` slot after Clear highlight. Both bodies stay mounted, so each renders its own copy, and tests look inside `.workspace-body:not([hidden])`.
- `objectStorageConfig` passes down from the runtime message only, so a report never loads the chunk. `sendToCodap` is one setting across both modes, so `canSend` doesn't change after the first render, and the client starts once, with the workspace.
- R17's check sits in `Workspace`, in `outputLimitReached`, and not in `saved-outputs.ts`, which `interactive-state.ts` imports, so the tables' code stays out of anything else that reads saved state.
- The dialog's closing runs in `useLayoutEffect`, since closing hands focus back only while it is in the page. It takes focus before its controls turn off, stops Escape's default while busy because Chromium closes a dialog past two refused `cancel` events, and wraps Tab itself because a modal dialog makes only its own document inert, so in a frame Tab would reach the host's page.
- An ESLint warning counts as a failure here: CI's Cypress runs on `npm start`, whose overlay shows warnings over the page, and every click then fails as covered.
- `jest-resolver.js` gives `nanoid` its CommonJS build, since jsdom asks for its browser build, an ES module Jest can't load, so `table-sender.test.ts` runs against the real library and its demo store.
- Cypress's frame makes a page read as hosted, so the standalone rules are in `standalone.test.tsx`. `{esc}` sends only a keydown and `cy.press` doesn't reach a native dialog, so tests pair `{esc}` with `.trigger("cancel")`. `trigger("mouseover")` doesn't set `:hover`. The row's wrap test shows Clear highlight, since at 700 px the row without it fits exactly in some browsers.

### Corrections to earlier specs and notes

Each was checked against the code.

- **An early note, "reuse `inspectColumns`".** Partly right. `inspectColumns` decides which columns exist, so Draw mode has no counts (R12), but its cells are display text ("the → cat", "2 of 3 = 67%") that CODAP can't use, so the tables take their values from `transitionRows`.
- **An early note, "disable the Transitions checkbox".** Rebecca's default for question 27, which her answer left standing, is no Transitions checkbox with order off. The note predates that answer. R6 follows her default.
- **MARK-15's "`outputSequence` ... MARK-18 adds the data saved for CODAP".** Not needed. `outputSequence` fires for each finished sequence, and a snapshot is taken on a press from the tool's `sequenceGroups`. `ap-host.ts` keeps its no-op.
- **MARK-16's "two buttons take it past 904 px in its widest cases".** Measured, the widest row is 899 px, Clear highlight included, so it fits at 904 and wraps only below that (Technical Notes).
- **MARK-17's "its name counter is a new optional field the builder will carry".** Correct, and it needs a place in the reader too (R10).

## Out of Scope

- Any change to the CODAP plugin, or to the Datalog plugin (DP-12).
- Moving Show probabilities, or anything else in the top row. Rebecca's note on the row's left and right isn't decided; R3 doesn't depend on it.
- Deleting or listing snapshots in the interactive.
- Sending both modes' tables in one snapshot.
- A thumbnail on a snapshot.
- CSV upload (MARK-23).
- Choosing outputs by sequence or by state (MARK-27).
- A Case sensitive column on Outputs, since it isn't recorded per output.
- A warning when an author turns Send to CODAP on with no linked CODAP interactive on the page; the authoring form's note covers it, and the interactive can't see the link.

## Not Yet Implemented

- R27's Chromebook download of four files. The rest of R27 passed on staging, with the plugin on DP-12's branch deploy.

## Decisions

### Is the popup's table list per mode, or does "empty" mean both modes are empty?
**Context**: Rebecca said the buttons are off when the interactive has "no data and no drawings". With words in Data mode and an empty Draw mode, a student in Draw has nothing to send.
**Options considered**:
- A) Off when the showing mode is empty.
- B) Off only when both are empty, and an empty popup otherwise.

**Decision**: A. A snapshot is one mode's tables, and B would open a popup with nothing to choose.

---

### Where the count lives.
**Context**: "No two saves get the same name", with "Data1" and "Drawing1" as separate defaults.
**Options considered**:
- A) A count per mode.
- B) One count, so "Data1" then "Drawing2".

**Decision**: A. Rebecca's own examples start each mode at 1, and the names can't collide across modes. A student can still type a name already used; the plugin keeps the two apart (R15).

---

### What a blank line becomes in the Input table.
**Context**: The input table shows a blank line as a row, which breaks the chain.
**Options considered**:
- A) No row, with Position counting words.
- B) An empty row.

**Decision**: A. An empty case in CODAP is noise for analysis. A downloaded Input file uploaded through MARK-23 loses its blank lines, which is acceptable for a list of words.

---

### One row per output, or one row per word, in the Outputs table?
**Context**: One row per word lets CODAP count words across outputs, but measured 1,108 to 2,726 KB near the output limit, against about 1,000.
**Options considered**:
- A) One row per output.
- B) One row per word.

**Decision**: A, Rebecca. Its columns stay as R12 lists them.

---

### With "Order matters" off, is the Transitions box absent or shown grayed out?
**Context**: Her default for question 27 says absent; an earlier note said disabled.
**Options considered**:
- A) Absent.
- B) Shown, grayed out.

**Decision**: A, Rebecca.

---

### If the author hides the Inspect pane, can students still send States and Transitions?
**Context**: An author may hide Inspect so students work the numbers out themselves.
**Options considered**:
- A) Still offered.
- B) Not offered when Inspect is hidden.

**Decision**: A, Rebecca.

---

### How should Probability look in the tables?
**Context**: Inspect shows "2 of 3 = 67%", which CODAP treats as words.
**Options considered**:
- A) A number from 0 to 1, such as 0.6667.
- B) A whole percent, such as 67.
- C) Inspect's text, as shown.

**Decision**: A, Rebecca.

---

### In CODAP, does every send get its own tables, or join the earlier sends' tables?
**Context**: Agent Sim recordings all join one dataset. A CODAP v3 graph draws from one dataset, so two sends can share one graph only if they share a table; separate tables can be graphed side by side.
**Options considered**:
- A) A new set of tables for every send, named like her files.
- B) Later sends add rows to shared tables, with a column for which send each row came from.

**Decision**: A, Rebecca. No column says which send a row came from, since the title does. The Datalog plugin builds the title, agreed with DP-12 (R14), and Agent Sim keeps joining.

---

### Are the new messages' words right?
**Context**: Her wording covers only the confirmation. The hover reasons of R4 and the failure of R16 are ours, as was a too-big message.
**Options considered**:
- A) As written.
- B) Changed as she says.

**Decision**: A for R4 and R16. She pointed out that "clear some outputs" isn't possible, since Clear removes all of them, so that message went, and R17 stops generating before it would be needed. The check applies only where Send to CODAP shows (Doug), and lands on this story's branch; MARK-17 stays as it is.

---

### A native `dialog`, or a `div` like the shared `ConfirmModal`?
**Context**: The repo's modals are `div`s with no focus handling.
**Options considered**:
- A) `<dialog>` with `showModal()`.
- B) Reuse `ConfirmModal`.

**Decision**: A. R5 needs a focus trap, a blocked page and focus returned. `dialog` gives all three within its own document, as run in Chrome; a frame's Tab can still leave for the host's page, so the popup wraps Tab itself. `ConfirmModal` is shared with the CODAP plugin, so changing it risks R23. jsdom has no `showModal`, so the popup's tests are Cypress's.

---

### Create the client at the start, or at the first press?
**Context**: Starting it loads 163 KB gzipped for a page with Send to CODAP, even if unused.
**Options considered**:
- A) When the workspace starts.
- B) At the first Send.

**Decision**: A. The client signs in with a token from the init message when it is created. Firebase custom tokens last an hour, and a student can press Send long after that, so B could fail on an old token. Pages without the setting load nothing. The hour is Firebase's documented lifetime, not something run here, so R27 sends from a page left open for more than an hour.

---

### Test the sender against the real library or a mock.
**Context**: The library won't load in Jest unless `nanoid` resolves to its CommonJS build.
**Options considered**:
- A) The real library, with a Jest resolver for `nanoid`.
- B) A `jest.mock` of the library.

**Decision**: A. The test's job is to prove the object matches DP-12's reader, and a mock of `addDataTable` would only repeat what the code says.

---

### What the spec reviews changed

Each was run or read in the code, not assumed.

- **R4's reason is a `title`, not a custom tooltip.** A custom tooltip covers the pane under it and needs Escape handling to meet WCAG 1.4.13, which doesn't apply to a browser's own `title` (Doug). A screen reader hears the reason and a mouse user sees it; a sighted keyboard user or a touch user sees only the faded button.
- **R5 places the popup under the row.** The Activity Player's frame is as tall as the workspace, so a centered popup could open below the fold.
- **R6 marks any empty table.** Transitions with one word or a drawing with no arrows reads "(none yet)", since a checked box would make a header-only file and nothing in CODAP.
- **R10 leaves the count out at 0,** so an untouched state stays as it opened.
- **R13 gives 0 where a state's arrows total 0,** which was `NaN` and `null` in JSON.
- **R13's "(space)".** In real CODAP 3.1.2 a value of `" "` came back empty, and a space is the default delimiter, so most Outputs rows would have shown none. Files carry the same label, since the table serves both.
- **R17's edges.** Long labels in a drawing can pass the size in Transitions. That is contrived, like the two edges beside it, and falls to R16's message, so it stays unguarded.
- **R25a gives the demo page and the fake page the demo store,** since neither sent `objectStorageConfig` and neither would show Send.
- **A failed connection at the start stays failed.** `connecting` and the library's `initPromise` keep their rejection, so R16's "try again" can't work until a reload. Accepted, since the page has just loaded on a fresh token; a new client after a failed connect can't tell that from a failed write.
- **`chunkFilename`.** Without it the chunk came out unhashed and outside `assets/`, which a deploy could serve stale.
- **`saving` covers downloads,** since a second press during the gaps would save every file twice.
- **The confirmation is read through `aria-describedby` on Close,** which takes focus, because a message inserted with its live region isn't reliably announced.
- **Download comes before Send in the build order,** so no commit has a button with nothing behind it.
- **An older plugin reads a snapshot's first table as numbers,** so authors shouldn't turn Send on before 0.0.4 is live.
