import { applyStatePercentages, movePairedPercentage } from "./state-editor";

describe("applyStatePercentages", () => {
  it("keeps the state's values when its percentages are unchanged", () => {
    const edges = [
      { from: "a", to: "b", value: 1 }, { from: "a", to: "c", value: 1 }, { from: "a", to: "d", value: 1 }
    ];
    const third = 100 / 3;
    const result = applyStatePercentages(edges, "a", 3, [third, third, 100 - 2 * third]);
    expect(result).toHaveLength(3);
    result.forEach(edge => expect(edge.value).toBeCloseTo(1));
  });

  it("keeps the state's total, sets the new ratios and leaves other states' edges alone", () => {
    const other = { from: "b", to: "a", value: 7 };
    const edges = [{ from: "a", to: "b", value: 1 }, other, { from: "a", to: "c", value: 3 }];
    const result = applyStatePercentages(edges, "a", 4, [50, 50]);
    expect(result.map(e => e.value)).toEqual([2, 7, 2]);
    expect(result[1]).toBe(other);
  });

  it("gives each edge leaving the state its own percentage, in edge order", () => {
    const edges = [
      { from: "a", to: "b", value: 1 }, { from: "b", to: "a", value: 7 }, { from: "a", to: "c", value: 3 }
    ];
    expect(applyStatePercentages(edges, "a", 4, [25, 75]).map(e => e.value)).toEqual([1, 7, 3]);
  });
});

describe("movePairedPercentage", () => {
  it("trades percentage between a thumb's share and the next, keeping the total", () => {
    expect(movePairedPercentage([50, 50], 0, 0.25)).toEqual([25, 75]);
    // the second thumb sits at 60% of the line, after the first share's 20%
    expect(movePairedPercentage([20, 30, 50], 1, 0.6)).toEqual([20, 40, 40]);
  });

  it("ignores a move past the next thumb, which would make a share negative", () => {
    expect(movePairedPercentage([20, 30, 50], 0, 0.6)).toBeUndefined();
  });

  it("gives a thumb moved back past the thumb before it a share of 0", () => {
    expect(movePairedPercentage([20, 30, 50], 1, 0.1)).toEqual([20, 0, 80]);
  });
});
