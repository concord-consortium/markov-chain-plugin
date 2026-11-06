import { maxInputLength } from "../interactive-state";
import { RowLayout, separatorBefore } from "./table-edits";
import { rowText, textForRow } from "./tokenizer";

// A CSV file's first column as the input's text: each cell one table row, an empty cell a break, written as the
// table writes rows. RFC 4180, commas only.

export const maxCsvBytes = 2 * 1024 * 1024;

export type CsvRefusal = "tooLarge" | "tooLong" | "noValues" | "unreadable";
export type CsvRead =
  | { ok: true, text: string, column: string, values: number, rows: number }
  | { ok: false, reason: CsvRefusal };
export type CsvValues = Extract<CsvRead, { ok: true }>;

// UTF-8 (a byte order mark dropped), or Windows-1252 when the bytes aren't valid UTF-8, as Excel saves a plain CSV
export const decodeCsv = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

// rows of fields; a quoted field may hold commas, line breaks and doubled quotes; an unclosed quote runs to the end
export const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== "\"") {
        field += char;
      } else if (text[i + 1] === "\"") {
        field += char;
        i++;
      } else {
        quoted = false;
      }
    } else if (char === "\"" && !field) {
      quoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      endRow();
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    endRow();
  }
  return rows;
};

// a cell as a table row: control characters (line breaks and tabs among them) as spaces, then the row's text
export const cellText = (cell: string) => rowText(cell.replace(/\p{Cc}/gu, " "));

// the first column after any leading "#" lines (CODAP's export metadata) and the header row
export const firstColumn = (rows: string[][]) => {
  const header = rows.findIndex(row => !row[0].startsWith("#"));
  if (header === -1) {
    return { name: "", cells: [] };
  }
  return { name: rows[header][0].trim(), cells: rows.slice(header + 1).map(row => cellText(row[0])) };
};

// the cells written as the table writes rows: a blank line for a run of empty cells between words, and nothing for
// empty cells at either end
export const textFromCells = (cells: string[], layout: RowLayout) => {
  let text = "";
  let afterBreak = false;
  for (const cell of cells) {
    if (!cell) {
      afterBreak = true;
    } else {
      const written = textForRow(cell);
      const before = !text ? "" : afterBreak ? "\n\n" : separatorBefore(written, layout);
      text += before + written;
      afterBreak = false;
    }
  }
  return text;
};

export const readCsv = (bytes: Uint8Array, layout: RowLayout): CsvRead => {
  if (bytes.length > maxCsvBytes) {
    return { ok: false, reason: "tooLarge" };
  }
  const { name, cells } = firstColumn(parseCsv(decodeCsv(bytes)));
  const values = cells.filter(cell => cell).length;
  if (values === 0) {
    return { ok: false, reason: "noValues" };
  }
  const text = textFromCells(cells, layout);
  if (text.length > maxInputLength) {
    return { ok: false, reason: "tooLong" };
  }
  return { ok: true, text, column: name, values, rows: cells.length };
};
