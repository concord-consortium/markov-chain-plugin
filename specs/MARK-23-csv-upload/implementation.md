# Implementation Plan: Start the AP Interactive's Input Table from a CSV File

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-23
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The branch starts from the stack below it: MARK-15's workspace, MARK-16's graph views and its table list layout, MARK-17, MARK-18 and DP-12. MARK-23 needs only MARK-15's and MARK-16's code; names below follow their specs (`src/interactive/input/tokenizer.ts`, `table-edits.ts`, `src/interactive/workspace/workspace.tsx`, `input-pane.tsx`, `workspace-config.ts`, `src/components/log-events.ts`), and the pass after they are built corrects any that differ.

Three steps, each its own commit, each building, linting and passing Jest and Cypress on its own: the authoring setting, the pure CSV module, then the button. No dependency or lockfile changes.

Toolchain: Node 24 (`.nvmrc`). Each step ends with `npm run build`, `npm run lint`, `npm run lint:build`, `npm run lint:style`, `npx tsc --noEmit -p .`, `npx tsc --noEmit -p cypress` and `npx jest`; steps 1 and 3 also run `npm run test:cypress` headless against `npm start`.

### 1. The authoring setting

**Summary**: R1, R2's configuration. One boolean on MARK-13's authored state, its checkbox and summary row, and the workspace configuration's flag. Nothing renders the flag yet, so students see no change.

**Files affected**:
- `src/interactive/authored-state.ts` and `authored-state.test.ts`: `allowCsvUpload` and its label.
- `src/interactive/authoring.tsx`: the checkbox.
- `src/interactive/settings-summary.ts` and `settings-summary.test.ts`: the row.
- `src/interactive/url-settings.test.ts`: its list of URL settings gains `["allowCsvUpload", "boolean"]` at the field's place in `defaultAuthoredState`'s key order (after `inputView`), since the test compares the whole list in order.
- `src/interactive/workspace/workspace-config.ts` and its test: `csvUpload`.
- `cypress/e2e/interactive-authoring.test.ts`: the checkbox saves and reads back.

**Estimated diff size**: ~100 lines, about half tests

```ts
// src/interactive/authored-state.ts
export interface MarkovAuthoredState {
  // ... as MARK-13 and MARK-15 have it, with:
  allowCsvUpload: boolean;
}
// defaultAuthoredState: allowCsvUpload false, placed after inputView
// readAuthoredState: allowCsvUpload: readBoolean(saved.allowCsvUpload, defaultAuthoredState.allowCsvUpload),
// settingLabels: allowCsvUpload: "Let students start from a CSV file",
```

- `authoredStateVersion` stays 1, as the file's header comment says for a setting added later.
- `authoring.tsx`: in `useDataSettings`, after the input view's `Select` and its help paragraph, `<Checkbox id="allowCsvUpload" label={settingLabels.allowCsvUpload} checked={state.allowCsvUpload} onChange={allowCsvUpload => update(current => ({ ...current, allowCsvUpload }))} />`. `useDataSettings` renders only with Data mode, so the checkbox does too.
- `settings-summary.ts`: inside the `useData` block, after the input view's row, `{ label: settingLabels.allowCsvUpload, value: yesNo(state.allowCsvUpload) }`.
- `workspace-config.ts`: `csvUpload: boolean` joins `WorkspaceConfig`, `data && state.panes.input.available && state.allowCsvUpload`, beside MARK-15's `caseSwitch`.
- Jest, each naming what it catches:
  - `authored-state.test.ts`: the default is false; `{}` reads false; a saved `true` reads true (fails without the `readBoolean` line, which leaves the field out); `"yes"` reads false; the version is still 1.
  - `settings-summary.test.ts`: with Data mode the row reads Yes or No after "How students enter their data"; with Draw only it is absent.
  - `workspace-config.test.ts`: true in Data mode with the setting on and the Input pane available; false with the setting off; false with the Input pane unavailable (fails without that clause); false in Draw mode.
  - `url-settings.test.ts`: its "covers every setting by its path" list fails until `allowCsvUpload` is in it, so the list change is required, not optional.
- Cypress (`interactive-authoring.test.ts`): checking "Let students start from a CSV file" posts an `authoredState` with `allowCsvUpload: true`; reopened with that state, the box is checked; with Draw only it isn't in the form.

---

### 2. Reading a CSV file into input text

**Summary**: R4 to R8, R12's checks, R16's Jest cases. A pure module from a file's bytes to the input text, with a Jest test that runs in Node's environment.

**Files affected**:
- `src/interactive/input/csv.ts` (new) and `csv.test.ts` (new).
- `src/interactive/input/table-edits.ts`: the separator rule moves into one exported function that `insertRow` and `csv.ts` both call.

**Estimated diff size**: ~280 lines, about 60% tests

```ts
// src/interactive/input/table-edits.ts
// what goes before a table row's text added after another row: a line break in the list layout, else a space,
// or nothing before one of . , ? ! : ;
export const separatorBefore = (rowText: string, layout: TableLayout): string => ...;
```

- `insertRow` (MARK-15's, with MARK-16's `layout`) calls `separatorBefore` in place of its own inline rule, so the table and an upload can't separate words differently. Its existing tests cover the move unchanged.

```ts
// src/interactive/input/csv.ts
// A CSV file's first column as the input's text: each cell one table row, an empty cell a break, written as the
// table writes rows. RFC 4180, commas only.

export const maxCsvBytes = 2 * 1024 * 1024;

export type CsvRefusal = "tooLarge" | "tooLong" | "noValues" | "unreadable";
export type CsvRead =
  | { ok: true, text: string, column: string, values: number, rows: number }
  | { ok: false, reason: CsvRefusal };

// UTF-8 (a byte order mark dropped), or Windows-1252 when the bytes aren't valid UTF-8, as Excel saves a plain CSV
export const decodeCsv = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

// rows of fields; a quoted field may hold commas, line breaks and doubled quotes; an unclosed quote runs to the end
export const parseCsv = (text: string): string[][] => ...;

// a cell as a table row: control characters (line breaks and tabs among them) as spaces, then MARK-15's rowText
export const cellText = (cell: string) => rowText(cell.replace(/\p{Cc}/gu, " "));

// the first column after any leading "#" lines (CODAP's export metadata) and the header row
export const firstColumn = (rows: string[][]): { name: string, cells: string[] } => ...;

// the cells written as the table writes rows: textForRow for each, separatorBefore between, a blank line for a
// run of empty cells between words, and nothing for empty cells at either end
export const textFromCells = (cells: string[], layout: TableLayout): string => ...;

export const readCsv = (bytes: Uint8Array, layout: TableLayout): CsvRead => ...;
```

- `parseCsv` is a single scan (the stage 4 prototype, about 25 lines): inside quotes, `""` is a quote and `"` ends the field; outside, a `"` at a field's start opens quotes, `,` ends a field, and `\r\n`, `\n` or `\r` ends a row. A file ending in a line break adds no empty row.
- `firstColumn` skips rows whose first field starts with `#` until the first row that doesn't, takes that row's first field (trimmed) as the name, and the first field of each later row, `""` for a row with none, through `cellText`. A blank line parses as `[""]`, an empty cell, so it is a break (R7).
- `textFromCells` builds the text in one pass rather than calling `insertRow` once per cell, which tokenizes the whole text each time: at 8,000 cells and about 3 ms per tokenize (MARK-15's measurement) that would take about 24 s; one pass took 23 ms in the stage 4 prototype.
- `readCsv`: more than `maxCsvBytes` gives `tooLarge` before decoding (the component also checks `file.size` before reading, so a large file is never read; this check keeps the function whole on its own); no non-empty cell gives `noValues`; text longer than `maxInputLength` (MARK-15's 50,000) gives `tooLong`; otherwise `ok`, with `values` the non-empty cells and `rows` the rows after the header. `unreadable` is the component's, for a read that fails.
- `csv.test.ts` starts with the `@jest-environment node` docblock: jsdom has no `TextDecoder` *(checked with a throwaway Jest test: `typeof TextDecoder` is `"undefined"` under jsdom; under Node's environment the Windows-1252 fallback decodes `63 61 66 e9` as `café`)*. Byte inputs come from `new TextEncoder().encode(...)`, or a `Uint8Array` literal for Latin-1.
- Jest, each naming the mutation it catches:
  - `parseCsv`: `a,"b,c"` is two fields (fails if quotes don't protect commas); `"x ""y"""` is `x "y"` (fails without the doubled-quote rule); a quoted field with a line break stays one field; `\r\n`, `\n` and a lone `\r` each end a row; `"w\n"` is one row (fails if a final line break adds a row); `"open` reads `open` to the end.
  - `decodeCsv`: Latin-1 `café` (fails without the fallback); a UTF-8 file with a BOM reads without it; valid UTF-8 `ü` reads as itself (fails if the fallback always runs).
  - `firstColumn`: a CODAP 3 export (`# name: data`, two `# attribute -- ...` lines, `weather,day`, four rows) gives the name `weather` and its four cells (fails without the `#` skip); a `#1` value after the header stays (fails if every `#` line is skipped); a short row gives `""`; a cell `"multi\nline"` gives `multi line`; a cell `a\u0001b\u007fc` gives `a b c` (fails if only line breaks and tabs are replaced).
  - `textFromCells`: `["the", "cat"]` is `the cat` in prose and `the\ncat` in list; `["the", "."]` is `the.` in prose; `["No!"]` is `[No!]`; `["sunny", "", "", "rainy"]` is `sunny\n\nrainy` (one break for two empty cells); empty cells at either end write nothing. A round trip over a fixed list of 40 cell columns, built from the stage 4 prototype's pool (words, punctuation, `No!`, `ice cream`, `3.5`, `a+b`, `[x]`, `a]b`, `#1`, padded, multi-line and tab cells, accents, an emoji, empty cells), checks for each layout that `tokenize(textFromCells(cells))`'s rows equal the cells with runs of empty cells collapsed and the ends' dropped. The fixture's columns differ from one another, so it can't pass by returning one value.
  - `readCsv`: 25,000 one-letter values in the list layout (49,999 characters) are `ok`, and 25,001 (50,001) are `tooLong` (fails at an off-by-one either way); a header only is `noValues`; `maxCsvBytes + 1` bytes are `tooLarge`; a good file reports `values` and `rows` that differ when it has empty cells, so the two counts can't be swapped unnoticed.

---

### 3. The Upload CSV button

**Summary**: R2, R3, R9 to R15, R17, R19. The button, the inline confirmation, the status line, the commit and the logs, with Cypress tests.

**Files affected**:
- `src/interactive/workspace/csv-upload.tsx` (new): `CsvUpload`.
- `src/interactive/workspace/input-pane.tsx`: renders `CsvUpload` after MARK-16's `div.setting-switches`.
- `src/interactive/workspace/workspace.tsx`: the upload's commit, its status, and the logs.
- `src/interactive/workspace/workspace.scss`: the row, the status line and the confirmation.
- `src/components/log-events.ts` and `LOGGED-EVENTS.md`: `CsvUploaded` and `CsvUploadRefused`, added together so `log-events.test.ts` passes.
- `README.md`: one line in the Markov Interactive section (R19).
- `cypress/e2e/interactive-csv-upload.test.ts` (new).

**Estimated diff size**: ~300 lines, about half tests

```tsx
// src/interactive/workspace/csv-upload.tsx
export type CsvUploadStatus =
  | { kind: "read", values: number, column: string }
  | { kind: "refused", reason: CsvRefusal };

interface CsvUploadProps {
  disabled: boolean;               // while a sequence is generated (MARK-15's R21)
  hasWords: boolean;               // the committed input has a word, so replacing it asks first
  layout: TableLayout;             // MARK-16's: "list" while "Order matters" is off
  status?: CsvUploadStatus;        // the workspace's, cleared at the next commit
  onRead: (read: Extract<CsvRead, { ok: true }>) => void;
  onRefused: (reason: CsvRefusal) => void;
}
```

- `CsvUpload` renders a `button` ("Upload CSV", `aria-describedby` a visually hidden hint, "Starts your input from the first column of a CSV file.") and an `input type="file" accept=".csv,text/csv" hidden tabIndex={-1}`. The button calls the input's `click()`. *(Checked with a throwaway Cypress test on the fake Activity Player page: `selectFile` with `force: true` reaches a hidden file input inside the interactive's iframe, `file.arrayBuffer()` gives its bytes there, and the browser's Windows-1252 fallback reads `café`.)*
- The input's `onChange` takes `files[0]`, then sets the input's `value` to `""` so the same file can be chosen again (R13; the same throwaway checked that a second `selectFile` of the same file fires `change` after the clear). With `file.size > maxCsvBytes` it calls `onRefused("tooLarge")` without reading. Otherwise `file.arrayBuffer()`, and a rejection calls `onRefused("unreadable")`; then `readCsv(bytes, layout)`. A refusal calls `onRefused`; an `ok` read calls `onRead` at once when `!hasWords`, and otherwise is held as `pending` and the confirmation shows.
- The confirmation replaces the status line: a `div role="group" aria-labelledby` its question, "Replace your words with the file's?", with Replace and Cancel buttons. Replace takes focus when it appears (an effect on `pending`). Replace calls `onRead(pending)`; Cancel and Escape drop `pending` and focus the Upload CSV button. The group's `onKeyDown` handles Escape and calls `stopPropagation`: MARK-15's Escape listener is on the `ownerDocument`, above React's root, so the stopped event never reaches it and the selection stays. Replace is disabled while `disabled` is true, so a sequence started with the question open can't change the input mid-generation.
- The status line is a `p role="status"`: "Read 1,234 values from the column "weather"." (`toLocaleString("en-US")`; "from the first column" when the name is empty), or the refusal's message from one `Record<CsvRefusal, string>` (R12's wording; `unreadable` is "This file couldn't be read.").
- `InputPane`: when `config.csvUpload`, its top row (`div.input-controls`, `display: flex; flex-wrap: wrap; gap`) holds MARK-16's `div.setting-switches` then `CsvUpload`; the status line or the confirmation takes the row's full width below them (`flex-basis: 100%`). Hidden with the collapsed pane, as the switches are.
- `Workspace`: `uploadStatus` state. `onRead` sets the text to `read.text` and commits it through the same function every MARK-15 commit uses, as the case switch does: the core gets the values (`dataChanged`, laying out whole and fitting when most states are new, R29a and R29c), R28's clearing, Inspect and the table follow, and the text saves through `onSaveInput` (MARK-15's R31). It logs `CsvUploaded` with `{ rows: read.rows, tokens, states }` (the committed tokens' count and their distinct states, as `InputCommitted` counts them) and not `InputCommitted`, and sets `uploadStatus` to `{ kind: "read", values: read.values, column: read.column }`. Every other commit sets `uploadStatus` to `undefined`, so the line goes when the input next commits (R11). `onRefused` sets `{ kind: "refused", reason }` and logs `CsvUploadRefused` with `{ reason }`. `hasWords` is the committed tokens having a word; `disabled` is the flag MARK-15's text box and case switch use for R21.
- `log-events.ts` gains `"CsvUploaded", "CsvUploadRefused"`; `LOGGED-EVENTS.md`'s Input table gains their rows (parameters and when), saying the file's name is not logged.
- Cypress (`interactive-csv-upload.test.ts`), files built in the test with `Cypress.Buffer.from(...)` and chosen with `selectFile({ contents, fileName }, { force: true })` on the hidden input, each naming what it catches:
  - The default authored state shows no Upload CSV button; with `allowCsvUpload` it shows in each input view; with the Input pane off, none (catches a button not gated by `csvUpload`).
  - Linked view, empty starting text: a CODAP-style file (`#` lines, `weather,day`, `sunny,1`, `rainy,2`, `,3`, `Sunny,4`) puts `sunny`, `rainy`, an empty row and `Sunny` in the table, the text box reads `sunny rainy\n\nSunny` (the prose layout, "Order matters" starting on), and with `orderMatters.startsOn` false `sunny\nrainy\n\nSunny`, the graph's state labels are `sunny` and `rainy` (lowercased, Case sensitive No), the status reads "Read 3 values from the column "weather".", and the fake page's log has `CsvUploaded` with `rows: 4` and no `InputCommitted` after it.
  - With words already: choosing a file shows the question with focus on Replace; Cancel leaves the text unchanged and focuses Upload CSV; choosing again and Replace replaces it. With a state chosen, Escape at the question cancels and the state stays chosen, with no `SelectionCleared` logged (fails without `stopPropagation`).
  - Refusals: a header-only file, a file of 25,001 one-letter values, and a 2 MB + 1 byte file each show their message with the text unchanged and log `CsvUploadRefused` with `noValues`, `tooLong` and `tooLarge`.
  - The same file chosen twice in a row is read twice (two `CsvUploaded`; fails without clearing the input's value).
  - While a sequence plays, Upload CSV is disabled.
  - The posted `interactiveState`'s `input.text` is the uploaded text.
  - Typing a word after an upload clears the status line.
  - With the Input/Graph divider dragged far left (Input at its 160 px minimum), Upload CSV's right edge stays inside the Input pane's body.

## Verification

Run on the head commit, Node 24, all headless:

- The build, all three lints and both `tsc` checks clean.
- Jest: every existing test passes, plus the new cases in `authored-state.test.ts`, `settings-summary.test.ts`, `url-settings.test.ts`, `workspace-config.test.ts`, `table-edits.test.ts` (unchanged, covering the moved separator) and `csv.test.ts`. Cypress: every existing spec passes, plus `interactive-csv-upload.test.ts` and the new authoring case.
- R18: `git diff --name-only` against the branch's base lists nothing under `src/codap/`, `src/components/` other than `log-events.ts`, `src/hooks/` or `src/utils/`, and `package.json` and `package-lock.json` are unchanged.
- Not tested: the `unreadable` refusal (a rejected `file.arrayBuffer()`), which neither Jest nor Cypress's `selectFile` can produce; it shares the status line and `CsvUploadRefused` with the tested refusals.

## Open Questions

### RESOLVED: Judgment call: one separator rule shared with the table, not a copy
**Options considered**:
- A) Move `insertRow`'s separator rule into `separatorBefore` and call it from both.
- B) Write the rule again in `csv.ts`.
- C) Build the text by calling `insertRow` once per cell.

**Decision**: A. B gives the rule two homes that could drift (an upload and a typed row separated differently); C is quadratic, about 24 s at 8,000 cells.

### RESOLVED: Judgment call: the workspace owns the status, the button owns the question
**Options considered**:
- A) `Workspace` keeps `uploadStatus` and clears it in its commit function; `CsvUpload` keeps only the pending read.
- B) `CsvUpload` keeps both and clears its message from an effect on the committed text.

**Decision**: A. The commit function is the one place that knows a commit happened and why, so "goes at the next commit, not this one" is one line there; B's effect would also fire for the upload's own commit and need a flag to skip it.

### RESOLVED: Judgment call: the Jest test runs in Node's environment
**Options considered**:
- A) A `@jest-environment node` docblock on `csv.test.ts`, the module taking bytes, not a `File`.
- B) A `TextDecoder` polyfill in `setupTests.ts` for every test.

**Decision**: A. Only this module decodes, and a polyfill would have to supply Windows-1252, which Node's own `TextDecoder` already has.

## Self-Review

### Senior Engineer

#### RESOLVED: The control-character regex fails lint
`/[\u0000-\u001f\u007f]/g` trips ESLint's `no-control-regex` under both `npm run lint` and `npm run lint:build` *(checked with a throwaway file)*. `cellText` now uses `/\p{Cc}/gu`, which lints clean and replaces the same characters plus the C1 controls *(checked: `a\u0001b\nc\td\u007fe\u0085f` becomes `a b c d e f`)*.

### Test Writer

#### RESOLVED: The URL settings test compares the whole list in order
`url-settings.test.ts`'s first case `toEqual`s every setting's path in `defaultAuthoredState`'s key order, so "gains `allowCsvUpload`" had to say where. Step 1 now places the field after `inputView` in both.

#### RESOLVED: "As written by the list or prose layout" couldn't be asserted
The linked-view Cypress case now names the exact text for each layout, so a separator mistake fails it.

### Commit Reviewer

Checked, no finding: step 1 adds `csvUpload` to the configuration with nothing reading it, which builds and lints (a field, not an unused variable); step 2's `separatorBefore` move is covered by `insertRow`'s existing tests before `csv.ts` uses it; step 3 is the only step that renders anything. No step needs a later one.

### WCAG Accessibility Expert

Checked, no finding: the file input is out of the Tab order and the visible button opens it; the question moves focus to Replace and back to the button on Cancel or Escape; the status line is `role="status"`; the button is disabled, not hidden, while generating, as MARK-15's switch is.

