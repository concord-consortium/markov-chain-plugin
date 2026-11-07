import React, { useEffect, useId, useRef, useState } from "react";
import { CsvRefusal, CsvValues, readCsv } from "../input/csv";
import { maxCsvBytes } from "../input/csv-limits";
import { RowLayout } from "../input/table-edits";
import { maxInputLength } from "../interactive-state";

export type CsvUploadStatus =
  | { kind: "read", values: number, column: string }
  | { kind: "refused", reason: CsvRefusal };

const refusals: Record<CsvRefusal, string> = {
  tooLong: `This file is too big: its values come to more than ${maxInputLength.toLocaleString("en-US")} characters.`,
  tooLarge: "This file is too big to read.",
  noValues: "This file has no values to use.",
  unreadable: "This file couldn't be read.",
};

const statusText = (status: CsvUploadStatus) => {
  if (status.kind === "refused") {
    return refusals[status.reason];
  }
  const values = `${status.values.toLocaleString("en-US")} ${status.values === 1 ? "value" : "values"}`;
  return `Read ${values} from ${status.column ? `the column "${status.column}"` : "the first column"}.`;
};

interface CsvUploadProps {
  disabled: boolean;
  // the committed input has a word, so replacing it asks first
  hasWords: boolean;
  layout: RowLayout;
  status?: CsvUploadStatus;
  onRead: (read: CsvValues) => void;
  onRefused: (reason: CsvRefusal) => void;
}

// The Upload CSV button, with the question it asks before replacing words and the line saying what it read
export const CsvUpload = ({ disabled, hasWords, layout, status, onRead, onRefused }: CsvUploadProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const questionId = useId();
  // a file waiting on the question, read again at Replace since "Order matters" can change while it waits
  const [pending, setPending] = useState<Uint8Array>();
  // a disabled button can't take focus, so a question closed during a sequence hands it over when the sequence ends
  const focusOwed = useRef(false);

  useEffect(() => {
    if (pending) {
      replaceRef.current?.focus();
    }
  }, [pending]);

  useEffect(() => {
    const button = buttonRef.current;
    if (!disabled && focusOwed.current) {
      focusOwed.current = false;
      if (button?.ownerDocument.activeElement === button?.ownerDocument.body) {
        button?.focus();
      }
    }
  }, [disabled]);

  const takeFile = (bytes: Uint8Array, replacing: boolean) => {
    const read = readCsv(bytes, layout);
    if (!read.ok) {
      onRefused(read.reason);
    } else if (hasWords && !replacing) {
      setPending(bytes);
    } else {
      onRead(read);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setPending(undefined);
    if (!file) {
      return;
    }
    if (file.size > maxCsvBytes) {
      onRefused("tooLarge");
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      onRefused("unreadable");
      return;
    }
    takeFile(bytes, false);
  };

  const closeQuestion = () => {
    setPending(undefined);
    focusOwed.current = disabled;
    buttonRef.current?.focus();
  };

  const handleReplace = () => {
    if (pending) {
      takeFile(pending, true);
    }
    closeQuestion();
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // the workspace's own Escape would clear the selection
      e.stopPropagation();
      closeQuestion();
    }
  };

  return (
    <>
      <button type="button" className="csv-upload-button" ref={buttonRef} disabled={disabled}
        aria-describedby={hintId} onClick={() => fileRef.current?.click()}>
        Upload CSV
      </button>
      <span id={hintId} className="visually-hidden">Starts your input from the first column of a CSV file.</span>
      <input type="file" accept=".csv,text/csv" hidden tabIndex={-1} ref={fileRef} disabled={disabled}
        onChange={handleFile} />
      <p role="status" className="csv-upload-status">{ !pending && status && statusText(status) }</p>
      { pending &&
        <div role="group" className="csv-upload-question" aria-labelledby={questionId}
          onKeyDown={handleQuestionKeyDown}>
          <span id={questionId}>Replace your words with the file&apos;s?</span>
          <button type="button" ref={replaceRef} disabled={disabled} onClick={handleReplace}>Replace</button>
          <button type="button" onClick={closeQuestion}>Cancel</button>
        </div>
      }
    </>
  );
};
