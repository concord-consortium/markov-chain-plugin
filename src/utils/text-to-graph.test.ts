import { textToWords, wordsToGraph } from "./text-to-graph";

const parse = (text: string) => wordsToGraph(textToWords(text));

describe("wordsToGraph", () => {
  it("treats words that are Object.prototype names as ordinary states", () => {
    const {nodes, edges} = parse("the constructor built the house");
    expect(nodes).toEqual([
      {id: "the", label: "the", value: 2},
      {id: "constructor", label: "constructor", value: 1},
      {id: "built", label: "built", value: 1},
      {id: "house", label: "house", value: 1},
    ]);
    expect(edges).toEqual([
      {from: "the", to: "constructor", value: 1},
      {from: "constructor", to: "built", value: 1},
      {from: "built", to: "the", value: 1},
      {from: "the", to: "house", value: 1},
    ]);
  });

  it("lists integer words first, in numeric order, then the rest in order of appearance", () => {
    expect(parse("go 10 then 2").nodes.map(n => n.id)).toEqual(["2", "10", "go", "then"]);
  });
});
