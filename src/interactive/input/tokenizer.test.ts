import { rowText, textForRow, tokenize, tokensToValues } from "./tokenizer";

const words = (text: string) => tokenize(text, "asTyped").map(t => t.kind === "word" ? t.text : "|");

describe("tokenize", () => {
  it("splits at whitespace and makes each of . , ? ! : ; a token", () => {
    expect(words("the cat, sat.\tOn  the\nmat? yes! a: b;")).toEqual(
      ["the", "cat", ",", "sat", ".", "On", "the", "mat", "?", "yes", "!", "a", ":", "b", ";"]);
  });

  it("drops the separators the plugin's text drops", () => {
    expect(words("a\"b(c)d{e}f_g+h=i|j\\k/l<m>n")).toEqual(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"]);
  });

  it("keeps a bracketed token whole, trimmed at its ends", () => {
    expect(words("say [No!] to [ ice cream ] now")).toEqual(["say", "No!", "to", "ice cream", "now"]);
  });

  it("drops a bracket with no partner on its line, or with another [ before its ]", () => {
    expect(words("[a [b] c]")).toEqual(["a", "b", "c"]);
    expect(words("[a\nb]")).toEqual(["a", "b"]);
    expect(words("a ] b [")).toEqual(["a", "b"]);
  });

  it("makes nothing of empty brackets", () => {
    expect(words("a [] b [  ] c")).toEqual(["a", "b", "c"]);
  });

  it("breaks the chain at a blank line, once for several, and not at the ends", () => {
    expect(words("a\nb")).toEqual(["a", "b"]);
    expect(words("a\n\nb")).toEqual(["a", "|", "b"]);
    expect(words("a \n \t\n b")).toEqual(["a", "|", "b"]);
    expect(words("a\n\n\n\n\nb\n\nc")).toEqual(["a", "|", "b", "|", "c"]);
    expect(words("\n\na b\n\n")).toEqual(["a", "b"]);
    expect(words("a\n\n\"\n\nb")).toEqual(["a", "|", "b"]);
  });

  it("keeps each token's place in the text, a bracketed token's brackets included", () => {
    expect(tokenize("The [No!]\n\ncat.", "asTyped")).toEqual([
      { kind: "word", text: "The", state: "The", start: 0, end: 3 },
      { kind: "word", text: "No!", state: "No!", start: 4, end: 9 },
      { kind: "break", start: 9, end: 11 },
      { kind: "word", text: "cat", state: "cat", start: 11, end: 14 },
      { kind: "word", text: ".", state: ".", start: 14, end: 15 },
    ]);
  });

  it("lowercases states, and only states, unless case sensitive", () => {
    const [lower] = tokenize("The", "lowercase");
    expect(lower).toMatchObject({ text: "The", state: "the" });
    const [typed] = tokenize("The", "asTyped");
    expect(typed).toMatchObject({ text: "The", state: "The" });
  });
});

describe("tokensToValues", () => {
  it("gives each word's state and an empty value for each break", () => {
    expect(tokensToValues(tokenize("The cat\n\nthe", "lowercase"))).toEqual(["the", "cat", "", "the"]);
  });
});

describe("rowText", () => {
  it("trims a row and removes its brackets", () => {
    expect(rowText("  [No!] ")).toBe("No!");
    expect(rowText(" [] ")).toBe("");
  });
});

describe("textForRow", () => {
  it("writes a row the tokenizer gives back as one word as it is", () => {
    expect(textForRow("cat")).toBe("cat");
    expect(textForRow(".")).toBe(".");
  });

  it("brackets a row the tokenizer would split or change", () => {
    expect(textForRow("No!")).toBe("[No!]");
    expect(textForRow("ice cream")).toBe("[ice cream]");
    expect(textForRow("a+b")).toBe("[a+b]");
    expect(textForRow("(cat)")).toBe("[(cat)]");
  });
});
