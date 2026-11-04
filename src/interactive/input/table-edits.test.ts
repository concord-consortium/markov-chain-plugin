import { deleteRow, editRow, insertRow, placeAfterEdit, RowLayout } from "./table-edits";
import { tokenize } from "./tokenizer";

// the table a text gives: each word's text, "" for a break
const table = (text: string) => tokenize(text, "asTyped").map(t => t.kind === "word" ? t.text : "");
const edit = (text: string, row: number, value: string) => editRow(text, tokenize(text, "asTyped"), row, value);
const insert = (text: string, after: number, value: string, layout?: RowLayout) =>
  insertRow(text, tokenize(text, "asTyped"), after, value, layout);
const remove = (text: string, row: number) => deleteRow(text, tokenize(text, "asTyped"), row);

describe("editRow", () => {
  it("writes a row's new text in place of its token, leaving the rest as typed", () => {
    expect(edit("the  cat sat.", 1, "dog")).toBe("the  dog sat.");
  });

  it("brackets a row the tokenizer would split", () => {
    expect(edit("say no now", 1, "No!")).toBe("say [No!] now");
  });

  it("replaces a bracketed token's brackets too", () => {
    expect(edit("say [No!] now", 1, "yes")).toBe("say yes now");
  });

  it("keeps capitalization as typed", () => {
    expect(edit("the cat", 0, "The")).toBe("The cat");
  });

  it("writes an emptied row as a blank line", () => {
    expect(edit("a b c", 1, "  ")).toBe("a\n\nc");
    expect(table(edit("a b c", 1, ""))).toEqual(["a", "", "c"]);
  });

  it("keeps a new word from running into a word beside it", () => {
    expect(edit("[No!]the", 0, "cow")).toBe("cow the");
    expect(edit("cat.dog", 1, "and")).toBe("cat and dog");
  });

  it("keeps an unpaired bracket from pairing across an edited bracketed word", () => {
    expect(table(edit("[a [No!] b]", 1, "cow"))).toEqual(["a", "cow", "b"]);
  });

  it("writes a word into a break row in place of its blank line", () => {
    expect(edit("a\n\nc", 1, "b")).toBe("a\nb\nc");
    expect(table(edit("a\n\n\"\n\nc", 1, "b"))).toEqual(["a", "b", "c"]);
  });

  it("empties the first row out of the table", () => {
    expect(table(edit("a b", 0, ""))).toEqual(["b"]);
  });
});

describe("insertRow as a list", () => {
  it("writes each word on its own line, which leaves the rows unbroken", () => {
    const withDog = insert("the", 0, "dog", "list");
    expect(withDog).toBe("the\ndog");
    const withCat = insert(withDog, 1, "cat", "list");
    expect(withCat).toBe("the\ndog\ncat");
    expect(table(withCat)).toEqual(["the", "dog", "cat"]);
  });

  it("puts a word after a row in the middle on its own line", () => {
    expect(insert("the cat", 0, "dog", "list")).toBe("the\ndog cat");
  });

  it("puts punctuation on its own line too", () => {
    expect(insert("the cat", 1, ".", "list")).toBe("the cat\n.");
  });

  it("writes a word at the top, or after a blank line, with a line break after it", () => {
    expect(insert("the", -1, "dog", "list")).toBe("dog\nthe");
    expect(insert("a\n\nc", 1, "b", "list")).toBe("a\n\nb\nc");
  });

  it("writes the first word as it is", () => {
    expect(insert("", -1, "cat", "list")).toBe("cat");
  });
});

describe("insertRow", () => {
  it("adds a word after the row above, with a space before it", () => {
    expect(insert("the cat", 0, "black")).toBe("the black cat");
  });

  it("adds punctuation with no space before it", () => {
    expect(insert("the cat", 1, ".")).toBe("the cat.");
  });

  it("adds a word at the top, with a space after it", () => {
    expect(insert("the cat", -1, "see")).toBe("see the cat");
    expect(insert("", -1, "cat")).toBe("cat");
  });

  it("adds a word after a break row before the next word", () => {
    expect(insert("a\n\nc", 1, "b")).toBe("a\n\nb c");
  });

  it("keeps an added word from running into the word after it", () => {
    expect(insert(".the", 0, "cow")).toBe(". cow the");
  });

  it("brackets a new row the tokenizer would split", () => {
    expect(insert("a", 0, "ice cream")).toBe("a [ice cream]");
  });
});

describe("deleteRow", () => {
  it("removes a word and the space before it", () => {
    expect(remove("the black cat", 1)).toBe("the cat");
  });

  it("removes the first word and the space after it", () => {
    expect(remove("the cat", 0)).toBe("cat");
  });

  it("joins the chain where a break row was", () => {
    expect(remove("a\n\nb", 1)).toBe("a b");
  });

  it("keeps the words on either side of deleted punctuation apart", () => {
    expect(remove("cat.dog", 1)).toBe("cat dog");
  });

  it("deletes a word alone on its line without making a blank line", () => {
    expect(remove("a\nb\nc", 1)).toBe("a\nc");
    expect(table(remove("a \nb \nc", 1))).toEqual(["a", "c"]);
  });

  it("deletes the first word before a line break", () => {
    expect(remove("a\nb", 0)).toBe("\nb");
  });

  it("deletes a break with every blank line in it", () => {
    expect(table(remove("a\n\n___\n\nb", 1))).toEqual(["a", "b"]);
  });

  it("keeps an unpaired bracket from pairing across a deleted bracketed word or break", () => {
    expect(table(remove("[a [No!] b]", 1))).toEqual(["a", "b"]);
    expect(table(remove("[a\n\nb]", 1))).toEqual(["a", "b"]);
  });

  it("keeps a blank line beside a deleted word", () => {
    expect(table(remove("a\n\nb c", 2))).toEqual(["a", "", "c"]);
  });
});

// a small seeded generator (Park and Miller's, whose products stay exact in a double), so the round trip is the same
// on every run
const random = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// the table the student expects after an edit, as the tokenizer would read it: breaks in a row are one, and a
// break before the first word or after the last is none
const normalize = (rows: string[]) => rows
  .filter((row, i) => row !== "" || (i > 0 && rows[i - 1] !== ""))
  .filter((row, i, kept) => row !== "" || (kept.slice(0, i).some(r => r) && kept.slice(i + 1).some(r => r)));

describe("table edits", () => {
  it("give back exactly the edited table, for random texts and edits", () => {
    const next = random(15);
    const pick = <T, >(items: T[]) => items[Math.floor(next() * items.length)];
    const pieces =
      ["the", "cat", "Sat", ".", ",", "!", "\n\n", " ", "\n", "[No!]", "[ice cream]", "a+b", "dog", "[", "]"];
    const values = ["cow", "No!", "ice cream", ".", "?", "", "x+y", "The"];
    let checked = 0;

    for (let run = 0; run < 2000; run++) {
      const text = Array.from({ length: 1 + Math.floor(next() * 10) }, () => pick(pieces))
        .join(pick(["", " ", " ", "\n"]));
      const rows = table(text);
      const tokens = tokenize(text, "asTyped");
      const action = pick(["edit", "insert", "delete"]);
      const value = pick(values);
      let edited: string;
      let expected: string[];
      if (action === "insert") {
        const after = Math.floor(next() * (rows.length + 1)) - 1;
        edited = insertRow(text, tokens, after, value);
        const word = value.trim();
        expected = word ? [...rows.slice(0, after + 1), word, ...rows.slice(after + 1)] : rows;
      } else if (rows.length === 0) {
        continue;
      } else if (action === "edit") {
        const row = Math.floor(next() * rows.length);
        edited = editRow(text, tokens, row, value);
        expected = rows[row] === "" && value === "" ? rows : rows.map((r, i) => i === row ? value.trim() : r);
      } else {
        const row = Math.floor(next() * rows.length);
        edited = deleteRow(text, tokens, row);
        expected = rows.filter((r, i) => i !== row);
      }
      const change = { text, action, value };
      expect({ ...change, table: table(edited) }).toEqual({ ...change, table: normalize(expected) });
      checked++;
    }
    expect(checked).toBeGreaterThan(1500);
  });
});

describe("placeAfterEdit", () => {
  it("keeps a place before the edit and moves one after it with the text's change in length", () => {
    // "the" emptied to a blank line
    expect(placeAfterEdit("the cat sat", "\n\ncat sat", 4)).toEqual({ place: 2, inside: false });
    expect(placeAfterEdit("the cat sat", "\n\ncat sat", 8)).toEqual({ place: 6, inside: false });
    expect(placeAfterEdit("the cat sat", "the big cat sat", 0)).toEqual({ place: 0, inside: false });
  });

  it("places a place the edit took in at the edit's start", () => {
    expect(placeAfterEdit("the cat sat", "\n\ncat sat", 0)).toEqual({ place: 0, inside: true });
    expect(placeAfterEdit("a b c", "a c", 2)).toEqual({ place: 2, inside: true });
  });

  it("leaves every place where it was when the text is unchanged", () => {
    expect(placeAfterEdit("the cat", "the cat", 4)).toEqual({ place: 4, inside: false });
  });
});
