import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { maxInputLength } from "../interactive-state";
import { deleteRow, editRow, insertRow, placeAfterEdit, RowLayout } from "../input/table-edits";
import { rowText, Token, tokenize } from "../input/tokenizer";
import { Highlights } from "./highlights";
import { useLatest } from "../../hooks/use-latest";

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
  rowLayout: RowLayout;
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
  pressDelete: (at: number) => void;
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
            onMouseDown={() => actions.pressDelete(at)} onClick={() => actions.delete(at)}>
            <span aria-hidden="true">×</span>
          </button>
        }
      </td>
    </tr>
  );
};
// memoized so a commit renders only the rows it changes, not every row of a long input
const InputTableRow = memo(InputTableRowContent);

// The input's tokens, one per row, a break as an empty row. The rows are one stop in the Tab order, with the current
// row's input and delete button taking Tab, and Up and Down move between rows.
const InputTableRows = ({
  text, tokens, highlights, readOnly, onCommit, onRowAdded, onRowDeleted, onRowBlur, afterPress, onFocusToken,
  rowLayout
}: InputTableProps) => {
  const hintId = useId();
  const [current, setCurrent] = useState<RowKey>({ kind: "row", index: 0 });
  // the focused row's value while it is edited
  const [draft, setDraft] = useState<{ row: RowKey, value: string }>();
  // the token the row Enter opened is below, -1 for the top
  const [pendingAfter, setPendingAfter] = useState<number>();
  // counts the refused edits since the last one that went in, so each refusal is announced
  const [refusals, setRefusals] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusRequest, setFocusRequest] = useState<RowKey>();
  // the row whose delete button was pressed, which may be gone with the row
  const [deleted, setDeleted] = useState<number>();
  // Where Up or Down moves to: the row of target's token, found once the row left has committed, or, with no such row,
  // the place at in the rows after that commit
  const [moveTo, setMoveTo] = useState<{ at: number, target?: { before: string, start: number } }>();
  // the row a delete button is being pressed on, and its token's start in the text then, since leaving a row as the
  // press starts can commit an edit that moves the rows before the click
  const pressedDelete = useRef<{ at: number, row: RowKey, before: string, start: number, done?: boolean }>(undefined);
  // the place and part to focus once a row above the focus is dropped
  const [refocus, setRefocus] = useState<{ at: number, part: "input" | "button" }>();

  const rows: RowKey[] = tokens.flatMap((_, index) => {
    const row: RowKey[] = [{ kind: "row", index }];
    return pendingAfter === index ? [...row, { kind: "pending", after: index }] : row;
  });
  if (pendingAfter === -1) {
    rows.unshift({ kind: "pending", after: -1 });
  }
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
      onRowBlur(() => commitLeftRow(row));
    },
    keyDown: (e: React.KeyboardEvent<HTMLInputElement>, at: number) => handleKeyDown(e, rows[at], at),
    delete: (at: number) => {
      const pressed = pressedDelete.current;
      pressedDelete.current = undefined;
      if (pressed?.done) {
        return;
      }
      if (pressed?.at === at) {
        // the row pressed, wherever it is now; a row the commit took in, such as one emptied, is gone already
        const { index, inside } = tokenAfterEdit(pressed.before, pressed.start);
        if (!inside && index >= 0) {
          handleDelete(index);
        }
        return;
      }
      const row = rows[at];
      if (row.kind === "row") {
        handleDelete(row.index);
      }
    },
    pressDelete: (at: number) => {
      const row = rows[at];
      if (row.kind !== "row") {
        return;
      }
      const pressed = { at, row, before: text, start: tokens[row.index].start };
      pressedDelete.current = pressed;
      // forgotten as the press ends, or at once for a secondary button's, which no click follows
      afterPress(() => {
        if (pressedDelete.current === pressed) {
          pressedDelete.current = undefined;
        }
      });
    },
    placeOfMove: (move: { at: number, target?: { before: string, start: number } }) => {
      if (!move.target) {
        return move.at;
      }
      const { index } = tokenAfterEdit(move.target.before, move.target.start);
      const place = rows.findIndex(row => row.kind === "row" && row.index === index);
      return place >= 0 ? place : move.at;
    },
  });
  const actions = useMemo<RowActions>(() => ({
    focus: at => latestActions.current.focus(at),
    change: (at, value) => latestActions.current.change(at, value),
    blur: at => latestActions.current.blur(at),
    keyDown: (e, at) => latestActions.current.keyDown(e, at),
    delete: at => latestActions.current.delete(at),
    pressDelete: at => latestActions.current.pressDelete(at),
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
    const place = latestActions.current.placeOfMove(moveTo);
    const input = tableRef.current?.querySelectorAll<HTMLInputElement>("tbody input")[place];
    if (!input) {
      return;
    }
    if (input === input.ownerDocument.activeElement) {
      actions.focus(place);
    } else {
      input.focus();
    }
  }, [moveTo, actions, latestActions]);

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

  // the token, among the tokens now, that started at start in the text before; inside when an edit took it in, and
  // then the first token from where the edit was
  const tokenAfterEdit = (before: string, start: number) => {
    const { place, inside } = placeAfterEdit(before, text, start);
    const index = tokens.findIndex(token => inside ? token.end > place : token.start === place);
    return { index, inside };
  };

  // the table's edits keep to the input's limit; one that would pass it leaves the row as it was
  const commitText = (edited: string, andThen?: (edited: string) => string) => {
    const next = andThen ? andThen(edited) : edited;
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

  // whether the row's text went in; andThen makes a further change to the edited text, committed with it
  const commitRow = (row: RowKey, andThen?: (edited: string) => string) => {
    const value = valueOf(row);
    setDraft(undefined);
    if (row.kind === "row") {
      return value === committedValue(row) || commitText(editRow(text, tokens, row.index, value), andThen);
    }
    const added = !!rowText(value) && commitText(insertRow(text, tokens,
      row.kind === "pending" ? Math.min(row.after, tokens.length - 1) : tokens.length - 1, value, rowLayout), andThen);
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

  // A row left for a press on a delete button: when the row's edit moves the rows, the button pressed can be gone, or
  // show another row, before its click, so the row pressed is deleted with the edit, in one commit, and the click
  // does nothing. A press on the edited row's own button deletes the row, edit and all. Another row pressed is found
  // in the edited text, and one the edit took in is gone already. When the input's limit refuses the two together, the
  // click deletes the row by itself.
  const commitLeftRow = (row: RowKey) => {
    const pressed = pressedDelete.current;
    if (!pressed) {
      commitRow(row);
      return;
    }
    if (row.kind === "row" && sameRow(pressed.row, row) && valueOf(row) !== committedValue(row)) {
      pressed.done = true;
      handleDelete(row.index);
      return;
    }
    let foldedIn = false;
    let deletedAt: number | undefined;
    const deleteAfterEdit = (edited: string) => {
      const editedTokens = tokenize(edited, "asTyped");
      const { place, inside } = placeAfterEdit(pressed.before, edited, pressed.start);
      const index = inside ? -1 : editedTokens.findIndex(token => token.start === place);
      foldedIn = true;
      deletedAt = index >= 0 ? index : undefined;
      return index >= 0 ? deleteRow(edited, editedTokens, index) : edited;
    };
    if (commitRow(row, deleteAfterEdit) && foldedIn) {
      pressed.done = true;
      if (deletedAt !== undefined) {
        onRowDeleted();
        setDeleted(deletedAt);
      }
    }
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

  // how many tokens come before where the token at index starts, once its row is edited to value
  const tokensBefore = (index: number, value: string) =>
    tokenize(editRow(text, tokens, index, value), "asTyped").filter(token => token.start < tokens[index].start).length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: RowKey, at: number) => {
    // an input method's Enter confirms what it composed
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      // the row commits first, so the row reached chooses its token as committed; a pending row that doesn't go in
      // is dropped, and the row below takes its place
      const targetRow = rows[e.key === "ArrowUp" ? at - 1 : at + 1];
      const target = targetRow?.kind === "row" ? { before: text, start: tokens[targetRow.index].start } : undefined;
      const dropped = !commitRow(row) && row.kind === "pending";
      setMoveTo({ at: Math.max(0, e.key === "ArrowUp" ? at - 1 : at + (dropped ? 0 : 1)), target });
    } else if (e.key === "Enter" && !readOnly) {
      e.preventDefault();
      if (row.kind === "append") {
        commitRow(row);
        setFocusRequest({ kind: "append" });
      } else if (row.kind === "pending") {
        // it goes in and another opens below it; empty, or refused at the limit, it stays, emptied
        const after = commitRow(row) ? row.after + 1 : row.after;
        setPendingAfter(after);
        setFocusRequest({ kind: "pending", after });
      } else {
        // the row commits first, so the new row opens among the rows as they will be; an emptied word's row can go, or
        // join a blank line beside it, and the new row then opens where it was
        const value = valueOf(row);
        const emptied = tokens[row.index].kind === "word" && !rowText(value);
        const after = emptied ? tokensBefore(row.index, value) - 1 : row.index;
        commitRow(row);
        setPendingAfter(after);
        setFocusRequest({ kind: "pending", after });
        // the new row can take the place of the focused one, and then no focus event follows
        handleFocus({ kind: "pending", after });
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
