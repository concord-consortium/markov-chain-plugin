# Start the AP Interactive's Input Table from a CSV File

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-23

**Status**: **Closed**

## Overview

Students can start the AP interactive's input from a CSV file: an Upload CSV button in the Input pane reads one column of the file, and its values fill the table, the linked text box and the graph as if the student had entered them row by row. An authoring setting, off by default, decides whether students get the button.

The CODAP plugin let students drag a column from a CODAP table into the Markov tool, so a dataset (weather by day, notes in a song, moves in a game) became a chain without retyping it. The AP interactive replaced that with its own text box and table (MARK-15), and Rebecca noticed what was lost: "I am slightly regretting the inability to upload CSV as an option for how to start the table." We told her it would come back this sprint as its own piece of work, as a way to start the table from a CSV file.

This story gives students that start. A student with a CSV file (from CODAP, a spreadsheet, or a teacher) chooses it, and each value in its column becomes a row of the table, one state per value, with an empty cell breaking the chain, as an empty CODAP cell did in the plugin. From then on it is ordinary input: the student edits it like typed words, it is saved like typed words, and it can be replaced by another file. Authors turn the button on per activity. The CODAP plugin, and the ELA module that uses it, do not change.

## Requirements

### The setting

- **R1.** MARK-13's authored state gains `allowCsvUpload`, a boolean, off by default. It is read like MARK-15's `showCaseSwitch`: its default for activities saved before it, `authoredStateVersion` unchanged. The authoring form shows it in Data settings (shown only when Data mode is usable), under "How students enter their data", as the checkbox "Let students start from a CSV file". The standalone page reads it from the URL like every other setting.
- **R2.** Students get the Upload CSV button in Data mode when the setting is on and the Input pane is present, in every input view (text only, table only, and linked): the text box and the table are one input, so the file's values reach whichever the student sees. Draw mode and a Data mode with the Input pane turned off have no button. In the read-only report view the button shows disabled, as MARK-17 shows the switches there (its R25), grayed out so a file can't be chosen (Rebecca, 2026-11-06).

### The button

- **R3.** The button reads "Upload CSV" and sits at the top of the Input pane's body, after MARK-16's group of "Order matters" and "Case sensitive" switches, so it is hidden with the collapsed pane, shares the switches' line where the pane is wide enough (stacked, the pane is the workspace's width), and wraps below them in a narrow pane. It opens the browser's file chooser for `.csv` files. It is disabled whenever the switches are: while a sequence is generated (MARK-15's R21) and in the report view. The file input is disabled with it. It works from the keyboard and says what it does to a screen reader.

### Reading the file

- **R4.** The file is read as CSV (RFC 4180): fields separated by commas, a field in double quotes may hold commas, line breaks and doubled quotes, and lines end in CRLF, LF or CR. A UTF-8 byte order mark is dropped. A file that isn't valid UTF-8 is read as Windows-1252, the encoding Excel's plain "CSV (Comma delimited)" uses on Windows, so accented letters come through rather than as replacement characters.
- **R5.** **Which column.** The values come from the file's first column, whatever else the file holds, and the status line names it (R11).
- **R6.** **The first row.** Lines starting with `#` before the first row are skipped: CODAP 3 starts its CSV export with `# name: ...` and `# attribute -- ...` lines, and its own importer skips them. The first row after them is always read as the column's name, not a value, as CODAP reads a CSV, so a word list with no header loses its first word, which the status line shows as the column's name. A `#` later in the file is an ordinary value.
- **R7.** **Each value becomes a table row**, as the plugin made each CODAP value a state: the whole cell is one row (never split into words), trimmed, with brackets removed (MARK-15's R17); line breaks, tabs and other control characters inside a cell become spaces first, so the text it is written into stays one line per value and the saved state stays inside MARK-17's budget (a control character takes 7 bytes as the Activity Player stores it). An empty or whitespace-only cell is a break, as an empty CODAP cell was. A row missing the column (a short row) is an empty cell. A blank line is a row whose cells are all empty, so it is a break too: a spreadsheet saves an empty cell in a one-column sheet as a blank line. (CODAP's importer drops blank lines; here they keep the break the empty cell meant.) Empty rows at the end of the file are ignored, and leading ones break nothing, as blank lines at either end of MARK-15's text don't.
- **R8.** **The text the rows are written into** is what the table would write had the student added the rows one by one: each row's text through MARK-15's `textForRow` (so `No!` becomes `[No!]`), separated as MARK-16's table separates a word added after the last row (on a line of its own while "Order matters" is off, punctuation included; as prose while it is on, with no space before one of `. , ? ! : ;`), and a break as a blank line. "Order matters" itself doesn't change. Tokenizing that text gives back exactly the rows, in order (a Jest round trip). The capitalization rule is the workspace's: under "Case sensitive: No" the states are lowercased, as typed words are.

### Replacing the input

- **R9.** An upload replaces the student's whole input (the text box and the table together). When the input has any words, choosing a file first asks, in place of the status line (R11), "Replace your words with the file's?" with Replace and Cancel buttons, focus moving to Replace; Cancel or Escape leaves everything as it was, and Escape there doesn't also clear the workspace's selection. Replace, Cancel and Escape all return focus to the button; while a sequence plays the button can't take it, so it comes when the button is enabled again, unless the student has moved on. Replace reads the file again with the layout of that moment, since "Order matters" can change while the question shows, so it can also refuse a file that no longer fits. Replace is disabled while a sequence is generated. With an empty input it replaces without asking.
- **R10.** The upload commits as one edit through MARK-15's commit path: the core gets the new values, the graph is laid out whole when most states are new and fitted (R29a, R29c), Inspect follows keeping its tab and sort, a chosen state or transition that no longer exists is cleared, and the outputs already generated stay, with a chosen output kept and highlighted as before (MARK-17's R6). A generator starting state whose state is gone generates from any state, as after any commit. The text is saved as any commit's is (R14).
- **R11.** **Feedback.** After an upload a line under the button, announced with `role="status"`, says what was read: "Read 1,234 values from the column "weather"." It stays through a commit that changes nothing, such as a blur or the "Case sensitive" switch, and goes when a commit next changes the text. An empty status line stays in the page, so a screen reader announces its text; one value reads "1 value", a column with no name reads "from the first column", and a name past 60 characters is cut with "…", so a sentence in the header row can't crowd out the input. Each refusal writes the line anew, so a second one for the same reason is announced too.

### Refusals

- **R12.** The input is unchanged and the status line says why when:
  - the text built from the values (R8) would pass MARK-15's 50,000-character limit (checked here, since the text box's `maxLength` doesn't limit text set by code) (about 8,500 English words one per cell; more for short codes such as "H" and "T"): "This file is too big: its values come to more than 50,000 characters." Nothing is loaded: the file is refused whole, not cut to what fits.
  - the file is larger than 2 MB, checked before it is read, so a large file never stalls the page (a 2 MB file with ten columns parses in about 0.2 s): "This file is too big to read."
  - the column has no values (an empty file, or only a header): "This file has no values to use."
  - the file can't be read: "This file couldn't be read."
- **R13.** Choosing the same file again after a refusal or an upload reads it again (the file chooser's value is cleared after each choice).

### Saving

- **R14.** Nothing new is saved: the interactive state gains no field. An upload is a commit, so MARK-17 saves it as one: the new input text (one save, one step in the teacher's history), then the new layout's positions once drawn, with the outputs, generator settings and layout as they stand and a chosen state or transition the upload removed left out, since it was cleared. A reopened workspace shows the uploaded words as input, editable like typed ones, with the states where the student left them (MARK-17's R5 matches them: the positions saved after the upload's draw carry the uploaded states' key). The file itself, its name and its other columns are not kept. A refused upload saves nothing, but its log counts as the student having done something, as any logged action does (MARK-17's R13). On the standalone page the upload works and, as everything there, is neither saved nor logged (MARK-15's R5).

### Logging

- **R15.** `CsvUploaded` with `{ rows, tokens, states }` (`rows` the file's rows after the header, `tokens` the table's rows after the upload, words and breaks, `states` the graph's states) when an upload replaces the input. The upload logs no `InputCommitted`, as MARK-15's case switch doesn't. `CsvUploadRefused` with `{ reason }` for each refusal in R12 (`tooLong` for text past the limit, `tooLarge` for a file past 2 MB, `noValues`, `unreadable`); a canceled replacement logs nothing. Both carry `mode`, as every event does. The file's name is not logged: students often name files after themselves. Both join `logEvents` and `LOGGED-EVENTS.md`'s Input table. Neither is a saving event: the upload's commit saves itself (R14).

### Verification

- **R16.** Jest: the CSV parser (quotes, doubled quotes, commas and line breaks inside quotes, CRLF, CR, a BOM, short rows, trailing blank lines, an unterminated quote read to the end of the file), the decoding fallback, the cells' cleaning (a control character other than a line break or tab becomes a space), the text built from cells round-tripping through the tokenizer in both layouts (brackets, punctuation cells, breaks, consecutive breaks), the 50,000-character limit at its boundary (exactly 50,000 characters accepted, 50,001 refused), a file MARK-18's download writes reading back as its words, the authored-state default and reading, and the log list.
- **R17.** Cypress, on MARK-13's fake Activity Player page with Cypress's `selectFile`: the button absent by default and present with the setting; a file's values in the table, the text box and the graph's states; the confirmation, both answers; each refusal's message with the input unchanged and nothing saved; the 2 MB limit at its boundary, a file past it never read; a failed read, stubbed in the browser; the button disabled while playing and in the report view; the posted `interactiveState` holding the uploaded text, and a restart from it showing the uploaded words, with each state where it was saved; the logged `CsvUploaded`; the authoring checkbox saving and reading back.
- **R18.** The CODAP plugin is unchanged: no file outside `src/interactive/`, `src/components/log-events.ts`, `LOGGED-EVENTS.md`, the README and the tests changes, and every existing plugin test passes unchanged. No new dependency. `workspace.scss` shares one `button-off` mixin with MARK-18's buttons, with the same result.
- **R19.** README: the Markov Interactive section says students can start from a CSV file when the author allows it.

## Technical Notes

- **Where the code is.** `src/interactive/input/csv.ts` is pure, from a file's bytes to the input text (`decodeCsv`, `parseCsv`, `cellText`, `firstColumn`, `textFromCells`, `readCsv`). `src/interactive/workspace/csv-upload.tsx` holds the button, the question and the status line, and `input-pane.tsx` renders it after the switches in `div.input-controls`. `DataWorkspace` owns `uploadStatus` and commits through `commitText`, the path every commit and the case switch take. `src/interactive/tables/csv.ts` is MARK-18's writer, not this reader.
- **The file's bytes are held, not its read.** While the question shows, `CsvUpload` keeps the bytes and `takeFile` reads them again at Replace, so the text is always written in the current layout.
- **`separatorBefore`** in `table-edits.ts` is the one rule for what goes before a row added after a word, used by `insertRow` and `textFromCells`, so an upload and a typed row can't separate words differently.
- **`textFromCells` builds the text in one pass.** Calling `insertRow` per cell tokenizes the whole text each time: about 24 s at 8,000 cells, against 23 ms measured in one pass.
- **`hasWords` reads the committed tokens.** Pressing the button blurs the text box or a table row first, which commits it.
- **Escape at the question** is handled in the group's `onKeyDown` with `stopPropagation`: MARK-15's Escape listener is on the `ownerDocument`, above React's root, so a stopped event never reaches it.
- **No CSV dependency.** RFC 4180 with one column taken and leading `#` lines skipped is about 50 lines; Papa Parse would add a dependency for delimiter guessing this story doesn't do.
- **Decoding.** `new TextDecoder("utf-8", { fatal: true })` throws on invalid UTF-8, and `TextDecoder("windows-1252")` then reads Latin-1 bytes correctly; the UTF-8 decoder drops a BOM by default. jsdom has no `TextDecoder`, so `csv.test.ts` has the `@jest-environment node` docblock.
- **`cellText` uses `/\p{Cc}/gu`.** A `[\u0000-\u001f]` range trips ESLint's `no-control-regex`.
- **The saved state's size.** MARK-17 budgets the input at 200,004 bytes as the Activity Player stores it (JSON inside JSON), the cost of 50,000 double quotes, its worst case. A control character costs 7 bytes there, which MARK-17 leaves unguarded for typed text as contrived; an uploaded file could hold thousands, so R7's cleaning keeps them out.
- **The confirmation is inline, not the shared `ConfirmModal`.** That component, which the core's Reset uses, hard-codes Ok and Cancel, is a plain `div` with no dialog role or focus handling, and covers its nearest positioned ancestor.
- **Measured.** 40,000 random columns of cells round-tripped through the tokenizer in both layouts. Parsing 5 MB with ten columns took about 0.5 s, so the cap is 2 MB. 25,000 one-letter values in the list layout come to 49,999 characters. English words average 5.9 characters with their separator, so 50,000 characters hold about 8,500 words.
- **MARK-18.** Its Input file has a byte order mark and `Word` as its first column, so a downloaded Input file uploads back as words. That file has no blank lines, so it comes back without breaks.
- **`maxCsvBytes` has its own module,** `src/interactive/input/csv-limits.ts`, so Cypress can share it: `csv.ts`'s imports reach `graph.tsx`, which `tsc -p cypress` can't compile. The file's size is checked only in `CsvUpload`, before the file is read.

## Out of Scope

- Files other than CSV (TSV, Excel, semicolon-separated CSV from European Excel settings), and guessing the delimiter.
- Bringing data in from a CODAP table on the same page.
- Uploading in Draw mode (a drawing from a file).
- Keeping the file, its name or its other columns.
- Any change to the CODAP plugin.

## Decisions

### What does the teacher's read-only view show for the button?
**Decision**: Grayed out (Rebecca, 2026-11-06), disabled with the switches through the same flag, so the teacher sees what the student saw and a file can't be chosen.

### Is the tightest Input pane acceptable?
**Decision**: Accept it (Doug, 2026-11-06). At 160 px wide and a 200 px row the controls take most of the body; the button stays in its own row after the switches, and Cypress checks 60 px each for the text box and table at the starting sizes and the button inside the pane at 160 px.

### What does a file with several columns do?
**Decision**: The first column, named in the status line (Rebecca, 2026-11-03), rather than a column picker or every cell as one sequence.

### Is the first row skipped as column names?
**Decision**: Always, as CODAP reads a CSV (Rebecca, 2026-11-03), rather than never or a checkbox. A word list with no header loses its first word, shown as the column's name.

### What happens to a file too big for the input?
**Decision**: Refuse it and say why (Rebecca, 2026-11-03), rather than load what fits. The 2 MB cap on the file itself stands (Doug, 2026-11-03).

### Does an upload replace the input or add to it?
**Decision**: Replace, asking first when there are words (Rebecca, 2026-11-03).

### Does the button show in every input view, or only with a table?
**Decision**: Every view with an Input pane. The text and the table are one input, so the values land in whichever the student sees, and a text-only activity would otherwise have no way in.

### Is a cell one state, or split into words?
**Decision**: One state, as a CODAP value was and as MARK-15 reads a table row. A student wanting words can paste the text into the text box.

### Does the upload log `InputCommitted`?
**Decision**: No, it logs only `CsvUploaded`, following MARK-15's case switch: one event per student action, and a researcher counting typed commits doesn't count uploads.

### Why skip `#` lines only before the header?
**Decision**: CODAP 3's export starts with `# name: ...` and `# attribute -- ...` lines, which would otherwise load as values, while a value like `#1` later in a word list has to stay.

### Why keep blank lines when CODAP drops them?
**Decision**: A spreadsheet saves an empty cell in a one-column sheet as a blank line, the case where a student means a break.

### Why does the upload check the 50,000 characters itself?
**Decision**: The text box's `maxLength` applies only to typing, not to text set by code.

### Why do `CsvUploaded`'s counts differ from cells?
**Decision**: Consecutive empty cells are one break in the tokenizer, so `rows` is the file's, `tokens` the table's after the upload, and `states` the graph's.

### Who owns the status line and the question?
**Decision**: `DataWorkspace` keeps the status and clears it in `commitText`, the one place that knows a commit changed the text; `CsvUpload` keeps only the held file. An effect in `CsvUpload` would also fire for the upload's own commit.
