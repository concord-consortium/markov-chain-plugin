import { tableCsv, tableFileName } from "./csv";
import { TableData } from "./table-data";

const table = (rows: TableData["rows"]): TableData =>
  ({ word: "Input", cols: ["Word", "Position"], colTypes: ["categorical", "numeric"], rows });

describe("tableCsv", () => {
  it("starts with a byte order mark and ends each line with CRLF", () => {
    expect(tableCsv(table([["cat", 1], ["sat", 2]]))).toBe("\uFEFFWord,Position\r\ncat,1\r\nsat,2\r\n");
  });

  it("quotes a cell with a comma, a quote or a line break, and no other", () => {
    expect(tableCsv(table([["a,b", 1], ["say \"hi\"", 2], ["two\nlines", 3], ["cr\rhere", 4], ["plain", 5]])))
      .toBe("\uFEFFWord,Position\r\n\"a,b\",1\r\n\"say \"\"hi\"\"\",2\r\n\"two\nlines\",3\r\n" +
        "\"cr\rhere\",4\r\nplain,5\r\n");
  });

  it("writes a number as a number", () => {
    expect(tableCsv({ ...table([[0.3333, 0]]), cols: ["Probability", "Count"] }))
      .toBe("\uFEFFProbability,Count\r\n0.3333,0\r\n");
  });

  it("quotes a header with a comma", () => {
    expect(tableCsv({ ...table([]), cols: ["a,b"] })).toBe("\uFEFF\"a,b\"\r\n");
  });
});

describe("tableFileName", () => {
  it("is the name and the table's word", () => {
    expect(tableFileName("Data1", table([]))).toBe("Data1_Input.csv");
    expect(tableFileName("Data1", { ...table([]), word: "Outputs" })).toBe("Data1_Outputs.csv");
  });

  it("replaces each character a file name can't hold", () => {
    expect(tableFileName("a/b\\c:d*e?f\"g<h>i|j", table([]))).toBe("a_b_c_d_e_f_g_h_i_j_Input.csv");
  });

  it("keeps spaces and accents", () => {
    expect(tableFileName("Mi café", table([]))).toBe("Mi café_Input.csv");
  });
});
