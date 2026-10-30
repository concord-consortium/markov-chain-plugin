import { textToWords, wordsToGraph } from "./text-to-graph";

const parse = (text: string) => wordsToGraph(textToWords(text));

describe("wordsToGraph", () => {
  it("treats words that are Object.prototype names as ordinary states", () => {
    const { nodes, edges } = parse("the constructor built the house");
    expect(nodes).toEqual([
      { id: "the", label: "the", value: 2 },
      { id: "constructor", label: "constructor", value: 1 },
      { id: "built", label: "built", value: 1 },
      { id: "house", label: "house", value: 1 },
    ]);
    expect(edges).toEqual([
      { from: "the", to: "constructor", value: 1 },
      { from: "constructor", to: "built", value: 1 },
      { from: "built", to: "the", value: 1 },
      { from: "the", to: "house", value: 1 },
    ]);
  });

  it("lists integer words first, in numeric order, then the rest in order of appearance", () => {
    expect(parse("go 10 then 2").nodes.map(n => n.id)).toEqual(["2", "10", "go", "then"]);
  });
});

describe("textToWords", () => {
  it("splits on any whitespace and keeps . , ? ! : ; as words", () => {
    expect(textToWords("one\ntwo\tthree  four")).toEqual(["one", "two", "three", "four"]);
    expect(textToWords("Hello,  World!\nHi:\tthere; ok? yes."))
      .toEqual(["hello", ",", "world", "!", "hi", ":", "there", ";", "ok", "?", "yes", "."]);
  });

  it("treats \" ( ) { } [ ] _ + = | \\ / < > as spaces", () => {
    expect(textToWords(`"a" (b) {c} [d] e_f g+h=i j|k l\\m n/o <p>`))
      .toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p"]);
  });

  it("keeps apostrophes and hyphens inside words and splits a decimal at its point", () => {
    expect(textToWords("don't well-known 3.5")).toEqual(["don't", "well-known", "3", ".", "5"]);
  });

  it("lowercases every letter, accented ones included", () => {
    expect(textToWords("The CAT École")).toEqual(["the", "cat", "école"]);
  });

  it("gives no words for empty or blank text", () => {
    expect(textToWords("")).toEqual([]);
    expect(textToWords("  \n\t ")).toEqual([]);
    expect(wordsToGraph(textToWords(" "))).toEqual({ nodes: [], edges: [] });
  });
});

describe("wordsToGraph self-loops", () => {
  it("counts a word repeated back to back as a self-loop", () => {
    expect(parse("a a a b").edges).toEqual([
      { from: "a", to: "a", value: 2 },
      { from: "a", to: "b", value: 1 },
    ]);
  });
});
