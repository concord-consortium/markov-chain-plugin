import { compareStateLabels } from "./app-utils";

const sortLabels = (labels: unknown[]) => labels.map(label => ({label})).sort(compareStateLabels).map(n => n.label);

describe("compareStateLabels", () => {
  it("sorts labels alphabetically, punctuation first", () => {
    expect(sortLabels(["zebra", "apple", "mango"])).toEqual(["apple", "mango", "zebra"]);
    expect(sortLabels(["i", "love", "class", "!"])).toEqual(["!", "class", "i", "love"]);
  });

  it("sorts numbers in labels numerically, and numeric labels without throwing", () => {
    expect(sortLabels(["State 10", "State 2"])).toEqual(["State 2", "State 10"]);
    expect(sortLabels([10, 2])).toEqual([2, 10]);
  });
});
