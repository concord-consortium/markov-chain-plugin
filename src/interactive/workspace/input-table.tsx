import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { maxInputLength } from "../interactive-state";
import { deleteRow, editRow, insertRow } from "../input/table-edits";
import { rowText, Token } from "../input/tokenizer";
import { Highlights } from "./highlights";
import { useLatest } from "./use-latest";

interface InputTableProps {
  // the committed input, which the rows are the tokens of
  text: string;
  tokens: Token[];
  highlights: Highlights;
  readOnly: boolean;
  onCommit: (text: string) => void;
  onRowAdded: () => void;
  onRowDeleted: () => void;
  // commits a row the student left, at once or once a press ends
  onRowBlur: (commitRow: () => void) => void;
  // runs once a press ends, or now with none
  afterPress: (run: () => void) => void;
  onFocusToken: (token: Token | undefined) => void;
}

// A row: a token's (row), the one Enter opened below a token, not in the text until it has words (pending), or the
// empty row at the end that appends (append)
type RowKey = { kind: "row", index: number } | { kind: "pending", after: number } | { kind: "append" };

const rowId = (row: RowKey) =>
  row.kind === "row" ? `row-${row.index}` : row.kind === "pending" ? `pending-${row.after}` : row.kind;
const sameRow = (a: RowKey, b: RowKey) => rowId(a) === rowId(b);

// what a row does, by its place in the table; each keeps its identity across renders
interface RowActions {
  focus: (at: number) => void;
  change: (at: number, value: string) => void;
  blur: (at: number) => void;
  keyDown: (e: React.KeyboardEvent<HTMLInputElement>, at: number) => void;
  delete: (at: number) => void;
  register: (id: string, element: HTMLInputElement | null) => void;
}

interface InputTableRowProps {
  at: number;
  id: string;
  kind: RowKey["kind"];
  value: string;
  readOnly: boolean;
  takesTab: boolean;
  hintId: string;
  highlight?: string;
  actions: RowActions;
}

const InputTableRowContent = ({
  at, id, kind, value, readOnly, takesTab, hintId, highlight, actions
}: InputTableRowProps) => {
  const number = at + 1;
  return (
    <tr className={clsx(kind, highlight)}>
      <td>
        <input type="text" aria-label={kind === "append" ? "New row" : `Row ${number}`}
          value={value} readOnly={readOnly}
          tabIndex={takesTab ? 0 : -1} aria-describedby={takesTab ? hintId : undefined}
          ref={element => actions.register(id, element)}
          onFocus={() => actions.focus(at)}
          onChange={e => actions.change(at, e.target.value)}
          onBlur={() => actions.blur(at)}
          onKeyDown={e => actions.keyDown(e, at)} />
      </td>
      <td>
        { kind === "row" &&
          <button type="button" className="delete-row" aria-label={`Delete row ${number}`}
            title={`Delete row ${number}`} tabIndex={takesTab ? 0 : -1} disabled={readOnly}
            onClick={() => actions.delete(at)}>
            <span aria-hidden="true">×</span>
          </button>
        }
      </td>
    </tr>
  );
};
// memoized so a commit renders only the rows it changes, not every row of a long input
const InputTableRow = memo(InputTableRowContent);

// The input's tokens, one per row, a break as an empty row. The table is one stop in the Tab order: only the current
// row's input and delete button take Tab, and Up and Down move between rows.
const InputTableRows = ({
  text, tokens, highlights, readOnly, onCommit, onRowAdded, onRowDeleted, onRowBlur, afterPress, onFocusToken
}: InputTableProps) => {
  const hintId = useId();
  const [current, setCurrent] = useState<RowKey>({ kind: "row", index: 0 });
  // the focused row's value while it is edited
  const [draft, setDraft] = useState<{ row: RowKey, value: string }>();
  const [pendingAfter, setPendingAfter] = useState<number>();
  // counts the refused edits since the last one that went in, so each refusal is announced
  const [refusals, setRefusals] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusRequest, setFocusRequest] = useState<RowKey>();
  // the row whose delete button was pressed, which may be gone with the row
  const [deleted, setDeleted] = useState<number>();
  // the place Up or Down moves to, in the rows as they are once the row left has committed
  const [moveTo, setMoveTo] = useState<number>();
  // the place and part to focus once a row above the focus is dropped
  const [refocus, setRefocus] = useState<{ at: number, part: "input" | "button" }>();

  const rows: RowKey[] = tokens.flatMap((_, index) => {
    const row: RowKey[] = [{ kind: "row", index }];
    return pendingAfter === index ? [...row, { kind: "pending", after: index }] : row;
  });
  rows.push({ kind: "append" });
  // the row that takes Tab: the current one, or the first once that row is gone
  const tabRow = rows.find(row => sameRow(row, current)) ?? rows[0];

  useEffect(() => {
    if (focusRequest) {
      inputs.current.get(rowId(focusRequest))?.focus();
      setFocusRequest(undefined);
    }
  }, [focusRequest]);

  const latestActions = useLatest({
    focus: (at: number) => handleFocus(rows[at]),
    change: (at: number, value: string) => setDraft({ row: rows[at], value }),
    blur: (at: number) => {
      const row = rows[at];
      onRowBlur(() => commitRow(row));
    },
    keyDown: (e: React.KeyboardEvent<HTMLInputElement>, at: number) => handleKeyDown(e, rows[at], at),
    delete: (at: number) => {
      const row = rows[at];
      if (row.kind === "row") {
        handleDelete(row.index);
      }
    },
  });
  const actions = useMemo<RowActions>(() => ({
    focus: at => latestActions.current.focus(at),
    change: (at, value) => latestActions.current.change(at, value),
    blur: at => latestActions.current.blur(at),
    keyDown: (e, at) => latestActions.current.keyDown(e, at),
    delete: at => latestActions.current.delete(at),
    register: (id, element) => {
      if (element) {
        inputs.current.set(id, element);
      } else {
        inputs.current.delete(id);
      }
    },
  }), [latestActions]);

  // a row dropped from under the focus leaves the input focused, showing the row now in its place, with no focus event
  useEffect(() => {
    if (moveTo === undefined) {
      return;
    }
    setMoveTo(undefined);
    const input = tableRef.current?.querySelectorAll<HTMLInputElement>("tbody input")[moveTo];
    if (!input) {
      return;
    }
    if (input === input.ownerDocument.activeElement) {
      actions.focus(moveTo);
    } else {
      input.focus();
    }
  }, [moveTo, actions]);

  useEffect(() => {
    if (refocus) {
      setRefocus(undefined);
      tableRef.current?.querySelectorAll("tbody tr")[refocus.at]?.querySelector<HTMLElement>(refocus.part)?.focus();
    }
  }, [refocus]);

  // focus stays in the table when the deleted row's button goes, on the row now in its place or the one above it
  useEffect(() => {
    if (deleted === undefined) {
      return;
    }
    setDeleted(undefined);
    if (!tableRef.current?.contains(tableRef.current.ownerDocument.activeElement)) {
      const index = Math.min(deleted, tokens.length - 1);
      inputs.current.get(index >= 0 ? rowId({ kind: "row", index }) : "append")?.focus();
    }
  }, [deleted, tokens.length]);

  const committedValue = (row: RowKey) => {
    if (row.kind !== "row") {
      return "";
    }
    const token = tokens[row.index];
    return token?.kind === "word" ? token.text : "";
  };
  const valueOf = (row: RowKey) => draft && sameRow(draft.row, row) ? draft.value : committedValue(row);

  // the table's edits keep to the input's limit; one that would pass it leaves the row as it was
  const commitText = (next: string) => {
    if (next.length > maxInputLength) {
      setRefusals(count => count + 1);
      return false;
    }
    setRefusals(0);
    if (next !== text) {
      onCommit(next);
    }
    return true;
  };

  // whether the row's text went in
  const commitRow = (row: RowKey) => {
    const value = valueOf(row);
    setDraft(undefined);
    if (row.kind === "row") {
      return value === committedValue(row) || commitText(editRow(text, tokens, row.index, value));
    }
    const added = !!rowText(value) && commitText(insertRow(text, tokens,
      row.kind === "pending" ? Math.min(row.after, tokens.length - 1) : tokens.length - 1, value));
    if (added) {
      onRowAdded();
    }
    if (row.kind === "pending") {
      if (added) {
        setPendingAfter(undefined);
        // the Tab stop follows the row into its place
        setCurrent({ kind: "row", index: row.after + 1 });
      } else {
        dropPending(row.after);
      }
    }
    return added;
  };

  // An empty pending row goes once a press ends: dropped under the press, it would move the rows below it up a place
  // and the press would land on the row below the one pressed. Focus below it moves up with its row.
  const dropPending = (after: number) => {
    const place = rows.findIndex(row => row.kind === "pending");
    afterPress(() => {
      const active = tableRef.current?.ownerDocument.activeElement;
      const focusedRow = active?.closest("tr");
      const at = focusedRow ? [...tableRef.current!.querySelectorAll("tbody tr")].indexOf(focusedRow) : -1;
      setPendingAfter(pending => pending === after ? undefined : pending);
      if (at > place) {
        setRefocus({ at: at - 1, part: active?.tagName === "BUTTON" ? "button" : "input" });
      }
    });
  };

  const handleFocus = (row: RowKey) => {
    setCurrent(row);
    onFocusToken(row.kind === "row" ? tokens[row.index] : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: RowKey, at: number) => {
    // an input method's Enter confirms what it composed
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      // the row commits first, so the row reached chooses its token as committed; a pending row that doesn't go in
      // is dropped, and the row below takes its place
      const dropped = !commitRow(row) && row.kind === "pending";
      setMoveTo(Math.max(0, e.key === "ArrowUp" ? at - 1 : at + (dropped ? 0 : 1)));
    } else if (e.key === "Enter" && !readOnly) {
      e.preventDefault();
      if (row.kind === "append") {
        commitRow(row);
        setFocusRequest({ kind: "append" });
      } else if (row.kind === "pending") {
        // it goes in and another opens below it, or, refused at the limit, it stays, emptied
        const after = commitRow(row) ? row.after + 1 : row.after;
        setPendingAfter(after);
        setFocusRequest({ kind: "pending", after });
      } else {
        setPendingAfter(row.index);
        setFocusRequest({ kind: "pending", after: row.index });
      }
    }
  };

  const handleDelete = (index: number) => {
    setDraft(undefined);
    if (commitText(deleteRow(text, tokens, index))) {
      onRowDeleted();
      setDeleted(index);
    }
  };

  return (
    <div className="input-table" ref={tableRef}>
      <div className="input-table-rows">
        <table>
          <tbody>
            { rows.map((row, at) => {
              const lit = row.kind === "row" && highlights.tokens.has(row.index);
              return (
                // keyed by place, so the rows under a press keep their elements when a row above them goes in
                <InputTableRow key={at} at={at} id={rowId(row)} kind={row.kind} value={valueOf(row)}
                  readOnly={readOnly} takesTab={sameRow(row, tabRow)} hintId={hintId} actions={actions}
                  highlight={lit ? `highlight-${highlights.kind}` : undefined} />
              );
            }) }
          </tbody>
        </table>
      </div>
      <p id={hintId} className="visually-hidden">Up and Down move between rows.</p>
      <p role="status" className="input-table-limit">
        { refusals > 0 &&
          <span key={refusals}>
            The input is at its limit of { maxInputLength.toLocaleString("en-US") } characters.
          </span>
        }
      </p>
    </div>
  );
};
// memoized so a keystroke in the text box doesn't render the rows
export const InputTable = memo(InputTableRows);
InputTable.displayName = "InputTable";
