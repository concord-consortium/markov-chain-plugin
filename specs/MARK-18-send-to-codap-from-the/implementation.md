# Implementation Plan: Send to CODAP and Download tables

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-18
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Eight small steps, each a commit that builds and passes on its own. The new modules below were compiled and run as written here, in Jest and in Chromium and Firefox on the fake Activity Player page; `use-table-actions.tsx` is described, not written out, and ran in that same build from its description. Tests are summarized, each with the mistake it catches.

The new code sits in `src/interactive/tables/` (no React) and `src/interactive/workspace/` (components). Under `src/components` only `log-events.ts` changes, which the plugin imports as a type alone, and nothing under `src/utils`, `src/codap` or `src/index.tsx` changes, which is what keeps R23 true.

Run everything on the Node version in `.nvmrc`. An ESLint warning fails a commit here, not only an error: CI's Cypress runs on `npm start`, whose overlay shows warnings over the page, and every click then fails as covered.

---

### Add the object storage library

**Summary**: The dependency alone, so the lockfile's large diff is a commit a reviewer can skip through (R25).

**Files affected**:
- `package.json`: the dependency at exactly `1.0.0-pre.9`, the version the Datalog plugin and Agent Sim use, and the override
- `package-lock.json`: generated

**Estimated diff size**: about 10 lines by hand, about 1,700 generated

```json
"overrides": {
  "@concord-consortium/object-storage": { "react": "$react" }
}
```

The library declares a React 16 or 17 peer, so `npm install` refuses it on React 19 without the override. Its React context is the only part that touches React, and this code doesn't use it. The override goes once the library's peer range allows React 19. No `.npmrc` or `--legacy-peer-deps`, which would loosen every package's check.

---

### Build the tables

**Summary**: The four tables as plain data, from what the workspace already holds. One definition serves sending and downloading (R11 to R13), and it is pure, so all of it is tested in Jest.

**Files affected**:
- `src/interactive/tables/table-data.ts`: new
- `src/interactive/tables/table-data.test.ts`: new
- `src/interactive/workspace/build-state.ts`: exports `toPlaces`

**Estimated diff size**: about 270 lines

```ts
import { AnyStartingState } from "../../components/generator";
import { GraphData, SequenceGroup } from "../../type";
import { ModeId, yesNo } from "../authored-state";
import { Token } from "../input/tokenizer";
import { toPlaces } from "../workspace/build-state";
import { inspectColumns, stateRows, transitionRows } from "../workspace/inspect-rows";

export type ColumnType = "categorical" | "numeric";
export type Cell = string | number;

export const tableWords = ["Input", "States", "Transitions", "Outputs"] as const;
export type TableWord = typeof tableWords[number];

export const tableLabels: Record<TableWord, string> = {
  Input: "Input data", States: "States", Transitions: "Transitions", Outputs: "Outputs",
};

export interface TableData {
  word: TableWord;
  cols: string[];
  colTypes: ColumnType[];
  rows: Cell[][];
}

export interface TableSource {
  mode: ModeId;
  tokens: Token[];
  graph: GraphData;
  sequenceGroups: SequenceGroup[];
}

type Column = [string, ColumnType];

const table = (word: TableWord, columns: Column[], rows: Cell[][]): TableData =>
  ({ word, cols: columns.map(([col]) => col), colTypes: columns.map(([, type]) => type), rows });

const inputTable = ({ tokens }: TableSource) => {
  const words = tokens.flatMap(token => token.kind === "word" ? [token.text] : []);
  return table("Input", [["Word", "categorical"], ["Position", "numeric"]],
    words.map((word, index) => [word, index + 1]));
};

const statesTable = ({ mode, graph }: TableSource) => {
  const counted = inspectColumns(mode).states.some(column => column === "count");
  const columns: Column[] = [["State", "categorical"], ...(counted ? [["Count", "numeric"] as Column] : [])];
  return table("States", columns,
    stateRows(graph).map(row => counted ? [row.label, row.count] : [row.label]));
};

const transitionsTable = ({ mode, graph }: TableSource) => {
  const counted = inspectColumns(mode).transitions.some(column => column === "count");
  const columns: Column[] = [
    ["From", "categorical"], ["To", "categorical"],
    ...(counted ? [["Count", "numeric"] as Column] : []),
    ["Probability", "numeric"],
  ];
  return table("Transitions", columns, transitionRows(graph).map(row => {
    const probability = row.outOf > 0 ? toPlaces(row.count / row.outOf, 4) : 0;
    return [row.fromLabel, row.toLabel, ...(counted ? [row.count] : []), probability];
  }));
};

const outputsTable = ({ sequenceGroups }: Pick<TableSource, "sequenceGroups">) => {
  let number = 0;
  const rows = sequenceGroups.flatMap(group => group.sequences.map(sequence => [
    ++number, sequence.map(node => node.label).join(group.delimiter), group.startingNode?.label ?? AnyStartingState,
    group.lengthLimit, group.delimiter === "" ? "(none)" : group.delimiter, yesNo(group.orderMatters !== false),
  ]));
  return table("Outputs", [
    ["Output number", "numeric"], ["Output", "categorical"], ["Starting state", "categorical"],
    ["Max length", "numeric"], ["Delimiter", "categorical"], ["Order matters", "categorical"],
  ], rows);
};

const builders: Record<TableWord, (source: TableSource) => TableData> = {
  Input: inputTable, States: statesTable, Transitions: transitionsTable, Outputs: outputsTable,
};

export const buildTable = (word: TableWord, source: TableSource) => builders[word](source);

// inside Firestore's 1 MiB for a document, with room for the fields beside the table and for the last sequence
export const maxTableBytes = 1000000;

export const storedBytes = ({ rows }: TableData) => new Blob([JSON.stringify({ rows })]).size;

export const outputsTableFull = (sequenceGroups: SequenceGroup[]) =>
  storedBytes(outputsTable({ sequenceGroups })) >= maxTableBytes;

export interface TableChoice {
  word: TableWord;
  // a table with nothing in it yet is offered, off, and can't be chosen
  empty: boolean;
}

interface ChoiceRules {
  orderMatters: boolean;
  hasGenerator: boolean;
}

// the tables the popup offers for what is showing, in order
export const tableChoices = (source: TableSource, { orderMatters, hasGenerator }: ChoiceRules): TableChoice[] => {
  const offered = tableWords.filter(word => {
    switch (word) {
      case "Input":
        return source.mode === "useData";
      case "Transitions":
        return source.mode === "draw" || orderMatters;
      case "Outputs":
        return hasGenerator;
      default:
        return true;
    }
  });
  return offered.map(word => ({ word, empty: buildTable(word, source).rows.length === 0 }));
};
```

**Tests** (`table-data.test.ts`), using fixtures with different values in each row, and asserting whole arrays, so an empty table can't pass:
- Input from "The cat.\n\nthe [a b]": words as typed, a bracketed word whole, no row for the blank line, positions 1 to n. Catches using `token.state`, or keeping breaks.
- States and Transitions in Data mode, sorted, with counts; in Draw mode with no count columns. Catches ignoring `inspectColumns`.
- Probability: 1 of 3 gives 0.3333, and a drawing whose arrows out of a state total 0 gives 0. Catches `NaN`.
- Outputs: two groups, one orderless with an empty delimiter and a chosen start. Numbers run across groups, and "(any)", "(none)", "Yes", "No" each appear. Catches numbering per group, or a dropped flag.
- Each table's `cols` and `colTypes` in both modes, as literal arrays copied from R12. Catches a column in the wrong place or of the wrong type.
- `outputsTableFull` just under `maxTableBytes` is false and at it is true, and a word of multi-byte characters is counted in bytes, not characters.
- `tableChoices`: each rule on its own, Draw without Input, order off without Transitions but Draw with it, no generator without Outputs, no outputs marks only Outputs empty, one word with no transitions marks Transitions empty too, and the order holds.

---

### Write tables as CSV files

**Summary**: The file format and names, and saving files from the page (R19 to R21).

**Files affected**:
- `src/interactive/tables/csv.ts`: new
- `src/interactive/tables/file-gap.ts`: new, the gap alone, so the Cypress tests can import it: `tsc -p cypress` drops Node's types and can't compile the workspace's code
- `src/interactive/tables/csv.test.ts`: new

**Estimated diff size**: about 110 lines

```ts
import { fileGap } from "./file-gap";
import { Cell, TableData } from "./table-data";

const byteOrderMark = "\uFEFF";
const lineEnd = "\r\n";
const urlLifetime = 60000;

const csvCell = (cell: Cell) => {
  const text = String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

export const tableCsv = ({ cols, rows }: TableData) =>
  byteOrderMark + [cols, ...rows].map(row => row.map(csvCell).join(",")).join(lineEnd) + lineEnd;

export const tableFileName = (name: string, { word }: TableData) =>
  `${name.replace(/[/\\:*?"<>|]/g, "_")}_${word}.csv`;

const saveFile = (doc: Document, fileName: string, contents: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const link = doc.createElement("a");
  link.href = url;
  link.download = fileName;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), urlLifetime);
};

// a browser can drop a file started in the same moment as another
export const downloadTables = async (doc: Document, name: string, tables: TableData[]) => {
  for (const [index, table] of tables.entries()) {
    if (index > 0) {
      await new Promise(resolve => window.setTimeout(resolve, fileGap));
    }
    saveFile(doc, tableFileName(name, table), tableCsv(table));
  }
};
```

**Tests**: a cell with a comma, a quote and a line break each quoted, and a plain cell not; the byte order mark first and CRLF line ends; a number written as a number; a name with `/` and `"` in the file name only. `saveFile` is left to Cypress, which reads the real files.

---

### Save the name's count

**Summary**: The new optional saved field, on its own, with no one using it yet (R10, R24).

**Files affected**:
- `src/interactive/interactive-state.ts`: `tablesSaved?: number` on `SavedMode`, and its check in `readMode`
- `src/interactive/workspace/build-state.ts`: `modeFields` and `StateParts`
- `src/interactive/workspace/restore-work.ts`: `tablesSaved` on `RestoredMode`
- `src/interactive/workspace/workspace.tsx`: holds the count in state and passes it to the builder
- the matching `.test.ts` files

**Estimated diff size**: about 60 lines

```ts
// interactive-state.ts
const isCount: Check = value => Number.isInteger(value) && (value as number) >= 0;
// in readMode's keepValid
tablesSaved: isCount,

// build-state.ts, in modeFields; undefined at 0, so an untouched state stays as it opened
tablesSaved: tablesSaved || undefined,

// restore-work.ts, in restoredMode
tablesSaved: saved?.tablesSaved ?? 0,

// workspace.tsx
const [tablesSaved] = useState<Record<ModeId, number>>(
  { useData: restored.useData.tablesSaved, draw: restored.draw.tablesSaved });
```

The setter joins in the popup's step, which is the first to use it.

**Tests**: reading -1, 1.5 and "2" each drops the field; a built state at 0 has no key, so its JSON equals a state built before this field existed; a built count reads back; a count in a mode the page doesn't offer stays through a build, since `previous` keeps it.

---

### Add Download tables to the row

**Summary**: The button, its group at the row's right end, and its off state with its reason (R2 to R4). Pressing it arrives in the next step, so an author can't see it yet: `downloadTables` is off by default.

**Files affected**:
- `src/interactive/workspace/controls-row.tsx`: an `actions` slot, after Clear highlight
- `src/interactive/workspace/data-workspace.tsx`, `draw-workspace.tsx`: pass `actions` through
- `src/interactive/workspace/table-buttons.tsx`: new
- `src/interactive/workspace/workspace.tsx`: `actions`
- `src/interactive/workspace/workspace.scss`: the group, the off look
- `src/interactive/standalone.test.tsx`: the button standalone
- `cypress/e2e/interactive-tables.test.ts`: new

**Estimated diff size**: about 150 lines

```tsx
// table-buttons.tsx
import React, { useId } from "react";

export type TablesAction = "send" | "download";

export const tablesActionLabels: Record<TablesAction, string> = {
  send: "Send to CODAP", download: "Download tables",
};

interface TableButtonProps {
  action: TablesAction;
  offReason?: string;
  onPress: (action: TablesAction) => void;
}

// aria-disabled, so the button stays in the Tab order and its reason can be reached
const TableButton = ({ action, offReason, onPress }: TableButtonProps) => {
  const reasonId = useId();
  return (
    <>
      <button type="button" title={offReason} aria-disabled={!!offReason}
        aria-describedby={offReason ? reasonId : undefined} onClick={() => !offReason && onPress(action)}>
        { tablesActionLabels[action] }
      </button>
      { offReason && <span className="visually-hidden" id={reasonId}>{ offReason }</span> }
    </>
  );
};

interface TableButtonsProps {
  actions: TablesAction[];
  offReason?: string;
  onPress: (action: TablesAction) => void;
}

export const TableButtons = ({ actions, offReason, onPress }: TableButtonsProps) => (
  <div className="table-buttons">
    { actions.map(action => <TableButton key={action} action={action} offReason={offReason} onPress={onPress} />) }
  </div>
);
```

```scss
.table-buttons {
  display: flex;
  gap: var(--pane-gap);
  margin-left: auto;
}
```

The reason's span uses the workspace's existing `.visually-hidden`, as `inspect-pane.tsx` does for its hint.

```ts
// workspace.tsx, moving to use-table-actions.tsx with the button in the next step
const tablesOffReason = (tool: MarkovToolApi, mode: ModeId) => {
  if (tool.animating) {
    return "Wait for the sequence to finish.";
  }
  if (tool.graph.nodes.length > 0) {
    return undefined;
  }
  return mode === "draw" ? "Draw something first." : "Add some words first.";
};
```

Both bodies stay mounted, so each renders its own copy of `actions`, as with `controls`. Tests look inside `.workspace-body:not([hidden])`.

**Tests** (Cypress):
- Off by default; on with `buttons.downloadTables` on the fake Activity Player page; not in report mode. Standalone is `standalone.test.tsx`'s, in Jest: Cypress runs a page in a frame, so the app reads as hosted and waits for an init message.
- At the row's right edge, and still right of Clear highlight once a state is chosen. Catches adding it to `controls`.
- With no Input pane and both switches, on a second line, right-aligned, and inside the workspace: at 560 px with Download alone, which fits at 700 px, and at 700 px once Send joins it in the last step.
- Off with no words, with "Add some words first." as both the `title` and the text `aria-describedby` points at; on after typing, with neither left; off in an empty Draw mode with its own reason; off while playing, and while paused.
- An off button in the Tab order, and pressing it opens nothing (added with the popup in the next step).

---

### Open the popup and download

**Summary**: The popup, its choices and names, and the download path, with its logs (R5 to R9, R19 to R22). `use-table-actions.tsx` keeps the popup's state out of `Workspace`, which already holds a lot.

**Files affected**:
- `src/interactive/workspace/tables-dialog.tsx`: new
- `src/interactive/workspace/use-table-actions.tsx`: new
- `src/interactive/workspace/workspace.tsx`: uses the hook
- `src/interactive/workspace/ap-host.ts`: `TablesDownloaded` in `savingEvents`
- `src/interactive/workspace/workspace.scss`: the popup
- `src/components/log-events.ts`, `LOGGED-EVENTS.md`: `TablesDialogOpened`, `TablesDialogCanceled`, `TablesDownloaded`
- `.gitignore`: `cypress/downloads`
- `cypress/e2e/interactive-tables.test.ts`

**Estimated diff size**: about 315 lines

```tsx
// tables-dialog.tsx, as it stands after this step's and the last step's work
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { downloadTables } from "../tables/csv";
import { buildTable, tableLabels, TableChoice, TableSource, TableWord } from "../tables/table-data";
import { TableSender } from "../tables/table-sender";
import { TablesAction, tablesActionLabels } from "./table-buttons";

export const maxTablesNameLength = 50;

interface TablesDialogProps {
  action: TablesAction;
  defaultName: string;
  choices: TableChoice[];
  source: TableSource;
  sender?: TableSender;
  onFinished: (name: string, tables: TableWord[]) => void;
  onFailed: (name: string, tables: TableWord[]) => void;
  onCancel: () => void;
  onClose: () => void;
}

export const savedMessage = (name: string) => `Your tables have been saved as ${name}. ` +
  "Open the CODAP window on this page and choose this name in the Datalog plugin.";
const submitLabels: Record<TablesAction, [string, string]> = {
  send: ["Send", "Saving..."], download: ["Download", "Downloading..."],
};
const failedMessage = "Your tables couldn't be saved. Check your connection and try again.";

// A modal dialog holds focus only within its own document, so in a frame Tab would carry on into the host's page.
const wrapTab = (e: React.KeyboardEvent, dialog: Element) => {
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>("input:enabled, button:enabled"));
  const [first, last] = [controls[0], controls[controls.length - 1]];
  const { activeElement } = dialog.ownerDocument;
  if (!first || activeElement === (e.shiftKey ? first : last) || (e.shiftKey && activeElement === dialog)) {
    e.preventDefault();
    (e.shiftKey ? last : first)?.focus();
  }
};

// The popup both buttons open
export const TablesDialog = ({
  action, defaultName, choices, source, sender, onFinished, onFailed, onCancel, onClose
}: TablesDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const [name, setName] = useState(defaultName);
  const [checked, setChecked] = useState(() => new Set(choices.filter(c => !c.empty).map(c => c.word)));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [savedAs, setSavedAs] = useState<string>();

  // a layout effect, since closing hands focus back only while the dialog is still in the page
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (savedAs) {
      closeRef.current?.focus();
    }
  }, [savedAs]);

  const trimmed = name.trim();
  const words = choices.map(c => c.word).filter(word => checked.has(word));
  const canPress = trimmed !== "" && words.length > 0 && !saving;

  const toggle = (word: TableWord) => setChecked(prev => {
    const next = new Set(prev);
    if (!next.delete(word)) {
      next.add(word);
    }
    return next;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPress) {
      return;
    }
    const tables = words.map(word => buildTable(word, source));
    setProblem(undefined);
    dialogRef.current?.focus();
    setSaving(true);
    if (action === "download") {
      await downloadTables(dialogRef.current?.ownerDocument ?? document, trimmed, tables);
      onFinished(trimmed, words);
      onClose();
      return;
    }
    try {
      await sender?.send(trimmed, tables);
      setSavedAs(trimmed);
      onFinished(trimmed, words);
    } catch {
      setProblem(failedMessage);
      onFailed(trimmed, words);
    }
    setSaving(false);
  };

  const handleCancelEvent = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!saving) {
      (savedAs ? onClose : onCancel)();
    }
  };

  // the document's Escape clears the graph's choice, and a browser closes a dialog past a refused cancel event
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (saving) {
        e.preventDefault();
      }
    }
    if (e.key === "Tab") {
      wrapTab(e, e.currentTarget);
    }
  };

  return (
    <dialog className="tables-dialog" ref={dialogRef} tabIndex={-1} aria-labelledby={titleId}
      onCancel={handleCancelEvent} onKeyDown={handleKeyDown}>
      <h2 id={titleId}>{ tablesActionLabels[action] }</h2>
      { savedAs
        ? (
          <>
            <p id={messageId}>{ savedMessage(savedAs) }</p>
            <div className="tables-dialog-buttons">
              <button type="button" ref={closeRef} aria-describedby={messageId} onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="tables-dialog-name">
              Name
              <input type="text" value={name} maxLength={maxTablesNameLength} disabled={saving}
                onChange={e => setName(e.target.value)} />
            </label>
            <fieldset disabled={saving}>
              <legend>Tables</legend>
              { choices.map(({ word, empty }) => (
                <label key={word} className={empty ? "empty" : undefined}>
                  <input type="checkbox" checked={checked.has(word)} disabled={empty} onChange={() => toggle(word)} />
                  { tableLabels[word] }{ empty && " (none yet)" }
                </label>
              )) }
            </fieldset>
            { problem && <p role="alert">{ problem }</p> }
            <div className="tables-dialog-buttons">
              <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
              <button type="submit" disabled={!canPress}>
                { submitLabels[action][saving ? 1 : 0] }
              </button>
            </div>
          </form>
        ) }
    </dialog>
  );
};
```

In this step `TablesDialog` has only the download branch: no `sender`, `savedAs` or `onFailed`. The last step adds them. `saving` is here from the start, since a second press during a download's gaps would save every file twice. Turning a focused control off drops focus to the page, where Escape misses the popup and Tab leaves it, so the dialog takes focus first and keeps it through a failure. A message inserted with its live region isn't reliably announced, so the confirmation is read through `aria-describedby` on Close, which takes focus.

```tsx
// use-table-actions.tsx, the shape it takes
interface TableActionsOptions {
  mode: ModeId;
  configs: Record<ModeId, WorkspaceConfig>;
  tools: Record<ModeId, MarkovToolApi>;
  hosts: Record<ModeId, MarkovHost>;
  orderMatters: boolean;
  reports: React.RefObject<Record<ModeId, ModeReport>>;
  tablesSaved: Record<ModeId, number>;
  onTablesSaved: (mode: ModeId) => void;
  readOnly: boolean;
}

export const useTableActions = (options: TableActionsOptions) => {
  // ...
  return { actions, dialog };
};
```

On a press, the hook builds the `TableSource` once from the showing mode: `tokenize(report.text ?? "", report.capitalization ?? "asTyped")` for Data mode (`ModeReport` holds the committed text, in optional fields that are set before a press can happen), and `tool.graph` and `tool.outputProps.sequenceGroups`. The popup blocks the workspace, so that source can't go stale. `Workspace` renders `{ dialog }` beside the two bodies, and passes `actions` to each. The default name is `${mode === "draw" ? "Drawing" : "Data"}${tablesSaved[mode] + 1}`. `onFinished` logs and calls `onTablesSaved`; the log's request to save runs once the render has the new count, as `useSaveRequest` promises.

The popup's position: `margin: 40px auto auto`, not the dialog default, so it sits under the row in a tall frame.

**Tests** (Cypress, a new test file so the workspace's stays its size). `{esc}` sends only the keydown, which doesn't close a native `dialog`, and `cy.press` doesn't reach it, so these use `{esc}` for the popup's key handling and `.trigger("cancel")` for the closing; a real Escape is R27's.
- Focus: opens inside the popup, returns to the button after Cancel and after `cancel`. Catches `useEffect` in place of `useLayoutEffect`, which was seen to lose focus.
- `{esc}` leaves a chosen state chosen. Catches removing `stopPropagation`.
- While a download's gaps hold the popup busy: the dialog has focus, `{esc}` leaves a chosen state chosen, and a dispatched Escape keydown comes back `defaultPrevented`. Catches a busy popup that loses focus or lets the browser close it.
- A click on the backdrop leaves it open.
- A Tab keydown on the last control moves to the first, Shift+Tab on the first moves to the last, and a Tab with every control off stays. A real Tab into the host's page is R27's.
- The checkboxes by case, through each R6 rule on real panes, "Outputs (none yet)" faded and off.
- Download off with an empty name and with nothing checked; a spaces-only name counts as empty.
- `requestSubmit()` on the form while the button reads "Downloading..." changes nothing: the popup closes once and the next opening shows "Data2". Catches `canPress` ignoring `saving`; the folder can't, since Cypress overwrites a repeated file name.
- Two tables download with `Data1_`, contents read from `cypress/downloads`; a word with a comma arrives quoted.
- The next opening shows "Data2"; Draw mode's shows "Drawing1"; Cancel leaves the count.
- Reopening from the saved state shows the next number. Catches a count that isn't in `build`.
- The events with `mode`, and the `interactiveState` posted after a download. The existing test that compares `logEvents` to `LOGGED-EVENTS.md` covers the page.

---

### Write snapshots to object storage

**Summary**: The sender alone, tested against the real library and its demo store, with nothing calling it yet (R14, R16).

**Files affected**:
- `src/interactive/tables/table-sender.ts`: new
- `src/interactive/tables/table-sender.test.ts`: new
- `package.json`: Jest's `moduleNameMapper` for `nanoid`

**Estimated diff size**: about 115 lines

```ts
import type { ObjectStorageConfig } from "@concord-consortium/object-storage";
import { TableData } from "./table-data";

export const saveTimeout = 30000;

export interface TableSender {
  send: (name: string, tables: TableData[]) => Promise<void>;
}

const timedOut = (ms: number) => new Promise<never>((_resolve, reject) => {
  window.setTimeout(() => reject(new Error("save timed out")), ms);
});

// The library and Firebase are a chunk of their own, loaded only where Send to CODAP shows. The client starts with the
// workspace: it signs in as it is created, and the token in the config is freshest then.
export const connectTableSender = (config: unknown): TableSender => {
  const connecting = import("@concord-consortium/object-storage").then(library => ({
    library, storage: library.createObjectStorage(config as ObjectStorageConfig),
  }));
  connecting.catch(() => undefined);

  const write = async (name: string, tables: TableData[]) => {
    const { library, storage } = await connecting;
    const snapshot = new library.StoredObject({ name, description: name, subType: "multi-value-snapshot" });
    const ids = tables.map(table => table.word.toLowerCase());
    tables.forEach((table, index) =>
      snapshot.addDataTable({ id: ids[index], name: table.word, cols: table.cols, rows: table.rows }));
    snapshot.addObject({
      id: "tables", name: "Tables",
      data: { tables: tables.map(({ colTypes }, index) => ({ id: ids[index], colTypes })) },
    });
    await storage.add(snapshot);
  };

  return {
    send: (name, tables) => {
      const writing = write(name, tables);
      writing.catch(() => undefined);
      return Promise.race([writing, timedOut(saveTimeout)]);
    }
  };
};
```

The `catch`es mark a late failure as handled, since the timeout may already have answered; Agent Sim's save does the same.

```json
"^nanoid$": "<rootDir>/node_modules/@concord-consortium/object-storage/node_modules/nanoid/index.cjs"
```

Jest resolves `nanoid` to its ES module under jsdom and can't load it, on Node 22 or 24. With the mapper the real library runs in Jest, and the whole suite passed with it; the repo's tests of `nanoid` callers mock it as before.

**Tests**: with `DemoObjectStorage.prototype.add` spied on, a send of two tables gives the object in R14: `subType`, `description`, the item ids and names, a Draw table named "States", no item `subType`, and the index in the tables' order with each `colTypes`. Catches an index that doesn't match the items, which DP-12 refuses. A config the library refuses rejects `send`. An `add` that never finishes rejects at `saveTimeout`, with fake timers, and not before.

---

### Send to CODAP and show the confirmation

**Summary**: The button, connecting it all, the message, the failure path and the Outputs table's limit (R1, R14 to R18, R22, R23, R25a).

**Files affected**:
- `src/interactive/standalone.test.tsx`: no Send button standalone
- `src/interactive/app.tsx`, `runtime.tsx`, `workspace/workspace.tsx`: pass `objectStorageConfig` down, from the runtime message only; `Workspace` works out `canSend` and applies R17's limit
- `src/interactive/workspace/use-table-actions.tsx`: the sender and the Send button
- `src/interactive/workspace/tables-dialog.tsx`: the send branch shown above
- `src/interactive/workspace/ap-host.ts`: `TablesSent` in `savingEvents`
- `src/interactive/host-messages.ts`: the demo store
- `cypress/fake-ap/fake-ap.ts`: `objectStorageConfig` as a start option
- `webpack.config.js`: `chunkFilename`
- `src/components/log-events.ts`, `LOGGED-EVENTS.md`: `TablesSent`, `TablesSendFailed`; `OutputLimitReached`'s entry names R17's limit
- `cypress/e2e/interactive-tables.test.ts`

**Estimated diff size**: about 270 lines

```ts
// workspace.tsx, in place of each of its two outputsFull calls, with canSend passed on to useTableActions
const canSend = configs[mode].sendToCodap && !readOnly && !!objectStorageConfig;
const outputLimitReached = useCallback(() => outputsFull([dataGroups, drawGroups], savedDrawing(drawing)) ||
  (canSend && [dataGroups, drawGroups].some(outputsTableFull)), [dataGroups, drawGroups, drawing, canSend]);
const [limitReached, setLimitReached] = useState(outputLimitReached);
// the effect calls it, with outputLimitReached in its dependencies in place of drawing

// use-table-actions.tsx, with canSend and objectStorageConfig added to its options
const [sender] = useState(() => canSend ? connectTableSender(objectStorageConfig) : undefined);

// host-messages.ts: in the message, for the demo page and the fake Activity Player page
objectStorageConfig: { version: 1, type: "demo" },

// webpack.config.js, beside filename
chunkFilename: 'assets/[name].[contenthash].js',
```

`sendToCodap` is one setting across both modes, so `canSend` doesn't change after the first render. R17's check sits in `Workspace`, beside the effect that already holds its answer while a sequence runs, and not in `saved-outputs.ts`, which `interactive-state.ts` imports, so that the tables' code stays out of anything else that reads saved state. The `report` case in `app.tsx` passes no config, so a report never loads the chunk. `fake-ap.ts`'s `objectStorageConfig` start option replaces the demo store: `null` gives a host with none, and `{ version: 2, type: "demo" }` is a store that refuses, for the failure path.

**Tests** (Cypress):
- Shown on with `buttons.sendToCodap` on the fake page; not in a report, not with `objectStorageConfig: null`. Not standalone is Jest's, as with Download.
- Both buttons, Send first.
- A send: the exact message with an edited name, focus on Close, still open after several seconds, Close and `.trigger("cancel")` each ending it, focus back on the button, the next name "Data2".
- The failed path with the refusing store: the message, the popup still open with its choices and with focus on the dialog, the count unchanged, and `TablesSendFailed`.
- R17's limit: start from a saved state whose outputs repeat one 2,000-character state 600 times, which stays small as saved and is 1.2 MB as a table. With Send to CODAP on, Generate and Play are off and the limit's message shows; with it off, they stay on. Catches a limit that ignores `canSend`, or one on every page.
- Sends and failures log; a send posts a state with `tablesSaved`.

**Branch checks after this step** (R23): build the base and the head, and compare `dist/assets/index.*.js` and `dist/assets/main.*.css`, which must be byte-identical, and `report-item`. `interactive.html` loads only `interactive.*.js`; the chunk loads when a page has Send to CODAP.

---

## After the steps

R27's hand check runs before `v0.0.4` is tagged, on a copy of staging activity 1458 with this branch's pushed build in place of Agent Sim and the plugin pointed at a branch deploy of DP-12's code. Doug and the implementing session make the copy together in Playwright. `doc/deploy.md` needs nothing. 

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: a native `dialog`, or a `div` like the shared `ConfirmModal`?
**Context**: The repo's modals are `div`s with no focus handling.
**Options considered**:
- A) `<dialog>` with `showModal()`.
- B) Reuse `ConfirmModal`.

**Decision**: A. R5 needs a focus trap, a blocked page and focus returned. `dialog` gives all three within its own document, as run in Chrome; a frame's Tab can still leave for the host's page, so the popup wraps Tab itself. `ConfirmModal` is shared with the CODAP plugin, so changing it risks R23. jsdom has no `showModal`, so the popup's tests are Cypress's.

### RESOLVED: Judgment call: create the client at the start, or at the first press?
**Context**: Starting it loads 163 KB gzipped for a page with Send to CODAP, even if unused.
**Options considered**:
- A) When the workspace starts.
- B) At the first Send.

**Decision**: A. The client signs in with a token from the init message when it is created. Firebase custom tokens last an hour, and a student can press Send long after that, so B could fail on an old token. Pages without the setting load nothing. The hour is Firebase's documented lifetime, not something run here, so R27 sends from a page left open for more than an hour.

### RESOLVED: Judgment call: test the sender against the real library or a mock.
**Context**: The library won't load in Jest without a mapper for `nanoid`.
**Options considered**:
- A) The real library, with a mapper.
- B) A `jest.mock` of the library.

**Decision**: A. The test's job is to prove the object matches DP-12's reader, and a mock of `addDataTable` would only repeat what the code says.

## Self-Review

Roles: Senior Engineer, commit reviewer, test writer, operator, WCAG Accessibility Expert, Security Engineer. Claims about new code were checked by running it in a scratch copy.

### Senior Engineer

#### RESOLVED: Closing the popup lost focus
With `useEffect`, React removed the dialog before `close()` ran, so focus fell to the page: seen in Chrome. `useLayoutEffect` runs while it is still in the page, and focus returned after Escape, Cancel and Close.

#### RESOLVED: The chunk was unhashed and outside `assets/`
With no `chunkFilename` it came out as `dist/934.js`, which a deploy could serve stale. The setting is in the last step, and the plugin's hash stayed the same with it.

#### RESOLVED: A busy popup lost focus
Turning the focused control off dropped focus to the page in Chromium and Firefox, so Escape cleared the graph's selection and Tab left the popup after a failure. The dialog now takes focus first.

#### RESOLVED: Escape could close the popup during a save
After two refused `cancel` events Chromium closes the dialog anyway, which hid the confirmation and left the button dead. The keydown's default is stopped while busy, and six presses left it open.

#### RESOLVED: R17's wiring raised a lint warning
`outputLimitReached` as a plain function warned under `exhaustive-deps`, and the overlay that follows fails every Cypress click. It is a `useCallback`, which the effect lists.

#### RESOLVED: Two copies of `toPlaces`
`table-data.ts` repeated the helper in `build-state.ts`. It is exported from there and imported.

#### RESOLVED: The hook's described calls didn't type-check
`ModeReport`'s text and capitalization are optional, and the hook's options lacked `canSend` and `objectStorageConfig`. Both are spelled out.

#### RESOLVED: The byte order mark was an invisible character
The string held a literal U+FEFF, which nobody can see or review. It is written `"\uFEFF"`.

#### RESOLVED: Tab left the popup for the host's page
A modal dialog makes only its own document inert, so in the Activity Player's frame Tab passed the last control and reached the host's page, with the popup still open. Run in Chromium on the fake page with buttons around the frame. `wrapTab` keeps it inside, including while busy, when no control is on.

#### RESOLVED: A failed connection at the start stays failed
`connecting` and the library's `initPromise` keep their rejection: after a bad sign-in the second `add` rejected in 0 ms, so R16's "try again" can't work until a reload. Accepted and noted in requirements' Technical Notes, since the page has just loaded on a fresh token. A new client after a failed connect can't tell that from a failed write and wasn't run past one.

### Test writer

#### RESOLVED: Jest couldn't load the library
It failed on `nanoid`'s ES module on Node 22 and on `.nvmrc`'s 24. The mapper fixed that with the whole suite passing.

#### RESOLVED: The demo store can't be read from Cypress
It lives in the frame's sender. So Jest proves the object, and Cypress proves the flow; R27 proves the two together with the real plugin.

#### RESOLVED: Cypress can't press Escape on a native dialog
`{esc}` and `cy.press` both left the popup open; `.trigger("cancel")` closes it and returns focus. The tests split the key from the closing, and a real Escape joins R27.

#### RESOLVED: The second press test couldn't fail
Cypress overwrites a repeated file name, so two sets leave one set in the folder. It now submits while busy and reads the next name, which failed with `saving` taken out of `canPress`.

#### RESOLVED: A test true by construction
`cols` and `colTypes` both come from one `columns` list, so equal lengths can't fail. Literal arrays from R12 replace it.

### Commit reviewer

#### RESOLVED: A Send button with nothing behind it
An earlier order added both buttons before the popup. Download comes first and Send last, so no commit has a button that does nothing, and the sender's step adds code nothing calls only until the next step.

#### RESOLVED: The count's step left an unused setter
`setTablesSaved` had no caller until the popup's step, a `no-unused-vars` warning that fails that commit's Cypress through the overlay. The setter arrives with its first use.

### Operator

#### RESOLVED: A page with Datalog 0.0.3
An older plugin reads a snapshot's first table as numbers. Authors shouldn't turn Send on before 0.0.4 is live; requirements' Technical Notes says so.

#### RESOLVED: A second press could download everything twice
The gaps between files left the popup's button live. `saving` now covers downloads.

### WCAG Accessibility Expert

#### RESOLVED: The confirmation might go unannounced
A `role="status"` element added with its text often isn't read. Focus moves to Close, which now describes itself with the message.
