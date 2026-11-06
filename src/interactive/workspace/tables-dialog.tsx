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

// The popup both buttons open. A modal dialog keeps focus inside it and hands focus back to the button on closing.
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
