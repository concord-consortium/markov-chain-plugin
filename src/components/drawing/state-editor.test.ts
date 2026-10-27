import { applyStatePercentages } from "./state-editor";

describe("applyStatePercentages", () => {
  it("keeps the state's values when its percentages are unchanged", () => {
    const edges = [
      {from: "a", to: "b", value: 1}, {from: "a", to: "c", value: 1}, {from: "a", to: "d", value: 1}
    ];
    const third = 100 / 3;
    const result = applyStatePercentages(edges, "a", 3, [third, third, 100 - 2 * third]);
    expect(result).toHaveLength(3);
    result.forEach(edge => expect(edge.value).toBeCloseTo(1));
  });

  it("keeps the state's total, sets the new ratios and leaves other states' edges alone", () => {
    const other = {from: "b", to: "a", value: 7};
    const edges = [{from: "a", to: "b", value: 1}, other, {from: "a", to: "c", value: 3}];
    const result = applyStatePercentages(edges, "a", 4, [50, 50]);
    expect(result.map(e => e.value)).toEqual([2, 7, 2]);
    expect(result[1]).toBe(other);
  });

  it("gives each edge leaving the state its own percentage, in edge order", () => {
    const edges = [
      {from: "a", to: "b", value: 1}, {from: "b", to: "a", value: 7}, {from: "a", to: "c", value: 3}
    ];
    expect(applyStatePercentages(edges, "a", 4, [25, 75]).map(e => e.value)).toEqual([1, 7, 3]);
  });
});
