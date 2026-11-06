import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { downloadTables } from "../tables/csv";
import { buildTable, tableLabels, TableChoice, TableSource, TableWord } from "../tables/table-data";
import { TablesAction, tablesActionLabels } from "./table-buttons";

export const maxTablesNameLength = 50;

interface TablesDialogProps {
  action: TablesAction;
  defaultName: string;
  choices: TableChoice[];
  source: TableSource;
  onFinished: (name: string, tables: TableWord[]) => void;
  onCancel: () => void;
  onClose: () => void;
}

const submitLabels: Record<TablesAction, [string, string]> = {
  send: ["Send", "Saving..."], download: ["Download", "Downloading..."],
};

// The popup both buttons open. A modal dialog keeps focus inside it and hands focus back to the button on closing.
export const TablesDialog = ({
  action, defaultName, choices, source, onFinished, onCancel, onClose
}: TablesDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState(defaultName);
  const [checked, setChecked] = useState(() => new Set(choices.filter(c => !c.empty).map(c => c.word)));
  const [saving, setSaving] = useState(false);

  // a layout effect, since closing hands focus back only while the dialog is still in the page
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

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
    dialogRef.current?.focus();
    setSaving(true);
    await downloadTables(dialogRef.current?.ownerDocument ?? document, trimmed, tables);
    onFinished(trimmed, words);
    onClose();
  };

  const handleCancelEvent = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!saving) {
      onCancel();
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
        <div className="tables-dialog-buttons">
          <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={!canPress}>
            { submitLabels[action][saving ? 1 : 0] }
          </button>
        </div>
      </form>
    </dialog>
  );
};
