/**
 * @jest-environment node
 */
import { tableCsv } from "../tables/csv";
import { cellText, decodeCsv, firstColumn, parseCsv, readCsv, textFromCells } from "./csv";
import { RowLayout } from "./table-edits";
import { tokenize } from "./tokenizer";

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe("parseCsv", () => {
  it("keeps a comma inside quotes in its field", () => {
    expect(parseCsv("a,\"b,c\"")).toEqual([["a", "b,c"]]);
  });

  it("opens quotes only at a field's start", () => {
    expect(parseCsv("5\" pipe,x\nnext")).toEqual([["5\" pipe", "x"], ["next"]]);
  });

  it("reads a doubled quote as a quote", () => {
    expect(parseCsv("\"x \"\"y\"\"\"")).toEqual([["x \"y\""]]);
  });

  it("keeps a line break inside quotes in its field", () => {
    expect(parseCsv("\"a\nb\",c\nd")).toEqual([["a\nb", "c"], ["d"]]);
  });

  it.each([["CRLF", "\r\n"], ["LF", "\n"], ["CR", "\r"]])("ends a row at %s", (_, lineEnd) => {
    expect(parseCsv(`a${lineEnd}b`)).toEqual([["a"], ["b"]]);
  });

  it("adds no row for a final line break", () => {
    expect(parseCsv("w\n")).toEqual([["w"]]);
  });

  it("reads a blank line as an empty cell", () => {
    expect(parseCsv("a\n\nb")).toEqual([["a"], [""], ["b"]]);
  });

  it("keeps a last empty field", () => {
    expect(parseCsv("a,")).toEqual([["a", ""]]);
  });

  it("reads an unclosed quote to the end of the file", () => {
    expect(parseCsv("\"open\nstill")).toEqual([["open\nstill"]]);
  });
});

describe("decodeCsv", () => {
  it("reads bytes that aren't valid UTF-8 as Windows-1252", () => {
    expect(decodeCsv(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toBe("café");
  });

  it("drops a UTF-8 byte order mark", () => {
    expect(decodeCsv(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe("a");
  });

  it("reads valid UTF-8 as itself", () => {
    expect(decodeCsv(bytesOf("ü"))).toBe("ü");
  });
});

describe("firstColumn", () => {
  it("skips a CODAP export's leading # lines", () => {
    const csv = "# name: data\n# attribute -- name: weather\n# attribute -- name: day\n" +
      "weather,day\nsunny,1\nrainy,2\n,3\nSunny,4\n";
    expect(firstColumn(parseCsv(csv))).toEqual({ name: "weather", cells: ["sunny", "rainy", "", "Sunny"] });
  });

  it("keeps a # value after the header", () => {
    expect(firstColumn(parseCsv("word\n#1\n#2")).cells).toEqual(["#1", "#2"]);
  });

  it("trims the column's name", () => {
    expect(firstColumn(parseCsv(" weather \na")).name).toBe("weather");
  });

  it("reads a row with no first value as an empty cell", () => {
    expect(firstColumn(parseCsv("word,n\n,1\nb,2")).cells).toEqual(["", "b"]);
  });

  it("gives a file of # lines no column", () => {
    expect(firstColumn(parseCsv("# name: data\n"))).toEqual({ name: "", cells: [] });
  });

  it("writes line breaks inside a cell as spaces", () => {
    expect(firstColumn(parseCsv("word\n\"multi\nline\"")).cells).toEqual(["multi line"]);
  });
});

describe("cellText", () => {
  it("writes every control character as a space", () => {
    expect(cellText("a\u0001b\u007fc")).toBe("a b c");
  });

  it("trims a cell and removes its brackets", () => {
    expect(cellText("  [x] ")).toBe("x");
  });
});

describe("textFromCells", () => {
  it("writes words as prose, or one to a line in a list", () => {
    expect(textFromCells(["the", "cat"], "prose")).toBe("the cat");
    expect(textFromCells(["the", "cat"], "list")).toBe("the\ncat");
  });

  it("writes punctuation against the word before it in prose, and on its own line in a list", () => {
    expect(textFromCells(["the", "."], "prose")).toBe("the.");
    expect(textFromCells(["the", "."], "list")).toBe("the\n.");
  });

  it("writes a cell the tokenizer would split in brackets", () => {
    expect(textFromCells(["No!"], "prose")).toBe("[No!]");
  });

  it("writes a run of empty cells as one blank line", () => {
    expect(textFromCells(["sunny", "", "", "rainy"], "prose")).toBe("sunny\n\nrainy");
    expect(textFromCells(["sunny", "", "", "rainy"], "list")).toBe("sunny\n\nrainy");
  });

  it("writes nothing for empty cells at either end", () => {
    expect(textFromCells(["", "a", "b", "", ""], "prose")).toBe("a b");
  });

  const pool = [
    "sunny", ".", ",", "?", "No!", "ice cream", "3.5", "a+b", "[x]", "a]b", "#1", "  padded  ", "multi\nline",
    "tab\there", "café", "naïve", "😀", "", "", "rainy",
  ];
  const columns = Array.from({ length: 40 }, (_, column) =>
    Array.from({ length: 8 + column % 5 }, (__, cell) => pool[(column * 7 + cell * (column % 6 + 1)) % pool.length]));
  const collapsed = (cells: string[]) => {
    const rows = cells.filter((cell, i) => cell || cells[i - 1]);
    const first = rows.findIndex(row => row);
    const last = rows.length - 1 - [...rows].reverse().findIndex(row => row);
    return first === -1 ? [] : rows.slice(first, last + 1);
  };
  const tableRows = (text: string) =>
    tokenize(text, "asTyped").map(token => token.kind === "word" ? token.text : "");

  it("has round trip columns that differ from one another", () => {
    expect(new Set(columns.map(column => column.join("|"))).size).toBe(columns.length);
  });

  it.each<RowLayout>(["prose", "list"])("gives back the rows when tokenized, in the %s layout", layout => {
    columns.forEach(column => {
      const cells = column.map(cellText);
      expect(tableRows(textFromCells(cells, layout))).toEqual(collapsed(cells));
    });
  });
});

describe("readCsv", () => {
  const letters = (count: number, last = "a") => ["word", ...Array(count - 1).fill("a"), last].join("\n");

  it("reads the column's name, its text, and its values and rows", () => {
    expect(readCsv(bytesOf("weather,day\nsunny,1\n,2\n,3\nrainy,4\n"), "list")).toEqual({
      ok: true, text: "sunny\n\nrainy", column: "weather", values: 2, rows: 4
    });
  });

  it("writes the text in the layout it is given", () => {
    expect(readCsv(bytesOf("w\na\nb"), "prose")).toMatchObject({ text: "a b" });
  });

  it("reads back a table the download writes", () => {
    const csv = tableCsv({
      word: "Input", cols: ["Word", "Position"], colTypes: ["categorical", "numeric"],
      rows: [["sunny", 1], ["No!", 2], ["say \"hi\"", 3]],
    });
    expect(readCsv(bytesOf(csv), "list")).toEqual({
      ok: true, text: "sunny\n[No!]\n[say \"hi\"]", column: "Word", values: 3, rows: 3
    });
  });

  it("takes text of exactly the limit", () => {
    const read = readCsv(bytesOf(letters(25000, "ab")), "list");
    expect(read).toMatchObject({ ok: true, values: 25000 });
    expect(read.ok && read.text.length).toBe(50000);
  });

  it("refuses text one past the limit", () => {
    expect(readCsv(bytesOf(letters(25001)), "list")).toEqual({ ok: false, reason: "tooLong" });
  });

  it.each([
    ["an empty file", ""],
    ["a header alone", "word\n"],
    ["only empty values", "word\n\n,1\n"],
    ["only # lines", "# name: data\n"],
  ])("refuses %s", (_, csv) => {
    expect(readCsv(bytesOf(csv), "list")).toEqual({ ok: false, reason: "noValues" });
  });
});
