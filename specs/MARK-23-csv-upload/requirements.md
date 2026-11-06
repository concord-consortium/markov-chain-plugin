# Start the AP Interactive's Input Table from a CSV File

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-23
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Students can start the AP interactive's input from a CSV file: an Upload CSV button in the Input pane reads one column of the file, and its values fill the table, the linked text box and the graph as if the student had entered them row by row. An authoring setting, off by default, decides whether students get the button.

## Project Owner Overview

The CODAP plugin let students drag a column from a CODAP table into the Markov tool, so a dataset (weather by day, notes in a song, moves in a game) became a chain without retyping it. The AP interactive replaced that with its own text box and table (MARK-15), and Rebecca noticed what was lost: "I am slightly regretting the inability to upload CSV as an option for how to start the table." We told her it would come back this sprint as its own piece of work, as a way to start the table from a CSV file.

This story gives students that start. A student with a CSV file (from CODAP, a spreadsheet, or a teacher) chooses it, and each value in its column becomes a row of the table, one state per value, with an empty cell breaking the chain, as an empty CODAP cell did in the plugin. From then on it is ordinary input: the student edits it like typed words, it is saved like typed words, and it can be replaced by another file. Authors turn the button on per activity. The CODAP plugin, and the ELA module that uses it, do not change.

## Background

- **Where it came from.** Rebecca's answer to layout question 6 (the table's controls) in her 2026-11-02 answers, and item 6 of the follow-up we sent her ("Uploading a CSV: yes, uploading went away with CODAP. We're adding it back as its own piece of work this sprint, as a way to start the table from a CSV file."). Earlier, in the tech-specs doc's section 5, she wrote "We could let them choose from a CSV, or make their own table in CODAP" about bringing data into the AP interactive; that round left it out. MARK-19 (the dashboard summary) moved to the backlog to make room for this story.
- **MARK-15** (merged, PR #90; spec `specs/MARK-15-ap-workspace.md`) is what this story builds on:
  - The input is one text (`DataWorkspace`'s text state), and the table is that text's tokens (R20). The table-only view keeps the text too, unseen (R21).
  - A table row is one token as typed, trimmed, brackets removed; an empty or whitespace-only row is a break (R17). A row's text the tokenizer would split, or that holds a character the text drops, is written into the text in brackets (`textForRow`, R20). One tokenizer turns the text into states, lowercased unless the "Case sensitive" switch is on (R15, R16, R16a).
  - A commit hands the core the tokens' values (`dataChanged`), lays a mostly new graph out whole and fits it (R29a, R29c), and clears a selection that no longer exists (R28). The input is limited to 50,000 characters (R32).
  - While a sequence is generated, the text box, the table and the switches are read-only (R21).
  - Logging goes through one typed list of events and `LOGGED-EVENTS.md`, checked against each other by a test (R33 to R35). MARK-15's own precedent for an input change that isn't typing: the "Case sensitive" switch commits through the same path and logs only its own event, `CaseSensitivityChanged` (R16a).
  - Authoring settings are added to MARK-13's authored state without a version change, read one by one with a default (`authored-state.ts`'s header rule; MARK-15's `showCaseSwitch` did this), shown in the form's Data settings, and read from the standalone page's URL settings.
- **MARK-16** (PR #91, `specs/MARK-16-graph-views.md`) writes a word added in the table into the text on a line of its own while "Order matters" is off, and as prose while it's on (its R10a, from Rebecca's layout answer 7). It puts "Order matters" and "Case sensitive" together in one wrapping group at the top of the Input pane, hidden with the collapsed pane, and in the workspace's controls row when there is no Input pane (its R9). Draw mode has no Input pane (its R17). Stacked, the Input pane takes the workspace's full width.
- **MARK-17** (PR #92, stacked on #91, `specs/MARK-17-saved-work-in-the-ap.md`) saves the whole workspace: the last committed input text (only when it differs from the starting text), every Data-mode state's position, both modes' outputs, generator settings, the chosen item and the layout. A commit that changes the text saves (its R9), and the save after the next draw holds the new positions (R11). Positions are read back only when the rebuilt graph has as many states and the same case rule (R5). Outputs keep their own table of states, so they read and highlight as they did after their states are renamed or removed (R6). Any logged action counts as the student having done something (R13). In report mode it shows the student's workspace read-only: the text, the table and both switches can't be changed there (R22 to R25). It removed the settings summary with the report placeholder (R31).
- **How the CODAP plugin took a dataset.** `getAttributeValues` (`src/utils/attribute-values.ts`) reads one attribute's value from every case, in case order; `toStateLabel` turns a missing value into `""`; `graphFromValues` (`src/utils/chain-graph.ts`) makes each value one state as it is (not split into words, not lowercased), with an empty value breaking the chain. The student chose the column by dragging one attribute. The plugin had no size limit.

## Requirements

### The setting

- **R1.** MARK-13's authored state gains `allowCsvUpload`, a boolean, off by default. It is read like MARK-15's `showCaseSwitch`: its default for activities saved before it, `authoredStateVersion` unchanged. The authoring form shows it in Data settings (shown only when Data mode is usable), under "How students enter their data", as the checkbox "Let students start from a CSV file". The standalone page reads it from the URL like every other setting.
- **R2.** Students get the Upload CSV button in Data mode when the setting is on and the Input pane is present, in every input view (text only, table only, and linked): the text box and the table are one input, so the file's values reach whichever the student sees. Draw mode and a Data mode with the Input pane turned off have no button. In the read-only report view the button shows disabled, as MARK-17 shows the switches there (its R25), so a file can't be chosen (open question below).

### The button

- **R3.** The button reads "Upload CSV" and sits at the top of the Input pane's body, after MARK-16's group of "Order matters" and "Case sensitive" switches, so it is hidden with the collapsed pane, shares the switches' line where the pane is wide enough (stacked, the pane is the workspace's width), and wraps below them in a narrow pane. It opens the browser's file chooser for `.csv` files. It is disabled whenever the switches are: while a sequence is generated (MARK-15's R21) and in the report view. It works from the keyboard and says what it does to a screen reader.

### Reading the file

- **R4.** The file is read as CSV (RFC 4180): fields separated by commas, a field in double quotes may hold commas, line breaks and doubled quotes, and lines end in CRLF, LF or CR. A UTF-8 byte order mark is dropped. A file that isn't valid UTF-8 is read as Windows-1252, the encoding Excel's plain "CSV (Comma delimited)" uses on Windows, so accented letters come through rather than as replacement characters.
- **R5.** **Which column.** The values come from the file's first column, whatever else the file holds, and the status line names it (R11).
- **R6.** **The first row.** Lines starting with `#` before the first row are skipped: CODAP 3 starts its CSV export with `# name: ...` and `# attribute -- ...` lines, and its own importer skips them. The first row after them is always read as the column's name, not a value, as CODAP reads a CSV, so a word list with no header loses its first word, which the status line shows as the column's name. A `#` later in the file is an ordinary value.
- **R7.** **Each value becomes a table row**, as the plugin made each CODAP value a state: the whole cell is one row (never split into words), trimmed, with brackets removed (MARK-15's R17); line breaks, tabs and other control characters inside a cell become spaces first, so the text it is written into stays one line per value and the saved state stays inside MARK-17's budget (a control character takes 7 bytes as the Activity Player stores it). An empty or whitespace-only cell is a break, as an empty CODAP cell was. A row missing the column (a short row) is an empty cell. A blank line is a row whose cells are all empty, so it is a break too: a spreadsheet saves an empty cell in a one-column sheet as a blank line. (CODAP's importer drops blank lines; here they keep the break the empty cell meant.) Empty rows at the end of the file are ignored, and leading ones break nothing, as blank lines at either end of MARK-15's text don't.
- **R8.** **The text the rows are written into** is what the table would write had the student added the rows one by one: each row's text through MARK-15's `textForRow` (so `No!` becomes `[No!]`), separated as MARK-16's table separates a word added after the last row (on a line of its own while "Order matters" is off, punctuation included; as prose while it is on, with no space before one of `. , ? ! : ;`), and a break as a blank line. "Order matters" itself doesn't change. Tokenizing that text gives back exactly the rows, in order (a Jest round trip). The capitalization rule is the workspace's: under "Case sensitive: No" the states are lowercased, as typed words are.

### Replacing the input

- **R9.** An upload replaces the student's whole input (the text box and the table together). When the input has any words, choosing a file first asks, in place of the status line (R11), "Replace your words with the file's?" with Replace and Cancel buttons, focus moving to Replace; Cancel or Escape leaves everything as it was and returns focus to the button, and Escape there doesn't also clear the workspace's selection. With an empty input it replaces without asking.
- **R10.** The upload commits as one edit through MARK-15's commit path: the core gets the new values, the graph is laid out whole when most states are new and fitted (R29a, R29c), Inspect follows keeping its tab and sort, a chosen state or transition that no longer exists is cleared, and the outputs already generated stay, with a chosen output kept and highlighted as before (MARK-17's R6). A generator starting state whose state is gone generates from any state, as after any commit. The text is saved as any commit's is (R14).
- **R11.** **Feedback.** After an upload a line under the button, announced with `role="status"`, says what was read: "Read 1,234 values from the column "weather"." It goes when the input next commits.

### Refusals

- **R12.** The input is unchanged and the status line says why when:
  - the text built from the values (R8) would pass MARK-15's 50,000-character limit (checked here, since the text box's `maxLength` doesn't limit text set by code) (about 8,500 English words one per cell; more for short codes such as "H" and "T"): "This file is too big: its values come to more than 50,000 characters." Nothing is loaded: the file is refused whole, not cut to what fits.
  - the file is larger than 2 MB, checked before it is read, so a large file never stalls the page (a 2 MB file with ten columns parses in about 0.2 s): "This file is too big to read."
  - the column has no values (an empty file, or only a header): "This file has no values to use."
  - the file can't be read: "This file couldn't be read."
- **R13.** Choosing the same file again after a refusal or an upload reads it again (the file chooser's value is cleared after each choice).

### Saving

- **R14.** Nothing new is saved: the interactive state gains no field. An upload is a commit, so MARK-17 saves it as one: the new input text (one save, one step in the teacher's history), then the new layout's positions once drawn, with the outputs, generator settings and layout as they stand and a chosen state or transition the upload removed left out, since it was cleared. A reopened workspace shows the uploaded words as input, editable like typed ones, with the states where the student left them (MARK-17's R5 matches them, since the saved text and positions agree). The file itself, its name and its other columns are not kept. A refused upload saves nothing, but its log counts as the student having done something, as any logged action does (MARK-17's R13). On the standalone page the upload works and, as everything there, is neither saved nor logged (MARK-15's R5).

### Logging

- **R15.** `CsvUploaded` with `{ rows, tokens, states }` (`rows` the file's rows after the header, `tokens` the table's rows after the upload, words and breaks, `states` the graph's states) when an upload replaces the input. The upload logs no `InputCommitted`, as MARK-15's case switch doesn't. `CsvUploadRefused` with `{ reason }` for each refusal in R12 (`tooLong` for text past the limit, `tooLarge` for a file past 2 MB, `noValues`, `unreadable`); a canceled replacement logs nothing. Both carry `mode`, as every event does. The file's name is not logged: students often name files after themselves. Both join `logEvents` and `LOGGED-EVENTS.md`'s Input table. Neither is a saving event: the upload's commit saves itself (R14).

### Verification

- **R16.** Jest: the CSV parser (quotes, doubled quotes, commas and line breaks inside quotes, CRLF, CR, a BOM, short rows, trailing blank lines, an unterminated quote read to the end of the file), the decoding fallback, the cells' cleaning (a control character other than a line break or tab becomes a space), the text built from cells round-tripping through the tokenizer in both layouts (brackets, punctuation cells, breaks, consecutive breaks), each refusal at its boundary (exactly 50,000 characters accepted, 50,001 refused), the authored-state default and reading, and the log list. The "couldn't be read" refusal (a failed file read) has no automated test; neither suite can make a browser's file read fail.
- **R17.** Cypress, on MARK-13's fake Activity Player page with Cypress's `selectFile`: the button absent by default and present with the setting; a file's values in the table, the text box and the graph's states; the confirmation, both answers; each refusal's message with the input unchanged; the button disabled while playing and in the report view; the posted `interactiveState` holding the uploaded text, and a restart from it showing the uploaded words; the logged `CsvUploaded`; the authoring checkbox saving and reading back.
- **R18.** The CODAP plugin is unchanged: no file outside `src/interactive/`, `src/components/log-events.ts`, `LOGGED-EVENTS.md`, the README and the tests changes, and every existing plugin test passes unchanged. No new dependency.
- **R19.** README: the Markov Interactive section says students can start from a CSV file when the author allows it.

## Technical Notes

- **Where the code goes.** A pure `src/interactive/input/csv.ts` (parse, decode, the column's cells, the text built from them) beside MARK-15's tokenizer and table edits, with its Jest test; the button in a small `csv-upload.tsx` that `input-pane.tsx` renders beside the switches; the commit through `DataWorkspace`'s `commitText`, the path every commit and the case switch take.
- **No CSV dependency.** RFC 4180 with one column taken, and leading `#` lines skipped, is about 50 lines; Papa Parse (which CODAP uses, with `comments: "#"`) would add a dependency and lockfile churn for delimiter guessing this story doesn't do.
- **Decoding.** `new TextDecoder("utf-8", { fatal: true })` throws on invalid UTF-8, and `TextDecoder("windows-1252")` then reads Latin-1 bytes correctly; the UTF-8 decoder drops a BOM by default. *(Checked with throwaway code in Node 24: `café,naïve` saved as Latin-1 throws under fatal UTF-8 and reads back exactly under Windows-1252.)*
- **The saved state's size.** MARK-17 budgets the input at 200,004 bytes as the Activity Player stores it (JSON inside JSON), the cost of 50,000 double quotes, its worst case. A control character costs 7 bytes there, which MARK-17 leaves unguarded for typed text as contrived; an uploaded file could hold thousands, so R7's cleaning keeps them out of uploaded text, which then stays inside MARK-17's budget.
- **The confirmation is inline, not the shared `ConfirmModal`.** `src/components/confirm-modal.tsx`, which the core's Reset uses, hard-codes Ok and Cancel, is a plain `div` with no dialog role or focus handling, and covers its nearest positioned ancestor. An inline question in the Input pane keeps the shared component (and so the plugin) untouched and puts focus where the student is.
- **The round trip and the cost, measured.** *(Checked with throwaway code in Node 24: MARK-15's tokenizer, `rowText` and `textForRow` written from its spec, with this story's parser and text builder. 40,000 random columns of cells (words, punctuation, `No!`, `ice cream`, `3.5`, `a+b`, `[x]`, `a]b`, `#1`, padded, multi-line and tab cells, accented letters, an emoji, empty cells) built into text in both layouts tokenized back to exactly the expected rows, consecutive empty cells as one break and the ends' breaks dropped. A CODAP 3 export, `#` lines and all, gave the column "weather" and its four values. Parsing 5 MB with ten columns took about 0.5 s, so the cap is 2 MB; building the text from 8,000 cells took 23 ms. 25,000 one-letter values in the list layout come to 49,999 characters.)*
- **MARK-17 and MARK-18.** MARK-17's spec says this story needs nothing from it, and R14 agrees: an upload is a commit. MARK-18 stacks on MARK-17 beside this story, not under it; both add to `logEvents`, `LOGGED-EVENTS.md`, the authored state and the README, so whichever lands second merges those lists.

## Out of Scope

- Files other than CSV (TSV, Excel, semicolon-separated CSV from European Excel settings), and guessing the delimiter.
- Bringing data in from a CODAP table on the same page.
- Uploading in Draw mode (a drawing from a file).
- Keeping the file, its name or its other columns.
- Any change to the CODAP plugin.

## Open Questions

### What does the teacher's read-only view show for the button?
**Context**: MARK-17's report view shows the student's workspace with the text, the table and both switches disabled. The button has to do nothing there.
**Options considered**:
- A) Show it disabled, as the switches are, so the teacher sees what the student saw.
- B) Leave it out of the report view.

**Recommendation**: A. It needs no code beyond the flag the switches already use. For Rebecca.

### Is the tightest Input pane acceptable?
**Context**: At the Input pane's 160 px minimum width with the row at its 200 px minimum height, the two switches (each name wrapping), the button and a two-line status line can take most of the pane's body, leaving the linked text box and table little room. At the starting sizes (280 by 315 px) both keep their 60 px minimum.
**Options considered**:
- A) Accept it: the corner needs both dividers dragged to their limits, and widening the pane brings the room back. Cypress checks the starting sizes and that the button stays inside the pane at 160 px.
- B) Put the button inside the switches' group so it wraps with them, saving a line where it fits beside a switch.

**Recommendation**: A. For Doug.

### RESOLVED: What does a file with several columns do?
**Options considered**: A) the first column, named in the status line; B) the student picks a column from a list; C) every cell, row by row, as one sequence.
**Decision**: A (Rebecca, 2026-11-03). R5 and R11.

### RESOLVED: Is the first row skipped as column names?
**Options considered**: A) always, as CODAP reads a CSV; B) never; C) a "First row is column names" checkbox.
**Decision**: A (Rebecca, 2026-11-03). A word list with no header loses its first word, shown as the column's name. R6.

### RESOLVED: What happens to a file too big for the input?
**Options considered**: A) refuse it and say why; B) load the values that fit and say how many were left out.
**Decision**: A (Rebecca, 2026-11-03). R12. The 2 MB cap on the file itself stands (Doug, 2026-11-03).

### RESOLVED: Does an upload replace the input or add to it?
**Options considered**: A) replace, asking first when there are words; B) add to the end after a break; C) ask each time.
**Decision**: A (Rebecca, 2026-11-03). R9.

### RESOLVED: Judgment call: offer the button in every input view, not only with a table
**Options considered**:
- A) Every view with an Input pane.
- B) Only the table and linked views, as Jira's "the input table gets an Upload CSV button" reads.

**Decision**: A. The text and the table are one input in MARK-15, so the file's values land in whichever the student sees, and a text-only activity would otherwise have no way in. The authoring setting still decides whether students get it.

### RESOLVED: Judgment call: each cell is one state, not split into words
**Options considered**:
- A) A cell is one table row, as a CODAP value was one state.
- B) A cell is tokenized like typed text, so a cell holding a sentence becomes several states.

**Decision**: A. It is how the plugin read a dataset and how MARK-15 reads a table row, and it is what "start the table" means. A sentence-per-cell file reads as one state per sentence; a student wanting words can paste the text into the text box instead.

### RESOLVED: Judgment call: the upload logs its own event, not `InputCommitted`
**Options considered**:
- A) `CsvUploaded` only, carrying the counts `InputCommitted` would.
- B) `InputCommitted` with a new `how: "upload"`, plus `CsvUploaded` for the file's facts.

**Decision**: A, following MARK-15's case switch, which logs only `CaseSensitivityChanged`: one event per student action, and a researcher counting typed commits doesn't count uploads.

### RESOLVED: Low confidence: the confirmation's buttons
**Context**: R9 asks for Replace and Cancel; the shared `ConfirmModal` hard-codes Ok and Cancel, has no dialog role and doesn't move focus.
**Options considered**:
- A) Add an optional `okLabel` to `ConfirmModal`, defaulting to "Ok".
- B) Use `ConfirmModal` as it is, with Ok and Cancel.
- C) An inline question in the Input pane, with Replace and Cancel and focus moved to Replace.

**Decision**: C. It needs no change to a component the plugin renders (R18), and it fixes the keyboard and screen reader gaps A and B would inherit. R9 and Technical Notes say so.

### RESOLVED: Low confidence: how many values fit in 50,000 characters
**Context**: The figure Rebecca sees in R12's question.
**Options considered**:
- A) Measure it on real text.

**Decision**: A. *(Checked with throwaway code: the GPL-3 text's 5,700 words average 5.9 characters with their separator, so 50,000 characters hold about 8,500 words.)* R12 and the open question now say about 8,500 English words, more for short codes.

## Self-Review

Roles: Senior Engineer, Education Researcher, QA Engineer, Teacher, WCAG Accessibility Expert, Student. Each finding below was checked against the code before it was written down.

### Senior Engineer

#### RESOLVED: A CSV exported from CODAP would load its metadata as values
CODAP 3's `convertDatasetToCsv` (`v3/src/utilities/csv-export.ts`) writes `# name: ...` and one `# attribute -- name: ...` line per attribute before the header row, and its importer skips them with Papa Parse's `comments: "#"`. Read as plain CSV, "# name: data" would be the column's name and each attribute line a state. R6 now skips `#` lines before the header, and only there, so a value like `#1` later in a word list stays.

#### RESOLVED: Blank lines: CODAP drops them, a spreadsheet means a break
CODAP's importer uses `skipEmptyLines: "greedy"`, but a spreadsheet saves an empty cell in a one-column sheet as a blank line, the case where a student means a break. R7 now reads a blank line as an empty cell (a break), ignores trailing ones, and says why it differs from CODAP.

#### RESOLVED: The limit has to be checked by the upload itself
MARK-15 limits the text box with `maxLength`, which applies only to typing; text set by code passes it. R12 now says the upload checks the text built from the values.

### Education Researcher

#### RESOLVED: `CsvUploaded`'s counts overlapped
`values` and `breaks` counted cells, but consecutive empty cells are one break in MARK-15's tokenizer, so `values + breaks` didn't match the table. R15 now logs `rows` (the file's), `tokens` (the table's, after the upload) and `states`.

### QA Engineer

#### RESOLVED: The 5 MB refusal reused a message that would be untrue
A 3 MB file with many columns can have a first column far under 50,000 characters. R12 gives it its own message.

### Teacher

#### RESOLVED: The setting's place in the form
MARK-13's form shows Data settings only when Data mode is usable (`authoring.tsx`'s `useData && useDataSettings`). R1 says the checkbox follows that.

### Student

#### RESOLVED: The standalone page and the README weren't covered
R14 now says the upload works standalone and saves and logs nothing there, as MARK-15's R5 does for everything; R19 adds the README line.

### Implementation assumptions checked before the implementation spec

#### RESOLVED: A 5 MB file would freeze the page for half a second
Measured with throwaway code (Technical Notes): parsing 5 MB with ten columns takes about 0.5 s on the main thread, with either a character scan or a sticky regex. R12's cap is now 2 MB, about 0.2 s, still room for a CODAP export of about 20 columns and 8,000 rows.

#### RESOLVED: The text built from cells gives back the cells
Checked with throwaway code over 40,000 random columns (Technical Notes); R8's round trip holds in both layouts, including cells the tokenizer would split, bracket characters, and runs of empty cells.

