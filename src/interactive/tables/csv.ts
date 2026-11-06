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
